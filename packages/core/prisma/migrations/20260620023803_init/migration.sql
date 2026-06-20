-- CreateTable
CREATE TABLE "Link" (
    "discordId" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "misskeyId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "misskeyHost" TEXT,
    "token" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" DATETIME
);

-- CreateTable
CREATE TABLE "VerificationState" (
    "nonce" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "misskeySession" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RoleMapping" (
    "misskeyRoleId" TEXT NOT NULL PRIMARY KEY,
    "misskeyRoleName" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSync" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Allowlist" (
    "discordId" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_misskeyId_key" ON "Link"("misskeyId");

-- CreateIndex
CREATE INDEX "Link_status_idx" ON "Link"("status");

-- CreateIndex
CREATE INDEX "VerificationState_expiresAt_idx" ON "VerificationState"("expiresAt");
