# BrewLite

Ứng dụng đặt cà phê gồm frontend Next.js, API NestJS và PostgreSQL.

## Cách chạy nhanh bằng Docker Compose

Cài Docker Desktop, mở PowerShell tại thư mục gốc dự án (cùng thư mục với
`docker-compose.yml`), sau đó chạy:

```powershell
docker compose up --build
```

Lần chạy đầu tiên Docker sẽ tải dependencies, build frontend/backend, chờ
PostgreSQL sẵn sàng, áp dụng database migration rồi khởi động API. Khi các
service đã chạy:

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Swagger API: http://localhost:4000/api

Dừng ứng dụng bằng `Ctrl+C`; chạy nền bằng `docker compose up --build -d`, và
dừng các container bằng `docker compose down`.

## Chạy từng ứng dụng khi phát triển

Cần cài Node.js 20 trở lên, npm và Docker Desktop. Mở các terminal riêng tại
thư mục gốc dự án.

1. Khởi động PostgreSQL:

   ```powershell
   docker compose up -d db
   ```

2. Trong terminal backend, cài dependencies, áp dụng Prisma migration và chạy
   NestJS:

   ```powershell
   cd apps/api
   $env:DATABASE_URL = "postgresql://brewlite:brewlite123@localhost:5432/brewlite_db?schema=public"
   npm ci
   npx prisma migrate deploy
   npm run start:dev
   ```

3. Trong terminal frontend, cài dependencies và chạy Next.js:

   ```powershell
   cd apps/web
   npm ci
   npm run dev
   ```

Mở http://localhost:3000 để truy cập ứng dụng.

## Các lệnh thường dùng

Chạy backend từ `apps/api`: `npm run start:dev`, build bằng `npm run build`,
kiểm thử bằng `npm test -- --runInBand`.

Chạy frontend từ `apps/web`: `npm run dev`, build bằng `npm run build`.

## Cấu trúc chính

- `apps/api/src/main.ts`: điểm khởi chạy NestJS.
- `apps/web/src/app/page.tsx`: trang chủ Next.js.
- `docker-compose.yml`: khởi chạy toàn bộ PostgreSQL, backend và frontend.
- `.env.example`: các biến môi trường tham khảo.
