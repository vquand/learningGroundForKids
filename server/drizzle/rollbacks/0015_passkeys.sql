DROP TABLE IF EXISTS "passkey_challenges";
DROP TABLE IF EXISTS "passkeys";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "parent_verified_by";
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "parent_verified_until";
