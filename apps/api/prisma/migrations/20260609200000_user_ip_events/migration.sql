CREATE TABLE "UserIpEvent" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL,
  "ip"         VARCHAR(64) NOT NULL,
  "userAgent"  VARCHAR(512),
  "fingerprint" VARCHAR(128),
  "action"     VARCHAR(20) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserIpEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "UserIpEvent_userId_createdAt_idx" ON "UserIpEvent"("userId","createdAt");
CREATE INDEX "UserIpEvent_ip_idx" ON "UserIpEvent"("ip");
