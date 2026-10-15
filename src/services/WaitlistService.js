/**
 * TẦNG NGHIỆP VỤ – hàng đợi (waitlist).
 *
 * Khi một đêm KHÔNG ĐỦ phòng trống, khách vào hàng đợi. Mỗi khi có phòng được nhả
 * (hết hạn TTL hoặc người khác bỏ giữ), dịch vụ xử lý hàng đợi THEO THỨ TỰ VÀO HÀNG (FIFO):
 * người đầu hàng được TỰ ĐỘNG GIỮ PHÒNG (hold + TTL như bình thường) rồi được thông báo.
 * Nếu người đó không thanh toán kịp, phòng lại được nhả và chuyển cho người kế tiếp.
 *
 * Quy tắc công bằng: nếu người đầu hàng cần 2 phòng mà mới nhả 1 phòng, CẢ HÀNG CHỜ tiếp
 * (không cho người sau chen ngang) – tránh chuyện người cần ít phòng luôn được ưu tiên hơn.
 */
import { KeyedMutex } from "../utils/KeyedMutex.js";
import { EventBus } from "../utils/EventBus.js";
import { MAX_SEATS_PER_HOLD, SEAT_STATUS } from "./HoldService.js";
import { ValidationError, NotFoundError, AlreadyWaitingError, SeatsAvailableError } from "./errors.js";

// Trạng thái một mục trong hàng đợi: đang chờ / đã được thông báo (đã giữ phòng hộ).
const WAIT_STATUS = Object.freeze({ WAITING: "cho", OFFERED: "da_thong_bao" });
// Giá trị "không chọn hạng phòng" – chấp nhận phòng nào cũng được.
const ANY_ROOM_TYPE = "bat_ky";
// Số lần thử giữ phòng lại cho người đầu hàng nếu bị người khác giành mất.
const MAX_OFFER_ATTEMPTS = 3;

export class WaitlistService {
    #db;
    #holdService;
    #now;
    #mutex = new KeyedMutex();
    #pending = new Set();
    #unsubscribe = null;

    /** Sự kiện: "waitlist-joined", "waitlist-offered" {entry, seatIds, userId, expiresAt}, "waitlist-changed" {eventId}, "error". */
    events = new EventBus();

    /** Nhận CSDL và HoldService (để tự giữ phòng cho người đầu hàng). */
    constructor(db, holdService, { now = Date.now } = {}) {
        this.#db = db;
        this.#holdService = holdService;
        this.#now = now;
    }

    /** Bắt đầu lắng nghe việc nhả phòng. */
    start() {
        this.#unsubscribe ??= this.#holdService.events.on("seat-released", ({ seatId }) => {
            const task = this.#processSeat(seatId)
                .catch((error) => this.events.emit("error", error))
                .finally(() => this.#pending.delete(task));
            this.#pending.add(task);
        });
        return this;
    }

    /** Ngừng lắng nghe sự kiện nhả phòng (dùng khi tắt app / kết thúc test). */
    dispose() {
        this.#unsubscribe?.();
        this.#unsubscribe = null;
    }

    /** Chờ xử lý xong mọi lần nhả phòng đang dở (dùng trong test cho kết quả xác định). */
    async whenIdle() {
        while (this.#pending.size > 0) await Promise.all([...this.#pending]);
    }

    // ---------- Thao tác của khách ----------

    /**
     * @param {string} userId
     * @param {string} eventId
     * @param {number} roomCount số phòng cần (1..MAX_SEATS_PER_HOLD)
     * @returns {Promise<object>} bản ghi hàng đợi kèm `position` (1 = đầu hàng)
     * @throws {ValidationError|NotFoundError|AlreadyWaitingError|SeatsAvailableError}
     */
    async join(userId, eventId, roomCount, { roomType = ANY_ROOM_TYPE } = {}) {
        if (typeof userId !== "string" || userId.trim() === "") throw new ValidationError("Thiếu mã người dùng");
        if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > MAX_SEATS_PER_HOLD) {
            throw new ValidationError(`Số phòng phải từ 1 đến ${MAX_SEATS_PER_HOLD}`);
        }

        return this.#mutex.runExclusive([this.#lockKey(eventId)], async () => {
            if (!(await this.#db.findById("events", eventId))) throw new NotFoundError("đêm lưu trú", eventId);

            const queue = await this.#waitingQueue(eventId);
            if (queue.some((entry) => entry.user_id === userId)) throw new AlreadyWaitingError();

            const emptySeats = await this.#emptySeats(eventId, roomType);
            if (emptySeats.length >= roomCount) throw new SeatsAvailableError(emptySeats.length);

            const entry = await this.#db.insert("waitlist", {
                event_id: eventId, user_id: userId, so_luong_ghe: roomCount, hang_phong: roomType,
                thoi_gian_vao_hang: this.#now(), trang_thai: WAIT_STATUS.WAITING,
            });
            this.events.emit("waitlist-joined", entry);
            this.events.emit("waitlist-changed", { eventId });
            return { ...entry, position: queue.length + 1 };
        });
    }

    /** Rời hàng đợi. Trả về true nếu có mục bị xóa. */
    async leave(userId, eventId) {
        return this.#mutex.runExclusive([this.#lockKey(eventId)], async () => {
            const mine = (await this.#waitingQueue(eventId)).filter((entry) => entry.user_id === userId);
            await Promise.all(mine.map((entry) => this.#db.remove("waitlist", entry.id)));
            if (mine.length > 0) this.events.emit("waitlist-changed", { eventId });
            return mine.length > 0;
        });
    }

    /** Vị trí hiện tại của khách trong hàng đợi (1 = đầu hàng) hoặc null nếu không xếp hàng. */
    async getStatus(userId, eventId) {
        const queue = await this.#waitingQueue(eventId);
        const index = queue.findIndex((entry) => entry.user_id === userId);
        return index === -1 ? { waiting: false, position: null, entry: null } : { waiting: true, position: index + 1, entry: queue[index] };
    }

    // Danh sách người đang chờ của một đêm, theo thứ tự vào hàng.
    listQueue(eventId) { return this.#waitingQueue(eventId); }

    // ---------- Nội bộ ----------

    // Khóa riêng cho hàng đợi của từng đêm để các thao tác không chạy chồng nhau.
    #lockKey(eventId) { return `waitlist:${eventId}`; }

    /** Hàng đợi theo thứ tự vào hàng; bằng thời gian thì giữ thứ tự chèn (sort của JS ổn định). */
    async #waitingQueue(eventId) {
        const entries = await this.#db.find("waitlist", (e) => e.event_id === eventId && e.trang_thai === WAIT_STATUS.WAITING);
        return entries.sort((a, b) => a.thoi_gian_vao_hang - b.thoi_gian_vao_hang);
    }

    /** Lấy các phòng đang trống của một đêm (lọc theo hạng phòng nếu có), sắp theo mã phòng. */
    async #emptySeats(eventId, roomType) {
        const seats = await this.#db.find("seats", (seat) =>
            seat.event_id === eventId && seat.trang_thai === SEAT_STATUS.EMPTY
            && (roomType === ANY_ROOM_TYPE || seat.hang_phong === roomType));
        return seats.sort((a, b) => a.ma_phong.localeCompare(b.ma_phong));
    }

    /** Khi một phòng được nhả: tìm đêm của phòng đó rồi phục vụ hàng đợi của đêm ấy. */
    async #processSeat(seatId) {
        const seat = await this.#db.findById("seats", seatId);
        if (seat) await this.#processEvent(seat.event_id);
    }

    /** Phục vụ hàng đợi của một đêm cho tới khi hết phòng hoặc hết người. */
    async #processEvent(eventId) {
        await this.#mutex.runExclusive([this.#lockKey(eventId)], async () => {
            for (;;) {
                const [head] = await this.#waitingQueue(eventId);
                if (!head) return;

                const emptySeats = await this.#emptySeats(eventId, head.hang_phong);
                if (emptySeats.length < head.so_luong_ghe) return; // đầu hàng chưa đủ phòng -> cả hàng chờ tiếp

                if (!(await this.#offerTo(head, emptySeats))) return;
            }
        });
    }

    /** Giữ phòng cho người đầu hàng. Trả về false nếu không giữ được (vd. bị người khác giành mất). */
    async #offerTo(entry, emptySeats) {
        const seatIds = emptySeats.slice(0, entry.so_luong_ghe).map((seat) => seat.id);

        for (let attempt = 0; attempt < MAX_OFFER_ATTEMPTS; attempt += 1) {
            try {
                const holds = await this.#holdService.holdSeats(entry.user_id, seatIds);
                await this.#db.update("waitlist", entry.id, {
                    trang_thai: WAIT_STATUS.OFFERED, ghe_da_giu: seatIds, thoi_gian_thong_bao: this.#now(),
                });
                this.events.emit("waitlist-offered", {
                    entry, seatIds, userId: entry.user_id, expiresAt: holds[0].het_han_luc,
                });
                this.events.emit("waitlist-changed", { eventId: entry.event_id });
                return true;
            } catch (error) {
                if (error.code !== "SEAT_UNAVAILABLE") throw error;
                // Có phòng vừa bị người khác giữ mất -> tìm lại phòng trống rồi thử tiếp
                const fresh = await this.#emptySeats(entry.event_id, entry.hang_phong);
                if (fresh.length < entry.so_luong_ghe) return false;
                seatIds.splice(0, seatIds.length, ...fresh.slice(0, entry.so_luong_ghe).map((seat) => seat.id));
            }
        }
        return false;
    }
}
