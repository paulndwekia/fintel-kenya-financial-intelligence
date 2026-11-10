-- FINTEL local account credentials. Password hashes are stored separately
-- from the users table so they are never included in normal session responses.
CREATE TABLE IF NOT EXISTS "local_auth_credentials" (
  "userId" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "passwordHash" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_local_email_unique"
  ON "users" (lower("email"))
  WHERE "loginMethod" = 'fintel-local-account' AND "email" IS NOT NULL;
