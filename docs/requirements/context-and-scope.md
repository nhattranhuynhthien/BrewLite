# Bối cảnh, stakeholder và phạm vi (Task 1.1)

> Bản nháp ban đầu, nhóm chỉnh lại cho đúng với nhóm mình.

## 1. Vấn đề nghiệp vụ

Khách phải xếp hàng gọi món và trả tiền mặt tại quầy, mất thời gian vào giờ cao điểm
và dễ nhầm đơn. BrewLite cho khách chọn đồ uống, thanh toán không tiền mặt và theo dõi
đơn hàng trên điện thoại, giảm thời gian xếp hàng và nhận đơn nhanh tại quầy.

## 2. Stakeholder

| Stakeholder | Mục tiêu | Kỳ vọng |
|---|---|---|
| Khách hàng | Đặt đồ uống nhanh, không dùng tiền mặt | Giao diện dễ dùng trên điện thoại, theo dõi được trạng thái đơn |
| Nhân viên quầy (barista) | Tiếp nhận đơn và pha chế đúng | Đơn rõ ràng, cập nhật trạng thái dễ (ngoài MVP) |
| Quản lý cửa hàng / Product Owner | Giảm xếp hàng, đơn chính xác | Xác định yêu cầu, ưu tiên backlog, nghiệm thu Increment |
| Giảng viên / khách hàng nghiệm thu | Đánh giá quy trình và sản phẩm | Sản phẩm chạy được, đủ tài liệu, test, truy vết |
| Nhóm phát triển | Giao sản phẩm đúng hạn | Yêu cầu rõ, phạm vi vừa sức, dễ build và deploy |
| Đơn vị thanh toán | Xử lý giao dịch đúng | Yêu cầu hợp lệ, không trừ tiền hai lần (mô phỏng trong bài) |

## 3. Phạm vi

### In-scope (MVP)
- Xem menu, chi tiết sản phẩm, chọn size/topping
- Giỏ hàng và tính tổng tiền
- Đăng ký, đăng nhập (JWT)
- Tạo đơn hàng, thanh toán Ví/Thẻ mô phỏng
- Xác nhận đơn, trạng thái đơn, lịch sử đơn

### Phạm vi mở rộng
- Màn hình barista cập nhật trạng thái pha chế
- Khuyến mãi, điểm thưởng (loyalty)
- Kiểm soát tồn kho khi đặt đồng thời

### Out-of-scope (không thực hiện)
- Thanh toán thật qua Momo/VNPay/Stripe
- Ứng dụng native iOS/Android
- Giao hàng tận nơi
- Quản lý nhiều chi nhánh

## 4. Giả định
- Khách có smartphone và kết nối Internet.
- Cổng thanh toán chỉ là mô phỏng (mock).

## 5. Ràng buộc
- Bắt buộc dùng Next.js, NestJS, PostgreSQL (có thể bổ sung, không được thay thế).
- Thực hiện theo Agile Scrum, hai Sprint.
- Nguồn lực: nhóm sinh viên, thời gian giới hạn.

## 6. Rủi ro ban đầu
| Rủi ro | Cách giảm thiểu |
|---|---|
| Deploy lỗi vào phút cuối | Thiết lập CI/CD sớm, deploy thử từ Sprint 1 |
| Đặt đồng thời vượt tồn kho | Transaction + optimistic locking, có test |
| Tài liệu và code lệch nhau | Duy trì ma trận truy vết, thay đổi qua pull request |
