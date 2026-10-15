/**
 * Dữ liệu mẫu để trang Thống kê có số liệu khi trình diễn (các đơn được gắn cờ demo:true nên xóa sạch được).
 * Đơn mẫu đi qua PricingService như đơn thật nên giá gồm cả phụ thu cuối tuần/lễ, combo.
 */
// Các giờ đặt phòng mẫu (nghiêng về buổi tối cho giống thực tế).
const HOURS = [8, 9, 10, 11, 14, 15, 16, 19, 20, 20, 21, 21, 22, 23, 0, 1]; // nghiêng về buổi tối như thực tế
// Các lựa chọn combo ngẫu nhiên cho đơn mẫu.
const COMBO_POOL = [[], [], [], ["an_sang"], ["an_sang", "spa"], ["dua_don"]];
// Chọn ngẫu nhiên một phần tử trong danh sách.
const pick = (list, random) => list[Math.floor(random() * list.length)];

/** Tạo `count` đơn mẫu (gắn cờ demo) trên các phòng trống để trang Thống kê có số liệu; trả về số đơn đã tạo. */
export async function addDemoBookings(db, pricingService, { count = 40, now = Date.now(), random = Math.random } = {}) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const events = await db.find("events", (event) => new Date(event.thoi_gian).getTime() >= today.getTime());
    const seats = await db.find("seats", (seat) => seat.trang_thai === "trong");
    if (events.length === 0) return 0;

    const freeByEvent = new Map();
    seats.forEach((seat) => freeByEvent.set(seat.event_id, [...(freeByEvent.get(seat.event_id) ?? []), seat]));

    const writes = [];
    let created = 0;
    for (let i = 0; i < count; i += 1) {
        const event = pick(events, random);
        const free = freeByEvent.get(event.id) ?? [];
        if (free.length === 0) continue;

        const chosen = [];
        for (let k = 0, want = 1 + Math.floor(random() * 3); k < want && free.length > 0; k += 1) {
            chosen.push(free.splice(Math.floor(random() * free.length), 1)[0]);
        }

        const placedAt = new Date(now - Math.floor(random() * 14) * 86_400_000);
        placedAt.setHours(pick(HOURS, random), Math.floor(random() * 60), 0, 0);
        const cancelled = random() < 0.1;
        const quote = pricingService.quote({ seats: chosen, date: event.thoi_gian, comboIds: pick(COMBO_POOL, random) });

        writes.push(db.insert("bookings", {
            demo: true, user_id: `demo-user-${1 + Math.floor(random() * 20)}`, event_id: event.id,
            danh_sach_ghe: chosen.map((seat) => seat.id), tong_tien: quote.total, bang_gia: quote,
            trang_thai: cancelled ? "da_huy" : "da_thanh_toan",
            ...(cancelled ? { ly_do_huy: "thanh_toan_that_bai", da_hoan_tien: false } : {}),
            thoi_gian: placedAt.getTime(), khach: { ten: "Khách mẫu", sdt: "0900000000", email: "demo@example.com" },
        }));
        if (!cancelled) chosen.forEach((seat) => writes.push(db.update("seats", seat.id, { trang_thai: "da_dat" })));
        created += 1;
    }
    await Promise.all(writes);
    return created;
}

/** Xóa toàn bộ đơn mẫu và trả các phòng đã đặt về trống. */
export async function clearDemoBookings(db) {
    const demo = await db.find("bookings", (booking) => booking.demo === true);
    await Promise.all(demo.flatMap((booking) => [
        db.remove("bookings", booking.id),
        ...(booking.trang_thai === "da_thanh_toan"
            ? booking.danh_sach_ghe.map((seatId) => db.update("seats", seatId, { trang_thai: "trong" })) : []),
    ]));
    return demo.length;
}
