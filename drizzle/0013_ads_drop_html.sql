-- Phase 7: raw ad HTML is never stored or rendered (rule since Phase 1). The never-used column goes.
ALTER TABLE "ad_slots" DROP COLUMN "html_snippet";
