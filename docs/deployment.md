# Kiểm chứng chạy Docker trên localhost

Ngày kiểm tra: 03/11/2026. Nhánh nguồn: `develop`, commit gốc `7a8165d`
kèm các thay đổi cấu hình Docker/API client và README chưa commit.

## Cấu hình

- Docker Desktop: Linux containers, Engine 29.8.2.
- PostgreSQL: `postgres:15-alpine`, volume hiện có `pgdata` được giữ lại.
- Frontend: `http://localhost:3000`.
- Backend: `http://localhost:4000`, Swagger: `/api`.
- Compose truyền `NEXT_PUBLIC_API_URL` vào build arguments của frontend.
- Dockerfile có giá trị mặc định `http://localhost:4000`; API client cũng xử lý
  biến rỗng hoặc chỉ chứa khoảng trắng bằng URL mặc định này.

## Lệnh đã kiểm chứng

```powershell
docker compose config --quiet
docker compose up -d --build
docker compose up -d --wait --wait-timeout 60
docker compose ps
docker compose exec -T backend npx prisma migrate status
```

Docker Engine đã tạm dừng sau lần build đầu; khởi động lại Docker Desktop rồi
chạy lại Compose thành công. Không xóa volume hoặc thay đổi mật khẩu DB hiện có.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| Cấu hình Compose | Hợp lệ |
| Docker build frontend/backend | Thành công; backend dùng cache build |
| DB | Up, healthy |
| Frontend/backend | Up, publish đúng cổng 3000/4000 |
| Prisma migration status | 2 migrations, database schema up to date |
| HTTP từ máy host: `/` frontend | 200, HTML |
| HTTP từ máy host: `/products` backend | 200, JSON |
| Catalog hiện có | 40 sản phẩm |
| HTTP từ máy host: Swagger `/api` | 200 |
| Bundle JavaScript API client trong image frontend | Có URL `http://localhost:4000` |
| CORS cho origin `http://localhost:3000` | Header cho phép đúng origin |
| `/orders/me` chưa đăng nhập | 401 |
| Đăng ký, đăng nhập bằng HTTP | Thành công, nhận JWT |
| Tạo đơn với sản phẩm test riêng | PENDING, trừ đúng 1 đơn vị tồn kho |
| Mock payment WALLET | PAID, cộng 3 điểm cho đơn 35.000đ |
| Gửi lại cùng payment/key tuần tự | Kết quả cache, chỉ 1 payment |
| Lịch sử tài khoản test | Có đúng đơn đã PAID |
| Dữ liệu test | Đã xóa user, product, order/items, payment và key của lần chạy |

Smoke test dùng tài khoản và sản phẩm tạm riêng; không dùng stock của sản phẩm
catalog để thử đặt đơn. Các thao tác dọn dữ liệu chỉ áp dụng bản ghi của lần test.

Kiểm tra riêng API client bằng mock response cũng đạt các trường hợp:
URL rỗng/khoảng trắng, URL có dấu `/` cuối, lỗi HTML 404, lỗi JSON có danh sách
message và JSON không hợp lệ. HTML lỗi không còn bị đưa nguyên lên giao diện.

## Giới hạn

- Đây là build/HTTP smoke test trên volume đang có, chưa phải thử cài mới trên DB trống.
- Chưa tự động thao tác giao diện trong trình duyệt; vẫn cần chạy checklist UI trong README.
- Chưa nghiệm thu size/topping, payment thất bại/retry hoặc request đồng thời.
- Replay tuần tự đạt không chứng minh idempotency an toàn khi gửi đồng thời.
- Chưa chạy toàn bộ integration suite, đo hiệu năng hoặc kiểm tra nhiều trình duyệt.

Hướng dẫn chạy Docker/npm, biến môi trường, migration và giới hạn seed nằm tại
[README](../README.md).
