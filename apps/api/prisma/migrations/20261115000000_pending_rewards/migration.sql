-- rewardPoints remains the total balance; pendingRewardPoints is its locked part.
ALTER TABLE "User" ADD COLUMN "pendingRewardPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "rewardPointsEarned" INTEGER NOT NULL DEFAULT 0;
UPDATE "Order" SET "rewardPointsEarned" = FLOOR("total" / 10000)::INTEGER
WHERE "status" IN ('PAID', 'PREPARING', 'READY', 'COMPLETED');
UPDATE "User" u SET "pendingRewardPoints" = p.points
FROM (SELECT "userId", SUM("rewardPointsEarned")::INTEGER AS points
      FROM "Order" WHERE "status" = 'PAID' GROUP BY "userId") p
WHERE u.id = p."userId";
-- Preserve historical balances, including already spent legacy rewards. No reset.
