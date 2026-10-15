# BÁO CÁO DỰ ÁN

## XÂY DỰNG WEBSITE ĐẶT PHÒNG KHÁCH SẠN TRỰC TUYẾN (ONLINE HOTEL BOOKING)

### Mục tiêu cụ thể

* Hiển thị danh sách phòng khách sạn.
* Phân loại phòng theo từng tầng.
* Hỗ trợ đặt phòng trực tuyến.
* Quản lý trạng thái phòng.
* Chống đặt trùng phòng.
* Hỗ trợ giữ phòng tạm thời.
* Thống kê số lượng phòng.
* Lưu dữ liệu bằng LocalStorage.
* Giao diện thân thiện và dễ sử dụng.

### Đối tượng hướng tới

Khách hàng du lịch có nhu cầu về chỗ ở

### Chức năng thực hiện

* Xem danh sách phòng.
* Đặt phòng.
* Quản lý trạng thái phòng.
* Xem thống kê.

### Công nghệ sử dụng

* HTML5
* CSS3
* Bootstrap 5
* JavaScript ES6 Modules
* LocalStorage
* Webpack

# CHƯƠNG 2: PHÂN TÍCH HỆ THỐNG

## 2.1 Mô tả hệ thống

Hệ thống cho phép người dùng truy cập website để xem thông tin phòng khách sạn và thực hiện đặt phòng trực tuyến.

Sau khi người dùng chọn phòng:

* Hệ thống kiểm tra trạng thái phòng.
* Nếu phòng còn trống sẽ cho phép giữ phòng.
* Nếu phòng đã được giữ hoặc đã đặt thì không thể đặt tiếp.
* Thông tin đặt phòng được lưu vào LocalStorage.

## 2.2 Các loại phòng

Khách sạn gồm 5 tầng.

Mỗi tầng gồm 12 phòng:

* 5 phòng đơn (Single Room)
* 5 phòng đôi (Double Room)
* 2 phòng VIP (VIP Room)

## 2.3 Chức năng hệ thống

* Xem danh sách phòng.
* Xem trạng thái phòng.
* Đặt phòng.
* Xem thông tin đặt phòng.
* Theo dõi thống kê.

# CHƯƠNG 3: THIẾT KẾ HỆ THỐNG

## 3.1 Cấu trúc thư mục

src/
│
├── components/
├── pages/
├── services/
├── router/
├── data/
├── ui/
└── utils/

## 3.2 Kiến trúc hệ thống

Website được xây dựng theo mô hình Module.

Mỗi chức năng được tách riêng:

### Pages

Chứa các trang giao diện:

* HomePage
* HotelPage
* StatsPage
* ContactPage
* LoginPage

### Services

Xử lý nghiệp vụ:

* BookingService
* RoomService
* HoldService
* WaitlistService
* StatisticsService

### Router

Điều hướng giữa các trang bằng Hash Router.

## 3.3 Giao diện hệ thống

### Trang chủ

Chức năng:

* Giới thiệu khách sạn.
* Hiển thị dịch vụ nổi bật.
* Điều hướng đến trang đặt phòng.

### Trang phòng nghỉ

Chức năng:

* Hiển thị danh sách phòng.
* Chọn phòng.
* Đặt phòng.

### Trang thống kê

Hiển thị:

* Tổng số phòng.
* Phòng trống.
* Phòng đang giữ.
* Phòng đã đặt.

### Trang liên hệ

Hiển thị:

* Thông tin khách sạn.
* Số điện thoại.
* Email hỗ trợ.

# CHƯƠNG 4: TRIỂN KHAI HỆ THỐNG

## 4.1 Công cụ sử dụng

* Visual Studio Code
* NodeJS
* npm
* GitHub

## 4.2 Các thư viện sử dụng

### Bootstrap 5

Sử dụng để xây dựng giao diện responsive.

### Webpack

Dùng để đóng gói và tối ưu mã nguồn.

### LocalStorage

Lưu dữ liệu đặt phòng trên trình duyệt.

## 4.3 Luồng hoạt động

Bước 1:

Người dùng chọn phòng.

↓

Bước 2:

Hệ thống kiểm tra trạng thái.

↓

Bước 3:

Nếu còn trống → giữ phòng.

↓

Bước 4:

Người dùng xác nhận đặt phòng.

↓

Bước 5:

Hệ thống lưu dữ liệu.

↓

Bước 6:

Cập nhật thống kê.
