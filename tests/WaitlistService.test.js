import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { Database } from "../src/data/Database.js";
import { seedDatabase } from "../src/data/seed.js";
import { HoldService } from "../src/services/HoldService.js";
import { WaitlistService } from "../src/services/WaitlistService.js";

let db; let holds; let waitlist; let eventId; let allSeatIds;

// Chờ `ms` mili-giây.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Đặt kín cả đêm: người dùng ảo giữ toàn bộ 36 phòng (mỗi lần tối đa 6 phòng). */
const fillEvent = async () => {
    for (let i = 0; i < allSeatIds.length; i += 6) {
        await holds.holdSeats(`filler-${i / 6}`, allSeatIds.slice(i, i + 6));
    }
};
// Cho biết ai đang giữ một phòng (undefined nếu không ai giữ).
const holderOf = async (seatId) => (await holds.getHoldsBySeat(seatId))[0]?.user_id;

// Dựng môi trường mới cho mỗi test: CSDL mẫu, HoldService, WaitlistService đã chạy, và danh sách phòng của đêm đầu tiên.
const setup = async ({ ttlMs = 10_000 } = {}) => {
    db = seedDatabase(new Database({ latencyMs: 3 }));
    holds = new HoldService(db, { ttlMs });
    waitlist = new WaitlistService(db, holds).start();
    const [event] = await db.find("events");
    eventId = event.id;
    allSeatIds = (await db.find("seats", (s) => s.event_id === eventId)).map((s) => s.id).sort();
};

afterEach(() => { waitlist?.dispose(); holds?.dispose(); });

describe("Vào hàng đợi", () => {
    beforeEach(() => setup());

    it("còn đủ phòng thì KHÔNG cần xếp hàng -> SEATS_AVAILABLE", async () => {
        await assert.rejects(waitlist.join("an", eventId, 2), { code: "SEATS_AVAILABLE" });
    });

    it("hết phòng thì vào được, vị trí tăng dần theo thứ tự vào", async () => {
        await fillEvent();
        const first = await waitlist.join("an", eventId, 1);
        const second = await waitlist.join("binh", eventId, 1);
        assert.equal(first.position, 1);
        assert.equal(second.position, 2);
        assert.deepEqual((await waitlist.getStatus("binh", eventId)).position, 2);
    });

    it("không xếp hàng hai lần trong cùng một đêm", async () => {
        await fillEvent();
        await waitlist.join("an", eventId, 1);
        await assert.rejects(waitlist.join("an", eventId, 1), { code: "ALREADY_WAITING" });
    });

    it("số phòng không hợp lệ / đêm không tồn tại / thiếu userId", async () => {
        await fillEvent();
        for (const bad of [0, -1, 7, 1.5, NaN, "2"]) {
            await assert.rejects(waitlist.join("an", eventId, bad), { code: "VALIDATION" });
        }
        await assert.rejects(waitlist.join("", eventId, 1), { code: "VALIDATION" });
        await assert.rejects(waitlist.join("an", "khong-co", 1), { code: "NOT_FOUND" });
    });

    it("rời hàng đợi: những người sau được dồn lên", async () => {
        await fillEvent();
        await waitlist.join("an", eventId, 1);
        await waitlist.join("binh", eventId, 1);
        assert.equal(await waitlist.leave("an", eventId), true);
        assert.equal(await waitlist.leave("an", eventId), false);
        assert.equal((await waitlist.getStatus("binh", eventId)).position, 1);
    });

    it("hạng phòng ưu tiên: còn phòng đôi nhưng khách muốn VIP thì vẫn phải xếp hàng", async () => {
        const vipIds = (await db.find("seats", (s) => s.event_id === eventId && s.hang_phong === "vip")).map((s) => s.id);
        await holds.holdSeats("filler", vipIds); // giữ hết phòng VIP (6 phòng)
        await assert.rejects(waitlist.join("an", eventId, 1), { code: "SEATS_AVAILABLE" });
        const entry = await waitlist.join("an", eventId, 1, { roomType: "vip" });
        assert.equal(entry.position, 1);
    });
});

describe("Phục vụ hàng đợi khi có phòng nhả ra (FIFO)", () => {
    beforeEach(() => setup());

    it("người đầu hàng được TỰ ĐỘNG GIỮ phòng và nhận thông báo", async () => {
        await fillEvent();
        const offers = [];
        waitlist.events.on("waitlist-offered", (o) => offers.push(o));

        await waitlist.join("an", eventId, 1);
        await holds.releaseHolds("filler-0", [allSeatIds[0]]);
        await waitlist.whenIdle();

        assert.equal(offers.length, 1);
        assert.equal(offers[0].userId, "an");
        assert.deepEqual(offers[0].seatIds, [allSeatIds[0]]);
        assert.equal(await holderOf(allSeatIds[0]), "an");
        assert.equal((await waitlist.getStatus("an", eventId)).waiting, false); // đã rời hàng
    });

    it("nhiều phòng nhả lần lượt -> phục vụ đúng thứ tự vào hàng", async () => {
        await fillEvent();
        const served = [];
        waitlist.events.on("waitlist-offered", (o) => served.push(o.userId));

        for (const user of ["an", "binh", "cuong"]) await waitlist.join(user, eventId, 1);
        for (let i = 0; i < 3; i += 1) {
            await holds.releaseHolds("filler-0", [allSeatIds[i]]);
            await waitlist.whenIdle();
        }
        assert.deepEqual(served, ["an", "binh", "cuong"]);
    });

    it("đầu hàng cần 2 phòng, mới nhả 1: cả hàng CHỜ, người sau không được chen ngang", async () => {
        await fillEvent();
        const served = [];
        waitlist.events.on("waitlist-offered", (o) => served.push([o.userId, o.seatIds.length]));

        await waitlist.join("an", eventId, 2);
        await waitlist.join("binh", eventId, 1);

        await holds.releaseHolds("filler-0", [allSeatIds[0]]);
        await waitlist.whenIdle();
        assert.deepEqual(served, []); // binh cần 1 phòng và có 1 phòng trống, nhưng phải chờ an

        await holds.releaseHolds("filler-0", [allSeatIds[1]]);
        await waitlist.whenIdle();
        assert.deepEqual(served, [["an", 2]]);

        await holds.releaseHolds("filler-0", [allSeatIds[2]]);
        await waitlist.whenIdle();
        assert.deepEqual(served, [["an", 2], ["binh", 1]]);
    });

    it("nhả nhiều phòng cùng lúc: phục vụ liên tiếp nhiều người trong một lượt", async () => {
        await fillEvent();
        const served = [];
        waitlist.events.on("waitlist-offered", (o) => served.push(o.userId));
        await waitlist.join("an", eventId, 1);
        await waitlist.join("binh", eventId, 1);

        await Promise.all(allSeatIds.slice(0, 6).map((id) => holds.releaseHolds("filler-0", [id])));
        await waitlist.whenIdle();
        assert.deepEqual(served, ["an", "binh"]);
    });

    it("hết hạn TTL cũng kích hoạt hàng đợi; người được mời không thanh toán -> chuyển cho người kế tiếp", async () => {
        await setup({ ttlMs: 500 }); // đủ dài để đặt kín 36 phòng trước khi phòng đầu tiên hết hạn
        await holds.holdSeats("filler", allSeatIds.slice(0, 6));
        for (let i = 6; i < 36; i += 6) await holds.holdSeats(`f${i}`, allSeatIds.slice(i, i + 6));
        const served = [];
        waitlist.events.on("waitlist-offered", (o) => served.push(o.userId));

        await waitlist.join("an", eventId, 1);
        await waitlist.join("binh", eventId, 1);
        await sleep(750); // hết TTL: 36 phòng nhả -> an, binh được mời (mỗi người giữ 1 phòng)
        await waitlist.whenIdle();
        assert.deepEqual(served, ["an", "binh"]);

        await sleep(700); // an và binh không thanh toán -> phòng nhả tiếp, hàng đã trống
        await waitlist.whenIdle();
        assert.equal((await db.find("holds")).length, 0);
    });

    it("ai đó giữ phòng vừa nhả trước: hàng đợi không lỗi, chờ lần nhả sau", async () => {
        await fillEvent();
        const served = [];
        waitlist.events.on("waitlist-offered", (o) => served.push(o.userId));
        await waitlist.join("an", eventId, 1);

        await holds.releaseHolds("filler-0", [allSeatIds[0]]);
        await holds.holdSeats("nguoi-nhanh-tay", [allSeatIds[0]]).catch(() => {}); // có thể thắng hoặc thua an
        await waitlist.whenIdle();

        // dù ai thắng, phòng đó chỉ có MỘT người giữ
        assert.equal((await holds.getHoldsBySeat(allSeatIds[0])).length, 1);
        assert.ok(served.length <= 1);
    });
});
