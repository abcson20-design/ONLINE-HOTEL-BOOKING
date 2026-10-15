/**
 * Bảng cấu hình giá (dữ liệu, không phải logic) – muốn đổi giá/ngày lễ/mã giảm giá chỉ sửa file này.
 */

/** Ngày lễ lặp lại hằng năm, khai báo theo dương lịch "MM-DD". (Tết Nguyên đán theo âm lịch: thêm thủ công khi cần.) */
export const HOLIDAYS = Object.freeze([
    { date: "01-01", ten: "Tết Dương lịch" },
    { date: "04-30", ten: "Giải phóng miền Nam" },
    { date: "05-01", ten: "Quốc tế Lao động" },
    { date: "09-02", ten: "Quốc khánh" },
    { date: "10-20", ten: "Ngày Phụ nữ Việt Nam" },
    { date: "11-20", ten: "Ngày Nhà giáo Việt Nam" },
    { date: "12-24", ten: "Đêm Giáng sinh" },
    { date: "12-25", ten: "Giáng sinh" },
]);

/** Combo dịch vụ đi kèm. tinh_theo: "phong" = nhân theo số phòng, "don" = tính một lần cho cả đơn. */
export const COMBOS = Object.freeze([
    { id: "an_sang", ten: "Ăn sáng buffet", gia: 120_000, tinh_theo: "phong" },
    { id: "spa", ten: "Spa thư giãn 60 phút", gia: 350_000, tinh_theo: "phong" },
    { id: "dua_don", ten: "Đưa đón sân bay", gia: 250_000, tinh_theo: "don" },
]);

/**
 * Mã giảm giá. loai: "phan_tram" | "co_dinh".
 * Điều kiện: don_toi_thieu (VND), so_phong_toi_thieu; trần giảm: toi_da (VND, chỉ cho phần trăm).
 */
export const COUPONS = Object.freeze({
    WELCOME10: { loai: "phan_tram", gia_tri: 10, toi_da: 200_000, don_toi_thieu: 500_000, mo_ta: "Giảm 10% (tối đa 200.000₫) cho đơn từ 500.000₫" },
    GIAM50K: { loai: "co_dinh", gia_tri: 50_000, don_toi_thieu: 800_000, mo_ta: "Giảm 50.000₫ cho đơn từ 800.000₫" },
    NHOM15: { loai: "phan_tram", gia_tri: 15, toi_da: 300_000, so_phong_toi_thieu: 2, mo_ta: "Giảm 15% (tối đa 300.000₫) khi đặt từ 2 phòng" },
});
