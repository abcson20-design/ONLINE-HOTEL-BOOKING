import Layout from "../components/Layout";
import { icons } from "../components/icons";

/** Trang đăng nhập / đăng ký (giao diện minh họa). */
export default function LoginPage() {
    return Layout("#/login", `
    <section class="auth-section">
        <div class="container">
            <div class="auth-card">
                <div class="row g-0">
                    <div class="col-lg-5 d-none d-lg-flex auth-side">
                        <div>
                            <span class="brand-mark mb-4">${icons.hotel(22)}</span>
                            <h3>Chào mừng trở lại!</h3>
                            <p>Đăng nhập để quản lý đặt phòng và nhận ưu đãi dành riêng cho thành viên.</p>
                        </div>
                    </div>
                    <div class="col-lg-7">
                        <div class="auth-form">
                            <h2>Đăng nhập</h2>
                            <p class="text-muted mb-4">Nhập thông tin tài khoản của bạn</p>
                            <form>
                                <div class="mb-3">
                                    <label class="form-label" for="l-email">Email</label>
                                    <input id="l-email" type="email" class="form-control form-control-lg" placeholder="email@example.com">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label" for="l-pass">Mật khẩu</label>
                                    <input id="l-pass" type="password" class="form-control form-control-lg" placeholder="••••••••">
                                </div>
                                <div class="d-flex justify-content-between align-items-center mb-4">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="l-remember">
                                        <label class="form-check-label" for="l-remember">Ghi nhớ tôi</label>
                                    </div>
                                    <a href="#/login" class="link-brand small">Quên mật khẩu?</a>
                                </div>
                                <button class="btn btn-primary btn-lg w-100" type="button">Đăng nhập</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
    `);
}
