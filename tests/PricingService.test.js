import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PricingService } from "../src/services/PricingService.js";

// Ngày cố định (giờ địa phương) để test không phụ thuộc hôm nay là ngày nào.
// Các ngày cố định (giờ địa phương) để kết quả test không phụ thuộc hôm nay là ngày nào.
const WEDNESDAY = new Date(2026, 9, 14);   // 14/10/2026 – thứ Tư
const FRIDAY = new Date(2026, 9, 16);      // 16/10/2026 – thứ Sáu
const SATURDAY = new Date(2026, 9, 17);
const HOLIDAY_WEEKDAY = new Date(2026, 9, 20); // 20/10/2026 – thứ Ba, Ngày Phụ nữ VN
const CHRISTMAS_FRIDAY = new Date(2026, 11, 25); // 25/12/2026 – thứ Sáu, vừa lễ vừa cuối tuần

// Ba phòng mẫu đại diện cho ba hạng: đơn, đôi, VIP.
const single = { id: "s1", ma_phong: "101", hang_phong: "don", gia: 500_000 };
const double = { id: "s2", ma_phong: "106", hang_phong: "doi", gia: 800_000 };
const vip = { id: "s3", ma_phong: "111", hang_phong: "vip", gia: 1_500_000 };

// PricingService dùng cấu hình mặc định để kiểm thử.
const pricing = new PricingService();

describe("Hệ số đêm", () => {
    it("ngày thường: giá gốc theo hạng phòng", () => {
        const quote = pricing.quote({ seats: [single, double, vip], date: WEDNESDAY });
        assert.equal(quote.total, 2_800_000);
        assert.equal(quote.surcharge, 0);
        assert.equal(quote.nightLabel, null);
    });

    it("đêm thứ Sáu và thứ Bảy phụ thu 20%", () => {
        for (const date of [FRIDAY, SATURDAY]) {
            const quote = pricing.quote({ seats: [double], date });
            assert.equal(quote.roomsTotal, 960_000);
            assert.equal(quote.surcharge, 160_000);
            assert.equal(quote.nightKind, "cuoi_tuan");
        }
    });

    it("dịp lễ phụ thu 30% kèm tên ngày lễ", () => {
        const quote = pricing.quote({ seats: [single], date: HOLIDAY_WEEKDAY });
        assert.equal(quote.roomsTotal, 650_000);
        assert.equal(quote.nightKind, "le");
        assert.match(quote.nightLabel, /Phụ nữ/);
    });

    it("vừa lễ vừa cuối tuần: lấy hệ số CAO HƠN, không cộng dồn", () => {
        const quote = pricing.quote({ seats: [single], date: CHRISTMAS_FRIDAY });
        assert.equal(quote.roomsTotal, 650_000); // 30%, không phải 50%
        assert.equal(quote.nightKind, "le");
    });

    it("cấu hình tỉ lệ bằng 0 thì không phụ thu", () => {
        const flat = new PricingService({ weekendRate: 0, holidayRate: 0 });
        assert.equal(flat.describeNight(FRIDAY).multiplier, 1);
        assert.equal(flat.describeNight(HOLIDAY_WEEKDAY).label, null);
    });

    it("làm tròn đến nghìn đồng", () => {
        const odd = new PricingService({ weekendRate: 0.333 });
        assert.equal(odd.roomPrice(500_000, FRIDAY) % 1000, 0);
    });

    it("ngày không hợp lệ -> VALIDATION", () => {
        assert.throws(() => pricing.describeNight("không phải ngày"), { code: "VALIDATION" });
    });
});

describe("Combo", () => {
    it("combo 'phong' nhân theo số phòng, combo 'don' chỉ tính một lần", () => {
        const quote = pricing.quote({ seats: [single, double], date: WEDNESDAY, comboIds: ["an_sang", "dua_don"] });
        const byId = Object.fromEntries(quote.combos.map((c) => [c.id, c]));
        assert.equal(byId.an_sang.amount, 240_000); // 120k x 2 phòng
        assert.equal(byId.dua_don.amount, 250_000); // 1 lần
        assert.equal(quote.total, 1_300_000 + 490_000);
    });

    it("combo trùng lặp chỉ tính một lần; combo không tồn tại -> lỗi", () => {
        const quote = pricing.quote({ seats: [single], date: WEDNESDAY, comboIds: ["spa", "spa"] });
        assert.equal(quote.combos.length, 1);
        assert.throws(() => pricing.quote({ seats: [single], date: WEDNESDAY, comboIds: ["khong-co"] }), { code: "VALIDATION" });
    });

    it("phụ thu cuối tuần KHÔNG áp lên combo", () => {
        const quote = pricing.quote({ seats: [single], date: FRIDAY, comboIds: ["an_sang"] });
        assert.equal(quote.combosTotal, 120_000);
        assert.equal(quote.total, 600_000 + 120_000);
    });
});

describe("Mã giảm giá", () => {
    it("WELCOME10: giảm 10% và bị chặn bởi trần 200.000₫", () => {
        const small = pricing.quote({ seats: [single], date: WEDNESDAY, couponCode: "WELCOME10" });
        assert.equal(small.discount, 50_000);
        const big = pricing.quote({ seats: [vip, vip, vip].map((s, i) => ({ ...s, id: `v${i}` })), date: WEDNESDAY, couponCode: "WELCOME10" });
        assert.equal(big.discount, 200_000); // 10% của 4,5tr = 450k -> chặn 200k
    });

    it("GIAM50K: giảm cố định, cần đơn từ 800.000₫", () => {
        assert.equal(pricing.quote({ seats: [double], date: WEDNESDAY, couponCode: "GIAM50K" }).total, 750_000);
        assert.throws(
            () => pricing.quote({ seats: [single], date: WEDNESDAY, couponCode: "GIAM50K" }),
            (e) => e.code === "VALIDATION" && e.details.field === "coupon" && /800\.000/.test(e.message),
        );
    });

    it("NHOM15: cần từ 2 phòng", () => {
        assert.throws(() => pricing.quote({ seats: [vip], date: WEDNESDAY, couponCode: "NHOM15" }), { code: "VALIDATION" });
        const quote = pricing.quote({ seats: [single, double], date: WEDNESDAY, couponCode: "NHOM15" });
        assert.equal(quote.discount, 195_000); // 15% của 1,3tr
    });

    it("không phân biệt hoa thường/khoảng trắng; mã rỗng = không dùng mã", () => {
        assert.equal(pricing.quote({ seats: [double], date: WEDNESDAY, couponCode: "  welcome10 " }).coupon.code, "WELCOME10");
        assert.equal(pricing.quote({ seats: [double], date: WEDNESDAY, couponCode: "   " }).coupon, null);
        assert.equal(pricing.quote({ seats: [double], date: WEDNESDAY, couponCode: undefined }).discount, 0);
    });

    it("mã không tồn tại -> lỗi ở ô coupon", () => {
        assert.throws(
            () => pricing.quote({ seats: [double], date: WEDNESDAY, couponCode: "FAKE" }),
            (e) => e.details.field === "coupon",
        );
    });

    it("giảm giá tính trên tạm tính (phòng đã phụ thu + combo)", () => {
        const quote = pricing.quote({ seats: [double], date: FRIDAY, comboIds: ["an_sang"], couponCode: "WELCOME10" });
        assert.equal(quote.subtotal, 960_000 + 120_000);
        assert.equal(quote.discount, 108_000);
        assert.equal(quote.total, 972_000);
    });

    it("không bao giờ giảm quá tổng tiền", () => {
        const tiny = new PricingService({ coupons: { X: { loai: "co_dinh", gia_tri: 9_999_999, mo_ta: "" } } });
        const quote = tiny.quote({ seats: [single], date: WEDNESDAY, couponCode: "X" });
        assert.equal(quote.total, 0);
        assert.ok(quote.total >= 0);
    });
});

describe("Đầu vào không hợp lệ", () => {
    it("không có phòng nào", () => {
        assert.throws(() => pricing.quote({ seats: [], date: WEDNESDAY }), { code: "VALIDATION" });
        assert.throws(() => pricing.quote({ seats: undefined, date: WEDNESDAY }), { code: "VALIDATION" });
    });
});
