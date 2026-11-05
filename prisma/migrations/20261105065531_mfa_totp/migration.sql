-- AlterTable
ALTER TABLE "users" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLastStep" INTEGER,
ADD COLUMN     "twoFactorSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "two_factor_recovery_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_recovery_codes_userId_codeHash_key" ON "two_factor_recovery_codes"("userId", "codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "login_challenges_tokenHash_key" ON "login_challenges"("tokenHash");

-- CreateIndex
CREATE INDEX "login_challenges_userId_idx" ON "login_challenges"("userId");

-- CreateIndex
CREATE INDEX "login_challenges_expiresAt_idx" ON "login_challenges"("expiresAt");

-- AddForeignKey
ALTER TABLE "two_factor_recovery_codes" ADD CONSTRAINT "two_factor_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_challenges" ADD CONSTRAINT "login_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────────── Guard integritas (berlaku juga untuk SQL langsung) ─────────────

ALTER TABLE "users"
  ADD CONSTRAINT "users_2fa_secret_chk" CHECK (NOT "twoFactorEnabled" OR ("twoFactorSecretEnc" IS NOT NULL AND "twoFactorEnabledAt" IS NOT NULL));
ALTER TABLE "login_challenges"
  ADD CONSTRAINT "login_challenges_attempts_chk" CHECK ("attempts" >= 0);

-- Kode pemulihan yang sudah terpakai tidak boleh "dihidupkan" lagi atau diubah waktunya; hash tidak boleh diganti.
CREATE OR REPLACE FUNCTION two_factor_recovery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."usedAt" IS NOT NULL AND NEW."usedAt" IS DISTINCT FROM OLD."usedAt" THEN
    RAISE EXCEPTION 'Kode pemulihan yang sudah dipakai tidak dapat diubah.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."codeHash" <> OLD."codeHash" OR NEW."userId" <> OLD."userId" THEN
    RAISE EXCEPTION 'Kode pemulihan tidak dapat diubah; buat ulang.' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER two_factor_recovery_guard_upd BEFORE UPDATE ON "two_factor_recovery_codes" FOR EACH ROW EXECUTE FUNCTION two_factor_recovery_guard();
