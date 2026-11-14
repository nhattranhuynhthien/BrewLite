# Kiến trúc tổng quan (Task 3.1)

```
Next.js (web)  --REST/JSON-->  NestJS (api)  --ORM-->  PostgreSQL
                                    |
                                    +--> Mock Payment Service
```

## Thành phần
| Thành phần | Thư mục | Công nghệ |
|---|---|---|
| Frontend PWA mobile-first | `apps/web` | Next.js, TypeScript |
| Backend API theo module/domain | `apps/api` | NestJS |
| Cơ sở dữ liệu và migration | `apps/api/prisma` | PostgreSQL |
| Thanh toán mô phỏng | `apps/api/src/payments` | NestJS module |
| Logging, health check, cấu hình | `apps/api/src/health`, `src/config` | NestJS |

## Quy tắc phân lớp ở backend
Controller (nhận request) gọi Service (nghiệp vụ) gọi Prisma (database).
Controller không chứa logic nghiệp vụ.

## Trade-off
Ghi lý do chọn, ưu điểm, hạn chế. Quyết định quan trọng viết thành ADR trong `adr/`.
