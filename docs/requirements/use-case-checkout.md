# UC-01: Đặt và thanh toán đơn hàng (Task 1.3)

- **Actor chính:** Khách hàng. **Actor phụ:** Dịch vụ thanh toán (mô phỏng).
- **Trigger:** Khách bấm "Thanh toán" trong giỏ hàng.
- **Liên kết yêu cầu:** FR-03, FR-04, FR-05, FR-06, FR-07, NFR-02.

## Tiền điều kiện
- Giỏ hàng có ít nhất 1 sản phẩm.
- Khách đã đăng nhập (nếu chưa, hệ thống chuyển sang đăng nhập).

## Hậu điều kiện
- Thành công: đơn ở trạng thái PAID, hiển thị mã đơn.
- Thất bại: đơn ở trạng thái PAYMENT_FAILED, giỏ hàng được giữ nguyên.

## Luồng chính
1. Khách xem giỏ hàng và tổng tiền, bấm "Thanh toán".
2. Hệ thống kiểm tra JWT và validate dữ liệu giỏ hàng.
3. Hệ thống tạo đơn (PENDING) và kiểm tra tồn kho trong một transaction.
4. Khách chọn phương thức (Ví/Thẻ) và xác nhận.
5. Hệ thống gọi dịch vụ thanh toán với Idempotency-Key.
6. Thanh toán thành công: đơn chuyển PAID.
7. Hệ thống hiển thị mã đơn và trạng thái.

## Luồng thay thế
- A1: Chưa đăng nhập, chuyển sang đăng nhập rồi quay lại bước 1.
- A2: Khách thêm sản phẩm khác vào giỏ, quay lại bước 1.

## Luồng ngoại lệ
- E1: Hết hàng, báo sản phẩm hết và không tạo đơn.
- E2: Thanh toán lỗi, đơn PAYMENT_FAILED, cho phép thử lại.
- E3: Gửi lại cùng Idempotency-Key, trả kết quả cũ, không tạo đơn mới.
