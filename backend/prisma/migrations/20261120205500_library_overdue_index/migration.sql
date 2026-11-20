-- Roll back with: DROP INDEX "library_loans_returned_on_due_on_idx";
CREATE INDEX "library_loans_returned_on_due_on_idx"
ON "library_loans"("returned_on", "due_on");
