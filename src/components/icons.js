/** Tạo mã SVG cho một biểu tượng: `path` là nét vẽ, `size` là kích thước (px); màu theo màu chữ hiện tại. */
const svg = (path, size = 22) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
     aria-hidden="true">${path}</svg>`;

/** Bộ biểu tượng dùng trong giao diện – gọi dạng icons.tên(kích_thước) trả về chuỗi SVG. */
export const icons = {
    hotel:    (s) => svg('<path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>', s),
    calendar: (s) => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', s),
    users:    (s) => svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.3 3.5 5.2"/>', s),
    search:   (s) => svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
    shield:   (s) => svg('<path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>', s),
    clock:    (s) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', s),
    tag:      (s) => svg('<path d="M3 12V4h8l10 10-8 8L3 12z"/><path d="M7.5 8h.01"/>', s),
    headset:  (s) => svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="14" width="5" height="6" rx="1.5"/><rect x="16.5" y="14" width="5" height="6" rx="1.5"/>', s),
    pin:      (s) => svg('<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>', s),
    phone:    (s) => svg('<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', s),
    mail:     (s) => svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', s),
    arrow:    (s) => svg('<path d="M5 12h14M13 6l6 6-6 6"/>', s),
    bed:      (s) => svg('<path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.500"/>', s),
    star:     (s) => svg('<path d="m12 3 2.800 5.700 6.200.9-4.500 4.400 1.100 6.200L12 17.200 6.400 20.200l1.100-6.200L3 9.600l6.200-.9L12 3z"/>', s),
};
