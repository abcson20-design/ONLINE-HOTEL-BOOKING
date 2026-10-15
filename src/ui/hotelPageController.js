/**
 * TẦNG GIAO DIỆN – điều phối trang "Phòng nghỉ": gọi service, gắn sự kiện, cập nhật DOM.
 * Không chứa quy tắc nghiệp vụ (giữ chỗ, chống trùng, tính giá, hàng đợi…) – tất cả nằm trong src/services.
 */
import { Modal } from "bootstrap";
import { getServices, getCurrentUserId, TTL_OPTIONS } from "../services/container.js";
import { SeatMapService } from "../services/SeatMapService.js";
import { MAX_SEATS_PER_HOLD } from "../services/HoldService.js";
import { validateCustomer } from "../services/BookingService.js";
import { simulateConcurrentHolds } from "../services/concurrencySimulator.js";
import {
    renderSummary, renderSeatMap, renderHoldPanel, renderBookings, renderSimulationResult,
    renderCheckoutForm, renderCheckoutPaying, renderCheckoutSuccess, renderCheckoutFailure,
    renderPriceBreakdown, renderCouponMessage, renderWaitlistCard,
} from "./views.js";
import { formatCountdown, formatMoney } from "../utils/format.js";

// Mô phỏng: số phòng làm "mục tiêu tranh giành"; số người ảo mỗi nhóm khi đặt kín đêm; hai người ảo xếp hàng đợi.
const SIM_TARGET_ROOMS = 5;
const SIM_FILL_USERS_PER_CHUNK = 6;
const VIRTUAL_WAITERS = ["sim-user-wait-1", "sim-user-wait-2"];
// Lấy phần tử theo id.
const $ = (id) => document.getElementById(id);
// Xáo trộn ngẫu nhiên một danh sách (trả về bản sao).
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

/** Gắn logic vào DOM của trang; trả về hàm dọn dẹp để Router gọi khi rời trang. */
export function mountHotelPage() {
    const { holdService, bookingService, seatMapService, pricingService, waitlistService } = getServices();
    const userId = getCurrentUserId();

    // Trạng thái của trang: danh sách đêm, đêm đang chọn, sơ đồ phòng, bộ lọc, phòng đang xử lý, dữ liệu form thanh toán...
    const state = {
        events: [], eventId: null, seatMap: [], otherNights: 0, waitStatus: null,
        typeFilter: "all", busySeats: new Set(), refreshSeq: 0, disposed: false,
        checkout: { open: false, step: "form", seatIds: [], values: {}, combos: [], coupon: "", couponMessage: null },
    };

    // Các phần tử HTML cần thao tác (lấy một lần để dùng lại).
    const dom = {
        night: $("nightSelect"), nightBadge: $("nightBadge"), ttl: $("ttlSelect"), filter: $("roomFilter"),
        summary: $("seatSummary"), map: $("seatMap"), holdPanel: $("holdPanel"), waitlist: $("waitlistCard"),
        bookings: $("myBookings"), simUsers: $("simUsers"), simRun: $("simRun"), simFill: $("simFill"),
        simClear: $("simClear"), simResult: $("simResult"), modalEl: $("checkoutModal"), modalContent: $("checkoutContent"),
    };
    const modal = new Modal(dom.modalEl, { backdrop: "static", keyboard: false });

    // ---------- Tiện ích ----------
    // Đêm đang được chọn.
    const currentEvent = () => state.events.find((event) => event.id === state.eventId);
    // Các phòng do CHÍNH người dùng đang giữ.
    const mySeats = () => state.seatMap.filter((seat) => seat.display === "cua_ban");
    // Tên mức thời gian giữ phòng hiện tại (vd. "10 phút").
    const ttlLabel = () => TTL_OPTIONS.find((o) => o.seconds * 1000 === holdService.ttlMs)?.label ?? "vài phút";
    // Giá một phòng trong đêm đang xem (đã tính phụ thu cuối tuần/lễ).
    const priceOf = (seat) => (currentEvent() ? pricingService.roomPrice(seat.gia, currentEvent().thoi_gian) : seat.gia);
    // Lấy mã phòng từ id ghế, vd. "evt-2026-10-05-101" -> "101".
    const roomCode = (seatId) => seatId.split("-").pop();

    let toastHost = null;
    /** Hiện thông báo nhỏ ở góc màn hình (tự tắt sau 4 giây); `tone`: info / ok / warn. */
    function toast(message, tone = "info") {
        toastHost ??= Object.assign(document.body.appendChild(document.createElement("div")), { className: "toast-host" });
        const item = Object.assign(document.createElement("div"), { className: `app-toast toast-${tone}`, textContent: message });
        toastHost.appendChild(item);
        setTimeout(() => item.remove(), 4000);
    }

    // Chuyển lỗi thành câu thông báo thân thiện (lỗi lạ thì báo chung).
    const errorMessage = (error) => (error?.code ? error.message : "Đã xảy ra lỗi, vui lòng thử lại");

    // ---------- Vẽ giao diện ----------
    /** Hiện nhãn loại đêm đang chọn: giá thường / cuối tuần / dịp lễ kèm % phụ thu. */
    function renderNightBadge() {
        const event = currentEvent();
        if (!event) return;
        const night = pricingService.describeNight(event.thoi_gian);
        const percent = Math.round((night.multiplier - 1) * 100);
        dom.nightBadge.textContent = night.label ? `${night.label} · +${percent}%` : "Giá thường";
        dom.nightBadge.className = `night-badge ${night.kind}`;
    }

    /** Vẽ lại toàn bộ giao diện từ state: nhãn đêm, thẻ phòng, thống kê, ô giữ phòng và thẻ hàng đợi. */
    function renderAll() {
        const summary = SeatMapService.summarize(state.seatMap);
        const mine = mySeats();
        const panelQuote = mine.length && currentEvent()
            ? pricingService.quote({ seats: mine, date: currentEvent().thoi_gian }) : null;

        renderNightBadge();
        dom.map.innerHTML = renderSeatMap(state.seatMap, { typeFilter: state.typeFilter, priceOf });
        dom.summary.innerHTML = renderSummary(summary);
        dom.holdPanel.innerHTML = renderHoldPanel(mine, { otherNights: state.otherNights, ttlLabel: ttlLabel(), quote: panelQuote });
        dom.waitlist.innerHTML = renderWaitlistCard({ emptyCount: summary.trong, status: state.waitStatus });
        state.busySeats.forEach((id) => dom.map.querySelector(`[data-seat-id="${id}"]`)?.classList.add("is-busy"));
    }

    /** Tải lại dữ liệu. `refreshSeq` bỏ qua kết quả cũ nếu có lần tải mới hơn đã bắt đầu. */
    async function refresh() {
        if (!state.eventId || state.disposed) return;
        const seq = ++state.refreshSeq;
        const [seatMap, allMyHolds, waitStatus] = await Promise.all([
            seatMapService.getSeatMap(state.eventId, userId),
            holdService.getHoldsOfUser(userId),
            waitlistService.getStatus(userId, state.eventId),
        ]);
        if (seq !== state.refreshSeq || state.disposed) return;

        state.seatMap = seatMap;
        state.waitStatus = waitStatus;
        state.otherNights = allMyHolds.length - seatMap.filter((s) => s.display === "cua_ban").length;
        renderAll();
        detectLostHoldsDuringCheckout();
    }

    let refreshTimer = null;
    // Hẹn tải lại dữ liệu (gộp nhiều sự kiện dồn dập thành một lần tải).
    const scheduleRefresh = () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => refresh().catch(console.error), 60); // gộp nhiều sự kiện dồn dập
    };

    /** Tải và hiển thị danh sách đơn đặt phòng của người dùng. */
    async function refreshBookings() {
        const bookings = await bookingService.getBookingsOfUser(userId);
        if (!state.disposed) dom.bookings.innerHTML = renderBookings(bookings);
    }

    // ---------- Giữ / bỏ giữ phòng ----------
    /** Bấm vào thẻ phòng: phòng trống thì GIỮ, phòng của mình thì BỎ GIỮ; phòng đã đặt/người khác giữ thì báo cho khách. */
    async function toggleSeat(seatId) {
        const seat = state.seatMap.find((item) => item.id === seatId);
        if (!seat || state.busySeats.has(seatId)) return;

        if (seat.display === "da_dat") return toast(`Phòng ${seat.ma_phong} đã được đặt`, "warn");
        if (seat.display === "nguoi_khac") return toast(`Phòng ${seat.ma_phong} đang được người khác giữ`, "warn");
        if (seat.display === "trong" && mySeats().length >= MAX_SEATS_PER_HOLD) {
            return toast(`Mỗi đơn tối đa ${MAX_SEATS_PER_HOLD} phòng`, "warn");
        }

        state.busySeats.add(seatId);
        dom.map.querySelector(`[data-seat-id="${seatId}"]`)?.classList.add("is-busy");
        try {
            if (seat.display === "trong") {
                await holdService.holdSeats(userId, [seatId]);
                toast(`Đã giữ phòng ${seat.ma_phong} trong ${ttlLabel()}`, "ok");
            } else {
                await holdService.releaseHolds(userId, [seatId]);
                toast(`Đã bỏ giữ phòng ${seat.ma_phong}`, "info");
            }
        } catch (error) {
            toast(errorMessage(error), "warn"); // vd. người khác giữ trước vài mili giây
        } finally {
            state.busySeats.delete(seatId);
            scheduleRefresh();
        }
    }

    // ---------- Hàng đợi ----------
    /** Vào hàng đợi của đêm đang xem với số phòng đã chọn. */
    async function joinWaitlist() {
        try {
            const entry = await waitlistService.join(userId, state.eventId, Number($("waitCount").value));
            toast(`Đã vào hàng đợi, vị trí #${entry.position}`, "ok");
        } catch (error) {
            toast(errorMessage(error), "warn");
        }
        scheduleRefresh();
    }

    /** Rời hàng đợi của đêm đang xem. */
    async function leaveWaitlist() {
        await waitlistService.leave(userId, state.eventId);
        toast("Đã rời hàng đợi", "info");
        scheduleRefresh();
    }

    // ---------- Thanh toán ----------
    // Thay nội dung hộp thoại thanh toán.
    const setModal = (html) => { dom.modalContent.innerHTML = html; };

    /** Mở hộp thoại thanh toán cho các phòng đang giữ và hiện form nhập thông tin. */
    function openCheckout() {
        const seats = mySeats();
        if (seats.length === 0) return;
        state.checkout = {
            open: true, step: "form", seatIds: seats.map((s) => s.id), values: {}, combos: [], coupon: "", couponMessage: null,
        };
        showCheckoutForm();
        modal.show();
    }

    // Các phòng trong đơn đang thanh toán mà vẫn còn được giữ.
    function checkoutSeats() {
        return state.seatMap.filter((seat) => state.checkout.seatIds.includes(seat.id) && seat.display === "cua_ban");
    }

    /** Báo giá hiện tại của form. Nếu mã giảm giá không còn đủ điều kiện (vd. bỏ combo) thì tự gỡ mã và báo lý do. */
    function computeQuote() {
        const request = { seats: checkoutSeats(), date: currentEvent().thoi_gian, comboIds: state.checkout.combos };
        try {
            return pricingService.quote({ ...request, couponCode: state.checkout.coupon });
        } catch (error) {
            if (error.details?.field !== "coupon") throw error;
            state.checkout.coupon = "";
            state.checkout.couponMessage = { ok: false, text: error.message };
            return pricingService.quote(request);
        }
    }

    /** Vẽ form thanh toán (thông tin khách, combo, mã giảm giá, phương thức); `errors` là lỗi theo từng ô. */
    function showCheckoutForm(errors = {}) {
        state.checkout.step = "form";
        setModal(renderCheckoutForm({
            seats: checkoutSeats(), eventName: currentEvent().ten, values: state.checkout.values, errors,
            combos: pricingService.listCombos(), selectedCombos: state.checkout.combos,
            couponHints: pricingService.listCoupons(), quote: computeQuote(), couponMessage: state.checkout.couponMessage,
        }));
    }

    /** Cập nhật riêng bảng giá + nút thanh toán (không vẽ lại cả form để khỏi mất chữ đang nhập). */
    function updatePricing() {
        const quote = computeQuote();
        $("priceBreakdown").innerHTML = renderPriceBreakdown(quote);
        $("payButton").textContent = `Thanh toán ${formatMoney(quote.total)}`;
        $("couponMessage").innerHTML = renderCouponMessage(state.checkout.couponMessage, pricingService.listCoupons());
    }

    /** Kiểm tra mã trong ô nhập; trả về true nếu hợp lệ (hoặc để trống). */
    function applyCouponFromInput() {
        const code = $("coupon").value.trim();
        state.checkout.values = { ...state.checkout.values, coupon: code };

        if (code === "") {
            state.checkout.coupon = "";
            state.checkout.couponMessage = null;
            updatePricing();
            return true;
        }
        try {
            const quote = pricingService.quote({
                seats: checkoutSeats(), date: currentEvent().thoi_gian, comboIds: state.checkout.combos, couponCode: code,
            });
            state.checkout.coupon = quote.coupon.code;
            state.checkout.couponMessage = { ok: true, text: `Đã áp dụng ${quote.coupon.code}: ${quote.coupon.mo_ta}` };
            updatePricing();
            return true;
        } catch (error) {
            if (error.code !== "VALIDATION") throw error;
            state.checkout.coupon = "";
            state.checkout.couponMessage = { ok: false, text: error.message };
            updatePricing();
            return false;
        }
    }

    /** Đọc dữ liệu người dùng đã nhập trong form thanh toán. */
    function readCheckoutForm() {
        const data = new FormData($("checkoutForm"));
        return {
            ten: data.get("ten"), sdt: data.get("sdt"), email: data.get("email"), method: data.get("method"),
            coupon: data.get("coupon"), fail: data.get("fail") === "on",
        };
    }

    /** Gửi form: kiểm tra thông tin và mã giảm giá, hiện màn "đang thanh toán", gọi BookingService.checkout rồi hiện kết quả thành công/thất bại. */
    async function submitCheckout() {
        const values = readCheckoutForm();
        state.checkout.values = values;

        try {
            validateCustomer(values); // báo lỗi từng ô ngay, chưa chuyển sang bước thanh toán
        } catch (error) {
            return showCheckoutForm({ [error.details.field]: error.message });
        }
        if (!applyCouponFromInput()) return; // mã sai: dừng tại form và hiện lý do

        const seats = checkoutSeats();
        state.checkout.step = "paying";
        setModal(renderCheckoutPaying(Math.min(...seats.map((s) => s.hold.het_han_luc))));

        try {
            const booking = await bookingService.checkout(userId, state.checkout.seatIds, values, {
                paymentMethod: values.method, simulateFailure: values.fail,
                comboIds: state.checkout.combos, couponCode: state.checkout.coupon,
            });
            state.checkout.step = "result";
            setModal(renderCheckoutSuccess({ booking, seats, eventName: currentEvent().ten }));
        } catch (error) {
            showCheckoutFailure(error);
        } finally {
            scheduleRefresh();
            refreshBookings().catch(console.error);
        }
    }

    /** Hiện màn thất bại tương ứng với mã lỗi (thanh toán lỗi, đơn bị hủy, hết hạn giữ phòng); chỉ lỗi thanh toán mới cho thử lại. */
    function showCheckoutFailure(error) {
        state.checkout.step = "result";
        const canRetry = error.code === "PAYMENT_FAILED";
        const titles = {
            PAYMENT_FAILED: "Thanh toán không thành công",
            BOOKING_CANCELLED: "Đơn đặt phòng đã bị hủy",
            HOLD_EXPIRED: "Hết thời gian giữ phòng",
        };
        setModal(renderCheckoutFailure({
            title: titles[error.code] ?? "Không thể hoàn tất đặt phòng", message: errorMessage(error), canRetry,
        }));
    }

    /** Đang ở bước nhập thông tin mà phòng đã bị nhả (hết hạn) -> báo ngay, không để khách thanh toán vô ích. */
    function detectLostHoldsDuringCheckout() {
        const { open, step, seatIds } = state.checkout;
        if (!open || step !== "form") return;
        if (checkoutSeats().length !== seatIds.length) {
            showCheckoutFailure({ code: "HOLD_EXPIRED", message: "Phòng của bạn đã hết thời gian giữ và được nhả cho người khác. Vui lòng chọn lại." });
        }
    }

    // ---------- Mô phỏng ----------
    /** Mô phỏng nhiều người đặt cùng lúc: bắn N yêu cầu giữ vào vài phòng và hiển thị kết quả kiểm tra không trùng. */
    async function runSimulation() {
        const userCount = Math.min(100, Math.max(2, Number(dom.simUsers.value) || 30));
        dom.simUsers.value = userCount;

        const emptySeats = state.seatMap.filter((seat) => seat.display === "trong");
        if (emptySeats.length < 2) return toast("Cần ít nhất 2 phòng trống để mô phỏng", "warn");

        const targets = shuffle(emptySeats).slice(0, SIM_TARGET_ROOMS);
        const targetIds = targets.map((seat) => seat.id);
        dom.simRun.disabled = true;
        dom.simResult.innerHTML = `<p class="panel-note">Đang gửi ${userCount} yêu cầu đồng thời…</p>`;

        try {
            const result = await simulateConcurrentHolds(holdService, {
                userCount,
                pickSeats: () => shuffle(targetIds).slice(0, 1 + Math.floor(Math.random() * 2)),
            });
            dom.simResult.innerHTML = renderSimulationResult(result, targets.map((s) => s.ma_phong));
        } catch (error) {
            dom.simResult.innerHTML = "";
            toast(errorMessage(error), "warn");
        } finally {
            dom.simRun.disabled = false;
            scheduleRefresh();
        }
    }

    /** Đặt kín đêm đang xem bằng người dùng ảo và cho 2 người ảo xếp hàng trước bạn (để thấy đúng thứ tự FIFO). */
    async function fillNight() {
        const emptyIds = state.seatMap.filter((seat) => seat.display === "trong").map((seat) => seat.id);
        if (emptyIds.length === 0) return toast("Đêm này đã kín phòng", "warn");

        dom.simFill.disabled = true;
        try {
            const chunks = [];
            for (let i = 0; i < emptyIds.length; i += SIM_FILL_USERS_PER_CHUNK) chunks.push(emptyIds.slice(i, i + SIM_FILL_USERS_PER_CHUNK));
            await Promise.allSettled(chunks.map((ids, index) => holdService.holdSeats(`sim-user-fill-${index + 1}`, ids)));

            for (const waiter of VIRTUAL_WAITERS) { // tuần tự để giữ đúng thứ tự vào hàng
                await waitlistService.join(waiter, state.eventId, 1).catch(() => {});
            }
            toast("Đã đặt kín đêm này. Hãy vào hàng đợi, rồi bấm “Nhả phòng mô phỏng”.", "info");
        } finally {
            dom.simFill.disabled = false;
            scheduleRefresh();
        }
    }

    /** Nhả mọi phòng đang do người dùng ảo (sim-user-*) giữ, theo dữ liệu mới nhất trên màn hình. */
    async function releaseSimHolds() {
        const seatsBySimUser = new Map();
        state.seatMap.filter((s) => s.hold?.user_id.startsWith("sim-user-")).forEach((seat) => {
            const list = seatsBySimUser.get(seat.hold.user_id) ?? [];
            seatsBySimUser.set(seat.hold.user_id, [...list, seat.id]);
        });
        await Promise.all([...seatsBySimUser].map(([simUser, ids]) => holdService.releaseHolds(simUser, ids)));
        return seatsBySimUser.size;
    }

    /** Dọn mô phỏng: nhả phòng của người dùng ảo, chờ hàng đợi phục vụ xong, rồi cho người xếp hàng ảo rời hàng. */
    async function clearSimulation() {
        const released = await releaseSimHolds();
        await waitlistService.whenIdle(); // chờ hàng đợi phục vụ xong (người đầu hàng được giữ phòng)
        await refresh();
        await releaseSimHolds(); // nhả nốt phòng vừa được giữ cho người xếp hàng ảo
        await Promise.all(VIRTUAL_WAITERS.map((waiter) => waitlistService.leave(waiter, state.eventId)));

        dom.simResult.innerHTML = "";
        toast(released ? "Đã nhả các phòng mô phỏng" : "Không có phòng mô phỏng nào", "info");
        scheduleRefresh();
    }

    // ---------- Đồng hồ đếm ngược (cập nhật mỗi giây, không cần gọi lại service) ----------
    // Đồng hồ: mỗi giây cập nhật mọi bộ đếm ngược trên trang, dưới 1 phút thì đổi sang màu cảnh báo.
    const ticker = setInterval(() => {
        document.querySelectorAll("[data-expires]").forEach((el) => {
            const msLeft = Number(el.dataset.expires) - Date.now();
            el.textContent = formatCountdown(msLeft);
            el.classList.toggle("is-urgent", msLeft < 60_000);
        });
    }, 1000);

    // ---------- Gắn sự kiện ----------
    // Bấm vào thẻ phòng trên sơ đồ.
    dom.map.addEventListener("click", (event) => {
        const tile = event.target.closest("[data-seat-id]");
        if (tile) toggleSeat(tile.dataset.seatId);
    });

    // Bấm nút trong ô "Phòng bạn đang giữ": bỏ giữ một phòng hoặc tiếp tục đặt phòng.
    dom.holdPanel.addEventListener("click", (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        if (button.dataset.action === "release") toggleSeat(button.dataset.seatId);
        if (button.dataset.action === "checkout") openCheckout();
    });

    // Bấm nút vào / rời hàng đợi.
    dom.waitlist.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "join-wait") joinWaitlist();
        if (action === "leave-wait") leaveWaitlist().catch(console.error);
    });

    // Chọn bộ lọc hạng phòng (Tất cả / Đơn / Đôi / VIP): phòng không khớp sẽ mờ đi.
    dom.filter.addEventListener("click", (event) => {
        const chip = event.target.closest(".chip");
        if (!chip) return;
        state.typeFilter = chip.dataset.filter;
        dom.filter.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
        renderAll();
    });

    // Đổi đêm lưu trú -> tải lại sơ đồ phòng; đổi thời gian giữ -> áp dụng cho các lượt giữ mới.
    dom.night.addEventListener("change", () => { state.eventId = dom.night.value; refresh().catch(console.error); });
    dom.ttl.addEventListener("change", () => { holdService.setTtlMs(Number(dom.ttl.value) * 1000); renderAll(); });
    dom.simRun.addEventListener("click", runSimulation);
    dom.simFill.addEventListener("click", () => fillNight().catch(console.error));
    dom.simClear.addEventListener("click", () => clearSimulation().catch(console.error));

    // Hộp thoại thanh toán: gửi form, tick/bỏ combo, áp mã giảm giá, thử lại; đóng hộp thoại thì đánh dấu không còn mở.
    dom.modalContent.addEventListener("submit", (event) => { event.preventDefault(); submitCheckout(); });
    dom.modalContent.addEventListener("change", (event) => {
        if (event.target.name !== "combo") return;
        state.checkout.combos = [...dom.modalContent.querySelectorAll('input[name="combo"]:checked')].map((el) => el.value);
        updatePricing();
    });
    dom.modalContent.addEventListener("click", (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (action === "apply-coupon") applyCouponFromInput();
        if (action === "retry") checkoutSeats().length === state.checkout.seatIds.length ? showCheckoutForm() : modal.hide();
    });
    dom.modalEl.addEventListener("hidden.bs.modal", () => { state.checkout.open = false; });

    // Lắng nghe sự kiện từ service để tự cập nhật giao diện (phòng được giữ/nhả/đặt, hàng đợi thay đổi, đến lượt bạn).
    const unsubscribe = ["seats-held", "seat-released", "seats-confirmed"].map((name) => holdService.events.on(name, scheduleRefresh));
    unsubscribe.push(
        holdService.events.on("error", (error) => console.error("Lỗi timer giữ phòng:", error)),
        waitlistService.events.on("waitlist-changed", scheduleRefresh),
        waitlistService.events.on("waitlist-offered", ({ userId: offeredTo, seatIds }) => {
            if (offeredTo === userId) {
                toast(`Đến lượt bạn! Đã giữ phòng ${seatIds.map(roomCode).join(", ")} cho bạn trong ${ttlLabel()}.`, "ok");
            }
        }),
    );

    // ---------- Khởi tạo ----------
    // Khởi tạo: nạp các mức TTL, danh sách đêm, chọn đêm đầu tiên rồi tải sơ đồ phòng và đơn của khách.
    (async () => {
        dom.ttl.innerHTML = TTL_OPTIONS.map((o) => `<option value="${o.seconds}">${o.label}</option>`).join("");
        dom.ttl.value = String(holdService.ttlMs / 1000);

        state.events = await seatMapService.listEvents();
        if (state.disposed) return;
        dom.night.innerHTML = state.events.map((event) => {
            const weekday = new Date(event.thoi_gian).toLocaleDateString("vi-VN", { weekday: "short" });
            return `<option value="${event.id}">${weekday}, ${event.ten}</option>`;
        }).join("");
        state.eventId = state.events[0]?.id ?? null;

        await Promise.all([refresh(), refreshBookings()]);
    })().catch(console.error);

    // ---------- Dọn dẹp khi rời trang ----------
    // Dọn dẹp khi rời trang: dừng timer, hủy lắng nghe, đóng hộp thoại và xóa thông báo.
    return function dispose() {
        state.disposed = true;
        clearInterval(ticker);
        clearTimeout(refreshTimer);
        unsubscribe.forEach((off) => off());
        modal.dispose();
        document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
        toastHost?.remove();
    };
}
