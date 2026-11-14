# BrewLite

Ứng dụng đặt cà phê gồm frontend Next.js, API NestJS và PostgreSQL.

## Cách chạy nhanh bằng Docker Compose

Cài và mở Docker Desktop ở chế độ Linux containers. Mở PowerShell tại thư mục
gốc dự án (cùng thư mục với `docker-compose.yml`). Nếu chưa có `.env`, tạo từ mẫu:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose config --quiet
docker compose up -d --build
```

Lần chạy đầu tiên Docker sẽ tải dependencies, build frontend/backend, chờ
PostgreSQL sẵn sàng, áp dụng database migration rồi khởi động API. Khi các
service đã chạy:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Swagger API: http://localhost:4000/api

Kiểm tra trạng thái và log:

```powershell
docker compose ps
docker compose logs --tail 50 backend frontend
```

DB cần báo `healthy`; backend/frontend cần báo `Up`. Kiểm tra HTTP:

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:3000).StatusCode
(Invoke-WebRequest -UseBasicParsing http://localhost:4000/api).StatusCode
$products = Invoke-RestMethod http://localhost:4000/products
$products.Count
```

Hai lệnh đầu cần trả `200`; danh sách sản phẩm cần có dữ liệu. Backend hiện
chưa đăng ký route `/health`, vì vậy không dùng endpoint đó để xác nhận hoạt động.

Dừng bằng `docker compose stop`; khởi động lại bằng `docker compose up -d`.
`docker compose down` gỡ container/network nhưng giữ dữ liệu trong volume `pgdata`.

## Biến môi trường

| Biến | Nơi sử dụng | Giá trị localhost mẫu |
|---|---|---|
| `POSTGRES_USER` | Compose, khởi tạo PostgreSQL | `brewlite` |
| `POSTGRES_PASSWORD` | Compose, khởi tạo PostgreSQL | `brewlite123` |
| `POSTGRES_DB` | Compose, khởi tạo PostgreSQL | `brewlite_db` |
| `DATABASE_URL` | Prisma/API khi chạy bằng npm | `postgresql://brewlite:brewlite123@localhost:5432/brewlite_db?schema=public` |
| `PORT` | API khi chạy bằng npm | `4000` |
| `JWT_SECRET` | Ký và kiểm tra JWT | Xem `.env.example`; đặt giá trị riêng khi triển khai |
| `NEXT_PUBLIC_API_URL` | Frontend, được đóng vào JavaScript lúc build | `http://localhost:4000` |

Compose đọc `.env` ở thư mục gốc, tự tạo `DATABASE_URL` nội bộ dùng hostname
`db` cho backend. Frontend gọi API từ trình duyệt nên URL cần truy cập được
từ máy người dùng; localhost dùng cổng 4000, không dùng `http://backend:4000`.

Khi thay đổi `NEXT_PUBLIC_API_URL`, cần build lại frontend:

```powershell
docker compose up -d --build frontend
```

Chỉ restart container hoặc sửa runtime environment không đổi được URL đã build.
Nếu trình duyệt gọi `http://localhost:3000/products` và nhận HTML 404, kiểm tra
build argument, build lại frontend rồi nhấn `Ctrl+Shift+R`.

Không ghi đè `.env` hiện có khi cập nhật code. Với DB đã có volume, thay đổi
`POSTGRES_PASSWORD` trong `.env` không tự đổi mật khẩu bên trong DB; giữ thông tin
đã khởi tạo hoặc đổi mật khẩu DB có chủ đích và đồng bộ cấu hình.

## Migration và dữ liệu mẫu

Backend Docker chạy `prisma migrate deploy` trước khi khởi động. Có thể kiểm tra:

```powershell
docker compose exec backend npx prisma migrate status
```

Migration `20261028130000_product_catalog` đã thêm catalog 40 sản phẩm. Trên DB
mới, không cần chạy seed riêng để hiển thị menu. Migration đã áp dụng sẽ không
tự chạy lại để khôi phục sản phẩm nếu bạn xóa dữ liệu thủ công.

Seed tùy chọn (chỉ dùng trên dữ liệu phát triển khi cần):

```powershell
docker compose exec backend npx prisma db seed
```

Seed hiện tại upsert 4 sản phẩm đầu và tạo voucher `GIAM10`; nó đổi tên/giá/ảnh
và đặt stock 4 sản phẩm đó về 100. Seed này chưa đồng bộ với catalog 40 sản phẩm,
nên không chạy mặc định cho DB đang dùng. Bạn có thể đăng ký tài khoản từ giao diện;
dự án không cung cấp tài khoản demo mặc định trong seed.

## Chạy từng ứng dụng khi phát triển

Cần cài Node.js 20 trở lên, npm và Docker Desktop. Mở các terminal riêng tại
thư mục gốc dự án.

1. Nếu đang chạy toàn bộ bằng Docker, dừng web/API để tránh trùng cổng, giữ DB:

   ```powershell
   docker compose stop frontend backend
   docker compose up -d db
   ```

2. Trong terminal backend, cài dependencies, áp dụng Prisma migration và chạy
   NestJS:

   ```powershell
   cd apps/api
   $env:DATABASE_URL = "postgresql://brewlite:brewlite123@localhost:5432/brewlite_db?schema=public"
   npm.cmd ci
   npx.cmd prisma generate
   npx.cmd prisma migrate deploy
   npm.cmd run start:dev
   ```

   Thay thông tin trong `DATABASE_URL` bằng tài khoản/mật khẩu của DB hiện tại.
   Lệnh trên đặt biến trong terminal backend; `.env` ở gốc không tự được nạp vào
   mọi tiến trình npm ở thư mục con. Nếu cần JWT secret riêng, đặt
   `$env:JWT_SECRET` trong cùng terminal trước khi khởi động API.

3. Trong terminal frontend, tạo `apps/web/.env.local` nếu chưa có, với nội dung:

   ```dotenv
   NEXT_PUBLIC_API_URL=http://localhost:4000
   ```

   Cài dependencies và chạy Next.js:

   ```powershell
   cd apps/web
   npm.cmd ci
   npm.cmd run dev
   ```

Mở http://localhost:3000. Sau khi đổi `.env.local`, khởi động lại frontend.
Những lần chạy sau có thể bỏ `npm.cmd ci` nếu dependencies không thay đổi.
`npm.cmd`/`npx.cmd` dùng được trong PowerShell có chặn script `npm.ps1`.

## Các lệnh thường dùng

Tại `apps/api`:

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
```

Tại `apps/web`:

```powershell
npm.cmd run build
```

Integration/E2E có ghi/xóa dữ liệu, vì vậy chạy trên database kiểm thử riêng
đã tạo, dùng cùng cấu hình JWT với ứng dụng. Tại `apps/api`:

```powershell
$env:DATABASE_URL = "postgresql://brewlite:brewlite123@localhost:5432/brewlite_test?schema=public"
npx.cmd prisma migrate deploy
npm.cmd run test:e2e -- --runInBand
```

Thay credentials cho đúng máy. Hiện test payment idempotency còn hardcode JWT
secret riêng; cần đồng bộ với AuthModule trước khi dùng kết quả để nghiệm thu.

## Checklist kiểm tra giao diện

- Menu tải được ảnh, tên, giá; Network gọi backend cổng 4000.
- Đăng ký/đăng nhập; token được gửi khi tạo đơn và lấy lịch sử.
- Thêm/sửa/xóa giỏ, chọn Ví/Thẻ, thanh toán và xem mã/trạng thái đơn.
- Xem lại đơn trong lịch sử đúng tài khoản.

Checklist này cần chạy bằng trình duyệt khi nghiệm thu. Build/HTTP smoke test
không xác nhận tính đúng đắn của size/topping, payment lỗi/retry hay xử lý đồng thời;
những phần đó cần test nghiệp vụ riêng.

Kết quả kiểm chứng Docker/HTTP trên localhost được ghi tại
[`docs/deployment.md`](docs/deployment.md).

## Cấu trúc chính

- `apps/api/src/main.ts`: điểm khởi chạy NestJS.
- `apps/web/src/app/page.tsx`: trang chủ Next.js.
- `docker-compose.yml`: khởi chạy toàn bộ PostgreSQL, backend và frontend.
- `.env.example`: các biến môi trường tham khảo.
