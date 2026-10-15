import Layout from "../components/Layout";
import { icons } from "../components/icons";

/** Trang liên hệ: thông tin khách sạn và form gửi tin nhắn. */
export default function ContactPage() {
    return Layout("#/contact", `
    <section class="page-hero">
        <div class="container text-center">
            <span class="hero-pill">${icons.mail(16)} Liên hệ</span>
            <h1>Chúng tôi luôn lắng nghe bạn</h1>
            <p>Gửi câu hỏi hoặc yêu cầu, đội ngũ sẽ phản hồi trong thời gian sớm nhất.</p>
        </div>
    </section>

    <section class="section pt-4">
        <div class="container">
            <div class="row g-4 justify-content-center">
                <div class="col-lg-4">
                    <div class="info-card h-100">
                        <h4 class="mb-4">Thông tin liên hệ</h4>
                        <div class="info-item">
                            <span class="info-icon">${icons.pin(20)}</span>
                            <div><strong>Địa chỉ</strong><br>Thanh Hóa, Việt Nam</div>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">${icons.phone(20)}</span>
                            <div><strong>Điện thoại</strong><br>1900 1234</div>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">${icons.mail(20)}</span>
                            <div><strong>Email</strong><br>support@onlinehotel.vn</div>
                        </div>
                        <div class="info-item mb-0">
                            <span class="info-icon">${icons.clock(20)}</span>
                            <div><strong>Giờ làm việc</strong><br>Hỗ trợ 24/7</div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-7">
                    <div class="form-card">
                        <h4 class="mb-4">Gửi tin nhắn</h4>
                        <form>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label" for="c-name">Họ tên</label>
                                    <input id="c-name" class="form-control" placeholder="Nguyễn Văn A">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label" for="c-email">Email</label>
                                    <input id="c-email" type="email" class="form-control" placeholder="email@example.com">
                                </div>
                                <div class="col-12">
                                    <label class="form-label" for="c-msg">Nội dung</label>
                                    <textarea id="c-msg" class="form-control" rows="5"
                                              placeholder="Bạn cần chúng tôi hỗ trợ điều gì?"></textarea>
                                </div>
                                <div class="col-12">
                                    <button class="btn btn-primary btn-lg px-5" type="button">Gửi tin nhắn</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </section>
    `);
}
