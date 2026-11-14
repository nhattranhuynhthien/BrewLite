ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "rewardPoints" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ProcPaymentKey" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcPaymentKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcPaymentKey_key_key" ON "ProcPaymentKey"("key");

INSERT INTO "Product" ("id", "name", "description", "price", "stock", "imageUrl", "category", "isAvailable", "createdAt", "updatedAt")
VALUES
  (1, 'Cà phê đen đá', NULL, 25000, 100, '/img/menu/ca-phe-den-da.png', 'coffee', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, 'Cà phê sữa đá', NULL, 28000, 100, '/img/menu/ca-phe-sua-da.png', 'coffee', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, 'Cà phê cappuccino', NULL, 35000, 100, '/img/menu/cappuccino.png', 'coffee', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (4, 'Cà phê caramel', NULL, 38000, 100, '/img/menu/ca-phe-caramel.png', 'coffee', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (5, 'Americano', NULL, 30000, 100, '/img/menu/americano.png', 'coffee', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (6, 'Trà đào', NULL, 28000, 100, '/img/menu/tra-dao.png', 'tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (7, 'Trà vải', NULL, 28000, 100, '/img/menu/tra-vai.png', 'tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (8, 'Trà tắc', NULL, 25000, 100, '/img/menu/tra-tac.png', 'tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (9, 'Trà xanh matcha', NULL, 32000, 100, '/img/menu/tra-xanh-matcha.png', 'tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (10, 'Trà ô long', NULL, 30000, 100, '/img/menu/tra-o-long.png', 'tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (11, 'Trà sữa truyền thống', NULL, 30000, 100, '/img/menu/tra-sua-truyen-thong.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (12, 'Trà sữa trân châu đường đen', NULL, 38000, 100, '/img/menu/tra-sua-tran-chau-duong-den.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (13, 'Trà sữa matcha', NULL, 40000, 100, '/img/menu/tra-sua-matcha.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (14, 'Trà sữa khoai môn', NULL, 38000, 100, '/img/menu/tra-sua-khoai-mon.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (15, 'Trà sữa socola', NULL, 38000, 100, '/img/menu/tra-sua-socola.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (16, 'Trà sữa Thái xanh', NULL, 35000, 100, '/img/menu/tra-sua-thai-xanh.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (17, 'Trà sữa Hokkaido', NULL, 40000, 100, '/img/menu/tra-sua-hokkaido.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (18, 'Trà sữa ô long', NULL, 38000, 100, '/img/menu/tra-sua-o-long.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (19, 'Trà sữa dâu', NULL, 36000, 100, '/img/menu/tra-sua-dau.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (20, 'Trà sữa kem cheese', NULL, 42000, 100, '/img/menu/tra-sua-kem-cheese.svg', 'milk-tea', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (21, 'Sinh tố bơ', NULL, 40000, 100, '/img/menu/sinh-to-bo.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (22, 'Sinh tố xoài', NULL, 38000, 100, '/img/menu/sinh-to-xoai.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (23, 'Sinh tố dâu', NULL, 38000, 100, '/img/menu/sinh-to-dau.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (24, 'Sinh tố chuối', NULL, 32000, 100, '/img/menu/sinh-to-chuoi.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (25, 'Sinh tố mãng cầu', NULL, 40000, 100, '/img/menu/sinh-to-mang-cau.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (26, 'Sinh tố việt quất', NULL, 45000, 100, '/img/menu/sinh-to-viet-quat.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (27, 'Sinh tố dưa hấu', NULL, 30000, 100, '/img/menu/sinh-to-dua-hau.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (28, 'Sinh tố cam cà rốt', NULL, 35000, 100, '/img/menu/sinh-to-cam-ca-rot.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (29, 'Sinh tố sapôchê', NULL, 38000, 100, '/img/menu/sinh-to-sapoche.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (30, 'Sinh tố thanh long', NULL, 35000, 100, '/img/menu/sinh-to-thanh-long.svg', 'smoothie', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (31, 'Bánh tiramisu', NULL, 45000, 100, '/img/menu/banh-tiramisu.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (32, 'Bánh mousse chanh dây', NULL, 42000, 100, '/img/menu/banh-mousse-chanh-day.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (33, 'Bánh su kem', NULL, 25000, 100, '/img/menu/banh-su-kem.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (34, 'Bánh croissant bơ', NULL, 30000, 100, '/img/menu/banh-croissant-bo.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (35, 'Bánh flan caramel', NULL, 20000, 100, '/img/menu/banh-flan-caramel.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (36, 'Bánh brownie socola', NULL, 35000, 100, '/img/menu/banh-brownie-socola.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (37, 'Bánh cheesecake việt quất', NULL, 48000, 100, '/img/menu/banh-cheesecake-viet-quat.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (38, 'Bánh bông lan trứng muối', NULL, 35000, 100, '/img/menu/banh-bong-lan-trung-muoi.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (39, 'Bánh cookie socola chip', NULL, 20000, 100, '/img/menu/banh-cookie-socola-chip.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (40, 'Bánh red velvet', NULL, 45000, 100, '/img/menu/banh-red-velvet.svg', 'cake', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "imageUrl" = EXCLUDED."imageUrl",
  "category" = EXCLUDED."category",
  "isAvailable" = EXCLUDED."isAvailable";

SELECT setval(pg_get_serial_sequence('"Product"', 'id'), GREATEST((SELECT MAX("id") FROM "Product"), 1));
