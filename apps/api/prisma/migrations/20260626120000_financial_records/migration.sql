CREATE TABLE "FinancialRecord" (
  "id"              TEXT NOT NULL,
  "type"            VARCHAR(16) NOT NULL,
  "label"           VARCHAR(200) NOT NULL,
  "description"     TEXT,
  "amount"          DECIMAL(18,2) NOT NULL,
  "currency"        VARCHAR(8) NOT NULL DEFAULT 'usdc',
  "recurring"       BOOLEAN NOT NULL DEFAULT false,
  "recurringPeriod" VARCHAR(16),
  "source"          VARCHAR(200),
  "referenceUrl"    VARCHAR(1024),
  "imageUrl"        VARCHAR(512),
  "date"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visible"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialRecord_type_date_idx" ON "FinancialRecord"("type", "date");
CREATE INDEX "FinancialRecord_visible_date_idx" ON "FinancialRecord"("visible", "date");
