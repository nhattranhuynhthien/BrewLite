# SRS rút gọn (Task 1.2)

Ưu tiên theo MoSCoW: Must, Should, Could, Won't.

## Yêu cầu chức năng

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
|---|---|---|---|
| FR-01 | Hiển thị menu đồ uống (hình, tên, giá) | Must | `GET /products` trả danh sách; trang menu có loading/empty/error |
| FR-02 | Xem chi tiết sản phẩm, chọn size và topping | Must | Giá thay đổi đúng theo tùy chọn |
| FR-03 | Thêm/sửa/xóa sản phẩm trong giỏ, tự tính tổng | Must | Tổng tiền đúng sau mỗi thao tác; badge số lượng cập nhật |
| FR-04 | Đăng ký, đăng nhập (JWT) | Must | Mật khẩu được băm; route đặt đơn yêu cầu token hợp lệ |
| FR-05 | Tạo đơn hàng | Must | `POST /orders` lưu đơn trạng thái PENDING, trả mã đơn |
| FR-06 | Thanh toán không tiền mặt (Ví/Thẻ mô phỏng) | Must | Thành công: PAID; lỗi: PAYMENT_FAILED và giữ nguyên giỏ |
| FR-07 | Xác nhận đơn và lịch sử đơn | Must | `GET /orders/me` trả đúng đơn của người dùng |
| FR-08 | Quản lý trạng thái đơn (state machine) | Should | Chuyển trạng thái sai bị chặn |
| FR-09 | Thanh toán idempotent (Idempotency-Key) | Should | Gửi 2 lần cùng key chỉ tạo 1 đơn |
| FR-10 | Kiểm soát tồn kho khi đặt đồng thời | Should | Đặt đồng thời không vượt tồn kho |
| FR-11 | Khuyến mãi và điểm thưởng | Could | Mã hợp lệ giảm giá; cộng điểm khi đơn PAID |
| FR-12 | Màn hình barista | Won't (MVP) | Để phiên bản sau |

## Yêu cầu phi chức năng

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
|---|---|---|---|
| NFR-01 | Hiệu năng | Must | API phản hồi dưới 500ms với dữ liệu mẫu |
| NFR-02 | Bảo mật | Must | Băm mật khẩu, JWT, validate đầu vào |
| NFR-03 | Tính khả dụng | Must | Mobile-first, chạy trên các trình duyệt phổ biến |
| NFR-04 | Khả năng triển khai | Must | `docker compose up` chạy web, API, DB; có `/health` |

## Sơ đồ use-case tổng quát
Lưu tại `docs/diagrams/usecase-overview.puml` và `.svg`.
