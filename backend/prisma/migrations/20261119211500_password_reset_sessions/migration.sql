CREATE TABLE "PasswordResetSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetSession_sessionHash_key" ON "PasswordResetSession"("sessionHash");
CREATE INDEX "PasswordResetSession_userId_expiresAt_idx" ON "PasswordResetSession"("userId", "expiresAt");
CREATE INDEX "PasswordResetSession_expiresAt_idx" ON "PasswordResetSession"("expiresAt");

ALTER TABLE "PasswordResetSession"
ADD CONSTRAINT "PasswordResetSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
