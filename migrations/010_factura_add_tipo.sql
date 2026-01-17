
ALTER TABLE factura ADD COLUMN impuesto_tipo ENUM('porcentaje', 'fijo') DEFAULT 'porcentaje';
