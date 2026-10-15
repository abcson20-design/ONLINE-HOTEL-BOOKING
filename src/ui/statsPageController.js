/** TẦNG GIAO DIỆN – điều phối trang Thống kê. Số liệu do StatsService tính; file này chỉ gọi và hiển thị. */
import { getServices } from "../services/container.js";
import { addDemoBookings, clearDemoBookings } from "../data/demoData.js";
import { renderReport } from "./statsViews.js";

// Lấy phần tử theo id.
const $ = (id) => document.getElementById(id);

/** Gắn logic cho trang Thống kê: nạp báo cáo, xử lý các nút, tự cập nhật khi có đơn/phòng thay đổi; trả về hàm dọn dẹp. */
export function mountStatsPage() {
    const { statsService, bookingService, holdService, pricingService, db } = getServices();
    let disposed = false;
    const body = $("statsBody");
    const notice = $("statsNotice");

    /** Lấy báo cáo mới từ StatsService và vẽ vào trang. */
    async function load() {
        const report = await statsService.getReport();
        if (!disposed) body.innerHTML = renderReport(report);
    }

    /** Chạy một thao tác (thêm/xóa đơn mẫu): khóa nút, hiện thông báo kết quả rồi nạp lại báo cáo. */
    async function runAction(button, task, message) {
        button.disabled = true;
        try {
            const count = await task();
            notice.textContent = message(count);
            await load();
        } finally {
            button.disabled = false;
        }
    }

    // Xử lý ba nút: làm mới số liệu, tạo đơn mẫu, xóa đơn mẫu.
    const onRefresh = () => load().catch(console.error);
    const onAdd = () => runAction($("statsAddDemo"), () => addDemoBookings(db, pricingService, { count: 40 }), (n) => `Đã thêm ${n} đơn mẫu.`).catch(console.error);
    const onClear = () => runAction($("statsClearDemo"), () => clearDemoBookings(db), (n) => `Đã xóa ${n} đơn mẫu.`).catch(console.error);

    $("statsRefresh").addEventListener("click", onRefresh);
    $("statsAddDemo").addEventListener("click", onAdd);
    $("statsClearDemo").addEventListener("click", onClear);

    // Có đơn mới / phòng đổi trạng thái thì tự cập nhật số liệu
    const unsubscribe = [
        bookingService.events.on("booking-paid", onRefresh),
        holdService.events.on("seat-released", onRefresh),
        holdService.events.on("seats-confirmed", onRefresh),
    ];

    load().catch(console.error);

    return function dispose() {
        disposed = true;
        unsubscribe.forEach((off) => off());
    };
}
