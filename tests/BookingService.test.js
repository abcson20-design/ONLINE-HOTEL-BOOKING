import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { Database } from "../src/data/Database.js";
import { seedDatabase } from "../src/data/seed.js";
import { HoldService } from "../src/services/HoldService.js";
import { BookingService, BOOKING_STATUS, validateCustomer } from "../src/services/BookingService.js";
import { PaymentGateway } from "../src/services/PaymentGateway.js";
import { SeatMapService, DISPLAY_STATUS } from "../src/services/SeatMapService.js";
import { PricingService } from "../src/services/PricingService.js";

// Thông tin khách mẫu hợp lệ dùng chung cho các test.
const customer = { ten: "Nguyễn Văn An", sdt: "0912345678", email: "an@example.com" };

let db; let holdService; let bookingService; let seatMapService; let room;

// Dựng môi trường mới cho mỗi test: CSDL mẫu + giữ phòng + đặt phòng (giá trung tính) và hàm `room(mã)` đổi mã phòng thành id.
const setup = async ({ ttlMs = 5000, paymentDelayMs = 0 } = {}) => {
    db = seedDatabase(new Database());
    holdService = new HoldService(db, { ttlMs });
    // bảng giá trung tính: tổng tiền không phụ thuộc hôm nay là thứ mấy
    const pricingService = new PricingService({ weekendRate: 0, holidayRate: 0 });
    bookingService = new BookingService(db, holdService, new PaymentGateway({ delayMs: paymentDelayMs }), { pricingService });
    seatMapService = new SeatMapService(db);
    const [event] = await seatMapService.listEvents();
    room = (code) => `${event.id}-${code}`;
};
// Đọc trạng thái hiện tại của một phòng trong CSDL.
const statusOf = async (id) => (await db.findById("seats", id)).trang_thai;

afterEach(() => holdService?.dispose());

describe("validateCustomer (ca biên)", () => {
    it("chấp nhận dữ liệu hợp lệ và chuẩn hóa khoảng trắng", () => {
        assert.deepEqual(
            validateCustomer({ ten: "  An  ", sdt: "0912 345 678", email: " a@b.co " }),
            { ten: "An", sdt: "0912345678", email: "a@b.co" },
        );
    });

    it("báo đúng ô nhập sai", () => {
        assert.throws(() => validateCustomer({ ...customer, ten: "A" }), (e) => e.details.field === "ten");
        assert.throws(() => validateCustomer({ ...customer, sdt: "123" }), (e) => e.details.field === "sdt");
        assert.throws(() => validateCustomer({ ...customer, email: "abc" }), (e) => e.details.field === "email");
        assert.throws(() => validateCustomer(), (e) => e.details.field === "ten");
    });
});

describe("Quy trình đặt phòng", () => {
    beforeEach(() => setup());

    it("thành công: booking da_thanh_toan, phòng da_dat, tổng tiền đúng", async () => {
        await holdService.holdSeats("an", [room(101), room(111)]); // đơn 500k + VIP 1.5tr
        const booking = await bookingService.checkout("an", [room(101), room(111)], customer);

        assert.equal(booking.trang_thai, BOOKING_STATUS.PAID);
        assert.equal(booking.tong_tien, 2_000_000);
        assert.equal(await statusOf(room(101)), "da_dat");
        assert.equal(await statusOf(room(111)), "da_dat");
        assert.equal((await bookingService.getBookingsOfUser("an")).length, 1);
    });

    it("chưa giữ phòng mà đặt -> HOLD_EXPIRED, không tạo booking", async () => {
        await assert.rejects(bookingService.checkout("an", [room(101)], customer), { code: "HOLD_EXPIRED" });
        assert.equal((await db.find("bookings")).length, 0);
    });

    it("đặt phòng do người khác giữ -> NOT_OWNER", async () => {
        await holdService.holdSeats("binh", [room(101)]);
        await assert.rejects(bookingService.checkout("an", [room(101)], customer), { code: "NOT_OWNER" });
    });

    it("thông tin khách sai -> VALIDATION, phòng vẫn được giữ", async () => {
        await holdService.holdSeats("an", [room(101)]);
        await assert.rejects(bookingService.checkout("an", [room(101)], { ...customer, sdt: "1" }), { code: "VALIDATION" });
        assert.equal(await statusOf(room(101)), "dang_giu");
    });

    it("không đặt danh sách rỗng hoặc phòng khác đêm", async () => {
        await assert.rejects(bookingService.checkout("an", [], customer), { code: "VALIDATION" });

        const [first, second] = await seatMapService.listEvents();
        const otherNight = `${second.id}-101`;
        await holdService.holdSeats("an", [`${first.id}-101`, otherNight]);
        await assert.rejects(bookingService.checkout("an", [`${first.id}-101`, otherNight], customer), { code: "VALIDATION" });
    });

    it("thanh toán thất bại: đơn da_huy, phòng VẪN được giữ để thử lại", async () => {
        await holdService.holdSeats("an", [room(101)]);
        await assert.rejects(
            bookingService.checkout("an", [room(101)], customer, { simulateFailure: true }),
            { code: "PAYMENT_FAILED" },
        );
        const [booking] = await bookingService.getBookingsOfUser("an");
        assert.equal(booking.trang_thai, BOOKING_STATUS.CANCELLED);
        assert.equal(booking.da_hoan_tien, false);
        assert.equal(await statusOf(room(101)), "dang_giu");

        const retry = await bookingService.checkout("an", [room(101)], customer); // thử lại thành công
        assert.equal(retry.trang_thai, BOOKING_STATUS.PAID);
    });

    it("chống bấm hai lần: lần thứ hai khi đang xử lý -> ALREADY_PROCESSING", async () => {
        await setup({ paymentDelayMs: 50 });
        await holdService.holdSeats("an", [room(101)]);
        const first = bookingService.checkout("an", [room(101)], customer);
        await assert.rejects(bookingService.checkout("an", [room(101)], customer), { code: "ALREADY_PROCESSING" });
        assert.equal((await first).trang_thai, BOOKING_STATUS.PAID);
        assert.equal((await db.find("bookings")).length, 1);
    });
});

describe("Tính giá khi đặt phòng", () => {
    it("đêm cuối tuần + combo + mã giảm giá: service tự tính, lưu bảng giá vào đơn", async () => {
        await setup();
        // dùng bảng giá THẬT và tìm một đêm thứ Sáu trong 30 đêm
        const realPricing = new PricingService();
        bookingService = new BookingService(db, holdService, new PaymentGateway({ delayMs: 0 }), { pricingService: realPricing });
        const friday = (await db.find("events")).find((e) => new Date(e.thoi_gian).getDay() === 5);
        const seatId = `${friday.id}-106`; // phòng đôi 800.000₫

        await holdService.holdSeats("an", [seatId]);
        const booking = await bookingService.checkout("an", [seatId], customer, { comboIds: ["an_sang"], couponCode: "welcome10" });

        // 800k x 1,2 = 960k, + ăn sáng 120k = 1.080k, giảm 10% = 108k
        assert.equal(booking.tong_tien, 972_000);
        assert.equal(booking.bang_gia.surcharge, 160_000);
        assert.equal(booking.bang_gia.coupon.code, "WELCOME10");
    });

    it("mã giảm giá sai -> VALIDATION, chưa tạo đơn, phòng vẫn được giữ", async () => {
        await setup();
        await holdService.holdSeats("an", [room(101)]);
        await assert.rejects(bookingService.checkout("an", [room(101)], customer, { couponCode: "FAKE" }), { code: "VALIDATION" });
        assert.equal((await db.find("bookings")).length, 0);
        assert.equal(await statusOf(room(101)), "dang_giu");
    });
});

describe("Hết hạn giữ phòng GIỮA LÚC thanh toán", () => {
    it("hủy đơn, hoàn tiền, phòng được nhả cho người khác", async () => {
        await setup({ ttlMs: 60, paymentDelayMs: 200 }); // giữ 60ms nhưng thanh toán mất 200ms
        await holdService.holdSeats("an", [room(101)]);

        await assert.rejects(
            bookingService.checkout("an", [room(101)], customer),
            (error) => error.code === "BOOKING_CANCELLED" && error.details.refunded === true,
        );

        const [booking] = await bookingService.getBookingsOfUser("an");
        assert.equal(booking.trang_thai, BOOKING_STATUS.CANCELLED);
        assert.equal(booking.ly_do_huy, "het_han_giu_cho");
        assert.equal(booking.da_hoan_tien, true);
        assert.equal(await statusOf(room(101)), "trong");
        await assert.doesNotReject(holdService.holdSeats("binh", [room(101)])); // người khác giữ được
    });
});

describe("SeatMapService", () => {
    beforeEach(() => setup());

    it("hiển thị đúng 4 trạng thái theo góc nhìn từng người", async () => {
        await holdService.holdSeats("an", [room(101)]);
        await holdService.holdSeats("binh", [room(102)]);
        await holdService.holdSeats("cuong", [room(103)]);
        await holdService.confirmHolds("cuong", [room(103)]);

        const seatMap = await seatMapService.getSeatMap(room(101).replace(/-101$/, ""), "an");
        const display = (code) => seatMap.find((s) => s.ma_phong === code).display;

        assert.equal(display("101"), DISPLAY_STATUS.MINE);
        assert.equal(display("102"), DISPLAY_STATUS.OTHERS);
        assert.equal(display("103"), DISPLAY_STATUS.BOOKED);
        assert.equal(display("104"), DISPLAY_STATUS.EMPTY);
        assert.deepEqual(SeatMapService.summarize(seatMap), { trong: 33, dang_giu: 2, da_dat: 1 });
    });

    it("chỉ liệt kê các đêm từ hôm nay trở đi", async () => {
        const tomorrow = Date.now() + 36 * 3600 * 1000;
        const service = new SeatMapService(db, { now: () => tomorrow });
        const events = await service.listEvents();
        assert.equal(events.length, 29); // bỏ đêm hôm nay
    });
});

describe("setTtlMs", () => {
    beforeEach(() => setup());

    it("đổi TTL cho lượt giữ mới và từ chối giá trị không hợp lệ", async () => {
        holdService.setTtlMs(30_000);
        const [hold] = await holdService.holdSeats("an", [room(101)]);
        assert.equal(hold.het_han_luc - hold.thoi_diem_giu, 30_000);
        assert.throws(() => holdService.setTtlMs(0), { code: "VALIDATION" });
        assert.throws(() => holdService.setTtlMs(-5), { code: "VALIDATION" });
        assert.throws(() => holdService.setTtlMs(NaN), { code: "VALIDATION" });
    });
});
