/**
 * TẦNG NGHIỆP VỤ – quy trình đặt phòng:
 *   phòng đang giữ -> nhập thông tin -> thanh toán (bất đồng bộ) -> xác nhận.
 *
 * Điểm khó là THANH TOÁN MẤT THỜI GIAN nên hold có thể hết hạn NGAY TRONG lúc đó.
 * Vì vậy sau khi thanh toán xong vẫn phải kiểm tra lại hold trong confirmHolds().
 * Nếu đã hết hạn -> hủy đơn, đánh dấu hoàn tiền, phòng được nhả cho người khác.
 */
import { EventBus } from "../utils/EventBus.js";
import { PricingService } from "./PricingService.js";
import {
    ValidationError, HoldExpiredError, NotOwnerError, NotFoundError,
    BookingCancelledError, AlreadyProcessingError,
} from "./errors.js";

// Các trạng thái của một đơn: chờ thanh toán / đã thanh toán / đã hủy.
export const BOOKING_STATUS = Object.freeze({
    PENDING: "cho_thanh_toan",
    PAID: "da_thanh_toan",
    CANCELLED: "da_huy",
});

// Mẫu số điện thoại VN (0xxxxxxxxx hoặc +84xxxxxxxxx) và mẫu email cơ bản.
const PHONE_PATTERN = /^(0|\+84)\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Kiểm tra và chuẩn hóa thông tin khách.
 * @throws {ValidationError} details.field cho biết ô nhập nào sai
 */
export function validateCustomer({ ten = "", sdt = "", email = "" } = {}) {
    const customer = { ten: ten.trim(), sdt: sdt.replace(/\s+/g, ""), email: email.trim() };

    if (customer.ten.length < 2) throw new ValidationError("Vui lòng nhập họ tên (tối thiểu 2 ký tự)", { field: "ten" });
    if (!PHONE_PATTERN.test(customer.sdt)) throw new ValidationError("Số điện thoại không hợp lệ (vd. 0912345678)", { field: "sdt" });
    if (!EMAIL_PATTERN.test(customer.email)) throw new ValidationError("Email không hợp lệ", { field: "email" });
    return customer;
}

export class BookingService {
    #db;
    #holdService;
    #gateway;
    #now;
    #pricing;
    #processingUsers = new Set(); // chống bấm "Thanh toán" hai lần

    events = new EventBus();

    /** Nhận CSDL, HoldService (giữ phòng), cổng thanh toán và PricingService (tính giá). */
    constructor(db, holdService, gateway, { now = Date.now, pricingService = new PricingService() } = {}) {
        this.#pricing = pricingService;
        this.#db = db;
        this.#holdService = holdService;
        this.#gateway = gateway;
        this.#now = now;
    }

    /**
     * Hoàn tất một đơn đặt phòng từ các phòng người dùng ĐANG GIỮ.
     * @returns {Promise<object>} bản ghi booking với trang_thai = da_thanh_toan
     * @throws {ValidationError|HoldExpiredError|NotOwnerError|PaymentFailedError|BookingCancelledError|AlreadyProcessingError}
     */
    async checkout(userId, seatIds, customer, {
        paymentMethod = "the", simulateFailure = false, comboIds = [], couponCode = "",
    } = {}) {
        if (this.#processingUsers.has(userId)) throw new AlreadyProcessingError();
        this.#processingUsers.add(userId);

        try {
            const info = validateCustomer(customer);
            const seats = await this.#loadSeatsAndCheckHolds(userId, seatIds);

            // Tính giá Ở PHÍA SERVICE (không tin số tiền từ giao diện). Lỗi mã giảm giá/combo dừng tại đây, chưa tạo đơn.
            const event = await this.#db.findById("events", seats[0].event_id);
            const quote = this.#pricing.quote({ seats, date: event.thoi_gian, comboIds, couponCode });

            const booking = await this.#db.insert("bookings", {
                user_id: userId,
                event_id: seats[0].event_id,
                danh_sach_ghe: seatIds,
                tong_tien: quote.total,
                bang_gia: quote, // lưu lại giá tại thời điểm đặt, sau này đổi bảng giá cũng không ảnh hưởng đơn cũ
                trang_thai: BOOKING_STATUS.PENDING,
                thoi_gian: this.#now(),
                khach: info,
            });

            return await this.#payAndConfirm(booking, userId, seatIds, { paymentMethod, simulateFailure });
        } finally {
            this.#processingUsers.delete(userId);
        }
    }

    /** Lấy các đơn của một người dùng, đơn mới nhất xếp trước. */
    async getBookingsOfUser(userId) {
        const bookings = await this.#db.find("bookings", (booking) => booking.user_id === userId);
        return bookings.sort((a, b) => b.thoi_gian - a.thoi_gian);
    }

    // ---------- Nội bộ ----------

    /** Đảm bảo mọi phòng đều đang được CHÍNH người này giữ và chưa hết hạn, cùng một đêm. */
    async #loadSeatsAndCheckHolds(userId, seatIds) {
        if (!Array.isArray(seatIds) || seatIds.length === 0) throw new ValidationError("Chưa chọn phòng nào");

        const seats = await Promise.all(seatIds.map((id) => this.#db.findById("seats", id)));
        seats.forEach((seat, index) => { if (!seat) throw new NotFoundError("phòng", seatIds[index]); });

        if (new Set(seats.map((seat) => seat.event_id)).size !== 1) {
            throw new ValidationError("Mỗi đơn chỉ đặt các phòng trong cùng một đêm");
        }

        for (const seatId of seatIds) {
            const [hold] = await this.#holdService.getHoldsBySeat(seatId);
            if (!hold || hold.het_han_luc <= this.#now()) throw new HoldExpiredError(seatId);
            if (hold.user_id !== userId) throw new NotOwnerError(seatId, userId);
        }
        return seats;
    }

    /**
     * Thanh toán rồi xác nhận phòng. Thanh toán lỗi -> hủy đơn nhưng giữ phòng;
     * hết hạn giữ giữa lúc thanh toán -> hủy đơn và hoàn tiền; thành công -> đánh dấu "đã thanh toán".
     */
    async #payAndConfirm(booking, userId, seatIds, { paymentMethod, simulateFailure }) {
        try {
            await this.#gateway.charge({ amount: booking.tong_tien, method: paymentMethod, simulateFailure });
        } catch (error) {
            // Thanh toán lỗi: hủy đơn nhưng GIỮ NGUYÊN phòng để khách thử lại khi còn hạn.
            await this.#cancel(booking, "thanh_toan_that_bai", { refunded: false });
            throw error;
        }

        try {
            await this.#holdService.confirmHolds(userId, seatIds);
        } catch (error) {
            // Tiền đã trừ nhưng phòng không còn giữ được (hết hạn giữa chừng) -> hủy + hoàn tiền.
            const cancelled = await this.#cancel(booking, "het_han_giu_cho", { refunded: true });
            throw new BookingCancelledError(
                "Đã hết thời gian giữ phòng trong lúc thanh toán. Đơn bị hủy và số tiền sẽ được hoàn lại.",
                { bookingId: booking.id, refunded: true, cause: error.code, booking: cancelled },
            );
        }

        const paid = await this.#db.update("bookings", booking.id, { trang_thai: BOOKING_STATUS.PAID });
        this.events.emit("booking-paid", paid);
        return paid;
    }

    /** Đánh dấu đơn đã hủy kèm lý do và việc có hoàn tiền hay không, rồi phát sự kiện "booking-cancelled". */
    async #cancel(booking, reason, { refunded }) {
        const cancelled = await this.#db.update("bookings", booking.id, {
            trang_thai: BOOKING_STATUS.CANCELLED, ly_do_huy: reason, da_hoan_tien: refunded,
        });
        this.events.emit("booking-cancelled", cancelled);
        return cancelled;
    }
}
