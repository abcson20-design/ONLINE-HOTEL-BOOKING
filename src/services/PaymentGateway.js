/**
 * Cổng thanh toán GIẢ LẬP: chờ một khoảng (mô phỏng gọi mạng) rồi thành công hoặc thất bại.
 * Tách riêng thành class để BookingService không phụ thuộc cách thanh toán cụ thể
 * và test có thể thay bằng bản chạy tức thì.
 */
import { PaymentFailedError, ValidationError } from "./errors.js";

// Chờ `ms` mili-giây (giả lập thời gian gọi ngân hàng).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class PaymentGateway {
    #delayMs;
    #failureRate;

    /** Tạo cổng thanh toán: `delayMs` là thời gian xử lý giả lập, `failureRate` là tỉ lệ thất bại ngẫu nhiên (0–1). */
    constructor({ delayMs = 1500, failureRate = 0 } = {}) {
        this.#delayMs = delayMs;
        this.#failureRate = failureRate;
    }

    /**
     * @param {{amount:number, method?:string, simulateFailure?:boolean}} request
     * @returns {Promise<{transactionId:string, amount:number, method:string}>}
     * @throws {ValidationError|PaymentFailedError}
     */
    async charge({ amount, method = "the", simulateFailure = false }) {
        if (!Number.isFinite(amount) || amount <= 0) throw new ValidationError("Số tiền thanh toán phải lớn hơn 0");

        await sleep(this.#delayMs);

        if (simulateFailure || Math.random() < this.#failureRate) {
            throw new PaymentFailedError("Ngân hàng từ chối giao dịch. Bạn có thể thử lại.");
        }
        return { transactionId: `TXN-${Date.now().toString(36).toUpperCase()}`, amount, method };
    }
}
