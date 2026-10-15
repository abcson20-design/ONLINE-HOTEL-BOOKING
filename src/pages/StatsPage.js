import Layout from "../components/Layout";
import { icons } from "../components/icons";
import { mountStatsPage } from "../ui/statsPageController.js";

/** Trang "Thống kê": khung HTML với các nút làm mới / tạo / xóa dữ liệu mẫu và vùng hiển thị báo cáo. */
export default function StatsPage() {
    return Layout("#/stats", `
    <section class="page-hero">
        <div class="container text-center">
            <span class="hero-pill">${icons.star(16)} Báo cáo</span>
            <h1>Thống kê đặt phòng</h1>
            <p>Tỉ lệ lấp đầy, doanh thu và phòng bán chạy – cập nhật theo dữ liệu đặt phòng thực tế.</p>
        </div>
    </section>

    <section class="section pt-4">
        <div class="container">
            <div class="stats-toolbar">
                <p id="statsNotice" class="mb-0 text-muted">Số liệu chỉ tính các đơn đã thanh toán.</p>
                <div class="d-flex flex-wrap gap-2">
                    <button id="statsRefresh" class="btn btn-outline-brand btn-sm">Làm mới</button>
                    <button id="statsAddDemo" class="btn btn-primary btn-sm">Tạo dữ liệu mẫu</button>
                    <button id="statsClearDemo" class="btn btn-outline-brand btn-sm">Xóa dữ liệu mẫu</button>
                </div>
            </div>
            <div id="statsBody"><p class="panel-note">Đang tải số liệu…</p></div>
        </div>
    </section>
    `);
}

/** Router gọi sau khi vẽ trang; trả về hàm dọn dẹp khi rời trang. */
export function initStatsPage() {
    return mountStatsPage();
}
