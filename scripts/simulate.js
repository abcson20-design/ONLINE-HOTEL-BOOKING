/**
 * Chạy: npm run simulate
 * Chứng minh hệ thống không cho đặt trùng khi 50 người tranh 1 phòng
 * và khi 40 người tranh ngẫu nhiên 1–3 phòng trong nhóm 6 phòng.
 */
import { Database } from "../src/data/Database.js";
import { seedDatabase } from "../src/data/seed.js";
import { HoldService } from "../src/services/HoldService.js";
import { simulateConcurrentHolds } from "../src/services/concurrencySimulator.js";

// Tạo một hệ thống mới (CSDL mẫu có độ trễ + HoldService) để mỗi kịch bản chạy độc lập.
const createSystem = () => {
    const db = seedDatabase(new Database({ latencyMs: 8 }));
    return { db, holdService: new HoldService(db) };
};

const [firstEvent] = await createSystem().db.find("events");
// Đổi mã phòng (vd. 101) thành id phòng của đêm đầu tiên.
const room = (code) => `${firstEvent.id}-${code}`;

console.log("=== Kịch bản 1: 50 người cùng giữ phòng 101 ===");
{
    const { holdService } = createSystem();
    const result = await simulateConcurrentHolds(holdService, { userCount: 50, pickSeats: () => [room(101)] });
    console.log({ ...result, winners: result.winners.join(", ") });
    holdService.dispose();
}

console.log("\n=== Kịch bản 2: 40 người tranh ngẫu nhiên 1–3 phòng trong 6 phòng ===");
{
    const { holdService } = createSystem();
    const pool = [101, 102, 103, 104, 105, 106].map(room);
    const pickSeats = () => {
        const count = 1 + Math.floor(Math.random() * 3);
        return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
    };
    const result = await simulateConcurrentHolds(holdService, { userCount: 40, pickSeats });
    console.log({ ...result, winners: `${result.winners.length} người` });
    holdService.dispose();
}
