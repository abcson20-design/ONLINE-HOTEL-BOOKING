import HomePage from "../pages/HomePage";
import HotelPage, { initHotelPage } from "../pages/HotelPage";
import StatsPage, { initStatsPage } from "../pages/StatsPage";
import ContactPage from "../pages/ContactPage";
import LoginPage from "../pages/LoginPage";

// Hàm dọn dẹp của trang hiện tại (hủy timer, sự kiện) – chạy trước khi chuyển trang.
let cleanupCurrentPage = null; // dọn timer/sự kiện của trang trước khi chuyển trang

/**
 * Bộ định tuyến theo hash: đọc `#/...` trên thanh địa chỉ, vẽ trang tương ứng vào thẻ #app,
 * rồi khởi tạo hành vi (initXxxPage) cho các trang cần tương tác, và cuộn lên đầu trang.
 */
export default function Router() {

    cleanupCurrentPage?.();
    cleanupCurrentPage = null;

    const app = document.getElementById("app");
    const hash = window.location.hash || "#/";

    switch (hash) {

        case "#/hotel":
            app.innerHTML = HotelPage();
            cleanupCurrentPage = initHotelPage();
            break;

        case "#/stats":
            app.innerHTML = StatsPage();
            cleanupCurrentPage = initStatsPage();
            break;

        case "#/contact":
            app.innerHTML = ContactPage();
            break;

        case "#/login":
            app.innerHTML = LoginPage();
            break;

        default:
            app.innerHTML = HomePage();
    }

    window.scrollTo({ top: 0, behavior: "instant" });
}
