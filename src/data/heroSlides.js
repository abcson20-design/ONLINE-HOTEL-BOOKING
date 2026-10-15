// Ảnh banner & ảnh phòng. Muốn dùng ảnh thật: chép ảnh (.jpg/.png/.webp) vào
// src/assets/banner/ rồi đổi đường dẫn import bên dưới (VD: ../assets/banner/lobby.jpg).
import hotelExterior from "../assets/banner/MatTruocKhachSan.png";
import hotelLobby from "../assets/banner/Sanh.png";
import roomSingle from "../assets/banner/PhongDon.png";
import roomDouble from "../assets/banner/PhongDoi.png";
import roomVip from "../assets/banner/PhongVip.png";

// Bảng ảnh dùng chung (ảnh phòng ở thẻ phòng, ảnh sảnh ở trang chủ).
export const IMAGES = { hotelExterior, hotelLobby, roomSingle, roomDouble, roomVip };

// Danh sách slide cho banner trang chủ: ảnh, mô tả ảnh (alt) và chú thích hiển thị.
export const HERO_SLIDES = [
    { img: hotelExterior, alt: "Mặt tiền khách sạn",  caption: "Khách sạn hiện đại giữa lòng thành phố" },
    { img: hotelLobby,    alt: "Sảnh khách sạn",      caption: "Sảnh đón tiếp sang trọng, thoáng đãng" },
    { img: roomSingle,    alt: "Phòng đơn",           caption: "Phòng đơn gọn gàng, ấm cúng" },
    { img: roomDouble,    alt: "Phòng đôi",           caption: "Phòng đôi rộng rãi, view thoáng mát" },
    { img: roomVip,       alt: "Phòng VIP",           caption: "Phòng VIP đẳng cấp với phòng khách riêng" },
];
