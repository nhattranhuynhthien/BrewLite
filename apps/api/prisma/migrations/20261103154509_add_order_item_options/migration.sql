-- DropIndex
DROP INDEX "Payment_orderId_key";

-- AlterTable
ALTER TABLE "OrderItem" RENAME COLUMN "price" TO "unitPrice";

ALTER TABLE "OrderItem"
ADD COLUMN     "note" VARCHAR(255),
ADD COLUMN     "size" TEXT,
ADD COLUMN     "toppings" JSONB;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "maxDiscount" INTEGER NOT NULL,
    "usageLimit" INTEGER NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
