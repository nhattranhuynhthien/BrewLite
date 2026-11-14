ALTER TABLE "Order" ADD COLUMN "requestKey" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Order_requestKey_key" ON "Order"("requestKey");
