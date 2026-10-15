import { icons } from "./icons";

// Các mục menu: đường dẫn (hash) và tên hiển thị.
const NAV = [
    { href: "#/",        label: "Trang chủ" },
    { href: "#/hotel",   label: "Phòng nghỉ" },
    { href: "#/stats",   label: "Thống kê" },
    { href: "#/contact", label: "Liên hệ" },
];

/** Thanh menu đầu trang; `active` là mục đang mở để tô sáng. */
function Header(active = "#/") {
    const items = NAV.map(n => `
        <li class="nav-item">
            <a class="nav-link ${n.href === active ? "active" : ""}" href="${n.href}">${n.label}</a>
        </li>`).join("");

    return `
    <header class="site-header">
        <nav class="navbar navbar-expand-lg">
            <div class="container">
                <a class="navbar-brand brand" href="#/">
                    <span class="brand-mark">${icons.hotel(20)}</span>
                    <span class="brand-text">Online<span>Hotel</span></span>
                </a>

                <button class="navbar-toggler border-0 shadow-none" type="button"
                        data-bs-toggle="collapse" data-bs-target="#mainNav"
                        aria-controls="mainNav" aria-expanded="false" aria-label="Mở menu">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="collapse navbar-collapse" id="mainNav">
                    <ul class="navbar-nav mx-auto gap-lg-2">${items}</ul>
                    <div class="d-flex gap-2 mt-3 mt-lg-0">
                        <a href="#/login" class="btn btn-outline-brand ${active === "#/login" ? "active" : ""}">Đăng nhập</a>
                        <a href="#/hotel" class="btn btn-primary">Đặt phòng</a>
                    </div>
                </div>
            </div>
        </nav>
    </header>`;
}

/** Chân trang: giới thiệu, liên kết nhanh và thông tin liên hệ. */
function Footer() {
    return `
    <footer class="site-footer">
        <div class="container">
            <div class="row g-4 py-5">
                <div class="col-lg-5">
                    <a class="brand brand-light mb-3 d-inline-flex" href="#/">
                        <span class="brand-mark">${icons.hotel(20)}</span>
                        <span class="brand-text">Online<span>Hotel</span></span>
                    </a>
                    <p class="footer-muted mb-0 pe-lg-5">
                        Hệ thống đặt phòng khách sạn trực tuyến nhanh chóng, minh bạch giá
                        và xác nhận ngay trong vài giây.
                    </p>
                </div>
                <div class="col-6 col-lg-3">
                    <h6 class="footer-title">Khám phá</h6>
                    <ul class="list-unstyled footer-links">
                        <li><a href="#/">Trang chủ</a></li>
                        <li><a href="#/hotel">Phòng nghỉ</a></li>
                        <li><a href="#/stats">Thống kê</a></li>
                        <li><a href="#/contact">Liên hệ</a></li>
                        <li><a href="#/login">Đăng nhập</a></li>
                    </ul>
                </div>
                <div class="col-6 col-lg-4">
                    <h6 class="footer-title">Liên hệ</h6>
                    <ul class="list-unstyled footer-links footer-contact">
                        <li>${icons.pin(18)} Thanh Hóa, Việt Nam</li>
                        <li>${icons.phone(18)} 036 222 5438 </li>
                        <li>${icons.mail(18)} abcson20@gmail.com</li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                © ${new Date().getFullYear()} Online Hotel Booking. Chất lượng hàng đầu Việt Nam.
            </div>
        </div>
    </footer>`;
}

/** Khung chung của mọi trang: Header + nội dung + Footer. */
export default function Layout(active, content) {
    return `${Header(active)}<main>${content}</main>${Footer()}`;
}
