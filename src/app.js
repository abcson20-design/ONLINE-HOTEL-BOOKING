// Gắn bộ định tuyến (Router) vào trình duyệt:
// - "load": chạy một lần khi mở trang để hiển thị trang đầu tiên.
// - "hashchange": chạy lại mỗi khi đường dẫn #/... thay đổi (bấm menu, nút quay lại).
import Router from "./router/Router";

window.addEventListener(
    "load",
    Router
);

window.addEventListener(
    "hashchange",
    Router
);