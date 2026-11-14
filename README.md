# BrewLite

Ứng dụng đặt cà phê gồm frontend Next.js, API NestJS và PostgreSQL.

## Cách chạy nhanh bằng Docker Compose

Cài và mở Docker Desktop ở chế độ Linux containers. Mở PowerShell tại thư mục
gốc dự án (cùng thư mục với `docker-compose.yml`). Nếu chưa có `.env`, tạo từ mẫu:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
node scripts/setup-env.cjs
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

Hai lệnh đầu cần trả `200`; danh sách sản phẩm cần có dữ liệu.
`GET /health` kiểm tra API đang chạy; `GET /health/ready` kiểm tra DB (200 khi sẵn sàng, 503 khi mất kết nối).

Dừng bằng `docker compose stop`; khởi động lại bằng `docker compose up -d`.
`docker compose down` gỡ container/network nhưng giữ dữ liệu trong volume `pgdata`.

## Biến môi trường

| Biến | Nơi sử dụng | Giá trị localhost mẫu |
|---|---|---|
| `POSTGRES_USER` | Compose, khởi tạo PostgreSQL | `brewlite` |
| `POSTGRES_PASSWORD` | Compose, khởi tạo PostgreSQL | `brewlite123` |
| `POSTGRES_DB` | Compose, khởi tạo PostgreSQL | `brewlite_db` |
| `DATABASE_URL` | Prisma/API khi chạy bằng npm | `postgresql://brewlite:brewlite123@localhost:5433/brewlite_db?schema=public` |
| `PORT` | API khi chạy bằng npm | `4000` |
| `JWT_SECRET` | Ký và kiểm tra JWT | Bắt buộc secret riêng ≥32 byte; tạo bằng `node scripts/setup-env.cjs` |
| `ORDER_OPERATOR_USER_IDS` | Quyền chuyển trạng thái pha chế | ID tài khoản nhân viên, cách nhau bằng dấu phẩy; mặc định không ai có quyền |
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

Script `setup-env.cjs` chỉ thay JWT secret trống/yếu hoặc secret công khai cũ;
giữ nguyên secret riêng và các cấu hình khác. Không commit `.env`.
API từ chối khởi động nếu secret thiếu, dưới 32 byte hoặc dùng secret mặc định cũ.
Nếu từng dùng secret cũ, chạy script rồi tạo lại container backend; người dùng đăng nhập lại.

## Migration và dữ liệu mẫu

Backend Docker chạy `prisma migrate deploy` trước khi khởi động. Có thể kiểm tra:

```powershell
docker compose exec backend npx prisma migrate status
```

Migration `20261028130000_product_catalog` đã thêm catalog 40 sản phẩm. Trên DB
mới, không cần chạy seed riêng để hiển thị menu. Migration đã áp dụng sẽ không
tự chạy lại để khôi phục sản phẩm nếu bạn xóa dữ liệu thủ công.

Backend Docker chạy seed sau migrate để bổ sung topping và voucher `GIAM10`.
Có thể chạy lại seed trên môi trường phát triển:

```powershell
docker compose exec backend npx prisma db seed
```

Seed chỉ tạo bản ghi chưa có, không đổi tên/giá/stock hoặc lượt voucher đang tồn tại.
Bạn có thể đăng ký tài khoản từ giao diện; seed không tạo tài khoản mặc định.

Backend làm tròn tiền giảm giá đến VND nguyên. Điểm đổi được giới hạn theo phần
tiền còn lại (1 điểm = 1.000đ), không trừ điểm dư. Mật khẩu tối đa 72 byte UTF-8
theo giới hạn bcrypt; tài khoản cũ từng dùng mật khẩu dài cần đổi qua quản trị.
Nếu gateway lỗi chưa rõ kết quả, retry bằng cùng Idempotency-Key để đối soát.

## Chạy từng ứng dụng khi phát triển

Cần cài Node.js 20 trở lên, npm và Docker Desktop. Mở các terminal riêng tại
thư mục gốc dự án.

1. Nếu đang chạy toàn bộ bằng Docker, dừng web/API để tránh trùng cổng, giữ DB:

   ```powershell
   node scripts/setup-env.cjs
   docker compose stop frontend backend
   docker compose up -d db
   ```

2. Trong terminal backend, cài dependencies, áp dụng Prisma migration và chạy
   NestJS:

   ```powershell
   cd apps/api
   $env:JWT_SECRET = node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   $env:DATABASE_URL = "postgresql://brewlite:brewlite123@localhost:5433/brewlite_db?schema=public"
   npm.cmd ci
   npx.cmd prisma generate
   npx.cmd prisma migrate deploy
   npm.cmd run start:dev
   ```

   Thay thông tin trong `DATABASE_URL` bằng tài khoản/mật khẩu của DB hiện tại.
   Lệnh trên đặt biến trong terminal backend; `.env` ở gốc không tự được nạp vào
   mọi tiến trình npm ở thư mục con. Giữ cùng `$env:JWT_SECRET` giữa các lần khởi động
   nếu muốn giữ hiệu lực token; lệnh mẫu tạo secret mới cho phiên phát triển.

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
npm.cmd test
npm.cmd run lint
```

Integration/E2E có ghi/xóa dữ liệu, vì vậy chạy trên database kiểm thử riêng
đã tạo, dùng cùng cấu hình JWT với ứng dụng. Tại `apps/api`:

```powershell
$env:DATABASE_URL = "postgresql://brewlite:brewlite123@localhost:5433/brewlite_test?schema=public"
npx.cmd prisma migrate deploy
npm.cmd run test:e2e -- --runInBand
```

Test ký JWT bằng JwtService của ứng dụng. Dùng hướng dẫn database test riêng
bên dưới để không ghi/xóa dữ liệu phát triển.

## Kiểm thử tự động

Khởi động PostgreSQL test độc lập (cổng 5434; dữ liệu tạm mất khi container dừng):

```powershell
docker compose -p brewlite-tests -f docker-compose.test.yml up -d --wait
cd apps/api
$env:DATABASE_URL = "postgresql://brewlite_test:brewlite_test@127.0.0.1:5434/brewlite_test?schema=public&connection_limit=5"
npx.cmd prisma generate
npm.cmd run test:e2e:migrate
npm.cmd run test:e2e
npm.cmd test -- --runInBand
npm.cmd run lint
```

Dùng `127.0.0.1` với container test bind IPv4 để tránh chậm kết nối do localhost
ưu tiên IPv6 trên Windows. Script từ chối chạy nếu tên DB không chứa `test`.
Có thể đặt DATABASE_URL trong `apps/api/.env.test` thay cho biến môi trường.
Sau khi kiểm thử, đóng terminal này để không dùng nhầm DATABASE_URL cho API thật.
Tại thư mục gốc, dừng môi trường test bằng:

```powershell
docker compose -p brewlite-tests -f docker-compose.test.yml down
```

CI đã cấu hình build, lint, unit test và E2E trên PostgreSQL riêng. Chưa chạy CI
remote trong lần cập nhật này vì không push code.

## Thanh toán và gửi lại yêu cầu

- POST /orders nhận header Idempotency-Key (khuyến nghị bắt buộc ở client).
  Cùng user, key và giỏ hàng trả lại cùng đơn; khác nội dung trả 409.
  Request không có key vẫn hỗ trợ client cũ nhưng không có bảo đảm chống tạo trùng.
- POST /payments nhận `{ orderId, amount, method }`; amount lấy từ `order.total`
  của POST /orders. Method là WALLET, CREDIT_CARD hoặc MOMO. Số tiền 0 được hỗ trợ.
- Giao diện lưu key theo user và giỏ hàng trong localStorage trước khi gửi;
  reload giữ được lần thử. Chỉ đổi payment key khi đã nhận kết quả FAILED.
- Khi giỏ thay đổi mà đơn cũ chưa hoàn tất, giao diện yêu cầu kiểm tra/hủy đơn cũ
  trong lịch sử trước khi tạo đơn mới. Chỉ trừ các món/số lượng thuộc đơn đã trả;
  các món thêm trong lúc chờ được giữ lại. Các tab dùng Web Locks để tránh gửi đồng thời.
- Mock gateway chống gọi lặp theo key trong vòng đời tiến trình; chưa phải gateway
  thật hoặc cơ chế phục hồi thu tiền qua nhiều server/restart.
- Migration mới `20261111000000_order_request_idempotency` thêm hai cột nullable,
  không reset dữ liệu. Cập nhật Docker bằng `docker compose up -d --build`.
- Migration `20261113000000_order_reserved_benefits` lưu điểm/voucher đã dùng trên
  đơn mới. Hủy đơn hoàn kho, điểm đã dùng và lượt voucher trong cùng transaction;
  đơn PAID thu hồi điểm thưởng và đánh dấu payment REFUNDED trong mock ledger.
  Đơn được tạo trước migration không có lịch sử điểm/voucher để backfill chính xác;
  phần quyền lợi của các đơn cũ cần đối soát thủ công.

## API vận hành đơn hàng

Quản trị viên đặt `ORDER_OPERATOR_USER_IDS=7,9` cho các tài khoản nhân viên hiện có
ở backend (Compose đọc biến từ `.env`). Để trống sẽ chặn toàn bộ API vận hành.
Khách không thể tự cấp quyền bằng đăng ký, profile hoặc request body.
Nhân viên đăng nhập bình thường, gửi JWT và gọi `PATCH /orders/:id/status` với
`{"status":"PREPARING"}`, tiếp theo `READY`, rồi `COMPLETED`.
API kiểm tra thứ tự bằng state machine; khách thường nhận 403, thiếu JWT nhận 401.
Endpoint này không cho gán PAID hoặc CANCELLED; thanh toán/hủy dùng luồng riêng.


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
