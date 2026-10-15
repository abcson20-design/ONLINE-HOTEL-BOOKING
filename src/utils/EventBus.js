/**
 * Bus sự kiện tối giản (publish/subscribe).
 * Tầng nghiệp vụ phát sự kiện ("hold-expired", "seat-released"...),
 * tầng giao diện và hàng đợi đăng ký lắng nghe -> hai tầng không phụ thuộc trực tiếp nhau.
 */
export class EventBus {
    #handlers = new Map();

    /** Đăng ký lắng nghe; trả về hàm hủy đăng ký. */
    on(eventName, handler) {
        const list = this.#handlers.get(eventName) ?? [];
        this.#handlers.set(eventName, [...list, handler]);
        return () => this.off(eventName, handler);
    }

    /** Hủy đăng ký một hàm đã lắng nghe sự kiện trước đó. */
    off(eventName, handler) {
        const list = this.#handlers.get(eventName) ?? [];
        this.#handlers.set(eventName, list.filter((h) => h !== handler));
    }

    /** Phát sự kiện: gọi lần lượt mọi hàm đã đăng ký cho `eventName`, truyền kèm `payload`. */
    emit(eventName, payload) {
        (this.#handlers.get(eventName) ?? []).forEach((handler) => handler(payload));
    }
}
