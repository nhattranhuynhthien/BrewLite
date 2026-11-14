-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "paidOrderId" INTEGER;

-- Điền cho các payment PAID đã có. Nếu một đơn đang có hơn một payment PAID,
-- bước CreateIndex bên dưới sẽ báo lỗi: xử lý dữ liệu trùng đó trước rồi chạy lại.
UPDATE "Payment" SET "paidOrderId" = "orderId" WHERE "status" = 'PAID';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paidOrderId_key" ON "Payment"("paidOrderId");
