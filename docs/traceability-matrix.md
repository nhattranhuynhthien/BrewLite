# Đối chiếu yêu cầu đề BrewLite

| Task | Mã nguồn/chức năng | Kiểm chứng / giới hạn |
|---|---|---|
| 1 | apps/api, apps/web, .env.example, README, Git | Build cả hai ứng dụng |
| 2 | products controller/service, catalog migration | GET /products; 40 sản phẩm từ migration |
| 3 | MenuPage, useProducts, storefront | Loading/lỗi/empty state; cần nghiệm thu trình duyệt |
| 4 | ProductDetailModal, product-options, orders service | Giá server bao gồm size/topping; voucher-loyalty E2E kiểm tra chốt giá |
| 5 | cart-store, cart-page | Zustand, thêm/sửa/xóa; cần demo badge và lưu giỏ |
| 6 | orders controller/service, CreateOrderDto | E2E tồn kho và checkout; đơn PENDING, không tin giá client |
| 7 | auth, AuthGuard | Unit auth/guard; JWT bảo vệ orders/payment/history |
| 8 | payments, MockPaymentGateway, storefront | Wallet/Card PAID, FAILED/retry, giữ giỏ khi lỗi |
| 9 | confirmation/history, /orders/me, docker-compose | Checkout HTTP E2E kiểm tra lịch sử; cần demo Docker với bản mới |
| 10.1 | order-status, OrdersService.update | Unit state machine chặn chuyển sai; barista UI ngoài MVP |
| 10.2 | Order.requestKey/requestHash, ProcPaymentKey, paidOrderId | E2E cùng key tạo một đơn/payment; mock cache chỉ trong tiến trình |
| 10.3 | Transaction + updateMany(stock >= quantity) | E2E cạnh tranh kho, giỏ nhiều món ngược thứ tự |
| 10.4 | Promotion, rewardPoints, orders/payments | E2E voucher/điểm, cạnh tranh lượt cuối, cộng điểm sau PAID |
| Phi chức năng | class-validator, bcrypt, JWT; .github/workflows/ci.yml | Build/lint/test local đạt; cần đo hiệu năng và nhiều trình duyệt |
| Scrum/bàn giao | docs/requirements, README | Nhóm cần bổ sung minh chứng Scrum/review thực tế |

Không suy ra điểm nghiệm thu chỉ từ số test qua.
