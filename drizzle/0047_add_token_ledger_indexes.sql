CREATE INDEX "token_ledger_created_at_idx" ON "token_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "token_ledger_issued_to_created_at_idx" ON "token_ledger" USING btree ("issued_to_user_id","created_at");
