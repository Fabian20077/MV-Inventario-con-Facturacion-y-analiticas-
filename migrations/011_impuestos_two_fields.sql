
ALTER TABLE impuesto ADD COLUMN valor_fijo DECIMAL(10,2) DEFAULT 0;
ALTER TABLE factura ADD COLUMN impuesto_valor_fijo DECIMAL(10,2) DEFAULT 0;
-- Optional: Update existing 'fijo' types if any were created in the short window, to move 'porcentaje' value to 'valor_fijo'.
-- UPDATE impuesto SET valor_fijo = porcentaje, porcentaje = 0 WHERE tipo = 'fijo'; 
-- But since user just rejected the previous UI, we assume no critical data yet.
