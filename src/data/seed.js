/**
 * Dữ liệu mẫu: mỗi ĐÊM LƯU TRÚ là một "event" (suất), mỗi PHÒNG trong đêm đó là một "seat" (ghế).
 * => phòng 101 đêm 10/10 và phòng 101 đêm 11/10 là hai "ghế" độc lập.
 *
 * Khách sạn: 3 tầng x 12 phòng = 36 phòng/đêm (khớp trang giới thiệu).
 *   phòng 1–5: đơn | 6–10: đôi | 11–12: VIP
 */
// Ba hạng phòng: tên hiển thị và giá gốc mỗi đêm (VND).
export const ROOM_TYPES = Object.freeze({
    don: { label: "Phòng đơn", basePrice: 500_000 },
    doi: { label: "Phòng đôi", basePrice: 800_000 },
    vip: { label: "Phòng VIP", basePrice: 1_500_000 },
});

// Số tầng và số phòng mỗi tầng của khách sạn.
const FLOORS = 3;
const ROOMS_PER_FLOOR = 12;

// Thêm số 0 phía trước cho đủ 2 chữ số.
const pad = (n) => String(n).padStart(2, "0");
// Đổi ngày thành chuỗi "YYYY-MM-DD" dùng làm mã đêm.
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Suy ra hạng phòng từ số thứ tự phòng trong tầng (1–5 đơn, 6–10 đôi, 11–12 VIP).
const roomTypeOf = (roomIndex) => {
    if (roomIndex <= 5) return "don";
    if (roomIndex <= 10) return "doi";
    return "vip";
};

/** Tạo danh sách các đêm lưu trú (mặc định 30 đêm tính từ hôm nay). */
function buildEvents({ startDate = new Date(), nights = 30 } = {}) {
    return Array.from({ length: nights }, (_, offset) => {
        const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + offset);
        return {
            id: `evt-${toDateKey(date)}`,
            ten: `Đêm ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
            thoi_gian: date.toISOString(),
            loai: "khach_san",
            so_do_phong: { tang: FLOORS, phong_moi_tang: ROOMS_PER_FLOOR },
        };
    });
}

/** Tạo toàn bộ phòng cho mỗi đêm (3 tầng x 12 phòng), ban đầu đều "trống". */
function buildSeats(events) {
    return events.flatMap((event) =>
        Array.from({ length: FLOORS * ROOMS_PER_FLOOR }, (_, i) => {
            const floor = Math.floor(i / ROOMS_PER_FLOOR) + 1;
            const roomIndex = (i % ROOMS_PER_FLOOR) + 1;
            const maPhong = String(floor * 100 + roomIndex);
            const hang = roomTypeOf(roomIndex);
            return {
                id: `${event.id}-${maPhong}`,
                event_id: event.id,
                ma_phong: maPhong,
                hang_phong: hang,
                trang_thai: "trong",
                gia: ROOM_TYPES[hang].basePrice,
            };
        }),
    );
}

/** Nạp dữ liệu mẫu (đêm + phòng) vào CSDL; chỉ thêm các bản ghi chưa có nên chạy lại vẫn an toàn. */
export function seedDatabase(db, options) {
    const events = buildEvents(options);
    db.seed("events", events);
    db.seed("seats", buildSeats(events));
    return db;
}
