-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "keyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scopes" TEXT[],
    "allowedIps" TEXT[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "prevSecretVersion" INTEGER,
    "prevValidUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" UUID,
    "revokeReason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_nonces" (
    "clientId" UUID NOT NULL,
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_nonces_pkey" PRIMARY KEY ("clientId","nonce")
);

-- CreateTable
CREATE TABLE "api_idempotency" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "api_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_keyId_key" ON "api_clients"("keyId");

-- CreateIndex
CREATE INDEX "api_nonces_createdAt_idx" ON "api_nonces"("createdAt");

-- CreateIndex
CREATE INDEX "api_idempotency_createdAt_idx" ON "api_idempotency"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_idempotency_clientId_key_key" ON "api_idempotency"("clientId", "key");

-- AddForeignKey
ALTER TABLE "api_nonces" ADD CONSTRAINT "api_nonces_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "api_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_idempotency" ADD CONSTRAINT "api_idempotency_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "api_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ───────────── Guard integritas (berlaku juga untuk SQL langsung) ─────────────

ALTER TABLE "api_clients"
  ADD CONSTRAINT "api_clients_rate_chk" CHECK ("rateLimitPerMinute" BETWEEN 1 AND 6000),
  ADD CONSTRAINT "api_clients_keyid_chk" CHECK ("keyId" ~ '^fmsk_[0-9a-f]{20}$'),
  ADD CONSTRAINT "api_clients_version_chk" CHECK ("secretVersion" >= 1),
  ADD CONSTRAINT "api_clients_revoked_chk" CHECK (("isActive" AND "revokedAt" IS NULL) OR (NOT "isActive" AND "revokedAt" IS NOT NULL));

ALTER TABLE "api_idempotency"
  ADD CONSTRAINT "api_idempotency_state_chk" CHECK ("state" IN ('IN_PROGRESS','DONE')),
  ADD CONSTRAINT "api_idempotency_done_chk" CHECK ("state" <> 'DONE' OR ("responseStatus" IS NOT NULL AND "completedAt" IS NOT NULL));

-- Kredensial tidak dihapus (jejak audit merujuk padanya) dan yang sudah dicabut TIDAK dapat diaktifkan kembali: buat kredensial baru.
CREATE OR REPLACE FUNCTION api_clients_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Kredensial integrasi tidak boleh dihapus; cabut saja.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD."isActive" = false AND NEW."isActive" = true THEN
    RAISE EXCEPTION 'Kredensial integrasi yang sudah dicabut tidak dapat diaktifkan kembali; buat kredensial baru.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."keyId" <> OLD."keyId" OR NEW."id" <> OLD."id" THEN
    RAISE EXCEPTION 'Pengenal kredensial integrasi tidak dapat diubah.' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW."secretVersion" < OLD."secretVersion" THEN
    RAISE EXCEPTION 'Versi rahasia tidak boleh turun (rotasi hanya maju).' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER api_clients_guard_upd BEFORE UPDATE ON "api_clients" FOR EACH ROW EXECUTE FUNCTION api_clients_guard();
CREATE TRIGGER api_clients_guard_del BEFORE DELETE ON "api_clients" FOR EACH ROW EXECUTE FUNCTION api_clients_guard();
