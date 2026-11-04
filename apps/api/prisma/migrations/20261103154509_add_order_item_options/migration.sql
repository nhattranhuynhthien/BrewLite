/*
  Warnings:

  - You are about to drop the column `price` on the `OrderItem` table. All the data in the column will be lost.
  - Added the required column `unitPrice` to the `OrderItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Payment_orderId_key";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "price",
ADD COLUMN     "note" VARCHAR(255),
ADD COLUMN     "size" TEXT,
ADD COLUMN     "toppings" JSONB,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL;

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
