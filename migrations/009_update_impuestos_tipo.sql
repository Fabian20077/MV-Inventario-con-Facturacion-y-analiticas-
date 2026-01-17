
ALTER TABLE impuesto ADD COLUMN tipo ENUM('porcentaje', 'fijo') NOT NULL DEFAULT 'porcentaje';
-- Reuse porcentaje column for value, or maybe rename/add logic?
-- Ideally we would rename 'porcentaje' to 'valor', but to avoid breaking changes we will keep 'porcentaje'
-- and interpret it as 'valor' when tipo='fijo'.
-- Optionally, we can add a comment/description column if needed.
