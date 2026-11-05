-- CreateTable
CREATE TABLE "AdminPermissionConfig" (
    "adminId" VARCHAR(64) NOT NULL,
    "permissions" TEXT[],
    "updatedBy" VARCHAR(64),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermissionConfig_pkey" PRIMARY KEY ("adminId")
);
