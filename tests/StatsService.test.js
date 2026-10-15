import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { Database } from "../src/data/Database.js";
import { seedDatabase } from "../src/data/seed.js";
import { buildReport, StatsService } from "../src/services/StatsService.js";
import { PricingService } from "../src/services/PricingService.js";
import { addDemoBookings, clearDemoBookings } from "../src/data/demoData.js";

// Tạo mốc thời gian (ms) vào ngày `day` tháng 10/2026 lúc `hour` giờ.
const at = (day, hour) => new Date(2026, 9, day, hour, 0).getTime(); // tháng 10/2026, giờ địa phương
// "Bây giờ" cố định của bài test.
const NOW = at(14, 12);

// Dữ liệu giả: ba đêm (một đêm đã qua), sáu phòng với trạng thái khác nhau, ba đơn (hai đã thanh toán, một đã hủy).
const events = [
    { id: "e1", ten: "Đêm 14/10", thoi_gian: new Date(2026, 9, 14).toISOString() },
    { id: "e2", ten: "Đêm 15/10", thoi_gian: new Date(2026, 9, 15).toISOString() },
    { id: "old", ten: "Đêm 01/10", thoi_gian: new Date(2026, 9, 1).toISOString() },
];
// Tạo nhanh một phòng giả.
const mkSeat = (id, event_id, ma_phong, hang_phong, trang_thai) => ({ id, event_id, ma_phong, hang_phong, trang_thai, gia: 500_000 });
const seats = [
    mkSeat("e1-101", "e1", "101", "don", "da_dat"), mkSeat("e1-102", "e1", "102", "don", "dang_giu"),
    mkSeat("e1-111", "e1", "111", "vip", "da_dat"), mkSeat("e1-103", "e1", "103", "don", "trong"),
    mkSeat("e2-101", "e2", "101", "don", "da_dat"), mkSeat("e2-102", "e2", "102", "don", "trong"),
];
// Tạo nhanh một đơn giả.
const booking = (id, event_id, ghe, tong_tien, trang_thai, thoi_gian) =>
    ({ id, event_id, danh_sach_ghe: ghe, tong_tien, trang_thai, thoi_gian });

const bookings = [
    booking("b1", "e1", ["e1-101", "e1-111"], 2_000_000, "da_thanh_toan", at(13, 20)),
    booking("b2", "e2", ["e2-101"], 500_000, "da_thanh_toan", at(13, 9)),
    booking("b3", "e1", ["e1-102"], 500_000, "da_huy", at(13, 23)),
];

describe("buildReport", () => {
    const report = buildReport({ events, seats, bookings, now: NOW });

    it("tổng quan: chỉ đơn đã thanh toán tính vào doanh thu", () => {
        assert.equal(report.overview.totalRevenue, 2_500_000);
        assert.equal(report.overview.paidCount, 2);
        assert.equal(report.overview.cancelledCount, 1);
        assert.equal(report.overview.roomsSold, 3);
        assert.equal(report.overview.averageOrder, 1_250_000);
        assert.ok(Math.abs(report.overview.cancelRate - 1 / 3) < 1e-9);
    });

    it("tỉ lệ lấp đầy theo đêm; bỏ qua các đêm đã qua", () => {
        assert.deepEqual(report.occupancyByEvent.map((e) => e.eventId), ["e1", "e2"]);
        const [e1, e2] = report.occupancyByEvent;
        assert.deepEqual([e1.booked, e1.held, e1.total, e1.rate], [2, 1, 4, 0.5]);
        assert.deepEqual([e2.booked, e2.total, e2.rate], [1, 2, 0.5]);
        assert.equal(report.overview.averageOccupancy, 3 / 6);
    });

    it("doanh thu theo đêm lưu trú và theo ngày đặt", () => {
        assert.deepEqual(report.revenueByEvent.map((e) => [e.eventId, e.revenue]), [["e1", 2_000_000], ["e2", 500_000]]);
        assert.deepEqual(report.revenueByBookingDay.map((d) => [d.day, d.revenue]), [["2026-10-13", 2_500_000]]);
    });

    it("phòng bán chạy: phòng 101 bán 2 lần (2 đêm) đứng đầu", () => {
        assert.deepEqual(report.topRooms[0], { ma_phong: "101", hang_phong: "don", count: 2 });
        assert.deepEqual(report.topRooms.map((r) => r.ma_phong), ["101", "111"]);
    });

    it("khung giờ đặt phòng: 9h -> sáng, 20h -> tối; đơn hủy không tính", () => {
        const byId = Object.fromEntries(report.byHourBucket.map((b) => [b.id, b]));
        assert.equal(byId.sang.bookings, 1);
        assert.equal(byId.toi.bookings, 1);
        assert.equal(byId.dem.bookings, 0); // đơn hủy lúc 23h không được tính
        assert.equal(byId.chieu.revenue, 0);
    });

    it("phân theo hạng phòng", () => {
        assert.deepEqual(report.byRoomType, [{ hang_phong: "don", rooms: 2 }, { hang_phong: "vip", rooms: 1 }]);
    });
});

describe("buildReport – ca biên", () => {
    it("không có dữ liệu -> mọi số về 0, không NaN/Infinity", () => {
        const empty = buildReport({ events: [], seats: [], bookings: [], now: NOW });
        assert.deepEqual(empty.overview, {
            totalRevenue: 0, paidCount: 0, cancelledCount: 0, roomsSold: 0, averageOrder: 0, cancelRate: 0, averageOccupancy: 0,
        });
        assert.equal(empty.topRooms.length, 0);
        assert.equal(empty.byHourBucket.length, 4);
    });

    it("chỉ có đơn hủy -> tỉ lệ hủy 100%, doanh thu 0", () => {
        const report = buildReport({ events, seats, bookings: [bookings[2]], now: NOW });
        assert.equal(report.overview.cancelRate, 1);
        assert.equal(report.overview.totalRevenue, 0);
    });

    it("đơn tham chiếu phòng không còn tồn tại thì bỏ qua phòng đó, không lỗi", () => {
        const report = buildReport({ events, seats, bookings: [booking("bx", "e1", ["ghost"], 1, "da_thanh_toan", at(13, 10))], now: NOW });
        assert.equal(report.topRooms.length, 0);
        assert.equal(report.overview.paidCount, 1);
    });

    it("ranh giới khung giờ: 4h là đêm, 5h là sáng, 11h sáng, 12h chiều, 22h tối, 23h đêm", () => {
        const at1 = (hour) => buildReport({
            events, seats, bookings: [booking("b", "e1", ["e1-101"], 1, "da_thanh_toan", at(13, hour))], now: NOW,
        }).byHourBucket.find((b) => b.bookings === 1).id;
        assert.deepEqual([4, 5, 11, 12, 22, 23, 0].map(at1), ["dem", "sang", "sang", "chieu", "toi", "dem", "dem"]);
    });
});

describe("Dữ liệu mẫu + StatsService", () => {
    const pricing = new PricingService();

    it("thêm đơn mẫu: phòng chuyển 'da_dat', báo cáo có số liệu; xóa thì trả về như cũ", async () => {
        const db = seedDatabase(new Database());
        const stats = new StatsService(db);

        const added = await addDemoBookings(db, pricing, { count: 30 });
        assert.equal(added, 30);
        const report = await stats.getReport();
        assert.ok(report.overview.paidCount > 0);
        assert.ok(report.overview.totalRevenue > 0);
        assert.ok(report.overview.averageOccupancy > 0);
        assert.equal(report.overview.paidCount + report.overview.cancelledCount, 30);

        // không phòng nào bị đặt hai lần
        const booked = (await db.find("bookings", (b) => b.trang_thai === "da_thanh_toan")).flatMap((b) => b.danh_sach_ghe);
        assert.equal(new Set(booked).size, booked.length);

        await clearDemoBookings(db);
        const after = await stats.getReport();
        assert.equal(after.overview.paidCount, 0);
        assert.equal((await db.find("seats", (s) => s.trang_thai !== "trong")).length, 0);
    });

    it("không đụng tới đơn thật khi xóa dữ liệu mẫu", async () => {
        const db = seedDatabase(new Database());
        await db.insert("bookings", { user_id: "that", event_id: "x", danh_sach_ghe: [], tong_tien: 1, trang_thai: "da_thanh_toan", thoi_gian: 1 });
        await addDemoBookings(db, pricing, { count: 5 });
        await clearDemoBookings(db);
        assert.equal((await db.find("bookings")).length, 1);
    });
});
