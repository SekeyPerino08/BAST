CREATE TABLE "audit_log" (
  "id" TEXT NOT NULL,
  "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_user_id" TEXT,
  "actor_role" "Role",
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "student_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_student_id_at_idx" ON "audit_log"("student_id", "at");
CREATE INDEX "audit_log_actor_user_id_at_idx" ON "audit_log"("actor_user_id", "at");
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

INSERT INTO "audit_log" (
  "id", "at", "actor_user_id", "actor_role", "action", "entity_type",
  "entity_id", "student_id", "after", "ip"
)
SELECT
  old."id",
  old."createdAt",
  old."userId",
  actor."role",
  old."action",
  old."entity",
  old."entityId",
  CASE WHEN old."entity" = 'Student' THEN old."entityId" ELSE NULL END,
  old."details",
  old."ipAddress"
FROM "AuditLog" old
LEFT JOIN "User" actor ON actor."id" = old."userId";

CREATE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update_delete"
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
