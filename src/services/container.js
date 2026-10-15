/**
 * Nơi DUY NHẤT lắp ráp các service (composition root).
 * Giao diện chỉ lấy service từ đây -> dễ thay DB/cổng thanh toán, và test có thể tự lắp bản riêng.
 */
import { Database } from "../data/Database.js";
import { seedDatabase } from "../data/seed.js";
import { HoldService, DEFAULT_HOLD_TTL_MS } from "./HoldService.js";
import { BookingService } from "./BookingService.js";
import { PaymentGateway } from "./PaymentGateway.js";
import { SeatMapService } from "./SeatMapService.js";
import { PricingService } from "./PricingService.js";
import { WaitlistService } from "./WaitlistService.js";
import { StatsService } from "./StatsService.js";

/** Các mức thời gian giữ phòng cho người dùng chọn (30 giây chỉ để trình diễn tự nhả phòng). */
export const TTL_OPTIONS = Object.freeze([
    { seconds: DEFAULT_HOLD_TTL_MS / 1000, label: "10 phút" },
    { seconds: 30, label: "30 giây (demo)" },
]);

// Khóa lưu mã khách trong localStorage.
const USER_KEY = "online-hotel-booking-user-id";

/** Lấy localStorage một cách an toàn (trả về null nếu trình duyệt chặn hoặc chạy trong Node). */
const safeLocalStorage = () => {
    try { return globalThis.localStorage ?? null; } catch { return null; }
};

/**
 * Tạo và nối dây mọi service: CSDL -> giữ phòng, giá, thanh toán, đặt phòng, sơ đồ, hàng đợi, thống kê.
 * Các tham số cho phép test tự chọn độ trễ/thời gian giữ.
 */
function createServices({ storage = null, latencyMs = 0, ttlMs = DEFAULT_HOLD_TTL_MS, paymentDelayMs = 1500 } = {}) {
    const db = seedDatabase(new Database({ latencyMs, storage }));
    const holdService = new HoldService(db, { ttlMs });
    const pricingService = new PricingService();
    const bookingService = new BookingService(db, holdService, new PaymentGateway({ delayMs: paymentDelayMs }), { pricingService });
    const seatMapService = new SeatMapService(db);
    const waitlistService = new WaitlistService(db, holdService).start();
    const statsService = new StatsService(db);
    return { db, holdService, bookingService, seatMapService, pricingService, waitlistService, statsService };
}

let instance = null;

/** Service dùng chung cho cả ứng dụng (tạo một lần, lưu vào localStorage, có độ trễ giả lập như gọi API). */
export function getServices() {
    if (!instance) {
        instance = createServices({ storage: safeLocalStorage(), latencyMs: 80 });
        instance.holdService.restoreTimers(); // dựng lại timer cho các lượt giữ còn lưu từ lần trước
    }
    return instance;
}

/** Mã khách ẩn danh, lưu lại để tải lại trang vẫn nhận ra phòng mình đang giữ. */
export function getCurrentUserId() {
    const storage = safeLocalStorage();
    let userId = storage?.getItem(USER_KEY);
    if (!userId) {
        userId = `khach-${Math.random().toString(36).slice(2, 8)}`;
        storage?.setItem(USER_KEY, userId);
    }
    return userId;
}
