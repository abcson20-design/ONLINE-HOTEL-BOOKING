/**
 * TẦNG NGHIỆP VỤ – dựng dữ liệu cho sơ đồ phòng.
 * Mỗi phòng có thêm trường `display` (trạng thái nhìn từ góc độ của MỘT người dùng):
 *   trong | cua_ban (mình đang giữ) | nguoi_khac (người khác đang giữ) | da_dat
 */
export const DISPLAY_STATUS = Object.freeze({
    EMPTY: "trong", MINE: "cua_ban", OTHERS: "nguoi_khac", BOOKED: "da_dat",
});

// Trả về mốc 00:00 của ngày chứa `timestamp` (để so sánh theo ngày).
const startOfDay = (timestamp) => {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

export class SeatMapService {
    #db;
    #now;

    /** Nhận CSDL và đồng hồ (`now` có thể thay khi test). */
    constructor(db, { now = Date.now } = {}) {
        this.#db = db;
        this.#now = now;
    }

    /** Các đêm từ hôm nay trở đi, sắp theo thời gian. */
    async listEvents() {
        const today = startOfDay(this.#now());
        const events = await this.#db.find("events", (event) => new Date(event.thoi_gian).getTime() >= today);
        return events.sort((a, b) => a.thoi_gian.localeCompare(b.thoi_gian));
    }

    /** Dựng sơ đồ phòng của một đêm: gắn lượt giữ và trạng thái hiển thị (`display`) theo góc nhìn của `userId`. */
    async getSeatMap(eventId, userId) {
        const seats = await this.#db.find("seats", (seat) => seat.event_id === eventId);
        const seatIds = new Set(seats.map((seat) => seat.id));
        const holds = await this.#db.find("holds", (hold) => seatIds.has(hold.seat_id));
        const holdBySeat = new Map(holds.map((hold) => [hold.seat_id, hold]));

        return seats
            .map((seat) => {
                const hold = holdBySeat.get(seat.id) ?? null;
                return { ...seat, hold, display: this.#displayStatus(seat, hold, userId) };
            })
            .sort((a, b) => a.ma_phong.localeCompare(b.ma_phong));
    }

    /** Đếm số phòng theo trạng thái (gộp "của bạn" vào "đang giữ"). */
    static summarize(seatMap) {
        const counts = { trong: 0, dang_giu: 0, da_dat: 0 };
        seatMap.forEach(({ trang_thai }) => { counts[trang_thai] += 1; });
        return counts;
    }

    /** Quy đổi trạng thái lưu trữ thành trạng thái hiển thị: đã đặt / của bạn / người khác giữ / trống. */
    #displayStatus(seat, hold, userId) {
        if (seat.trang_thai === "da_dat") return DISPLAY_STATUS.BOOKED;
        if (seat.trang_thai === "dang_giu") return hold?.user_id === userId ? DISPLAY_STATUS.MINE : DISPLAY_STATUS.OTHERS;
        return DISPLAY_STATUS.EMPTY;
    }
}
