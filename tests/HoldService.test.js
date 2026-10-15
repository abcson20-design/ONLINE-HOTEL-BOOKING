import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { Database } from "../src/data/Database.js";
import { seedDatabase } from "../src/data/seed.js";
import { HoldService, SEAT_STATUS, DEFAULT_HOLD_TTL_MS, MAX_SEATS_PER_HOLD } from "../src/services/HoldService.js";
import { simulateConcurrentHolds } from "../src/services/concurrencySimulator.js";
import { KeyedMutex } from "../src/utils/KeyedMutex.js";
import { naiveHold } from "./helpers/naiveHold.js";

// Chờ `ms` mili-giây (để timer hết hạn kịp nổ).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let db;
let service;
let room; // (mã phòng) -> id ghế của đêm đầu tiên

// Dựng môi trường mới cho mỗi test: CSDL mẫu (có thể thêm độ trễ) + HoldService; `room(mã)` trả id phòng của đêm đầu tiên.
const setup = async ({ ttlMs, latencyMs = 0 } = {}) => {
    db = seedDatabase(new Database({ latencyMs }));
    service = new HoldService(db, { ttlMs });
    const [firstEvent] = await db.find("events");
    room = (code) => `${firstEvent.id}-${code}`;
};

// Đọc trạng thái hiện tại của một phòng trong CSDL.
const statusOf = async (seatId) => (await db.findById("seats", seatId)).trang_thai;

afterEach(() => service?.dispose());

describe("Dữ liệu mẫu", () => {
    beforeEach(() => setup());

    it("có 30 đêm x 36 phòng, mặc định TTL = 10 phút", async () => {
        assert.equal((await db.find("events")).length, 30);
        assert.equal((await db.find("seats")).length, 30 * 36);
        assert.equal(DEFAULT_HOLD_TTL_MS, 10 * 60 * 1000);
        assert.equal(service.ttlMs, 600_000);
    });

    it("phân hạng phòng đúng: 101=đơn, 106=đôi, 111=VIP", async () => {
        const seat = async (code) => db.findById("seats", room(code));
        assert.equal((await seat(101)).hang_phong, "don");
        assert.equal((await seat(106)).hang_phong, "doi");
        assert.equal((await seat(111)).hang_phong, "vip");
    });
});

describe("Giữ phòng + TTL", () => {
    beforeEach(() => setup({ ttlMs: 60 }));

    it("giữ phòng: chuyển 'dang_giu' và het_han_luc = thoi_diem_giu + TTL", async () => {
        const [hold] = await service.holdSeats("an", [room(101)]);
        assert.equal(await statusOf(room(101)), SEAT_STATUS.HELD);
        assert.equal(hold.het_han_luc - hold.thoi_diem_giu, 60);
    });

    it("hết TTL: phòng tự nhả về 'trong', hold bị xóa, phát sự kiện", async () => {
        const released = [];
        service.events.on("seat-released", (payload) => released.push(payload));

        await service.holdSeats("an", [room(101)]);
        await sleep(200);

        assert.equal(await statusOf(room(101)), SEAT_STATUS.EMPTY);
        assert.equal((await db.find("holds")).length, 0);
        assert.deepEqual(released.map((r) => [r.seatId, r.reason]), [[room(101), "het_han"]]);
    });

    it("sau khi hết hạn, người khác giữ được phòng đó", async () => {
        await service.holdSeats("an", [room(101)]);
        await sleep(200);
        await assert.doesNotReject(service.holdSeats("binh", [room(101)]));
    });

    it("getRemainingMs giảm dần rồi về 0 khi hết hạn", async () => {
        const [hold] = await service.holdSeats("an", [room(101)]);
        const remaining = await service.getRemainingMs(hold.id);
        assert.ok(remaining > 0 && remaining <= 60);
        await sleep(200);
        assert.equal(await service.getRemainingMs(hold.id), 0);
    });

    it("restoreTimers: hold đã quá hạn trong DB được nhả ngay khi khởi động lại", async () => {
        await db.update("seats", room(102), { trang_thai: SEAT_STATUS.HELD });
        await db.insert("holds", { seat_id: room(102), user_id: "an", thoi_diem_giu: 0, het_han_luc: 1 });

        await service.restoreTimers();
        await sleep(50);

        assert.equal(await statusOf(room(102)), SEAT_STATUS.EMPTY);
    });
});

describe("Chống đặt trùng", () => {
    beforeEach(() => setup({ latencyMs: 6 }));

    it("người thứ hai không giữ được phòng đang được giữ", async () => {
        await service.holdSeats("an", [room(101)]);
        await assert.rejects(service.holdSeats("binh", [room(101)]), { code: "SEAT_UNAVAILABLE" });
    });

    it("không giữ được phòng đã đặt", async () => {
        await service.holdSeats("an", [room(101)]);
        await service.confirmHolds("an", [room(101)]);
        await assert.rejects(service.holdSeats("binh", [room(101)]), { code: "SEAT_UNAVAILABLE" });
    });

    it("50 người cùng giữ 1 phòng -> đúng 1 người thắng", async () => {
        const result = await simulateConcurrentHolds(service, { userCount: 50, pickSeats: () => [room(101)] });
        assert.equal(result.successCount, 1);
        assert.equal(result.failureReasons.SEAT_UNAVAILABLE, 49);
        assert.ok(result.isSafe);
    });

    it("40 người tranh ngẫu nhiên nhiều phòng -> không phòng nào bị giữ trùng", async () => {
        const pool = [101, 102, 103, 104].map(room);
        const pickSeats = (i) => (i % 2 === 0 ? [pool[i % 4], pool[(i + 1) % 4]] : [pool[i % 4]]);
        const result = await simulateConcurrentHolds(service, { userCount: 40, pickSeats });
        assert.ok(result.isSafe);
        assert.ok(result.successCount <= pool.length);
    });

    it("giữ nhiều phòng là 'tất cả hoặc không': phòng B bận thì phòng A vẫn trống", async () => {
        await service.holdSeats("binh", [room(102)]);
        await assert.rejects(service.holdSeats("an", [room(101), room(102)]), { code: "SEAT_UNAVAILABLE" });
        assert.equal(await statusOf(room(101)), SEAT_STATUS.EMPTY);
    });

    it("không deadlock khi hai người chọn cùng cặp phòng theo thứ tự ngược nhau", async () => {
        const outcomes = await Promise.allSettled([
            service.holdSeats("an", [room(101), room(102)]),
            service.holdSeats("binh", [room(102), room(101)]),
        ]);
        assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
    });

    it("CHỨNG MINH: phiên bản KHÔNG có khóa bị đặt trùng (race condition)", async () => {
        const outcomes = await Promise.allSettled(
            Array.from({ length: 20 }, (_, i) => naiveHold(db, `user-${i}`, room(103))),
        );
        const winners = outcomes.filter((o) => o.status === "fulfilled").length;
        assert.ok(winners > 1, `kỳ vọng >1 người "thắng" do race, thực tế: ${winners}`);
    });
});

describe("Xác nhận và hủy giữ", () => {
    beforeEach(() => setup({ ttlMs: 60 }));

    it("confirmHolds: phòng thành 'da_dat', hold bị xóa và KHÔNG bị nhả khi timer nổ", async () => {
        await service.holdSeats("an", [room(101)]);
        await service.confirmHolds("an", [room(101)]);
        await sleep(200);
        assert.equal(await statusOf(room(101)), SEAT_STATUS.BOOKED);
        assert.equal((await db.find("holds")).length, 0);
    });

    it("confirmHolds sau khi quá hạn -> HOLD_EXPIRED và phòng được nhả", async () => {
        await service.holdSeats("an", [room(101)]);
        await db.update("holds", (await db.find("holds"))[0].id, { het_han_luc: Date.now() - 1 });
        await assert.rejects(service.confirmHolds("an", [room(101)]), { code: "HOLD_EXPIRED" });
        assert.equal(await statusOf(room(101)), SEAT_STATUS.EMPTY);
    });

    it("confirmHolds cho phòng chưa ai giữ -> HOLD_EXPIRED", async () => {
        await assert.rejects(service.confirmHolds("an", [room(101)]), { code: "HOLD_EXPIRED" });
    });

    it("người khác không được xác nhận / bỏ giữ phòng của mình", async () => {
        await service.holdSeats("an", [room(101)]);
        await assert.rejects(service.confirmHolds("binh", [room(101)]), { code: "NOT_OWNER" });
        await assert.rejects(service.releaseHolds("binh", [room(101)]), { code: "NOT_OWNER" });
        assert.equal(await statusOf(room(101)), SEAT_STATUS.HELD);
    });

    it("releaseHolds: chủ hold bỏ giữ -> phòng trống lại", async () => {
        await service.holdSeats("an", [room(101)]);
        await service.releaseHolds("an", [room(101)]);
        assert.equal(await statusOf(room(101)), SEAT_STATUS.EMPTY);
    });
});

describe("Dữ liệu đầu vào không hợp lệ (ca biên)", () => {
    beforeEach(() => setup());

    it("userId rỗng / không phải chuỗi", async () => {
        await assert.rejects(service.holdSeats("", [room(101)]), { code: "VALIDATION" });
        await assert.rejects(service.holdSeats(null, [room(101)]), { code: "VALIDATION" });
    });

    it("danh sách phòng rỗng / không phải mảng", async () => {
        await assert.rejects(service.holdSeats("an", []), { code: "VALIDATION" });
        await assert.rejects(service.holdSeats("an", undefined), { code: "VALIDATION" });
    });

    it("phòng trùng lặp trong cùng một yêu cầu", async () => {
        await assert.rejects(service.holdSeats("an", [room(101), room(101)]), { code: "VALIDATION" });
    });

    it(`vượt hạn mức ${MAX_SEATS_PER_HOLD} phòng`, async () => {
        const tooMany = [101, 102, 103, 104, 105, 106, 107].map(room);
        await assert.rejects(service.holdSeats("an", tooMany), { code: "VALIDATION" });
    });

    it("phòng không tồn tại", async () => {
        await assert.rejects(service.holdSeats("an", ["khong-co"]), { code: "NOT_FOUND" });
    });
});

describe("KeyedMutex", () => {
    it("các tác vụ cùng khóa chạy tuần tự đúng thứ tự đến", async () => {
        const mutex = new KeyedMutex();
        const order = [];
        const task = (name, ms) => mutex.runExclusive(["k"], async () => {
            order.push(`${name}-start`);
            await sleep(ms);
            order.push(`${name}-end`);
        });
        await Promise.all([task("A", 20), task("B", 1), task("C", 1)]);
        assert.deepEqual(order, ["A-start", "A-end", "B-start", "B-end", "C-start", "C-end"]);
    });

    it("nhả khóa kể cả khi tác vụ ném lỗi", async () => {
        const mutex = new KeyedMutex();
        await assert.rejects(mutex.runExclusive(["k"], async () => { throw new Error("boom"); }));
        assert.equal(await mutex.runExclusive(["k"], async () => "ok"), "ok");
    });
});
