# BrewLite — Phân công sửa lỗi trên develop

Ngày kiểm tra: 03/11/2026. Nhánh: `develop`, commit `7a8165d`.

Nguồn đối chiếu: đề `BrewLite-CongNghePhanMem.pdf`, bảng
`BrewLite_PhanCong_Nhom (1).xlsx` và mã nguồn đang có trên máy.
Người phụ trách/review lấy từ bảng phân công, không phải kết luận ai gây lỗi.
Tài liệu này theo dõi việc cần làm và kết quả thực hiện. Bản cập nhật cấu hình,
README và kiểm chứng Docker nằm trên nhánh `fix/docker-local-api-docs`, chờ review
và tích hợp vào `develop`; các sửa đổi nghiệp vụ chưa thực hiện.

## Kết quả và phạm vi kiểm tra

- Frontend build đạt.
- Backend build đạt; 15 bộ unit test, 33/33 test đạt trong lần kiểm tra này.
- Đã đọc lại mã nguồn frontend, orders/payment, DTO và các test liên quan.
- Đã build Docker và xác nhận cả ba container chạy, DB healthy, 2 migrations
  cập nhật đầy đủ, API trả 40 sản phẩm; frontend/Swagger/products trả HTTP 200.
- HTTP smoke test đăng ký → đăng nhập → tạo đơn → thanh toán → lịch sử đạt;
  replay payment tuần tự chỉ tạo 1 payment. Dữ liệu test riêng đã được dọn.
- Chưa chạy toàn bộ integration/E2E, test đồng thời hoặc thao tác UI trong trình duyệt.
- Các rủi ro đồng thời bên dưới được xác định từ cách kiểm tra/cập nhật dữ liệu;
  cần integration test trên DB thật để xác nhận bản sửa.
- Nhánh `develop` hiện chưa chứa commit `64e3839` của `menu` cải thiện giỏ hàng.
  Nhận định ở đây áp dụng cho `develop`, không thay thế đánh giá các nhánh khác.
- Đã sửa URL Docker/API, xử lý lỗi HTML và cập nhật README, `.env.example`.
  Bằng chứng và giới hạn kiểm chứng: [docs/deployment.md](../docs/deployment.md).

## Tiến độ cập nhật

| Mục | Trạng thái |
|---|---|
| F01 — Cấu hình Docker | Đã sửa và kiểm chứng Docker/HTTP/bundle, chờ review TV2; chưa kiểm tra Network bằng trình duyệt |
| F09 — Xử lý HTML lỗi và URL rỗng | Đã sửa, mock test đạt; phần lịch sử và 401 vẫn còn |
| F11 — Docker, migration và README | Đã kiểm chứng/cập nhật; UI demo, hiệu năng và hồ sơ Scrum vẫn còn |
| F02–F08, F10 | Chưa sửa trong đợt này |

## Bảng giao việc

| Mã | Mức ưu tiên | Việc cần làm | Task / hạng mục | Phụ trách chính | Phối hợp | Review theo phân công |
|---|---|---|---|---|---|---|
| F01 | Cao | Sửa URL API lúc build Docker | 9 / H16 | TV1 — Nhật | TV4 | TV2 |
| F02 | Cao | Giữ tùy chọn và tính đúng giá từ chi tiết đến giỏ | 4–5 / H06–H07 | TV3 — Nghĩa, TV4 — Vinh | TV5 | TV4 review H06; TV3 review H07 |
| F03 | Cao | Lưu tùy chọn, tính giá ở backend | 6 / H02, H08 | TV5 — Tài | TV3, TV4 | TV6 review H02; TV2 review H08 |
| F04 | Cao | Thanh toán lỗi và thử lại trên đơn cũ | 8 / H12–H13 | TV6 — Huy, TV4 — Vinh | TV2 | TV5 review H12; TV3 review H13 |
| F05 | Cao | Bảo vệ state machine trong payment | 10.1 / H11 | TV2 — Nhân | TV6 | TV6 |
| F06 | Cao | Idempotency an toàn khi đồng thời | 10.2 / H17 | TV6 — Huy | TV5, TV4 | TV5 |
| F07 | Trung bình | Ngăn dùng vượt voucher/điểm khi đồng thời | 10.4 / H19 | TV5 — Tài | TV6 | TV2 |
| F08 | Trung bình | Test đồng thời, sửa JWT trong test | 10 / H17–H18 | TV6 — Huy | TV2, TV5 | TV5 review H17; TV2 review H18 |
| F09 | Trung bình | Lịch sử hiển thị tùy chọn thật; xử lý lỗi API | 9 / H15 và API client | TV4 — Vinh | TV5 | TV3 |
| F10 | Trung bình | Giới hạn phương thức thanh toán | 8 / H12 | TV6 — Huy | TV4 | TV5 |
| F11 | Trước bàn giao | Demo, đo hiệu năng và hồ sơ Scrum | 9 / H16, H20 | TV1 — Nhật | Cả nhóm; TV2 dẫn demo | TV2 |

## F01 — Nhật: sửa cấu hình Docker

Nguyên nhân trước khi sửa: `apps/web/Dockerfile` có `ARG NEXT_PUBLIC_API_URL` nhưng Compose
không truyền build argument; biến có thể rỗng lúc `next build`. Runtime
`environment` không thay đổi URL đã được đóng vào JavaScript trình duyệt.
API client dùng `??` nên chuỗi rỗng không được thay bằng URL mặc định.

Cách sửa:

- [x] Trong `docker-compose.yml`, đổi build frontend thành `context` và `args`;
  đọc `NEXT_PUBLIC_API_URL` từ `.env`, mặc định `http://localhost:4000`.
- [x] Đặt giá trị mặc định cho `ARG NEXT_PUBLIC_API_URL` trong Dockerfile.
- [x] Dùng fallback xử lý cả chuỗi rỗng trong `src/lib/api.ts`.
- [x] Build lại image frontend; kiểm chứng bundle chứa URL cổng 4000 và HTTP trả JSON.
- [ ] Tải lại trang và kiểm tra Network bằng trình duyệt.
- [ ] Với hosting, truyền URL backend công khai phù hợp khi build, không dùng
  tên service Docker cho request chạy trong trình duyệt người dùng.

Nghiệm thu: `GET http://localhost:4000/products` trả JSON; trình duyệt không gọi
`localhost:3000/products`. Xác nhận cả menu, đăng nhập và lịch sử.

## F02 — Nghĩa + Vinh: tùy chọn và giỏ hàng

Hiện trạng: `ProductDetailModal.tsx` chỉ hiển thị phụ thu size, gọi
`onAdd(product, quantity)` với giá gốc; chưa có topping. Giỏ chỉ lưu product và
quantity, gộp mọi biến thể có cùng product ID. Đường/đá/ghi chú cũng bị mất.

Cách sửa của Nghĩa (Task 4):

- [ ] Thêm chọn topping và phụ thu; chốt mã topping với Tài.
- [ ] Truyền object tùy chọn riêng: size, topping IDs và các tùy chọn hỗ trợ khác.
- [ ] Dùng cùng quy tắc giá đã thống nhất với backend để hiển thị đơn giá/tổng.
- [ ] Không ghép tùy chọn vào tên sản phẩm để thay thế dữ liệu có cấu trúc.

Cách sửa của Vinh (Task 5):

- [ ] Giỏ lưu tùy chọn và đơn giá hiển thị theo từng dòng.
- [ ] Tạo khóa dòng từ product ID và tùy chọn chuẩn hóa; khác biến thể là khác dòng.
- [ ] Tăng/giảm/xóa theo khóa dòng; hiển thị rõ size/topping/ghi chú.
- [ ] Thống nhất nhận tại quầy hay giao hàng: hiện giỏ cộng phí 25.000đ dưới
  150.000đ nhưng checkout không cộng. Nếu MVP nhận tại quầy thì bỏ phí đồng bộ.
- [ ] Có thể tái sử dụng phần phù hợp từ commit `64e3839` của `menu` qua PR;
  vẫn phải kiểm tra phụ thu và topping vì commit đó chưa hoàn thiện các phần này.

File: `apps/web/src/components/ProductDetailModal.tsx`, `src/store/cart-store.ts`,
`src/components/cart-page.tsx`, `src/hooks/useCartPage.ts`, `src/components/storefront.tsx`.

Nghiệm thu: món gốc 35.000đ + size L 10.000đ + topping 5.000đ = 50.000đ/ly
ở chi tiết, giỏ và checkout. Size S/L thành hai dòng; sửa một dòng không ảnh hưởng dòng kia.

## F03 — Tài: API/schema và giá đơn hàng

Hiện trạng: DTO chi tiết đơn chỉ có productId/quantity; OrderItem chưa có size/topping.
Backend dùng `product.price` gốc; frontend cũng không gửi tùy chọn khi tạo đơn.

Cách sửa:

- [ ] Chốt API contract với Nghĩa/Vinh: mã size, topping IDs, các trường tùy chọn,
  cách biểu diễn đơn giá và tổng dòng; cập nhật Swagger.
- [ ] Thêm Prisma migration lưu tùy chọn và giá tại thời điểm đặt hàng.
- [ ] Validate size/topping hợp lệ cho sản phẩm và giới hạn ghi chú nếu hỗ trợ.
- [ ] Lấy giá gốc/phụ thu từ dữ liệu backend, không tin giá frontend gửi.
- [ ] Trả tùy chọn và giá đã lưu cho màn hình xác nhận/lịch sử.
- [ ] Vinh cập nhật payload checkout theo contract mới; đối chiếu tổng server trả về.

File: `apps/api/prisma/schema.prisma`, `prisma/migrations/`,
`src/orders/dto/create-order.dto.ts`, `src/orders/orders.service.ts`.

Nghiệm thu: lưu đúng ví dụ 50.000đ trên; sửa giá trong request không làm giảm tiền;
tùy chọn không hợp lệ bị từ chối; xem lại đơn vẫn giữ giá/tùy chọn lúc đặt.

## F04 — Huy + Vinh: payment thất bại và retry

Hiện trạng: payment luôn thành công; mỗi lần gọi `pay()` lại tạo đơn mới.
Mất phản hồi hoặc thử lại có thể tạo thêm đơn và trừ tồn kho lần nữa.

Cách sửa của Huy:

- [ ] Thêm mock gateway có kết quả thành công/thất bại điều khiển được trong test.
- [ ] Thất bại cập nhật `PAYMENT_FAILED`, không cộng điểm thành công.
- [ ] Phối hợp Nhân đưa retry qua các trạng thái hợp lệ đã quy định.

Cách sửa của Vinh:

- [ ] Giữ mã đơn đang thanh toán; sau lỗi dùng lại mã đơn đó.
- [ ] Với lỗi mạng chưa rõ kết quả, truy vấn/replay kết quả của yêu cầu cũ trước
  khi tạo lượt thanh toán mới.
- [ ] Giữ khóa cho lần gửi lại cùng yêu cầu. Sau thất bại đã xác nhận, một lần
  thanh toán mới có thể cần khóa mới theo contract thống nhất với Huy.
- [ ] Giữ giỏ khi lỗi, chỉ xóa sau khi xác nhận thành công.

File: `apps/api/src/payments/payments.service.ts`, `apps/web/src/components/storefront.tsx`.

Nghiệm thu: thất bại có trạng thái đúng, còn giỏ; retry/mất phản hồi không làm
tăng số đơn và không trừ tồn kho thêm cho cùng lần đặt.

## F05 — Nhân + Huy: state machine

Hiện trạng: đã có `assertTransition` nhưng payment không gọi; có thể ghi thẳng
`PAID` cho trạng thái không hợp lệ. OrdersService.update cũng đọc rồi cập nhật
tách rời, cần tránh ghi đè khi trạng thái thay đổi đồng thời.

Cách sửa:

- [ ] Dùng quy tắc chuyển trạng thái chung trong mọi luồng thay đổi trạng thái.
- [ ] Đọc/kiểm tra/cập nhật trong transaction với khóa hoặc cập nhật có điều kiện
  theo trạng thái hiện tại; xử lý rõ trường hợp tranh chấp.
- [ ] Chặn payment cho `CANCELLED`, `COMPLETED` và trạng thái không cho phép.
- [ ] Retry từ `PAYMENT_FAILED` phải theo đường hợp lệ trong state machine.
- [ ] Test cả service payment thực tế, không chỉ test riêng hàm assertTransition.

File: `apps/api/src/orders/order-status.ts`, `src/orders/orders.service.ts`,
`src/payments/payments.service.ts`.

Nghiệm thu: chuyển sai không thay đổi order/payment/điểm; luồng
PENDING → PAID → PREPARING → READY → COMPLETED và nhánh retry đúng hoạt động.
Không cần thêm màn hình barista vì nằm ngoài MVP của đề.

## F06 — Huy: idempotency và thanh toán đồng thời

Hiện trạng: kiểm tra payment/key trước transaction, lưu key sau transaction.
Hai request có thể cùng vượt kiểm tra; lỗi lưu key có thể xảy ra sau khi đã thanh toán.

Cách sửa:

- [ ] Đặt claim khóa, kiểm tra đơn, tạo payment, đổi trạng thái và cộng điểm trong
  một thiết kế transaction/khóa nhất quán cho mock payment.
- [ ] Khóa duy nhất cho idempotency; ràng buộc/khóa theo đơn để hai khóa khác nhau
  cũng không tạo hai thanh toán thành công cho cùng đơn.
- [ ] Lưu fingerprint của yêu cầu, gồm order và method; cùng key khác payload bị từ chối.
- [ ] Lưu kết quả để replay; xử lý tranh chấp unique key có kiểm soát.
- [ ] Phối hợp Tài bảo đảm chỉ cộng điểm một lần và Vinh xử lý retry đúng contract.

File: `apps/api/src/payments/payments.service.ts`, `prisma/schema.prisma`,
`prisma/migrations/`, `test/payment-idempotency.e2e-spec.ts`.

Nghiệm thu: request lặp tuần tự/đồng thời chỉ có một payment thành công, một lần
cộng điểm. Hai key khác nhau cho cùng đơn cũng không gây thanh toán hai lần.

## F07 — Tài: bảo vệ voucher và điểm khi đồng thời

Hiện trạng: đã có voucher/loyalty nhưng kiểm tra số dư/lượt dùng rồi decrement
không kèm điều kiện, có nguy cơ hai đơn cùng tiêu số dư/lượt dùng cuối.

Cách sửa:

- [ ] Dùng update có điều kiện `usageLimit > 0` và `rewardPoints >= pointsToUse`,
  kiểm tra số dòng cập nhật; thất bại thì rollback toàn đơn.
- [ ] Giữ việc trừ tài nguyên và tạo đơn trong cùng transaction.
- [ ] Test đồng thời voucher còn 1 lượt và tài khoản chỉ đủ điểm cho 1 đơn.
- [ ] Cộng điểm khi payment thành công phải nằm trong cơ chế một lần của F06.

File: `apps/api/src/orders/orders.service.ts`, `src/payments/payments.service.ts`,
`test/voucher-loyalty.e2e-spec.ts`.

Nghiệm thu: số điểm/lượt dùng không âm; đơn bị từ chối không để lại thay đổi dở dang.

## F08 — Huy: kiểm thử integration

- [ ] `test/payment-idempotency.e2e-spec.ts` đang ký JWT với secret cố định khác
  mặc định ứng dụng. Dùng JwtService với cấu hình ứng dụng hoặc đăng nhập thật;
  không hardcode secret riêng cho test.
- [ ] Thêm request song song thực sự cho tồn kho; test hiện tại chỉ chạy tuần tự.
- [ ] Kiểm tra tổng lượng bán không vượt stock, stock không âm và rollback đúng.
- [ ] Test payment thất bại, replay, hai request cùng key/khác key cho cùng đơn,
  state machine và số lần cộng điểm.
- [ ] Chạy trên DB kiểm thử riêng, dọn dữ liệu test; ghi lại kết quả và môi trường.

Nghiệm thu: test chạy qua guard hợp lệ và chứng minh được từng điều kiện trên,
không chỉ kiểm tra service khởi tạo được.

## F09 — Vinh: lịch sử, loading và lỗi API

- [ ] Bỏ `Size M` cố định trong lịch sử, lấy dữ liệu đơn đã lưu sau F03.
- [ ] Hiển thị topping/ghi chú nếu đã hỗ trợ và tổng server trả về.
- [x] Khi API trả HTML hoặc JSON lỗi, dùng thông báo ngắn có HTTP status,
  không dùng nguyên response body làm nội dung giao diện.
- [ ] Phân biệt lỗi 401 để yêu cầu đăng nhập lại; giữ loading/error/empty rõ ràng.
- [ ] Có thể lấy phần phù hợp từ `menu` qua PR sau review, tránh sửa trùng.

File: `apps/web/src/components/storefront.tsx`, `src/lib/api.ts`.

Nghiệm thu: sai URL không hiện HTML dài; token hết hạn yêu cầu đăng nhập;
lịch sử phản ánh đúng size/topping đã đặt.

## F10 — Huy: validate phương thức thanh toán

Hiện `CreatePaymentDto.method` chỉ kiểm tra chuỗi không rỗng.

- [ ] Thống nhất enum phương thức với UI, ví dụ `WALLET`, `CARD`.
- [ ] Validate bằng enum/allowlist và cập nhật Swagger.
- [ ] Test phương thức lạ bị từ chối, không tạo payment/cộng điểm.

File: `apps/api/src/payments/dto/create-payment.dto.ts`.

## F11 — Nhật và cả nhóm: bàn giao

- [x] Nhật kiểm chứng Compose chạy đủ web/API/DB, migrations và catalog 40 sản phẩm.
- [ ] Nhân dẫn demo theo phân công; mỗi thành viên trình bày phần mình.
- [ ] Demo happy path, payment thất bại/retry và các bài test Task 10.
- [ ] Đo API dưới 500 ms với dữ liệu mẫu; ghi endpoint, dữ liệu và cách đo.
- [ ] Kiểm tra mobile và trình duyệt phổ biến; ghi vấn đề tìm được.
- [x] Cập nhật README: Docker/npm, env, migrations, dữ liệu mẫu, lệnh kiểm thử,
  xử lý URL API, lưu ý seed chưa đồng bộ catalog; sửa `.env.example`.
- [ ] Cập nhật bảng tiến độ nhóm và burndown thực tế.
- [ ] Bổ sung/cung cấp bằng chứng review, Sprint Review, Retrospective và phản hồi.

Đây là các mục cần kiểm chứng; không kết luận chưa tổ chức Scrum chỉ vì chưa thấy bằng chứng.

## Thứ tự triển khai

1. Nhật đưa bản sửa Docker vào develop qua PR để nhóm có môi trường chạy đúng.
2. Tài chốt schema/API tùy chọn; Nghĩa và Vinh thực hiện F02–F03 theo contract đó.
3. Nhân, Huy, Tài thống nhất state machine, transaction và idempotency; sửa F04–F08, F10.
4. Vinh tích hợp checkout/retry và lịch sử theo API mới, hoàn thiện F09.
5. Chạy lại build/unit/integration; Nhật điều phối demo và hồ sơ F11.

Definition of Done: đáp ứng tiêu chí nghiệm thu, build/test liên quan đạt,
commit rõ ràng, review chéo theo bảng phân công, cập nhật hướng dẫn cần thiết.
