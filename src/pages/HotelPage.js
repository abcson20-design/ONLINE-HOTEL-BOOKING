import Layout from "../components/Layout";
import { icons } from "../components/icons";
import { mountHotelPage } from "../ui/hotelPageController.js";

/** Trang "Phòng nghỉ": khung HTML gồm bộ lọc, danh sách thẻ phòng theo tầng, cột giữ phòng/hàng đợi/đơn/mô phỏng và hộp thoại thanh toán. */
export default function HotelPage() {
    return Layout("#/hotel", `
    <section class="page-hero">
        <div class="container text-center">
            <span class="hero-pill">${icons.hotel(16)} Đặt phòng trực tuyến</span>
            <h1>Chọn phòng &amp; giữ chỗ</h1>
            <p>Bấm vào phòng trống để giữ chỗ, hoàn tất thanh toán trước khi hết thời gian giữ.</p>
        </div>
    </section>

    <section class="section pt-4">
        <div class="container">

            <div class="booking-toolbar">
                <div class="toolbar-field">
                    <label class="form-label" for="nightSelect">${icons.calendar(16)} Đêm lưu trú</label>
                    <select id="nightSelect" class="form-select"></select>
                    <span id="nightBadge" class="night-badge"></span>
                </div>
                <div class="toolbar-field">
                    <label class="form-label" for="ttlSelect">${icons.clock(16)} Thời gian giữ phòng</label>
                    <select id="ttlSelect" class="form-select"></select>
                </div>
                <div class="toolbar-field toolbar-grow">
                    <label class="form-label">Hạng phòng</label>
                    <div class="filter-bar filter-inline" id="roomFilter">
                        <button class="chip active" data-filter="all">Tất cả</button>
                        <button class="chip" data-filter="don">Đơn</button>
                        <button class="chip" data-filter="doi">Đôi</button>
                        <button class="chip" data-filter="vip">VIP</button>
                    </div>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-lg-8">
                    <div class="map-card">
                        <div class="map-head">
                            <div class="seat-summary" id="seatSummary"></div>
                            <div class="legend">
                                <span><i class="dot dot-trong"></i>Trống</span>
                                <span><i class="dot dot-mine"></i>Bạn giữ</span>
                                <span><i class="dot dot-giu"></i>Người khác giữ</span>
                                <span><i class="dot dot-dat"></i>Đã đặt</span>
                            </div>
                        </div>
                        <div class="seat-map" id="seatMap"><p class="panel-note p-4">Đang tải sơ đồ phòng…</p></div>
                    </div>
                </div>

                <div class="col-lg-4">
                    <aside class="side-stack">
                        <div class="side-card">
                            <h5 class="side-title">${icons.bed(20)} Phòng bạn đang giữ</h5>
                            <div id="holdPanel"></div>
                        </div>

                        <div class="side-card">
                            <h5 class="side-title">${icons.users(20)} Hàng đợi</h5>
                            <div id="waitlistCard"></div>
                        </div>

                        <div class="side-card">
                            <h5 class="side-title">${icons.tag(20)} Đơn của bạn</h5>
                            <div id="myBookings"></div>
                        </div>

                        <div class="side-card">
                            <h5 class="side-title">${icons.users(20)} Mô phỏng đặt đồng thời</h5>
                            <p class="panel-note">Gửi nhiều yêu cầu giữ phòng cùng lúc để kiểm tra hệ thống không cho đặt trùng.</p>
                            <div class="d-flex gap-2 mb-2">
                                <input id="simUsers" type="number" min="2" max="100" value="30" class="form-control" aria-label="Số người dùng ảo">
                                <button id="simRun" class="btn btn-primary text-nowrap">Chạy</button>
                            </div>
                            <div class="d-flex gap-2">
                                <button id="simFill" class="btn btn-outline-brand btn-sm flex-fill">Đặt kín đêm này</button>
                                <button id="simClear" class="btn btn-outline-brand btn-sm flex-fill">Nhả phòng mô phỏng</button>
                            </div>
                            <div id="simResult" class="mt-3"></div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    </section>

    <div class="modal fade" id="checkoutModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content" id="checkoutContent"></div>
        </div>
    </div>
    `);
}

/** Router gọi sau khi render; giá trị trả về là hàm dọn dẹp khi rời trang. */
export function initHotelPage() {
    return mountHotelPage();
}
