/**
 * TẦNG NGHIỆP VỤ – thống kê. `buildReport` là hàm THUẦN (nhận dữ liệu, trả báo cáo) nên test được
 * mà không cần DB; `StatsService` chỉ đọc dữ liệu rồi gọi hàm đó.
 * Chỉ tính đơn "đã thanh toán" vào doanh thu; đơn "đã hủy" chỉ dùng để tính tỉ lệ hủy.
 */
// Thêm số 0 phía trước cho đủ 2 chữ số.
const pad = (n) => String(n).padStart(2, "0");
// Đổi mốc thời gian thành khóa ngày "YYYY-MM-DD" để gom nhóm theo ngày.
const dayKey = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Mốc 00:00 của ngày chứa `timestamp`.
const startOfDay = (timestamp) => {
    const d = new Date(timestamp);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
// Tỉ lệ part/whole (trả 0 nếu whole bằng 0 để tránh chia cho 0).
const ratio = (part, whole) => (whole > 0 ? part / whole : 0);

// Các khung giờ trong ngày dùng để thống kê giờ khách hay đặt phòng.
const HOUR_BUCKETS = Object.freeze([
    { id: "sang", label: "Sáng (05–11h)", from: 5, to: 11 },
    { id: "chieu", label: "Chiều (12–17h)", from: 12, to: 17 },
    { id: "toi", label: "Tối (18–22h)", from: 18, to: 22 },
    { id: "dem", label: "Đêm (23–04h)", from: 23, to: 4 },
]);

// Cho biết một mốc thời gian rơi vào khung giờ nào (xử lý cả khung vắt qua nửa đêm).
const bucketOf = (timestamp) => {
    const hour = new Date(timestamp).getHours();
    return HOUR_BUCKETS.find(({ from, to }) => (from <= to ? hour >= from && hour <= to : hour >= from || hour <= to));
};

// Cộng dồn số phòng, số đơn, doanh thu vào mục `key` của bảng gom nhóm `map`.
const increment = (map, key, patch) => {
    const current = map.get(key) ?? { rooms: 0, bookings: 0, revenue: 0 };
    map.set(key, { rooms: current.rooms + patch.rooms, bookings: current.bookings + 1, revenue: current.revenue + patch.revenue });
};

/**
 * @param {{events: object[], seats: object[], bookings: object[], now?: number}} data
 */
/**
 * Hàm THUẦN dựng báo cáo thống kê: tổng quan, công suất theo đêm, doanh thu theo đêm/ngày đặt,
 * phòng bán chạy, khung giờ đặt nhiều và hạng phòng được chọn nhiều.
 */
export function buildReport({ events, seats, bookings, now = Date.now() }) {
    const seatById = new Map(seats.map((seat) => [seat.id, seat]));
    const eventById = new Map(events.map((event) => [event.id, event]));
    const paid = bookings.filter((b) => b.trang_thai === "da_thanh_toan");
    const cancelled = bookings.filter((b) => b.trang_thai === "da_huy");

    const byEvent = new Map();
    const byBookingDay = new Map();
    const byRoom = new Map();
    const byType = new Map();
    const byBucket = new Map(HOUR_BUCKETS.map((bucket) => [bucket.id, { rooms: 0, bookings: 0, revenue: 0 }]));

    paid.forEach((booking) => {
        const patch = { rooms: booking.danh_sach_ghe.length, revenue: booking.tong_tien };
        increment(byEvent, booking.event_id, patch);
        increment(byBookingDay, dayKey(booking.thoi_gian), patch);
        increment(byBucket, bucketOf(booking.thoi_gian).id, patch);

        booking.danh_sach_ghe.forEach((seatId) => {
            const seat = seatById.get(seatId);
            if (!seat) return;
            byRoom.set(seat.ma_phong, { hang_phong: seat.hang_phong, count: (byRoom.get(seat.ma_phong)?.count ?? 0) + 1 });
            const type = byType.get(seat.hang_phong) ?? { rooms: 0 };
            byType.set(seat.hang_phong, { rooms: type.rooms + 1 });
        });
    });

    const today = startOfDay(now);
    const seatsByEvent = new Map();
    seats.forEach((seat) => seatsByEvent.set(seat.event_id, [...(seatsByEvent.get(seat.event_id) ?? []), seat]));

    const occupancyByEvent = events
        .filter((event) => new Date(event.thoi_gian).getTime() >= today)
        .sort((a, b) => a.thoi_gian.localeCompare(b.thoi_gian))
        .map((event) => {
            const list = seatsByEvent.get(event.id) ?? [];
            const booked = list.filter((s) => s.trang_thai === "da_dat").length;
            const held = list.filter((s) => s.trang_thai === "dang_giu").length;
            return { eventId: event.id, ten: event.ten, total: list.length, booked, held, rate: ratio(booked, list.length) };
        });

    const allBooked = occupancyByEvent.reduce((sum, e) => sum + e.booked, 0);
    const allSeats = occupancyByEvent.reduce((sum, e) => sum + e.total, 0);
    const totalRevenue = paid.reduce((sum, b) => sum + b.tong_tien, 0);

    return {
        overview: {
            totalRevenue,
            paidCount: paid.length,
            cancelledCount: cancelled.length,
            roomsSold: paid.reduce((sum, b) => sum + b.danh_sach_ghe.length, 0),
            averageOrder: paid.length ? Math.round(totalRevenue / paid.length) : 0,
            cancelRate: ratio(cancelled.length, paid.length + cancelled.length),
            averageOccupancy: ratio(allBooked, allSeats),
        },
        occupancyByEvent,
        revenueByEvent: [...byEvent]
            .map(([eventId, value]) => ({ eventId, ten: eventById.get(eventId)?.ten ?? eventId, ...value }))
            .sort((a, b) => (eventById.get(a.eventId)?.thoi_gian ?? "").localeCompare(eventById.get(b.eventId)?.thoi_gian ?? "")),
        revenueByBookingDay: [...byBookingDay].map(([day, value]) => ({ day, ...value })).sort((a, b) => a.day.localeCompare(b.day)),
        topRooms: [...byRoom]
            .map(([ma_phong, value]) => ({ ma_phong, ...value }))
            .sort((a, b) => b.count - a.count || a.ma_phong.localeCompare(b.ma_phong)),
        byHourBucket: HOUR_BUCKETS.map((bucket) => ({ ...bucket, ...byBucket.get(bucket.id) })),
        byRoomType: [...byType].map(([hang_phong, value]) => ({ hang_phong, ...value })).sort((a, b) => b.rooms - a.rooms),
    };
}

// Dịch vụ thống kê: đọc dữ liệu từ CSDL rồi giao cho buildReport tính toán.
export class StatsService {
    #db;
    #now;

    /** Nhận CSDL và đồng hồ `now` (thay được khi test). */
    constructor(db, { now = Date.now } = {}) {
        this.#db = db;
        this.#now = now;
    }

    /** Đọc đêm, phòng, đơn từ CSDL và trả về báo cáo thống kê hoàn chỉnh. */
    async getReport() {
        const [events, seats, bookings] = await Promise.all([
            this.#db.find("events"), this.#db.find("seats"), this.#db.find("bookings"),
        ]);
        return buildReport({ events, seats, bookings, now: this.#now() });
    }
}
