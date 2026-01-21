-- 03_triggers.sql
-- Auto-increment votes_received when vote is inserted

-- Create trigger function
CREATE OR REPLACE FUNCTION update_voting_round_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment votes_received in voting_rounds
    UPDATE voting_rounds
    SET votes_received = votes_received + 1
    WHERE tx_id = NEW.tx_id
      AND completed = false;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on votes table
CREATE TRIGGER after_vote_insert
AFTER INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION update_voting_round_count();

-- Log trigger creation
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (3, 'Add vote count trigger', NOW())
ON CONFLICT (version) DO NOTHING;
