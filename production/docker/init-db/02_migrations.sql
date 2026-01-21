-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log schema creation
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (1, 'Initial schema', NOW())
ON CONFLICT (version) DO NOTHING;
