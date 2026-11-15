# Chính sách điểm chờ và hủy đơn — 15/11/2026

Thay thế bản thử điểm âm trước đó.

| Trạng thái | Điểm của đơn | Hủy |
|---|---|---|
| PENDING / PAYMENT_FAILED | Chưa cộng | Được; ngoại trừ thanh toán đang chờ đối soát |
| PAID | Cộng ngay vào tổng điểm và điểm chờ | Được; thu hồi điểm chờ |
| PREPARING | Mở khóa điểm chờ thành điểm khả dụng | Không |
| READY / COMPLETED | Giữ nguyên, không cộng/mở khóa lần nữa | Không |

Ví dụ: khách có 0 điểm, thanh toán 50.000đ → tổng 5, chờ 5, khả dụng 0. Không thể dùng 5 điểm này cho đơn khác. Khi quán bắt đầu pha chế → tổng 5, chờ 0, khả dụng 5. Nếu hủy trước pha chế → cả ba số về 0.

Hủy hoàn tồn kho, lượt voucher và điểm khả dụng đã đổi. Hủy PAID thu hồi điểm thưởng của chính đơn và đánh dấu payment REFUNDED trong hệ thống mô phỏng. Không thu/hoàn tiền thật.

## Lưu trữ và bảo đảm đồng thời

- User.rewardPoints: tổng số dư đã ghi nhận, gồm phần đang chờ.
- User.pendingRewardPoints: phần tổng số dư đang khóa.
- Điểm có thể dùng: max(0, rewardPoints - pendingRewardPoints).
- Order.rewardPointsEarned: số điểm được cộng khi thanh toán, dùng để mở khóa hoặc thu hồi theo đơn.
- Trừ điểm kiểm tra cả tổng số dư và giá trị điểm chờ trong cùng thao tác cập nhật có điều kiện. Nếu điểm chờ thay đổi đồng thời, yêu cầu thất bại và rollback; khách có thể thử lại.
- Thanh toán cộng điểm cùng transaction với chuyển PAID. Mở khóa cùng transaction PAID → PREPARING. Hủy cùng transaction với hoàn quyền lợi. Chỉ request giành được chuyển trạng thái mới xử lý điểm; hủy/pha chế đồng thời không thể cùng thành công.
- Chưa thêm bảng lịch sử điểm độc lập; số điểm thưởng của từng đơn được lưu trên Order.

## Migration và dữ liệu cũ

Migration 20261115000000_pending_rewards bổ sung hai cột; backfill điểm thưởng từ tổng tiền của đơn PAID/PREPARING/READY/COMPLETED, khóa điểm của các đơn còn PAID. Không reset tổng số dư, tài khoản, đơn hoặc kho.

Điểm đã sử dụng theo chính sách cũ không thể được hoàn tác chính xác chỉ bằng migration này. Tài khoản cũ có thể có tổng điểm nhỏ hơn điểm chờ, hoặc còn số dư âm từ bản thử trước; hệ thống không cho đổi thêm điểm cho đến khi có số dư khả dụng. Cần đối soát riêng nếu muốn điều chỉnh dữ liệu lịch sử. Tài khoản demo mới dùng chính sách điểm chờ từ đầu.

## Đối chiếu đề bài

Mục 9 yêu cầu cộng điểm khi PAID: tổng điểm được tăng ngay ở thời điểm đó. Mục 9.1 cho PAID → CANCELLED, không cho hủy PREPARING. Thời điểm được sử dụng điểm là chính sách bổ sung của nhóm; điểm chờ được giải thích trong giao diện thanh toán, lịch sử và chương trình tích điểm.

## Kiểm thử

Kiểm thử PostgreSQL bao gồm: cộng và khóa tại PAID, replay payment không cộng lại, không tiêu được điểm chờ, hai yêu cầu PREPARING chỉ mở khóa một lần, hủy cạnh tranh PREPARING chỉ một thao tác thành công, không hủy sau pha chế, dùng điểm đã mở khóa và hoàn điểm đã đổi khi hủy đơn mới. Các bộ test thanh toán lỗi, idempotency, kho và voucher được chạy lại.
