# 001. Dùng monorepo với apps/web và apps/api

- **Trạng thái:** Đã chấp nhận

## Bối cảnh
Dự án có frontend Next.js và backend NestJS do cùng một nhóm phát triển, cần chung
tài liệu, CI/CD và docker-compose.

## Quyết định
Dùng một repository, tách `apps/web` và `apps/api`, tài liệu trong `docs/`.

## Hệ quả
- Ưu điểm: một PR có thể sửa cả hai phía, CI/CD và tài liệu tập trung một chỗ.
- Hạn chế: pipeline phải biết chạy riêng cho từng app.
