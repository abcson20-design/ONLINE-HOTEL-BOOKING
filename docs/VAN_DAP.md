# Tài liệu chuẩn bị vấn đáp (Y5)

Giảng viên sẽ chỉ vào một hàm bất kỳ và hỏi: **nó làm gì – vì sao cần – dữ liệu vào/ra là gì**, rồi hỏi tình huống *"nếu đầu vào là… / nếu bước… thất bại thì sao?"*. Tài liệu này giúp bạn luyện đúng kiểu hỏi đó. **Đừng học thuộc** – hãy mở code, chạy thử từng tình huống (`npm test`, `npm run simulate`, trang Phòng nghỉ) rồi tự nói lại bằng lời của mình.

---

## 1. Trình bày luồng chính trong 1 phút

1. Khách bấm một phòng trống → `HoldService.holdSeats`. Hàm **xin khóa (mutex) của phòng đó**, kiểm tra phòng còn `trong` thì ghi `dang_giu`, tạo bản ghi **hold** có `het_han_luc = bây giờ + 10 phút` và **hẹn một timer**.
2. Giao diện hiện **đồng hồ đếm ngược** tính từ `het_han_luc`. Khách nhập thông tin, chọn combo và mã giảm giá.
3. Khách bấm thanh toán → `BookingService.checkout`: kiểm tra hold còn hạn và đúng chủ, **`PricingService` tính giá ở phía service**, tạo đơn `cho_thanh_toan`, gọi cổng thanh toán (bất đồng bộ).
4. Thanh toán xong → `confirmHolds` **kiểm tra lại hold còn hạn** (vì thanh toán tốn thời gian) → phòng thành `da_dat`, đơn thành `da_thanh_toan`.
5. Nếu hết hạn mà chưa thanh toán, **timer nổ** → xin khóa → nhả phòng về `trong` → `WaitlistService` thấy có phòng thì **tự giữ cho người đầu hàng đợi**.

Ba thứ quyết định tính đúng đắn: **khóa theo phòng** (không trùng), **hold có mốc hết hạn + timer** (tự nhả), **kiểm tra lại ở bước xác nhận** (không giữ phòng "ma").

---

## 2. Bản đồ file

| Tầng | File | Một câu |
|---|---|---|
| Dữ liệu | `data/Database.js` | CSDL giả lập 5 bảng, mọi thao tác `async` có độ trễ, trả về **bản sao** bản ghi |
| | `data/seed.js` | Sinh 30 đêm × 36 phòng; chỉ thêm bản ghi **chưa có** |
| | `data/pricingCatalog.js` | Bảng cấu hình: ngày lễ, combo, mã giảm giá |
| | `data/demoData.js` | Tạo/xóa đơn mẫu cho trang thống kê |
| Nghiệp vụ | `services/HoldService.js` | Giữ, nhả, xác nhận phòng; TTL; chống trùng |
| | `services/BookingService.js` | Luồng đặt phòng và thanh toán |
| | `services/PricingService.js` | Tính giá, hàm thuần |
| | `services/WaitlistService.js` | Hàng đợi FIFO |
| | `services/StatsService.js` | Thống kê (`buildReport` là hàm thuần) |
| | `services/SeatMapService.js` | Dựng sơ đồ phòng theo góc nhìn từng người |
| | `services/concurrencySimulator.js` | Bắn N yêu cầu đồng thời và kiểm tra trùng |
| | `services/container.js` | Nơi lắp ráp service |
| | `utils/KeyedMutex.js` | Khóa loại trừ theo khóa |
| | `utils/EventBus.js` | Phát/nhận sự kiện giữa các service và giao diện |
| Giao diện | `ui/views.js`, `ui/statsViews.js` | Hàm thuần: dữ liệu → HTML |
| | `ui/hotelPageController.js`, `ui/statsPageController.js` | Gắn sự kiện, gọi service, cập nhật DOM |

---

## 3. Các hàm quan trọng

### `KeyedMutex.runExclusive(keys, task)` – `utils/KeyedMutex.js`
- **Làm gì:** chạy `task` khi đã giữ khóa của **tất cả** `keys`; ai đến sau phải chờ người trước nhả khóa.
- **Vào:** mảng khóa (mã phòng), hàm `task` bất đồng bộ. **Ra:** kết quả của `task`; luôn nhả khóa kể cả khi `task` ném lỗi (`finally`).
- **Vì sao cần:** giữa *đọc trạng thái* và *ghi trạng thái* có `await` nên request khác chen vào được (race condition). Khóa biến đoạn này thành một khối không bị chen.
- **Chi tiết hay bị hỏi:** khóa được xin theo thứ tự **đã sắp xếp** và bỏ trùng → tránh deadlock. Mỗi khóa là một chuỗi Promise (`previous.then(() => gate)`).

### `HoldService.holdSeats(userId, seatIds)`
- **Làm gì:** giữ tạm các phòng cho một người, **hoặc giữ được tất cả, hoặc không giữ phòng nào**.
- **Vào:** `userId` (chuỗi khác rỗng), `seatIds` (1–6 phòng, không trùng). **Ra:** mảng bản ghi hold. **Lỗi:** `VALIDATION`, `NOT_FOUND`, `SEAT_UNAVAILABLE`.
- **Các bước:** kiểm tra đầu vào → xin khóa tất cả phòng → đọc các phòng → nếu có phòng không `trong` thì ném lỗi **trước khi ghi bất cứ thứ gì** → ghi `dang_giu`, tạo hold, hẹn timer → phát sự kiện `seats-held`. Lỗi giữa chừng thì `#rollback`.

### `HoldService.#scheduleExpiry` và `#handleExpiry`
- **Làm gì:** hẹn timer theo `het_han_luc − now`; khi timer nổ thì nhả phòng.
- **Vì sao `#handleExpiry` cũng xin khóa:** nếu không, timer có thể nhả phòng đúng lúc khách đang xác nhận thanh toán.
- **Vì sao kiểm tra lại:** (1) hold có thể đã bị thanh toán hoặc bỏ giữ trước khi timer nổ; (2) `setTimeout` có thể nổ sớm ~1ms so với `Date.now()` → nếu chưa tới hạn thì **hẹn lại**, tránh phòng bị kẹt mãi ở "đang giữ".

### `HoldService.confirmHolds(userId, seatIds)`
- **Làm gì:** chuyển phòng từ "đang giữ" sang "đã đặt", chỉ khi **đúng chủ** và **còn hạn**.
- **Lỗi:** `HOLD_EXPIRED` (không còn hold, hoặc hold đã quá hạn – khi đó phòng được nhả luôn), `NOT_OWNER`.
- **Vì sao cần:** thanh toán mất thời gian nên hold có thể hết hạn **ngay trong lúc thanh toán**; đây là chốt chặn cuối.

### `HoldService.restoreTimers()`
- **Làm gì:** dựng lại timer cho mọi hold đã lưu trong `localStorage` khi mở lại trang. Hold quá hạn có `delay = 0` nên được nhả ngay.

### `BookingService.checkout(userId, seatIds, customer, options)`
- **Làm gì:** hoàn tất một đơn từ các phòng đang giữ. **Ra:** bản ghi booking `da_thanh_toan`.
- **Thứ tự:** chặn bấm hai lần → `validateCustomer` → kiểm tra hold (còn hạn, đúng chủ, cùng một đêm) → **tính giá** → tạo đơn `cho_thanh_toan` → thanh toán → `confirmHolds` → đơn `da_thanh_toan`.
- **Vì sao tính giá ở service:** số tiền từ trình duyệt có thể bị sửa; giá được lưu vào `bang_gia` để đổi bảng giá sau này không ảnh hưởng đơn cũ.

### `PricingService.describeNight(date)` và `quote(...)`
- `describeNight`: trả `{kind, multiplier, label}` – bình thường (×1), cuối tuần (×1,2), lễ (×1,3); **vừa lễ vừa cuối tuần lấy hệ số cao hơn, không cộng dồn**.
- `quote`: hạng phòng × hệ số đêm (làm tròn nghìn đồng) + combo − mã giảm giá. Mã giảm tính trên **tạm tính** (phòng đã phụ thu + combo) và không bao giờ giảm quá tổng tiền.
- Là **hàm thuần** (không đọc DB, không `async`): cùng đầu vào luôn ra cùng kết quả → dễ kiểm thử.

### `WaitlistService` – `join`, `#processEvent`, `#offerTo`
- `join`: chỉ cho vào hàng khi số phòng trống **ít hơn** số phòng cần (nếu còn đủ thì báo `SEATS_AVAILABLE`); không xếp hàng hai lần.
- `#processEvent`: lấy người **đầu hàng**; đủ phòng thì `#offerTo`, không đủ thì **dừng – cả hàng chờ** (không cho người sau chen ngang).
- `#offerTo`: gọi `holdSeats` **dưới tên người đầu hàng** nên vẫn đi qua khóa chống trùng; thử tối đa 3 lần nếu phòng vừa bị người khác giành.

### `StatsService.buildReport({events, seats, bookings, now})`
- **Làm gì:** gom dữ liệu thành báo cáo. **Chỉ đơn đã thanh toán** tính vào doanh thu; đơn hủy chỉ để tính tỉ lệ hủy. Hàm `ratio()` trả 0 khi mẫu số bằng 0 nên không bao giờ ra `NaN`.

### `simulateConcurrentHolds(holdService, {userCount, pickSeats})`
- **Làm gì:** bắn `userCount` yêu cầu giữ phòng bằng `Promise.allSettled`, sau đó **đếm lại số hold của từng phòng** để kiểm tra không phòng nào có quá 1. **Ra:** `{successCount, failureReasons, doubleBooked, isSafe}`.

### `Database` (tầng dữ liệu)
- Mỗi thao tác `async` chờ một độ trễ ngẫu nhiên (mô phỏng gọi API); trả về **bản sao** (`structuredClone`) nên bên ngoài không sửa trực tiếp dữ liệu, phải gọi `update()` như CSDL thật. Đây cũng là lý do race condition xuất hiện thật khi không có khóa.

### Giao diện: `refresh()` và `escapeHtml()`
- `refresh()` dùng số thứ tự `refreshSeq` để **bỏ qua kết quả cũ** nếu có lần tải mới hơn bắt đầu trước đó kết thúc (tránh sơ đồ "nhảy lùi").
- `escapeHtml()` thay `& < > " '` trước khi đưa dữ liệu người dùng vào `innerHTML` → chống chèn mã (XSS).

---

## 4. Câu hỏi tình huống

### Đồng thời và chống trùng
- **Hai người bấm cùng một phòng cùng lúc?** Cả hai gọi `holdSeats`, cùng xin khóa của phòng đó nên được xếp hàng. Người đến trước ghi `dang_giu`; người sau vào khối tới thấy phòng không còn `trong` → `SEAT_UNAVAILABLE`. Test: *50 người cùng giữ 1 phòng → đúng 1 người thắng*.
- **JavaScript đơn luồng, sao còn trùng được?** Đơn luồng chỉ đảm bảo không có hai đoạn code chạy *cùng lúc*, nhưng mỗi `await` nhường quyền cho đoạn khác. Test `CHỨNG MINH…` dùng bản không khóa để cho thấy nhiều người cùng "thắng".
- **Người 1 chọn [A, B], người 2 chọn [B, A]?** Khóa luôn xin theo thứ tự đã sắp xếp nên không ai giữ một khóa rồi chờ khóa kia theo chiều ngược → không deadlock; đúng một người thành công (có test).
- **Chọn [A, B] mà B đã bị giữ?** Không giữ gì cả: việc kiểm tra tất cả phòng xảy ra trước khi ghi, nên A vẫn `trong`.
- **Đang ghi dở thì lỗi (ví dụ ghi phòng B thất bại)?** `#rollback` xóa các hold đã tạo và trả phòng về `trong`.
- **Người khác cố xác nhận hoặc bỏ giữ phòng của mình?** `NOT_OWNER`; phòng vẫn đang giữ.

### Thời gian và TTL
- **Hết 10 phút trong lúc khách đang gõ form?** Timer nổ → xin khóa → nhả phòng → sự kiện `seat-released` → giao diện tải lại và hiện *"Hết thời gian giữ phòng"* (`detectLostHoldsDuringCheckout`), không để khách thanh toán vô ích.
- **Hết hạn ngay trong lúc đang thanh toán?** Thanh toán xong, `confirmHolds` thấy hold đã hết hạn (hoặc đã bị nhả) → `BookingCancelledError`: đơn `da_huy`, `da_hoan_tien = true`, phòng được nhả cho người khác (có test).
- **Đóng tab rồi mở lại?** Hold nằm trong `localStorage` nên phòng vẫn "đang giữ" lúc mở lại; `restoreTimers()` dựng lại timer, hold đã quá hạn bị nhả ngay. Khi tab đóng thì không có timer nào chạy – đây là giới hạn khi không có backend.
- **Đồng hồ đếm ngược có bị trôi không?** Không, vì mỗi giây nó tính lại `het_han_luc − Date.now()` chứ không trừ dần từng tick.
- **Timer nổ sớm 1ms?** `#handleExpiry` thấy `het_han_luc > now` nên hẹn lại, tránh phòng kẹt vĩnh viễn.

### Thanh toán và giá
- **Thanh toán thất bại?** Đơn `da_huy` (`ly_do_huy = thanh_toan_that_bai`, không hoàn tiền vì chưa trừ), **phòng vẫn được giữ** để thử lại nếu còn hạn.
- **Bấm "Thanh toán" hai lần?** `#processingUsers` chặn lần hai bằng `ALREADY_PROCESSING`; chỉ có một đơn được tạo (có test).
- **Nhập mã giảm giá sai, hoặc không đủ điều kiện?** `ValidationError` ở ô `coupon`, **chưa tạo đơn**, phòng vẫn giữ; giao diện hiện lý do.
- **Mã giảm lớn hơn tổng tiền?** Mức giảm bị chặn ở `Math.min(giảm, tạm tính)`.
- **Đêm vừa thứ Sáu vừa là Giáng sinh?** Lấy hệ số cao hơn (30%), không cộng dồn thành 50%.
- **Combo không tồn tại?** `ValidationError` ở ô `combo`.
- **Đặt 7 phòng? 0 phòng? Trùng mã phòng?** `holdSeats` ném `VALIDATION` (tối đa 6, tối thiểu 1, không trùng).
- **`userId` rỗng hoặc `null`?** `VALIDATION`.
- **Đặt các phòng thuộc hai đêm khác nhau trong một đơn?** `BookingService` từ chối: *"chỉ đặt các phòng trong cùng một đêm"*.

### Hàng đợi
- **Khi nào được vào hàng đợi?** Chỉ khi số phòng trống **ít hơn** số phòng cần; nếu còn đủ thì báo `SEATS_AVAILABLE`.
- **Đầu hàng cần 2 phòng mà mới nhả 1 phòng?** Cả hàng **chờ**; người thứ hai cần 1 phòng vẫn không được chen ngang (có test). Lý do: nếu không, người cần ít phòng luôn được ưu tiên và người cần nhiều phòng có thể chờ mãi.
- **Người được mời nhưng không thanh toán?** Phòng được giữ dưới tên họ như mọi hold khác, nên hết TTL sẽ nhả và hàng đợi chuyển cho người kế tiếp.
- **Người nhanh tay giành phòng vừa nhả trước hàng đợi?** Vẫn an toàn vì cả hai đều đi qua khóa; hàng đợi thử lại hoặc chờ lần nhả sau. Một phòng không bao giờ có hai hold.
- **Xếp hàng hai lần trong một đêm?** `ALREADY_WAITING`.

### Thống kê
- **Chưa có đơn nào?** Mọi số về 0, không `NaN`/`Infinity` (có test "không có dữ liệu").
- **Đơn hủy có tính vào doanh thu không?** Không; chỉ dùng để tính tỉ lệ hủy.
- **Khung giờ "Đêm (23–04h)" xử lý qua nửa đêm thế nào?** Bucket có `from > to` được xử lý riêng (`hour >= from || hour <= to`); test ranh giới 4h/5h/11h/12h/22h/23h/0h.

### Giao diện và bảo mật
- **Khách nhập tên chứa `<script>`?** `escapeHtml` biến thành văn bản thường, không chạy.
- **Trình duyệt chặn `localStorage`?** `container.js` bắt lỗi và dùng bộ nhớ tạm; ứng dụng vẫn chạy nhưng mất dữ liệu khi tải lại trang.
- **Rời trang khi còn timer/sự kiện?** Router gọi hàm `dispose()` của trang cũ: dừng `setInterval`, hủy đăng ký sự kiện, đóng hộp thoại, xóa thông báo.

---

## 5. Câu hỏi khái niệm

- **Seat hold + TTL là gì?** Khóa tạm thời một tài nguyên trong N phút; hết hạn thì tự nhả nếu chưa xác nhận.
- **Race condition là gì? Cách chống?** Kết quả phụ thuộc thứ tự xen kẽ của các thao tác; chống bằng loại trừ tương hỗ (mutex), ở đây theo từng phòng để các phòng khác nhau vẫn chạy song song.
- **`async/await` khác callback lồng nhau thế nào?** Viết tuần tự dễ đọc, bắt lỗi bằng `try/catch`; dự án không có callback lồng nhiều tầng.
- **`Promise.all` và `Promise.allSettled`?** `all` thất bại ngay khi một cái lỗi; `allSettled` chờ tất cả xong và cho biết từng kết quả – dùng ở mô phỏng vì cần đếm cả thắng lẫn thua.
- **Vì sao tách 3 tầng?** Nghiệp vụ không biết DOM nên kiểm thử bằng Node; đổi giao diện hay cơ sở dữ liệu không ảnh hưởng quy tắc.
- **`EventBus` dùng làm gì?** Service phát sự kiện (`seat-released`…), giao diện và hàng đợi lắng nghe → không phụ thuộc trực tiếp lẫn nhau.
- **`dependencies` khác `devDependencies`?** `dependencies` cần khi chạy sản phẩm (Bootstrap, Popper); `devDependencies` chỉ cần lúc phát triển (Webpack, ESLint).
- **Webpack làm gì?** Gom các module ES (`import/export`) và CSS thành một `bundle.js`; `html-webpack-plugin` sinh `index.html`.
- **Vì sao `package.json` có `"type": "module"` và webpack config đặt tên `.cjs`?** Để Node hiểu `import/export` khi chạy test; file config webpack viết kiểu CommonJS nên dùng đuôi `.cjs`.
- **ESLint bắt lỗi gì ở dự án này?** Biến không dùng, `var`, so sánh `==`, `console` thừa… (`npm run lint` hiện 0 lỗi).
- **Vì sao dùng private field `#`?** Giấu trạng thái nội bộ (`#timers`, `#mutex`) để bên ngoài chỉ dùng qua phương thức công khai.

---

## 6. Những điểm nên nói thẳng (giảng viên đánh giá cao sự trung thực)

- **Không có backend:** khóa chống trùng chỉ có tác dụng trong một tab trình duyệt. Khi có máy chủ, cùng kỹ thuật sẽ đặt ở server (hoặc dùng khóa của cơ sở dữ liệu/Redis); đề cho phép mô phỏng đồng thời nên cách làm hiện tại đáp ứng.
- **Timer nằm trong trình duyệt:** đóng tab thì dừng, đã có `restoreTimers()` để xử lý khi mở lại.
- **Dữ liệu cấu hình (giá, ngày lễ, mã giảm giá) là minh họa**, không phải bảng giá thật.
- **Đăng nhập/Liên hệ chỉ là giao diện.**

---

## 7. Kịch bản demo 3 phút

1. Mở **Phòng nghỉ**, chọn *30 giây (demo)*, giữ phòng → chỉ vào đồng hồ → chờ hết giờ, phòng tự nhả (**tự nhả + TTL**).
2. Nhập 50, bấm **Chạy** ở mô phỏng → đọc kết quả "1 thành công, 49 bị từ chối, 0 phòng trùng" (**chống trùng**).
3. Chọn đêm Thứ 6, giữ phòng, mở form, tick ăn sáng, nhập `WELCOME10` → đọc bảng giá (**pricing**).
4. Bấm **Đặt kín đêm này** → **Vào hàng** → **Nhả phòng mô phỏng** → toast "Đến lượt bạn" (**hàng đợi FIFO**).
5. Mở **Thống kê** → **Tạo dữ liệu mẫu** (**thống kê**).
6. Mở `npm test` (83 ca) và `images/so-do-luong-nghiep-vu.png` để trình bày sơ đồ luồng.
