# User Story, tiêu chí chấp nhận và Product Backlog

Backlog được sắp xếp từ hạng mục nền tảng, ít phức tạp đến nghiệp vụ tích hợp
và có rủi ro cao hơn. Mỗi task hoàn thành theo Definition of Done tại cuối tài
liệu này được tính 1 điểm, tổng cộng 10 điểm.

## Product Backlog

| # | Task (Story) | Yêu cầu / tiêu chí chấp nhận chính | Sprint | Điểm |
|---|---|---|---|---:|
| 1 | Khởi tạo dự án và cấu trúc | Monorepo có frontend Next.js và backend NestJS; chạy được Hello; có README, Git và `.env.example`. | 1 | 1 |
| 2 | API danh sách và chi tiết sản phẩm | `GET /products` trả JSON menu gồm id, tên, giá, ảnh; `GET /products/:id` trả chi tiết; dữ liệu mẫu có sẵn; id không tồn tại trả 404. | 1 | 1 |
| 3 | Trang menu | Frontend gọi `/products`, hiển thị danh sách; có trạng thái loading, rỗng và lỗi. | 1 | 1 |
| 4 | Chi tiết và tùy chọn sản phẩm | Khách xem chi tiết, chọn size S/M/L và topping; giá cập nhật theo lựa chọn. | 1 | 1 |
| 5 | Giỏ hàng | Khách thêm, sửa số lượng và xóa món; giỏ được lưu trong state; tổng tiền và badge cập nhật chính xác. | 1 | 1 |
| 6 | API tạo đơn | `POST /orders` yêu cầu JWT và dữ liệu hợp lệ; tạo đơn trạng thái `PENDING`, trả mã đơn. | 2 | 1 |
| 7 | Đăng ký và đăng nhập | `POST /auth/register` băm mật khẩu; `POST /auth/login` trả JWT; route đặt đơn từ chối token không hợp lệ. | 2 | 1 |
| 8 | Thanh toán không tiền mặt | Khách chọn Ví/Thẻ; mock payment chuyển đơn sang `PAID` khi thành công hoặc `PAYMENT_FAILED` khi lỗi; giỏ được giữ khi lỗi. | 2 | 1 |
| 9 | Xác nhận và lịch sử đơn | Hiển thị mã đơn, trạng thái sau khi tạo; `GET /orders/me` yêu cầu JWT và chỉ trả đơn của người dùng hiện tại; Docker Compose khởi chạy đủ web, API và DB. | 2 | 1 |
| 10 | Nghiệp vụ backend | State machine chặn chuyển trạng thái sai; thanh toán idempotent theo `Idempotency-Key`; kiểm soát tồn kho khi đặt đồng thời; cộng điểm loyalty khi đơn `PAID`. | 2 | 1 |
|   | **Tổng** |  |  | **10** |

## User Stories và Acceptance Criteria

### US-01 — Khởi tạo dự án

**Là** thành viên nhóm phát triển, **tôi muốn** có cấu trúc monorepo frontend/backend và hướng dẫn chạy, **để** cả nhóm có thể phát triển và kiểm thử trên cùng môi trường.

- Frontend và backend có thể khởi chạy theo README.
- Có `.env.example`; không đưa thông tin bí mật vào repository.
- CI có thể cài dependencies và build các ứng dụng.

### US-02 — Xem menu và chi tiết sản phẩm

**Là** khách hàng, **tôi muốn** xem danh sách đồ uống và thông tin chi tiết, **để** chọn món phù hợp.

- `GET /products` trả danh sách JSON có `id`, `name`, `price`, `imageUrl`.
- `GET /products/:id` trả đúng sản phẩm theo id; id không tồn tại trả HTTP 404.
- Dữ liệu mẫu có ít nhất một sản phẩm để menu dùng được khi demo.
- Giao diện thể hiện loading, danh sách rỗng và lỗi tải dữ liệu.

### US-03 — Chọn tùy chọn sản phẩm

**Là** khách hàng, **tôi muốn** chọn size và topping, **để** đặt đồ uống theo sở thích.

- Có thể chọn size S, M hoặc L và topping được hỗ trợ.
- Tổng giá thay đổi chính xác theo các tùy chọn đang chọn.
- Tùy chọn được thể hiện trong món thêm vào giỏ.

### US-04 — Quản lý giỏ hàng

**Là** khách hàng, **tôi muốn** sửa số lượng hoặc xóa món trong giỏ, **để** kiểm tra đơn trước khi thanh toán.

- Có thể thêm món, tăng/giảm số lượng và xóa món.
- Tổng tiền bằng tổng giá từng món nhân số lượng.
- Badge số lượng phản ánh đúng tổng số sản phẩm trong giỏ.

### US-05 — Tạo đơn hàng

**Là** khách hàng đã đăng nhập, **tôi muốn** gửi giỏ hàng để tạo đơn, **để** nhận mã đơn và tiếp tục thanh toán.

- `POST /orders` yêu cầu JWT hợp lệ và dữ liệu đầu vào hợp lệ.
- Đơn mới bắt đầu ở trạng thái `PENDING`.
- Phản hồi chứa mã đơn để khách hàng có thể tra cứu.

### US-06 — Đăng ký và đăng nhập

**Là** khách hàng, **tôi muốn** đăng ký và đăng nhập an toàn, **để** sử dụng các chức năng gắn với tài khoản.

- Đăng ký lưu mật khẩu đã băm, không lưu mật khẩu gốc.
- Đăng nhập đúng thông tin trả JWT.
- Thông tin đăng nhập sai hoặc token không hợp lệ bị từ chối.

### US-07 — Thanh toán không tiền mặt

**Là** khách hàng, **tôi muốn** thanh toán đơn bằng Ví hoặc Thẻ mô phỏng, **để** không cần mang tiền mặt.

- Khi giỏ có ít nhất một sản phẩm, nút thanh toán hiển thị tổng tiền.
- Chọn phương thức Ví/Thẻ rồi xác nhận sẽ tạo yêu cầu thanh toán cho đơn.
- Thanh toán thành công chuyển đơn sang `PAID` và hiển thị mã đơn cùng màn hình xác nhận.
- Thanh toán lỗi chuyển đơn sang `PAYMENT_FAILED` và giữ nguyên giỏ hàng.

### US-08 — Xem lịch sử đơn

**Là** khách hàng đã đăng nhập, **tôi muốn** xem lịch sử đơn của mình, **để** kiểm tra các đơn đã tạo và trạng thái hiện tại.

- `GET /orders/me` yêu cầu JWT hợp lệ.
- Kết quả chỉ bao gồm đơn thuộc tài khoản trong JWT, sắp xếp mới nhất trước.
- Mỗi đơn có trạng thái và thông tin mặt hàng để khách nhận biết đơn.

### US-09 — Theo dõi vòng đời đơn

**Là** khách hàng và nhân viên xử lý đơn, **tôi muốn** trạng thái đơn đi theo quy trình hợp lệ, **để** đơn được xử lý nhất quán.

- Luồng thành công là `PENDING → PAID → PREPARING → READY → COMPLETED`.
- `PENDING` có thể chuyển sang `PAYMENT_FAILED` hoặc `CANCELLED`.
- `PAYMENT_FAILED` có thể thử lại về `PENDING` hoặc chuyển `CANCELLED`.
- `PAID` có thể chuyển `PREPARING` hoặc `CANCELLED`.
- Trạng thái kết thúc `COMPLETED` và `CANCELLED` không được chuyển tiếp.
- Mọi chuyển trạng thái không được phép bị từ chối và không cập nhật dữ liệu.

### US-10 — Đảm bảo nghiệp vụ backend

**Là** chủ cửa hàng, **tôi muốn** thao tác thanh toán và cập nhật tồn kho an toàn, **để** không phát sinh đơn trùng hoặc bán vượt tồn kho.

- Gửi lặp yêu cầu với cùng `Idempotency-Key` chỉ tạo một đơn/thanh toán.
- Các yêu cầu đặt hàng đồng thời không làm số lượng bán vượt tồn kho.
- Chỉ cộng điểm thưởng khi đơn chuyển sang `PAID`.
- Unit/integration test chứng minh các điều kiện nghiệp vụ trên.

## Definition of Done

- Code chạy được, không lỗi build; thay đổi được review trong pull request.
- API có dữ liệu đầu vào/đầu ra rõ ràng và validate đầu vào phù hợp.
- Có kiểm thử cho luồng chính và các điều kiện chặn được nêu trong acceptance criteria.
- Hướng dẫn README được cập nhật khi cách chạy hoặc cấu hình thay đổi.
