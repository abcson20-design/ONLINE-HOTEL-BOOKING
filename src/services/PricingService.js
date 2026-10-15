/**
 * TẦNG NGHIỆP VỤ – tính giá. Là lớp THUẦN (không đọc DB, không async): cùng đầu vào luôn ra cùng kết quả,
 * nên rất dễ kiểm thử. BookingService tính lại giá ở phía service, không tin số tiền do giao diện gửi lên.
 *
 * Thứ tự tính:  giá gốc theo hạng phòng
 *            -> nhân hệ số đêm (cuối tuần / dịp lễ)          = tiền phòng
 *            -> cộng combo                                    = tạm tính
 *            -> trừ mã giảm giá (áp trên tạm tính)            = tổng thanh toán
 *
 * Quy tắc hệ số đêm: đêm vừa cuối tuần vừa lễ thì lấy hệ số CAO HƠN (không cộng dồn) để giá không tăng phi lý.
 */
import { COMBOS, COUPONS, HOLIDAYS } from "../data/pricingCatalog.js";
import { ValidationError } from "./errors.js";

// Thêm số 0 phía trước cho đủ 2 chữ số.
const pad = (n) => String(n).padStart(2, "0");
// Làm tròn đến nghìn đồng gần nhất.
const roundToThousand = (value) => Math.round(value / 1000) * 1000;
// Đêm thường: không phụ thu.
const NORMAL_NIGHT = Object.freeze({ kind: "binh_thuong", multiplier: 1, label: null });

export class PricingService {
    #weekendRate;
    #holidayRate;
    #weekendDays;
    #holidays;
    #combos;
    #coupons;

    /** weekendDays: 0 = Chủ nhật … 6 = Thứ bảy; mặc định đêm thứ Sáu (5) và thứ Bảy (6). */
    constructor({
        weekendRate = 0.2, holidayRate = 0.3, weekendDays = [5, 6],
        holidays = HOLIDAYS, combos = COMBOS, coupons = COUPONS,
    } = {}) {
        this.#weekendRate = weekendRate;
        this.#holidayRate = holidayRate;
        this.#weekendDays = weekendDays;
        this.#holidays = holidays;
        this.#combos = new Map(combos.map((combo) => [combo.id, combo]));
        this.#coupons = new Map(Object.entries(coupons).map(([code, rule]) => [code.toUpperCase(), rule]));
    }

    // Danh sách combo dịch vụ có thể chọn thêm.
    listCombos() { return [...this.#combos.values()]; }
    // Danh sách mã giảm giá (mã + mô tả) để hiển thị cho khách.
    listCoupons() { return [...this.#coupons].map(([code, rule]) => ({ code, mo_ta: rule.mo_ta })); }

    /** Đêm này là bình thường, cuối tuần hay dịp lễ? Trả về { kind, multiplier, label }. */
    describeNight(date) {
        const day = new Date(date);
        if (Number.isNaN(day.getTime())) throw new ValidationError("Ngày lưu trú không hợp lệ");

        const monthDay = `${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
        const holiday = this.#holidays.find((item) => item.date === monthDay);
        const candidates = [];

        if (holiday && this.#holidayRate > 0) {
            candidates.push({ kind: "le", multiplier: 1 + this.#holidayRate, label: `Dịp lễ: ${holiday.ten}` });
        }
        if (this.#weekendDays.includes(day.getDay()) && this.#weekendRate > 0) {
            candidates.push({ kind: "cuoi_tuan", multiplier: 1 + this.#weekendRate, label: "Đêm cuối tuần" });
        }
        // reduce với ">" nên khi hai hệ số bằng nhau thì giữ mục đứng trước (ngày lễ)
        return candidates.reduce((best, item) => (item.multiplier > best.multiplier ? item : best), NORMAL_NIGHT);
    }

    /** Giá một phòng trong đêm `date` (đã làm tròn đến nghìn đồng). */
    roomPrice(basePrice, date) {
        return roundToThousand(basePrice * this.describeNight(date).multiplier);
    }

    /**
     * @param {{seats: object[], date: string|Date, comboIds?: string[], couponCode?: string}} request
     * @returns báo giá chi tiết: rooms, roomsBase, surcharge, roomsTotal, combos, combosTotal, subtotal, coupon, discount, total
     * @throws {ValidationError} không có phòng, combo không tồn tại, mã giảm giá sai/không đủ điều kiện
     */
    quote({ seats, date, comboIds = [], couponCode = "" }) {
        if (!Array.isArray(seats) || seats.length === 0) throw new ValidationError("Chưa chọn phòng nào");

        const night = this.describeNight(date);
        const rooms = seats.map((seat) => ({
            seatId: seat.id, ma_phong: seat.ma_phong, hang_phong: seat.hang_phong,
            basePrice: seat.gia, price: roundToThousand(seat.gia * night.multiplier),
        }));
        const roomsBase = rooms.reduce((sum, room) => sum + room.basePrice, 0);
        const roomsTotal = rooms.reduce((sum, room) => sum + room.price, 0);

        const combos = [...new Set(comboIds)].map((id) => this.#priceCombo(id, seats.length));
        const combosTotal = combos.reduce((sum, combo) => sum + combo.amount, 0);
        const subtotal = roomsTotal + combosTotal;

        const coupon = this.#applyCoupon(couponCode, { subtotal, roomCount: seats.length });
        const discount = coupon?.amount ?? 0;

        return {
            nightKind: night.kind, nightLabel: night.label, multiplier: night.multiplier,
            rooms, roomsBase, surcharge: roomsTotal - roomsBase, roomsTotal,
            combos, combosTotal, subtotal, coupon, discount, total: subtotal - discount,
        };
    }

    // ---------- Nội bộ ----------

    /** Tính tiền một combo: nhân theo số phòng hoặc tính một lần cho cả đơn; báo lỗi nếu combo không tồn tại. */
    #priceCombo(id, roomCount) {
        const combo = this.#combos.get(id);
        if (!combo) throw new ValidationError(`Combo không tồn tại: ${id}`, { field: "combo" });
        const quantity = combo.tinh_theo === "phong" ? roomCount : 1;
        return { id, ten: combo.ten, unitPrice: combo.gia, quantity, amount: combo.gia * quantity };
    }

    /** Kiểm tra mã giảm giá (tồn tại, đủ đơn tối thiểu, đủ số phòng) và tính số tiền được giảm; trả về null nếu không nhập mã. */
    #applyCoupon(couponCode, { subtotal, roomCount }) {
        const code = String(couponCode ?? "").trim().toUpperCase();
        if (code === "") return null;

        const rule = this.#coupons.get(code);
        const fail = (message) => new ValidationError(message, { field: "coupon" });

        if (!rule) throw fail("Mã giảm giá không hợp lệ");
        if (rule.don_toi_thieu && subtotal < rule.don_toi_thieu) {
            throw fail(`Mã ${code} chỉ áp dụng cho đơn từ ${rule.don_toi_thieu.toLocaleString("vi-VN")}₫`);
        }
        if (rule.so_phong_toi_thieu && roomCount < rule.so_phong_toi_thieu) {
            throw fail(`Mã ${code} chỉ áp dụng khi đặt từ ${rule.so_phong_toi_thieu} phòng`);
        }

        let amount = rule.loai === "phan_tram" ? roundToThousand((subtotal * rule.gia_tri) / 100) : rule.gia_tri;
        if (rule.toi_da) amount = Math.min(amount, rule.toi_da);
        amount = Math.min(amount, subtotal); // không bao giờ giảm quá tổng tiền

        return { code, mo_ta: rule.mo_ta, amount };
    }
}
