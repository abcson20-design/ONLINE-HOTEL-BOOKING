/** Hàm định dạng dùng chung cho tầng giao diện. */
/** Định dạng tiền Việt: 500000 -> "500.000₫". */
export const formatMoney = (amount) => `${Number(amount).toLocaleString("vi-VN")}₫`;

/** Giá rút gọn cho chỗ hẹp: 500000 -> "500k", 1500000 -> "1.5tr". */
export const formatShortPrice = (amount) =>
    amount >= 1_000_000 ? `${amount / 1_000_000}tr` : `${Math.round(amount / 1000)}k`;

/** Thêm số 0 phía trước cho đủ 2 chữ số: 5 -> "05". */
const pad = (n) => String(n).padStart(2, "0");

/** 125000ms -> "02:05" */
export const formatCountdown = (ms) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    return `${pad(Math.floor(totalSeconds / 60))}:${pad(totalSeconds % 60)}`;
};

/** Đổi mốc thời gian (ms) thành chuỗi ngày giờ kiểu Việt Nam. */
export const formatDateTime = (timestamp) => new Date(timestamp).toLocaleString("vi-VN");

/** Bảng thay thế các ký tự đặc biệt của HTML bằng mã an toàn. */
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Chống chèn HTML/JS từ dữ liệu người dùng nhập (XSS) trước khi đưa vào innerHTML. */
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
