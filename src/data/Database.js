/**
 * TẦNG DỮ LIỆU – cơ sở dữ liệu giả lập trong bộ nhớ.
 *
 * Gồm 5 bảng theo Y1: events, seats, holds, bookings, waitlist.
 * - Mọi thao tác đều BẤT ĐỒNG BỘ và có độ trễ ngẫu nhiên (mô phỏng gọi mạng/API).
 * - Trả về BẢN SAO của bản ghi: bên ngoài không sửa trực tiếp được dữ liệu,
 *   phải gọi update() -> giống một DB thật, và làm race condition xuất hiện thật sự.
 * - Có thể nhận `storage` (vd. localStorage) để lưu lại khi tải lại trang.
 */
// Danh sách 5 bảng của CSDL giả lập.
const TABLES = ["events", "seats", "holds", "bookings", "waitlist"];
// Khóa lưu dữ liệu trong localStorage.
const STORAGE_KEY = "online-hotel-booking-db";

// Sao chép sâu một giá trị để bên ngoài không sửa trực tiếp dữ liệu bên trong.
const clone = (value) => structuredClone(value);

export class Database {
    #tables;
    #counters = {};
    #latencyMs;
    #storage;

    /** Tạo CSDL: `latencyMs` là độ trễ giả lập tối đa, `storage` là nơi lưu (vd. localStorage), rồi nạp dữ liệu đã lưu. */
    constructor({ latencyMs = 0, storage = null } = {}) {
        this.#latencyMs = latencyMs;
        this.#storage = storage;
        this.#tables = Object.fromEntries(TABLES.map((name) => [name, []]));
        this.#load();
    }

    /** Đọc dữ liệu đã lưu trước đó từ storage (nếu có). */
    #load() {
        const raw = this.#storage?.getItem(STORAGE_KEY);
        if (!raw) return;
        const { tables, counters } = JSON.parse(raw);
        this.#tables = { ...this.#tables, ...tables };
        this.#counters = counters ?? {};
    }

    /** Ghi toàn bộ bảng + bộ đếm id vào storage. */
    #save() {
        this.#storage?.setItem(STORAGE_KEY, JSON.stringify({ tables: this.#tables, counters: this.#counters }));
    }

    /** Chờ một khoảng ngẫu nhiên để mô phỏng độ trễ khi gọi mạng. */
    async #simulateLatency() {
        if (this.#latencyMs <= 0) return;
        const delay = Math.random() * this.#latencyMs;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    /** Lấy mảng dữ liệu của một bảng; báo lỗi nếu tên bảng sai. */
    #table(name) {
        if (!this.#tables[name]) throw new Error(`Bảng không tồn tại: ${name}`);
        return this.#tables[name];
    }

    /**
     * Nạp dữ liệu ban đầu (đồng bộ, không độ trễ): chỉ thêm các bản ghi có id CHƯA tồn tại,
     * nên mỗi ngày mở app sẽ tự bổ sung thêm các đêm mới mà không đè lên dữ liệu đã có.
     * Trả về số bản ghi mới được thêm.
     */
    seed(tableName, records) {
        const table = this.#table(tableName);
        const existingIds = new Set(table.map((row) => row.id));
        const fresh = records.filter((record) => !existingIds.has(record.id));
        if (fresh.length === 0) return 0;
        table.push(...clone(fresh));
        this.#save();
        return fresh.length;
    }

    /** Tìm một bản ghi theo id; trả về bản sao hoặc null nếu không có. */
    async findById(tableName, id) {
        await this.#simulateLatency();
        const found = this.#table(tableName).find((row) => row.id === id);
        return found ? clone(found) : null;
    }

    /** Lọc các bản ghi theo điều kiện `predicate` (mặc định lấy tất cả); trả về bản sao. */
    async find(tableName, predicate = () => true) {
        await this.#simulateLatency();
        return clone(this.#table(tableName).filter(predicate));
    }

    /** Thêm bản ghi mới, tự sinh id dạng "tên_bảng-số"; trả về bản ghi vừa thêm. */
    async insert(tableName, record) {
        await this.#simulateLatency();
        this.#counters[tableName] = (this.#counters[tableName] ?? 0) + 1;
        const row = { id: `${tableName}-${this.#counters[tableName]}`, ...clone(record) };
        this.#table(tableName).push(row);
        this.#save();
        return clone(row);
    }

    /** Cập nhật một phần (`patch`) của bản ghi theo id; trả về bản ghi mới hoặc null nếu không có. */
    async update(tableName, id, patch) {
        await this.#simulateLatency();
        const row = this.#table(tableName).find((item) => item.id === id);
        if (!row) return null;
        Object.assign(row, clone(patch));
        this.#save();
        return clone(row);
    }

    /** Xóa bản ghi theo id; trả về true nếu xóa được, false nếu không tìm thấy. */
    async remove(tableName, id) {
        await this.#simulateLatency();
        const table = this.#table(tableName);
        const index = table.findIndex((row) => row.id === id);
        if (index === -1) return false;
        table.splice(index, 1);
        this.#save();
        return true;
    }
}
