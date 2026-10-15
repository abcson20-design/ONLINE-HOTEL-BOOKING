/**
 * Khóa loại trừ theo khóa (mutex theo từng phòng).
 *
 * VÌ SAO CẦN?
 * JavaScript chạy đơn luồng nhưng mỗi thao tác dữ liệu là bất đồng bộ (await).
 * Giữa lúc "đọc trạng thái phòng" và "ghi trạng thái đang giữ" có khoảng await,
 * request khác có thể chen vào -> hai người cùng thấy phòng "trống" (race condition).
 * Mutex biến đoạn "kiểm tra + ghi" thành một khối không bị chen ngang.
 *
 * CÁCH HOẠT ĐỘNG: mỗi khóa có một chuỗi Promise (hàng đợi). Ai đến sau phải chờ
 * người trước nhả khóa rồi mới được chạy, theo đúng thứ tự đến.
 */
export class KeyedMutex {
    #tails = new Map();

    /** Xin khóa của một key: chờ người đến trước nhả khóa, trả về hàm để nhả khóa của mình. */
    async #acquire(key) {
        const previous = this.#tails.get(key) ?? Promise.resolve();
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const tail = previous.then(() => gate);
        this.#tails.set(key, tail);

        await previous; // chờ người trước nhả khóa

        return () => {
            release();
            if (this.#tails.get(key) === tail) this.#tails.delete(key); // dọn bộ nhớ
        };
    }

    /**
     * Chạy `task` khi đã giữ khóa của TẤT CẢ các key.
     * Khóa được lấy theo thứ tự đã sắp xếp để tránh deadlock
     * (A chờ B trong khi B chờ A khi hai người chọn cùng cặp phòng theo thứ tự ngược nhau).
     */
    async runExclusive(keys, task) {
        const sortedKeys = [...new Set(keys)].sort();
        const releases = [];
        try {
            for (const key of sortedKeys) {
                releases.push(await this.#acquire(key));
            }
            return await task();
        } finally {
            releases.reverse().forEach((release) => release());
        }
    }
}
