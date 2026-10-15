/** TẦNG GIAO DIỆN – HTML thuần cho trang Thống kê (biểu đồ thanh bằng CSS, không cần thư viện). */
import { formatMoney, escapeHtml } from "../utils/format.js";
import { ROOM_TYPES } from "../data/seed.js";

// Đổi tỉ lệ 0–1 thành phần trăm, vd. 0.256 -> "26%".
const percent = (ratio) => `${Math.round(ratio * 100)}%`;
// Thông báo hiển thị khi chưa có dữ liệu.
const EMPTY = `<p class="panel-note">Chưa có dữ liệu. Bấm “Tạo dữ liệu mẫu” hoặc đặt phòng ở trang Phòng nghỉ.</p>`;

// Vẽ một thanh biểu đồ ngang (nhãn, độ dài theo value/max, chú thích).
const bar = ({ label, value, max, text, tone = "" }) => `
    <div class="bar-row">
        <span class="bar-label">${escapeHtml(label)}</span>
        <div class="bar-track"><div class="bar-fill ${tone}" style="width:${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%"></div></div>
        <span class="bar-value">${text}</span>
    </div>`;

// Vẽ một khung biểu đồ có tiêu đề.
const card = (title, body, wide = false) => `
    <div class="${wide ? "col-12" : "col-lg-6"}">
        <div class="stat-card h-100"><h5>${title}</h5>${body}</div>
    </div>`;

// Vẽ một ô chỉ số tổng quan (tên, giá trị, ghi chú).
const kpi = (label, value, hint = "") => `
    <div class="col-6 col-lg-4 col-xl-2">
        <div class="kpi"><small>${label}</small><b>${value}</b>${hint ? `<span>${hint}</span>` : ""}</div>
    </div>`;

/** Vẽ toàn bộ báo cáo thống kê từ dữ liệu của StatsService: chỉ số tổng quan và các biểu đồ. */
export function renderReport({ overview, occupancyByEvent, revenueByEvent, revenueByBookingDay, topRooms, byHourBucket, byRoomType }) {
    // Giá trị lớn nhất của một trường trong danh sách (để quy đổi độ dài thanh).
    const maxOf = (list, key) => Math.max(0, ...list.map((item) => item[key]));
    // Rút gọn ngày "2026-10-05" thành "05/10".
    const shortDay = (day) => day.split("-").reverse().slice(0, 2).join("/");

    const occupancy = occupancyByEvent.length === 0 ? EMPTY : occupancyByEvent.map((e) => bar({
        label: e.ten.replace("Đêm ", ""), value: e.rate, max: 1,
        text: `${e.booked}/${e.total} · ${percent(e.rate)}`, tone: e.rate >= 0.7 ? "hot" : "",
    })).join("");

    const revenueNight = revenueByEvent.length === 0 ? EMPTY : revenueByEvent.map((e) => bar({
        label: e.ten.replace("Đêm ", ""), value: e.revenue, max: maxOf(revenueByEvent, "revenue"),
        text: `${formatMoney(e.revenue)} · ${e.rooms} phòng`,
    })).join("");

    const revenueDay = revenueByBookingDay.length === 0 ? EMPTY : revenueByBookingDay.slice(-14).map((d) => bar({
        label: shortDay(d.day), value: d.revenue, max: maxOf(revenueByBookingDay, "revenue"),
        text: `${formatMoney(d.revenue)} · ${d.bookings} đơn`, tone: "alt",
    })).join("");

    const rooms = topRooms.length === 0 ? EMPTY : topRooms.slice(0, 8).map((r) => bar({
        label: `Phòng ${r.ma_phong}`, value: r.count, max: topRooms[0].count,
        text: `${r.count} lượt · ${ROOM_TYPES[r.hang_phong]?.label ?? r.hang_phong}`, tone: "gold",
    })).join("");

    const hours = overview.paidCount === 0 ? EMPTY : byHourBucket.map((b) => bar({
        label: b.label, value: b.bookings, max: maxOf(byHourBucket, "bookings"),
        text: `${b.bookings} đơn · ${formatMoney(b.revenue)}`, tone: "alt",
    })).join("");

    const types = byRoomType.length === 0 ? EMPTY : byRoomType.map((t) => bar({
        label: ROOM_TYPES[t.hang_phong]?.label ?? t.hang_phong, value: t.rooms, max: byRoomType[0].rooms, text: `${t.rooms} phòng`, tone: "gold",
    })).join("");

    return `
    <div class="row g-3 mb-4">
        ${kpi("Doanh thu", formatMoney(overview.totalRevenue))}
        ${kpi("Đơn thành công", overview.paidCount)}
        ${kpi("Phòng đã bán", overview.roomsSold)}
        ${kpi("Giá trị TB/đơn", formatMoney(overview.averageOrder))}
        ${kpi("Lấp đầy TB", percent(overview.averageOccupancy), "các đêm sắp tới")}
        ${kpi("Tỉ lệ hủy", percent(overview.cancelRate), `${overview.cancelledCount} đơn hủy`)}
    </div>
    <div class="row g-4">
        ${card("Tỉ lệ lấp đầy theo đêm", `<div class="bars scroll">${occupancy}</div>`)}
        ${card("Doanh thu theo đêm lưu trú", `<div class="bars scroll">${revenueNight}</div>`)}
        ${card("Doanh thu theo ngày đặt (14 ngày gần nhất)", `<div class="bars scroll">${revenueDay}</div>`)}
        ${card("Phòng bán chạy nhất", `<div class="bars">${rooms}</div>`)}
        ${card("Khung giờ khách đặt phòng", `<div class="bars">${hours}</div>`)}
        ${card("Theo hạng phòng", `<div class="bars">${types}</div>`)}
    </div>`;
}
