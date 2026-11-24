# Postman cho BrewLite develop

Bộ kiểm thử có **50 request** bao phủ **18 endpoint** đã đăng ký trên nhánh `develop`, kèm Swagger. Các nhóm kiểm thử gồm health, xác thực, hồ sơ, menu và topping, báo giá voucher, tạo đơn, thanh toán mô phỏng, điểm thưởng và xử lý trạng thái đơn.

## Chạy collection

1. Import [collection JSON](BrewLite.develop.postman_collection.json) và [environment JSON](BrewLite.develop.local.postman_environment.json) vào Postman.
2. Chọn **BrewLite Develop Local** và chạy toàn bộ collection theo thứ tự. API kiểm thử mặc định ở `http://127.0.0.1:4003`.
3. Có thể bấm **Run Again** ngay. Mỗi lượt tạo khách hàng, hai đơn và các idempotency key riêng. Các lượt chạy tích lũy khách hàng và đơn hàng trong database kiểm thử và tiêu thụ một món đã thanh toán từ tồn kho mỗi lượt.

Chạy bằng Newman từ thư mục gốc repo.

```powershell
npx.cmd --yes newman@6 run postman/BrewLite.develop.postman_collection.json -e postman/BrewLite.develop.local.postman_environment.json
```

## Chuẩn bị một API kiểm thử riêng

Chạy đoạn lệnh dưới đây từ thư mục gốc repo trong PowerShell với Docker Desktop và Node.js. Đoạn lệnh dùng một PostgreSQL riêng, áp dụng migrations, seed voucher và topping, sau đó tạo tài khoản vận hành trong `ORDER_OPERATOR_USER_IDS`. Tài khoản và mật khẩu trong environment chỉ dành cho database kiểm thử.

```powershell
docker build -t brewlite-git-develop-postman-api ./apps/api
if ($LASTEXITCODE -ne 0) { throw 'Build API thất bại.' }
$dbUrl = 'postgresql://postman:postman_local_dev@brewlite-git-develop-postman-db:5432/brewlite_develop_postman?schema=public'
docker network create brewlite-git-develop-postman
if ($LASTEXITCODE -ne 0) { throw 'Khởi tạo Docker thất bại.' }
docker run -d --name brewlite-git-develop-postman-db --network brewlite-git-develop-postman -e POSTGRES_USER=postman -e POSTGRES_PASSWORD=postman_local_dev -e POSTGRES_DB=brewlite_develop_postman postgres:15-alpine
if ($LASTEXITCODE -ne 0) { throw 'Khởi tạo Docker thất bại.' }
$dbReady = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  docker exec brewlite-git-develop-postman-db pg_isready -h 127.0.0.1 -U postman -d brewlite_develop_postman 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
  Start-Sleep -Seconds 1
}
if (!$dbReady) { throw 'PostgreSQL did not start.' }
$bootstrap = @'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const db = new PrismaClient();
async function main() {
  const password = await bcrypt.hash(process.env.POSTMAN_TEST_PASSWORD, 10);
  const operator = await db.user.upsert({
    where: { email: 'postman-operator@example.test' },
    create: { email: 'postman-operator@example.test', name: 'Postman Operator', password },
    update: { password },
    select: { id: true },
  });
  console.log('OPERATOR_ID=' + operator.id);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
'@ | docker run --rm -i --network brewlite-git-develop-postman -e "DATABASE_URL=$dbUrl" -e 'POSTMAN_TEST_PASSWORD=BrewLiteDevelop123!' brewlite-git-develop-postman-api sh -c 'npx --no-install prisma migrate deploy && npx --no-install prisma db seed && node -'
if ($LASTEXITCODE -ne 0) { $bootstrap; throw 'Không thể seed database kiểm thử.' }
$operator = $bootstrap | Select-String '^OPERATOR_ID=[1-9][0-9]*$' | Select-Object -Last 1
if (!$operator) { throw 'No test operator ID was returned.' }
$operatorId = $operator.Line.Split('=')[1]
$jwt = node -p "require('node:crypto').randomBytes(32).toString('hex')"
docker run -d --name brewlite-git-develop-postman-api --network brewlite-git-develop-postman -p 127.0.0.1:4003:4000 -e "DATABASE_URL=$dbUrl" -e "JWT_SECRET=$jwt" -e "ORDER_OPERATOR_USER_IDS=$operatorId" brewlite-git-develop-postman-api
if ($LASTEXITCODE -ne 0) { throw 'Không thể khởi động API kiểm thử.' }
```

Chờ `curl.exe -f http://127.0.0.1:4003/health/ready` trả HTTP 200 rồi chạy bộ test. Nếu container đã tồn tại, dùng `docker start brewlite-git-develop-postman-db brewlite-git-develop-postman-api`.

Nếu dùng một API kiểm thử đã có sẵn, điền `baseUrl`, `operatorEmail` và `operatorPassword` tương ứng trong environment. API cần có topping, voucher seed `GIAM10` và tài khoản vận hành được cấp quyền qua `ORDER_OPERATOR_USER_IDS`.
