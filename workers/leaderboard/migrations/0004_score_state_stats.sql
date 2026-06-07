ALTER TABLE scores ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN leaks INTEGER NOT NULL DEFAULT 0;
ALTER TABLE scores ADD COLUMN towers_built INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_scores_rank;
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (
  score DESC,
  best_level DESC,
  best_wave DESC,
  maps_cleared DESC,
  kills DESC,
  best_combo DESC,
  gold DESC
);
