/** Lỗi nghiệp vụ có mã `code` để giao diện hiển thị thông báo phù hợp. */
export class AppError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = new.target.name;
        this.code = code;
        this.details = details;
    }
}

/** Dữ liệu đầu vào không hợp lệ (thiếu, sai định dạng, vượt giới hạn). */
export class ValidationError extends AppError {
    constructor(message, details) { super("VALIDATION", message, details); }
}

/** Không tìm thấy đối tượng (phòng, đơn...) theo mã. */
export class NotFoundError extends AppError {
    constructor(what, id) { super("NOT_FOUND", `Không tìm thấy ${what}: ${id}`, { what, id }); }
}

/** Phòng không còn trống (đang bị giữ hoặc đã đặt) nên không giữ được. */
export class SeatUnavailableError extends AppError {
    constructor(seatId, status) {
        super("SEAT_UNAVAILABLE", `Phòng ${seatId} không còn trống (đang ở trạng thái "${status}")`, { seatId, status });
    }
}

/** Lượt giữ phòng đã hết hạn hoặc chưa từng được giữ. */
export class HoldExpiredError extends AppError {
    constructor(seatId) {
        super("HOLD_EXPIRED", `Phòng ${seatId} đã hết thời gian giữ hoặc chưa được giữ`, { seatId });
    }
}

/** Người dùng không phải chủ của lượt giữ phòng nên không được thao tác. */
export class NotOwnerError extends AppError {
    constructor(seatId, userId) {
        super("NOT_OWNER", `Người dùng ${userId} không phải người đang giữ phòng ${seatId}`, { seatId, userId });
    }
}

/** Thanh toán bị từ chối / thất bại. */
export class PaymentFailedError extends AppError {
    constructor(message = "Thanh toán không thành công") { super("PAYMENT_FAILED", message); }
}

/** Đơn bị hủy sau khi đã bắt đầu (vd. hết hạn giữ phòng giữa lúc thanh toán). */
export class BookingCancelledError extends AppError {
    constructor(message, details) { super("BOOKING_CANCELLED", message, details); }
}

/** Đơn của người dùng đang được xử lý – chặn bấm đặt hai lần. */
export class AlreadyProcessingError extends AppError {
    constructor() { super("ALREADY_PROCESSING", "Đơn đặt phòng của bạn đang được xử lý, vui lòng chờ"); }
}

/** Người dùng đã đứng trong hàng đợi của đêm này rồi. */
export class AlreadyWaitingError extends AppError {
    constructor() { super("ALREADY_WAITING", "Bạn đã ở trong hàng đợi của đêm này"); }
}

/** Còn đủ phòng trống nên không cần xếp hàng đợi. */
export class SeatsAvailableError extends AppError {
    constructor(emptyCount) {
        super("SEATS_AVAILABLE", "Vẫn còn đủ phòng trống, bạn có thể đặt trực tiếp", { emptyCount });
    }
}
