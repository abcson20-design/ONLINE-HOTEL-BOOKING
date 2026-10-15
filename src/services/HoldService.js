/**
 * TẦNG NGHIỆP VỤ – giữ phòng tạm thời (hold + TTL) và chống đặt trùng.
 * Không đụng tới DOM: có thể chạy và kiểm thử ngay trong Node.
 *
 * Trạng thái phòng:  trong  --holdSeats-->  dang_giu  --confirmHolds-->  da_dat
 *                      ^                        |
 *                      +---- releaseHolds / hết hạn TTL (timer) ----+
 */
import { KeyedMutex } from "../utils/KeyedMutex.js";
import { EventBus } from "../utils/EventBus.js";
import {
    ValidationError, NotFoundError, SeatUnavailableError, HoldExpiredError, NotOwnerError,
} from "./errors.js";

export const SEAT_STATUS = Object.freeze({ EMPTY: "trong", HELD: "dang_giu", BOOKED: "da_dat" });
export const DEFAULT_HOLD_TTL_MS = 10 * 60 * 1000; // 10 phút
export const MAX_SEATS_PER_HOLD = 6;

export class HoldService {
    #db;
    #ttlMs;
    #now;
    #mutex = new KeyedMutex();
    #timers = new Map(); // holdId -> timer đang chờ hết hạn

    /** Phát các sự kiện: "seats-held", "seat-released" {seatId, reason}, "seats-confirmed", "error". */
    events = new EventBus();

    /** Nhận CSDL, thời gian giữ mặc định `ttlMs` và đồng hồ `now` (thay được khi test). */
    constructor(db, { ttlMs = DEFAULT_HOLD_TTL_MS, now = Date.now } = {}) {
        this.#db = db;
        this.#ttlMs = ttlMs;
        this.#now = now;
    }

    // Thời gian giữ phòng hiện tại (ms).
    get ttlMs() { return this.#ttlMs; }

    /** Đổi thời gian giữ cho CÁC LƯỢT GIỮ MỚI (lượt đang giữ vẫn theo hạn cũ). */
    setTtlMs(ttlMs) {
        if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new ValidationError("Thời gian giữ phải là số dương");
        this.#ttlMs = ttlMs;
    }

    // ---------- Giữ phòng ----------

    /**
     * Giữ đồng thời nhiều phòng cho một người – hoặc giữ được TẤT CẢ, hoặc không giữ phòng nào.
     * @param {string} userId
     * @param {string[]} seatIds
     * @returns {Promise<object[]>} danh sách bản ghi hold
     * @throws {ValidationError|NotFoundError|SeatUnavailableError}
     */
    async holdSeats(userId, seatIds) {
        this.#validateHoldInput(userId, seatIds);

        // Khóa TẤT CẢ phòng cần giữ, rồi mới "kiểm tra trống + ghi đang giữ" như một khối.
        return this.#mutex.runExclusive(seatIds, async () => {
            const seats = await Promise.all(seatIds.map((id) => this.#db.findById("seats", id)));

            seats.forEach((seat, index) => {
                if (!seat) throw new NotFoundError("phòng", seatIds[index]);
                if (seat.trang_thai !== SEAT_STATUS.EMPTY) throw new SeatUnavailableError(seat.id, seat.trang_thai);
            });

            const heldAt = this.#now();
            const expiresAt = heldAt + this.#ttlMs;
            const holds = [];

            try {
                for (const seat of seats) {
                    await this.#db.update("seats", seat.id, { trang_thai: SEAT_STATUS.HELD });
                    const hold = await this.#db.insert("holds", {
                        seat_id: seat.id, user_id: userId, thoi_diem_giu: heldAt, het_han_luc: expiresAt,
                    });
                    holds.push(hold);
                    this.#scheduleExpiry(hold);
                }
            } catch (error) {
                await this.#rollback(seats, holds); // lỗi giữa chừng -> hoàn tác để không "kẹt" phòng
                throw error;
            }

            this.events.emit("seats-held", { userId, holds });
            return holds;
        });
    }

    /** Người dùng chủ động bỏ giữ phòng. Chỉ chủ hold mới được bỏ. */
    async releaseHolds(userId, seatIds) {
        return this.#mutex.runExclusive(seatIds, async () => {
            for (const seatId of seatIds) {
                const hold = await this.#findHoldBySeat(seatId);
                if (!hold) continue; // không còn ai giữ -> coi như đã nhả
                if (hold.user_id !== userId) throw new NotOwnerError(seatId, userId);
                await this.#freeSeat(hold, "nguoi_dung_bo");
            }
        });
    }

    // ---------- Xác nhận (dùng ở bước thanh toán thành công) ----------

    /**
     * Chuyển các phòng đang giữ thành "đã đặt". Phải là chủ hold và hold còn hạn.
     * @throws {HoldExpiredError|NotOwnerError}
     */
    async confirmHolds(userId, seatIds) {
        return this.#mutex.runExclusive(seatIds, async () => {
            const holds = [];
            for (const seatId of seatIds) {
                const hold = await this.#findHoldBySeat(seatId);
                if (!hold) throw new HoldExpiredError(seatId);
                if (hold.user_id !== userId) throw new NotOwnerError(seatId, userId);
                holds.push(hold);
            }

            const expired = holds.filter((hold) => hold.het_han_luc <= this.#now());
            if (expired.length > 0) {
                for (const hold of expired) await this.#freeSeat(hold, "het_han");
                throw new HoldExpiredError(expired[0].seat_id);
            }

            for (const hold of holds) {
                this.#clearTimer(hold.id);
                await this.#db.remove("holds", hold.id);
                await this.#db.update("seats", hold.seat_id, { trang_thai: SEAT_STATUS.BOOKED });
            }
            this.events.emit("seats-confirmed", { userId, seatIds });
        });
    }

    // ---------- Truy vấn ----------

    // Lấy mọi lượt giữ của một người dùng.
    getHoldsOfUser(userId) { return this.#db.find("holds", (hold) => hold.user_id === userId); }
    // Lấy các lượt giữ của một phòng (bình thường tối đa 1).
    getHoldsBySeat(seatId) { return this.#db.find("holds", (hold) => hold.seat_id === seatId); }

    /** Số ms còn lại của một hold (dùng cho đồng hồ đếm ngược); 0 nếu đã hết hạn/không tồn tại. */
    async getRemainingMs(holdId) {
        const hold = await this.#db.findById("holds", holdId);
        return hold ? Math.max(0, hold.het_han_luc - this.#now()) : 0;
    }

    // ---------- Vòng đời timer ----------

    /** Gọi khi khởi động lại app: dựng lại timer cho hold đã lưu (hold quá hạn sẽ được nhả ngay). */
    async restoreTimers() {
        const holds = await this.#db.find("holds");
        holds.forEach((hold) => this.#scheduleExpiry(hold));
    }

    /** Hủy toàn bộ timer (dùng khi tắt app / kết thúc test). */
    dispose() {
        this.#timers.forEach((timer) => clearTimeout(timer));
        this.#timers.clear();
    }

    // ---------- Nội bộ ----------

    /** Kiểm tra đầu vào giữ phòng: có mã người dùng, 1–6 phòng, không trùng. */
    #validateHoldInput(userId, seatIds) {
        if (typeof userId !== "string" || userId.trim() === "") {
            throw new ValidationError("Thiếu mã người dùng");
        }
        if (!Array.isArray(seatIds) || seatIds.length === 0) {
            throw new ValidationError("Phải chọn ít nhất 1 phòng");
        }
        if (seatIds.length > MAX_SEATS_PER_HOLD) {
            throw new ValidationError(`Mỗi lần chỉ giữ tối đa ${MAX_SEATS_PER_HOLD} phòng`);
        }
        if (new Set(seatIds).size !== seatIds.length) {
            throw new ValidationError("Danh sách phòng bị trùng lặp");
        }
    }

    /** Tìm lượt giữ đang có của một phòng (null nếu không có). */
    async #findHoldBySeat(seatId) {
        const [hold] = await this.#db.find("holds", (item) => item.seat_id === seatId);
        return hold ?? null;
    }

    /** Hẹn giờ tự nhả phòng khi lượt giữ hết hạn. */
    #scheduleExpiry(hold) {
        this.#clearTimer(hold.id);
        const delay = Math.max(0, hold.het_han_luc - this.#now());
        const timer = setTimeout(() => {
            this.#handleExpiry(hold.id, hold.seat_id).catch((error) => this.events.emit("error", error));
        }, delay);
        timer.unref?.(); // trong Node: timer không giữ tiến trình sống mãi
        this.#timers.set(hold.id, timer);
    }

    /** Hủy timer hết hạn của một lượt giữ. */
    #clearTimer(holdId) {
        clearTimeout(this.#timers.get(holdId));
        this.#timers.delete(holdId);
    }

    /** Chạy khi timer nổ. Cũng phải xin khóa để không đụng độ với confirmHolds/releaseHolds. */
    async #handleExpiry(holdId, seatId) {
        await this.#mutex.runExclusive([seatId], async () => {
            const hold = await this.#db.findById("holds", holdId);
            if (!hold) return; // đã thanh toán hoặc đã nhả trước khi timer nổ

            // setTimeout có thể nổ sớm ~1ms so với Date.now -> chưa hết hạn thì hẹn lại.
            if (hold.het_han_luc > this.#now()) {
                this.#scheduleExpiry(hold);
                return;
            }
            await this.#freeSeat(hold, "het_han");
        });
    }

    /** Nhả phòng: xóa lượt giữ, đưa phòng về "trống" và phát sự kiện "seat-released" kèm lý do. */
    async #freeSeat(hold, reason) {
        this.#clearTimer(hold.id);
        await this.#db.remove("holds", hold.id);
        await this.#db.update("seats", hold.seat_id, { trang_thai: SEAT_STATUS.EMPTY });
        this.events.emit("seat-released", { seatId: hold.seat_id, userId: hold.user_id, reason });
    }

    /** Hoàn tác khi giữ phòng lỗi giữa chừng: xóa các lượt giữ đã tạo và trả phòng về "trống". */
    async #rollback(seats, holds) {
        holds.forEach((hold) => this.#clearTimer(hold.id));
        await Promise.all(holds.map((hold) => this.#db.remove("holds", hold.id)));
        await Promise.all(seats.map((seat) => this.#db.update("seats", seat.id, { trang_thai: SEAT_STATUS.EMPTY })));
    }
}
