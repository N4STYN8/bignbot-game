ALTER TABLE scores ADD COLUMN best_combo INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_scores_rank;
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (
  best_level DESC,
  best_wave DESC,
  maps_cleared DESC,
  kills DESC,
  best_combo DESC,
  gold DESC
);
