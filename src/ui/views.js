/**
 * TẦNG GIAO DIỆN – các hàm THUẦN tạo HTML từ dữ liệu (không gọi service, không gắn sự kiện).
 * Mọi dữ liệu người dùng nhập đều đi qua escapeHtml trước khi đưa vào HTML.
 */
import { icons } from "../components/icons.js";
import { ROOM_TYPES } from "../data/seed.js";
import { IMAGES } from "../data/heroSlides.js";
import { formatMoney, formatCountdown, formatDateTime, escapeHtml } from "../utils/format.js";

// Nhãn trạng thái phòng (dùng cho mô tả/tooltip), nhãn trạng thái đơn, và các phương thức thanh toán.
const STATUS_LABEL = {
    trong: "Trống", cua_ban: "Bạn đang giữ", nguoi_khac: "Đang được giữ", da_dat: "Đã đặt",
};
const BOOKING_LABEL = {
    da_thanh_toan: ["Đã thanh toán", "ok"], cho_thanh_toan: ["Chờ thanh toán", "wait"], da_huy: ["Đã hủy", "cancel"],
};
const PAYMENT_METHODS = [["the", "Thẻ ngân hàng"], ["chuyen_khoan", "Chuyển khoản"], ["vi", "Ví điện tử"]];

// Ảnh theo hạng phòng, nhãn trạng thái trên ảnh thẻ và chữ trên nút của thẻ phòng.
const ROOM_IMAGE = { don: IMAGES.roomSingle, doi: IMAGES.roomDouble, vip: IMAGES.roomVip };
const STATUS_BADGE = { trong: "Còn trống", cua_ban: "Bạn đang giữ", nguoi_khac: "Đang được giữ", da_dat: "Đã đặt" };
const CTA_LABEL = { trong: "Giữ phòng", cua_ban: "Bỏ giữ", nguoi_khac: "Không khả dụng", da_dat: "Đã hết phòng" };

// Thời gian còn lại đến `expiresAt` dạng "mm:ss".
const remaining = (expiresAt) => formatCountdown(expiresAt - Date.now());
// Tạo thẻ hiển thị đồng hồ đếm ngược (số giây được cập nhật mỗi giây bởi controller).
const timerHtml = (expiresAt, className = "") =>
    `<span class="countdown ${className}" data-expires="${expiresAt}">${remaining(expiresAt)}</span>`;

/** Vẽ dải thống kê nhanh: số phòng trống, đang giữ, đã đặt. */
export function renderSummary({ trong, dang_giu, da_dat }) {
    return `
        <span class="sum-item"><i class="dot dot-trong"></i>Trống <b>${trong}</b></span>
        <span class="sum-item"><i class="dot dot-giu"></i>Đang giữ <b>${dang_giu}</b></span>
        <span class="sum-item"><i class="dot dot-dat"></i>Đã đặt <b>${da_dat}</b></span>`;
}

/**
 * Vẽ danh sách phòng: gom theo tầng, mỗi tầng là lưới thẻ phòng (3 thẻ mỗi hàng).
 * `typeFilter` làm mờ phòng không đúng hạng; `priceOf` cho biết giá hiển thị của từng phòng.
 */
export function renderSeatMap(seatMap, { typeFilter = "all", priceOf = (seat) => seat.gia } = {}) {
    const floors = new Map();
    seatMap.forEach((seat) => {
        const floor = seat.ma_phong[0];
        floors.set(floor, [...(floors.get(floor) ?? []), seat]);
    });

    return [...floors].map(([floor, seats]) => `
        <div class="floor-block">
            <div class="floor-title"><span class="floor-badge">Tầng ${floor}</span><small>${seats.length} phòng</small></div>
            <div class="room-card-grid">${seats.map((seat) => renderTile(seat, typeFilter, priceOf(seat))).join("")}</div>
        </div>`).join("");
}

/** Vẽ MỘT thẻ phòng: ảnh, nhãn trạng thái, đồng hồ (nếu bạn đang giữ), số phòng, hạng, giá và nút thao tác. */
function renderTile(seat, typeFilter, price) {
    const type = ROOM_TYPES[seat.hang_phong];
    const dim = typeFilter !== "all" && typeFilter !== seat.hang_phong ? "is-dim" : "";
    const label = `Phòng ${seat.ma_phong} · ${type.label} · ${formatMoney(price)} · ${STATUS_LABEL[seat.display]}`;
    const timer = seat.display === "cua_ban" ? timerHtml(seat.hold.het_han_luc, "tile-timer") : "";

    return `
        <button type="button" class="room-tile tile-${seat.display} type-${seat.hang_phong} ${dim}"
                data-seat-id="${seat.id}" data-status="${seat.display}" title="${label}" aria-label="${label}">
            <span class="rc-img">
                <img src="${ROOM_IMAGE[seat.hang_phong]}" alt="${type.label}" loading="lazy">
                <span class="rc-status">${STATUS_BADGE[seat.display]}</span>
                ${timer}
            </span>
            <span class="rc-body">
                <span class="rc-top">
                    <span class="tile-code">Phòng ${seat.ma_phong}</span>
                    <span class="tile-type">${type.label.replace("Phòng ", "")}</span>
                </span>
                <span class="rc-bottom">
                    <span class="tile-price">${formatMoney(price)}<small>/đêm</small></span>
                    <span class="rc-cta">${CTA_LABEL[seat.display]}</span>
                </span>
            </span>
        </button>`;
}

/** Vẽ ô "Phòng bạn đang giữ": danh sách phòng, đồng hồ đếm ngược, tạm tính và nút "Tiếp tục đặt phòng". */
export function renderHoldPanel(mySeats, { otherNights = 0, ttlLabel, quote = null }) {
    const note = otherNights > 0
        ? `<p class="panel-note">Bạn còn ${otherNights} phòng đang giữ ở đêm khác.</p>` : "";

    if (mySeats.length === 0 || !quote) {
        return `
            <div class="panel-empty">
                ${icons.bed(34)}
                <p>Bấm vào phòng <b>trống</b> trên sơ đồ để giữ chỗ trong <b>${ttlLabel}</b>.</p>
                ${note}
            </div>`;
    }

    const nearest = Math.min(...mySeats.map((seat) => seat.hold.het_han_luc));
    const priceOfSeat = (seat) => quote.rooms.find((room) => room.seatId === seat.id)?.price ?? seat.gia;
    const rows = mySeats.map((seat) => `
        <li class="hold-row">
            <div class="hold-info">
                <b>Phòng ${seat.ma_phong}</b>
                <small>${ROOM_TYPES[seat.hang_phong].label} · ${formatMoney(priceOfSeat(seat))}</small>
            </div>
            ${timerHtml(seat.hold.het_han_luc, "hold-timer")}
            <button type="button" class="icon-btn" data-action="release" data-seat-id="${seat.id}"
                    aria-label="Bỏ giữ phòng ${seat.ma_phong}">×</button>
        </li>`).join("");
    const surchargeNote = quote.surcharge > 0
        ? `<div class="surcharge-note">Đã gồm phụ thu ${escapeHtml(quote.nightLabel.toLowerCase())}: +${formatMoney(quote.surcharge)}</div>` : "";

    return `
        <div class="hold-banner">
            ${icons.clock(18)} Phòng sẽ được nhả sau ${timerHtml(nearest, "banner-timer")}
        </div>
        <ul class="hold-list">${rows}</ul>
        <div class="hold-total"><span>Tạm tính</span><b>${formatMoney(quote.total)}</b></div>
        ${surchargeNote}
        <button type="button" class="btn btn-primary w-100 btn-lg" data-action="checkout">Tiếp tục đặt phòng</button>
        ${note}`;
}

/** Vẽ danh sách tối đa 5 đơn gần nhất của khách kèm trạng thái và số tiền. */
export function renderBookings(bookings) {
    if (bookings.length === 0) return `<p class="panel-note mb-0">Bạn chưa có đơn đặt phòng nào.</p>`;

    return bookings.slice(0, 5).map((booking) => {
        const [label, tone] = BOOKING_LABEL[booking.trang_thai];
        return `
        <div class="booking-item">
            <div>
                <b>${escapeHtml(booking.id)}</b>
                <small>${booking.danh_sach_ghe.length} phòng · ${formatDateTime(booking.thoi_gian)}</small>
            </div>
            <div class="text-end">
                <span class="status-pill pill-${tone}">${label}</span>
                <div class="booking-money">${formatMoney(booking.tong_tien)}</div>
            </div>
        </div>`;
    }).join("");
}

/** Vẽ kết quả mô phỏng nhiều người đặt cùng lúc: có phòng nào bị đặt trùng hay không, số người thành công/bị từ chối. */
export function renderSimulationResult(result, roomCodes) {
    const failureText = Object.entries(result.failureReasons)
        .map(([code, count]) => `${count} × ${code}`).join(", ") || "không có";
    return `
        <div class="sim-result ${result.isSafe ? "is-safe" : "is-unsafe"}">
            <div class="sim-verdict">${result.isSafe ? "✓ Không có phòng nào bị đặt trùng" : "✗ PHÁT HIỆN ĐẶT TRÙNG"}</div>
            <ul>
                <li>${result.userCount} người cùng tranh phòng <b>${roomCodes.join(", ")}</b></li>
                <li>Giữ thành công: <b>${result.successCount}</b> · Bị từ chối: <b>${result.failureCount}</b></li>
                <li>Lý do từ chối: ${failureText}</li>
                <li>Phòng bị giữ trùng: <b>${result.doubleBooked.length}</b></li>
            </ul>
        </div>`;
}

// ---------- Hộp thoại thanh toán ----------

// Vẽ một ô nhập liệu của form (nhãn, ô nhập, thông báo lỗi nếu có); dữ liệu được làm sạch HTML.
const field = ({ id, label, type = "text", placeholder, value = "", error }) => `
    <div class="mb-3">
        <label class="form-label" for="${id}">${label}</label>
        <input id="${id}" name="${id}" type="${type}" class="form-control ${error ? "is-invalid" : ""}"
               placeholder="${placeholder}" value="${escapeHtml(value)}" autocomplete="off">
        ${error ? `<div class="invalid-feedback">${escapeHtml(error)}</div>` : ""}
    </div>`;

// Định dạng số tiền có dấu: dương -> "+50.000₫", âm -> "−50.000₫".
const signed = (amount) => `${amount < 0 ? "−" : "+"}${formatMoney(Math.abs(amount))}`;

/** Bảng giá chi tiết: từng dòng cộng/trừ rõ ràng để khách hiểu vì sao ra tổng tiền đó. */
export function renderPriceBreakdown(quote) {
    const rows = [`<div class="price-row"><span>Tiền phòng (${quote.rooms.length} phòng)</span><b>${formatMoney(quote.roomsBase)}</b></div>`];

    if (quote.surcharge > 0) {
        const percent = Math.round((quote.multiplier - 1) * 100);
        rows.push(`<div class="price-row surcharge"><span>${escapeHtml(quote.nightLabel)} (+${percent}%)</span><b>${signed(quote.surcharge)}</b></div>`);
    }
    quote.combos.forEach((combo) => rows.push(
        `<div class="price-row"><span>${escapeHtml(combo.ten)}${combo.quantity > 1 ? ` × ${combo.quantity}` : ""}</span><b>${signed(combo.amount)}</b></div>`,
    ));
    if (quote.coupon) {
        rows.push(`<div class="price-row discount"><span>Mã ${escapeHtml(quote.coupon.code)}</span><b>${signed(-quote.discount)}</b></div>`);
    }
    rows.push(`<div class="price-row total"><span>Tổng thanh toán</span><b>${formatMoney(quote.total)}</b></div>`);
    return `<div class="price-rows">${rows.join("")}</div>`;
}

/** Vẽ thông báo kết quả mã giảm giá (áp dụng được/không) hoặc gợi ý các mã có sẵn. */
export function renderCouponMessage(couponMessage, couponHints = []) {
    return couponMessage
        ? `<div class="coupon-msg ${couponMessage.ok ? "ok" : "err"}">${escapeHtml(couponMessage.text)}</div>`
        : `<div class="coupon-msg hint">Mã gợi ý: ${couponHints.map((c) => `<code>${c.code}</code>`).join(" ")}</div>`;
}

/** Vẽ form thanh toán: tóm tắt phòng, thông tin khách, combo, mã giảm giá, bảng giá và phương thức thanh toán. */
export function renderCheckoutForm({
    seats, eventName, values = {}, errors = {}, combos = [], selectedCombos = [], couponHints = [], quote, couponMessage = null,
}) {
    const nearest = Math.min(...seats.map((seat) => seat.hold.het_han_luc));
    const methods = PAYMENT_METHODS.map(([value, label]) => `
        <label class="method-option">
            <input type="radio" name="method" value="${value}" ${(values.method ?? "the") === value ? "checked" : ""}>
            <span>${label}</span>
        </label>`).join("");
    const comboOptions = combos.map((combo) => `
        <label class="combo-option">
            <input type="checkbox" name="combo" value="${combo.id}" ${selectedCombos.includes(combo.id) ? "checked" : ""}>
            <span class="combo-name">${escapeHtml(combo.ten)}</span>
            <span class="combo-price">+${formatMoney(combo.gia)}${combo.tinh_theo === "phong" ? "/phòng" : ""}</span>
        </label>`).join("");
    return `
    <div class="modal-header">
        <h5 class="modal-title">Thông tin &amp; thanh toán</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
    </div>
    <div class="modal-body">
        <div class="hold-banner mb-3">${icons.clock(18)} Hoàn tất trong ${timerHtml(nearest, "banner-timer")} nếu không phòng sẽ được nhả</div>
        <div class="checkout-summary">
            <div><small>${escapeHtml(eventName)}</small><b>Phòng ${seats.map((s) => s.ma_phong).join(", ")}</b></div>
        </div>
        <form id="checkoutForm" novalidate>
            ${field({ id: "ten", label: "Họ tên", placeholder: "Nguyễn Văn A", value: values.ten, error: errors.ten })}
            ${field({ id: "sdt", label: "Số điện thoại", type: "tel", placeholder: "0912345678", value: values.sdt, error: errors.sdt })}
            ${field({ id: "email", label: "Email", type: "email", placeholder: "email@example.com", value: values.email, error: errors.email })}

            <label class="form-label">Dịch vụ đi kèm (combo)</label>
            <div class="combo-group mb-3">${comboOptions}</div>

            <label class="form-label" for="coupon">Mã giảm giá</label>
            <div class="coupon-row">
                <input id="coupon" name="coupon" class="form-control" placeholder="Nhập mã" value="${escapeHtml(values.coupon ?? "")}" autocomplete="off">
                <button type="button" class="btn btn-outline-brand" data-action="apply-coupon">Áp dụng</button>
            </div>
            <div id="couponMessage" class="mb-3">${renderCouponMessage(couponMessage, couponHints)}</div>

            <div id="priceBreakdown" class="price-box mb-3">${renderPriceBreakdown(quote)}</div>

            <label class="form-label">Phương thức thanh toán</label>
            <div class="method-group mb-3">${methods}</div>
            <div class="form-check mb-4">
                <input class="form-check-input" type="checkbox" id="simulateFailure" name="fail" ${values.fail ? "checked" : ""}>
                <label class="form-check-label" for="simulateFailure">Mô phỏng thanh toán thất bại (để thử luồng lỗi)</label>
            </div>
            <button type="submit" id="payButton" class="btn btn-primary btn-lg w-100">Thanh toán ${formatMoney(quote.total)}</button>
        </form>
    </div>`;
}

// Vẽ màn "đang xử lý thanh toán" kèm đồng hồ đếm ngược thời gian giữ phòng.
export const renderCheckoutPaying = (expiresAt) => `
    <div class="modal-body result-view">
        <div class="spinner-border text-primary mb-4" role="status" aria-hidden="true"></div>
        <h5>Đang xử lý thanh toán…</h5>
        <p class="text-muted mb-0">Vui lòng không đóng cửa sổ. Thời gian giữ phòng còn ${timerHtml(expiresAt, "banner-timer")}</p>
    </div>`;

/** Vẽ màn đặt phòng thành công: mã đơn, danh sách phòng, đêm lưu trú và tổng tiền. */
export function renderCheckoutSuccess({ booking, seats, eventName }) {
    return `
    <div class="modal-body result-view">
        <div class="result-icon ok">✓</div>
        <h4>Đặt phòng thành công!</h4>
        <p class="text-muted">Mã đơn <b>${escapeHtml(booking.id)}</b></p>
        <div class="result-detail">
            <div><span>Khách</span><b>${escapeHtml(booking.khach.ten)}</b></div>
            <div><span>Đêm</span><b>${escapeHtml(eventName)}</b></div>
            <div><span>Phòng</span><b>${seats.map((s) => s.ma_phong).join(", ")}</b></div>
            <div><span>Đã thanh toán</span><b class="price">${formatMoney(booking.tong_tien)}</b></div>
        </div>
        <button type="button" class="btn btn-primary btn-lg px-5" data-bs-dismiss="modal">Hoàn tất</button>
    </div>`;
}

/** Vẽ màn thất bại (tiêu đề, lý do) và nút thử lại nếu được phép. */
export function renderCheckoutFailure({ title, message, canRetry }) {
    return `
    <div class="modal-body result-view">
        <div class="result-icon fail">!</div>
        <h4>${escapeHtml(title)}</h4>
        <p class="text-muted">${escapeHtml(message)}</p>
        <div class="d-flex gap-2 justify-content-center">
            ${canRetry ? `<button type="button" class="btn btn-primary btn-lg" data-action="retry">Thử lại</button>` : ""}
            <button type="button" class="btn btn-outline-brand btn-lg" data-bs-dismiss="modal">Đóng</button>
        </div>
    </div>`;
}

// ---------- Hàng đợi ----------

/** Vẽ thẻ hàng đợi: còn phòng thì gợi ý đặt thẳng; hết phòng thì cho vào hàng; đã xếp hàng thì hiện vị trí và nút rời hàng. */
export function renderWaitlistCard({ emptyCount, status }) {
    if (status?.waiting) {
        return `
        <div class="wait-status">
            <div class="wait-position">#${status.position}</div>
            <div>
                <b>Bạn đang trong hàng đợi</b>
                <small>Cần ${status.entry.so_luong_ghe} phòng · khi có phòng, hệ thống tự giữ cho bạn</small>
            </div>
        </div>
        <button type="button" class="btn btn-outline-brand btn-sm w-100" data-action="leave-wait">Rời hàng đợi</button>`;
    }

    return `
        <p class="panel-note mt-0">Khi đêm này hết phòng, hãy xếp hàng: có phòng nhả ra là người <b>đầu hàng</b> được tự động giữ phòng trước.</p>
        ${emptyCount > 0 ? `<p class="panel-note">Đêm này còn <b>${emptyCount}</b> phòng trống – bạn có thể đặt trực tiếp.</p>` : ""}
        <div class="d-flex gap-2">
            <select id="waitCount" class="form-select" aria-label="Số phòng cần">
                <option value="1">1 phòng</option><option value="2">2 phòng</option><option value="3">3 phòng</option>
            </select>
            <button type="button" class="btn btn-primary text-nowrap" data-action="join-wait">Vào hàng</button>
        </div>`;
}
