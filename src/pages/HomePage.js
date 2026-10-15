import Layout from "../components/Layout";
import { icons } from "../components/icons";
import { HERO_SLIDES, IMAGES } from "../data/heroSlides";

// Bốn điểm mạnh hiển thị ở mục "Vì sao chọn chúng tôi".
const FEATURES = [
    { icon: icons.tag(26),      title: "Giá minh bạch",     text: "Giá niêm yết rõ ràng, không phụ phí ẩn khi thanh toán." },
    { icon: icons.clock(26),    title: "Đặt phòng nhanh",   text: "Chọn phòng và nhận xác nhận chỉ trong vài giây." },
    { icon: icons.shield(26),   title: "An toàn & tin cậy", text: "Thông tin khách hàng được bảo mật tuyệt đối." },
    { icon: icons.headset(26),  title: "Hỗ trợ 24/7",       text: "Đội ngũ lễ tân luôn sẵn sàng hỗ trợ bạn mọi lúc." },
];

// Thông tin ba hạng phòng hiển thị ở thẻ trên trang chủ.
const ROOM_TYPES = [
    { name: "Phòng đơn", price: "500.000", guests: "1 khách", img: IMAGES.roomSingle, badge: "Tiết kiệm",
      text: "Không gian gọn gàng, ấm cúng, phù hợp khách đi công tác." },
    { name: "Phòng đôi", price: "800.000", guests: "2 khách", img: IMAGES.roomDouble, badge: "Phổ biến",
      text: "Giường đôi rộng rãi, ban công thoáng mát cho cặp đôi hoặc bạn bè." },
    { name: "Phòng VIP", price: "1.500.000", guests: "3 khách", img: IMAGES.roomVip, badge: "Cao cấp",
      text: "Suite sang trọng với phòng khách riêng và tiện nghi đầy đủ." },
];

/** Trang chủ: banner slideshow, ô tìm phòng, thống kê nhanh, các hạng phòng, điểm mạnh và giới thiệu. */
export default function HomePage() {
    const features = FEATURES.map(f => `
        <div class="col-sm-6 col-lg-3">
            <div class="feature-card h-100">
                <div class="feature-icon">${f.icon}</div>
                <h5>${f.title}</h5>
                <p class="mb-0">${f.text}</p>
            </div>
        </div>`).join("");

    const rooms = ROOM_TYPES.map(r => `
        <div class="col-md-6 col-lg-4">
            <article class="card room-card type-card h-100">
                <div class="room-img-wrap">
                    <img src="${r.img}" alt="${r.name}" loading="lazy">
                    <span class="room-badge">${r.badge}</span>
                </div>
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="mb-0">${r.name}</h5>
                        <span class="guest-chip">${icons.users(16)} ${r.guests}</span>
                    </div>
                    <p class="text-muted">${r.text}</p>
                    <div class="d-flex justify-content-between align-items-end mt-3">
                        <div class="price-block">
                            <span class="price">${r.price}₫</span><small>/đêm</small>
                        </div>
                        <a href="#/hotel" class="btn btn-sm btn-outline-brand">Xem phòng</a>
                    </div>
                </div>
            </article>
        </div>`).join("");

    const slides = HERO_SLIDES.map((sl, i) => `
        <div class="carousel-item ${i === 0 ? "active" : ""}" data-bs-interval="4500">
            <img src="${sl.img}" class="d-block w-100" alt="${sl.alt}">
            <div class="carousel-caption-box">${sl.caption}</div>
        </div>`).join("");
    const indicators = HERO_SLIDES.map((sl, i) => `
        <button type="button" data-bs-target="#heroCarousel" data-bs-slide-to="${i}"
            class="${i === 0 ? "active" : ""}" aria-label="${sl.alt}"
            ${i === 0 ? 'aria-current="true"' : ""}></button>`).join("");

    return Layout("#/", `

    <!-- HERO -->
    <section class="hero">
        <div id="heroCarousel" class="carousel slide carousel-fade hero-carousel" data-bs-ride="carousel">
            <div class="carousel-indicators">${indicators}</div>
            <div class="carousel-inner">${slides}</div>
            <button class="carousel-control-prev" type="button" data-bs-target="#heroCarousel" data-bs-slide="prev" aria-label="Ảnh trước">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            </button>
            <button class="carousel-control-next" type="button" data-bs-target="#heroCarousel" data-bs-slide="next" aria-label="Ảnh sau">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
            </button>
            <div class="hero-overlay">
                <div class="container text-center">
                    <span class="hero-pill">${icons.star(16)} Đặt phòng trực tuyến dễ dàng</span>
                    <h1 class="hero-title">Tìm kỳ nghỉ <span>hoàn hảo</span><br>cho chuyến đi của bạn</h1>
                    <p class="hero-sub">
                        Hệ thống đặt phòng khách sạn trực tuyến với 36 phòng tiện nghi,
                        giá tốt và xác nhận tức thì.
                    </p>
                </div>
            </div>
        </div>

        <div class="container position-relative">
            <div class="search-card">
                <div class="row g-3 align-items-end">
                    <div class="col-md-6 col-lg-3">
                        <label class="form-label">${icons.calendar(16)} Nhận phòng</label>
                        <input type="date" class="form-control">
                    </div>
                    <div class="col-md-6 col-lg-3">
                        <label class="form-label">${icons.calendar(16)} Trả phòng</label>
                        <input type="date" class="form-control">
                    </div>
                    <div class="col-md-6 col-lg-3">
                        <label class="form-label">${icons.users(16)} Số khách</label>
                        <select class="form-select">
                            <option>1 khách</option>
                            <option selected>2 khách</option>
                            <option>3 khách</option>
                            <option>4+ khách</option>
                        </select>
                    </div>
                    <div class="col-md-6 col-lg-3">
                        <a href="#/hotel" class="btn btn-primary btn-lg w-100">
                            ${icons.search(18)} Tìm phòng
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- STATS -->
    <section class="stats">
        <div class="container">
            <div class="stats-card">
                <div class="row text-center g-4">
                    <div class="col-6 col-md-3"><div class="stat-num">3</div><div class="stat-label">Tầng</div></div>
                    <div class="col-6 col-md-3"><div class="stat-num">36</div><div class="stat-label">Phòng nghỉ</div></div>
                    <div class="col-6 col-md-3"><div class="stat-num">3</div><div class="stat-label">Hạng phòng</div></div>
                    <div class="col-6 col-md-3"><div class="stat-num">24/7</div><div class="stat-label">Hỗ trợ</div></div>
                </div>
            </div>
        </div>
    </section>

    <!-- FEATURES -->
    <section class="section">
        <div class="container">
            <div class="section-head text-center">
                <span class="eyebrow">Vì sao chọn chúng tôi</span>
                <h2>Trải nghiệm đặt phòng trọn vẹn</h2>
                <p>Mọi thứ bạn cần cho một kỳ nghỉ thoải mái đều nằm trong tầm tay.</p>
            </div>
            <div class="row g-4">${features}</div>
        </div>
    </section>

    <!-- ROOM TYPES -->
    <section class="section section-tint">
        <div class="container">
            <div class="section-head text-center">
                <span class="eyebrow">Hạng phòng</span>
                <h2>Lựa chọn phù hợp với bạn</h2>
                <p>Ba hạng phòng đa dạng, đáp ứng mọi nhu cầu và ngân sách.</p>
            </div>
            <div class="row g-4">${rooms}</div>
            <div class="text-center mt-5">
                <a href="#/hotel" class="btn btn-primary btn-lg">
                    Xem tất cả phòng ${icons.arrow(18)}
                </a>
            </div>
        </div>
    </section>

    <!-- ABOUT -->
    <section class="section">
        <div class="container">
            <div class="row align-items-center g-5">
                <div class="col-lg-6">
                    <div class="about-visual">
                        <img src="${IMAGES.hotelLobby}" alt="Khách sạn" loading="lazy">
                        <div class="about-float">
                            <strong>36</strong>
                            <span>phòng tiện nghi</span>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <span class="eyebrow">Giới thiệu</span>
                    <h2 class="mb-3">Khách sạn hiện đại, phục vụ tận tâm</h2>
                    <p class="text-muted mb-4">
                        Khách sạn được thiết kế theo phong cách hiện đại, mang lại không gian
                        nghỉ ngơi thoải mái cho mọi du khách.
                    </p>
                    <ul class="check-list">
                        <li>Khách sạn gồm 3 tầng</li>
                        <li>Mỗi tầng có 12 phòng</li>
                        <li>Đặt phòng trực tuyến nhanh chóng</li>
                        <li>Wifi miễn phí, điều hòa, TV màn hình phẳng</li>
                    </ul>
                    <a href="#/contact" class="btn btn-outline-brand mt-2">Liên hệ với chúng tôi</a>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA -->
    <section class="cta">
        <div class="container text-center">
            <h2>Sẵn sàng cho chuyến đi tiếp theo?</h2>
            <p>Đặt phòng ngay hôm nay để nhận mức giá tốt nhất.</p>
            <a href="#/hotel" class="btn btn-light btn-lg cta-btn">Đặt phòng ngay</a>
        </div>
    </section>
    `);
}
