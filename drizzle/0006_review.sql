ALTER TABLE chores ADD COLUMN review_status TEXT CHECK(review_status IS NULL OR review_status IN ('pending','approved'));
