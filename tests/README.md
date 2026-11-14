# Tests tích hợp / E2E (toàn hệ thống)

- Unit test nằm cạnh code (`*.spec.ts`) trong `apps/api/src`.
- E2E của API: `apps/api/test`.
- Tại đây: kịch bản end-to-end từ menu đến xác nhận đơn.

## Checkout trên trình duyệt

`checkout_browser.py` dùng Python Playwright và Chrome cài sẵn. Chỉ chạy với API
trỏ đến database test riêng: script tạo tài khoản và đơn thử nghiệm.

1. Chạy DB test và migration theo README gốc.
2. Build backend, chạy `node dist/main.js` tại apps/api với PORT=4001 và DATABASE_URL
   trỏ đến DB test (127.0.0.1:5434) và JWT_SECRET riêng (ít nhất 32 byte).
3. Build frontend với NEXT_PUBLIC_API_URL mặc định `http://localhost:4000`, chạy
   `npm.cmd run start -- --port 3001` tại apps/web.
4. Cài Playwright trong môi trường Python riêng, rồi chạy `python tests/checkout_browser.py`
   từ thư mục gốc. Không cần tải Chromium nếu máy đã có Google Chrome.

Script chuyển toàn bộ request browser từ port 4000 sang API test 4001, kiểm tra
Ví/Thẻ và giả lập mất phản hồi sau PAID rồi reload/retry: cùng key, một đơn,
một payment, giỏ được xóa sau thành công. Không trỏ API test đến DB development.

`audit_browser.py` dùng cùng môi trường để kiểm tra đổi giỏ sau khi mất phản hồi
tạo đơn, hủy đơn cũ rồi đặt lại, giữ món thêm trong lúc thanh toán, đổi tài khoản
giữa giao dịch và tìm món ngoài 16 món đầu. Kiểm tra chi tiêu/MoMo/tìm mã đơn
dùng fixture trả về từ route lịch sử trên trình duyệt.

Frontend có kiểm thử logic độc lập: `npm.cmd --prefix apps/web test`.
Backend `test/audit-http.spec.ts` kiểm tra controller/guard/validation qua HTTP với
adapter DB, còn `test/cancellation-benefits.e2e-spec.ts` kiểm tra transaction thật
trên PostgreSQL. Không dùng kết quả adapter để khẳng định concurrency DB.
