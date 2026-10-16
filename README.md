# \# BrewLite - Ứng dụng đặt cà phê không dùng tiền mặt

# 

# Bài tập lớn môn Công nghệ Phần mềm - Xây dựng theo quy trình Agile Scrum.

# 

# \## 1. Kiến trúc \& Công nghệ

# \- Frontend: Next.js (React, TypeScript), TailwindCSS, Zustand/React Query

# \- Backend: NestJS (TypeScript), REST API, class-validator, Passport JWT

# \- Cơ sở dữ liệu: PostgreSQL + Prisma / TypeORM

# \- DevOps: Docker Compose, GitHub Actions CI

# 

# \## 2. Cấu trúc thư mục (Monorepo)

# \- backend/ : Mã nguồn REST API (NestJS - Port 4000)

# \- frontend/ : Giao diện người dùng (Next.js - Port 3000)

# \- .env.example : Mẫu biến môi trường

# \- docker-compose.yml : Cấu hình chạy PostgreSQL, Backend, Frontend

# 

# \## 3. Hướng dẫn cài đặt và chạy dự án

# 

# \### Bước 1: Chuẩn bị file môi trường

# Copy file .env.example thành .env:

# cp .env.example .env

# 

# \### Bước 2: Chạy môi trường Development

# 1\. Khởi chạy riêng Database PostgreSQL:

# &#x20;  docker compose up -d db

# 2\. Chạy Backend (NestJS - http://localhost:4000):

# &#x20;  cd backend \&\& npm install \&\& npm run start:dev

# 3\. Chạy Frontend (Next.js - http://localhost:3000):

# &#x20;  cd frontend \&\& npm install \&\& npm run dev

# 

# \### Bước 3: Chạy toàn bộ bằng Docker Compose (DB + Backend + Frontend)

# docker compose up --build -d

# 

# \## 4. Quy ước Git \& Nhánh (Git Workflow)

# \- main: Nhánh ổn định dùng để demo và bàn giao cuối mỗi Sprint.

# \- develop: Nhánh tích hợp code của các thành viên trong Sprint.

# \- Nhánh tính năng: Tách từ develop theo cú pháp feature/task-<so>-<ten> (VD: feature/task-2-products-api).

# \- Quy ước Commit: feat: ..., fix: ..., chore: ..., docs: ...

# \- Quy trình Review: Không push trực tiếp lên main/develop. Mọi thay đổi phải tạo Pull Request vào develop, vượt qua bài kiểm tra CI (không lỗi build) và có ít nhất 1 thành viên review trước khi Merge.

