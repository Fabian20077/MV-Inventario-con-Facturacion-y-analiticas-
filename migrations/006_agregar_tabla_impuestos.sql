-- Migración 006: Agregar tabla de impuestos
-- Esta migración crea la tabla de impuestos para el sistema de gestión fiscal

CREATE TABLE IF NOT EXISTS impuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre del impuesto (Ej: IVA, VAT, IGV)',
    tipo ENUM('porcentaje', 'fijo', 'mixto') NOT NULL DEFAULT 'porcentaje' COMMENT 'Tipo de cálculo del impuesto',
    porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Porcentaje del impuesto',
    valor_fijo DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Valor fijo del impuesto',
    activo BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Estado del impuesto',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Agregar columna impuesto_id a la tabla factura
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_id INT NULL DEFAULT NULL COMMENT 'ID del impuesto aplicado' AFTER subtotal;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_nombre VARCHAR(100) DEFAULT NULL COMMENT 'Nombre del impuesto aplicado' AFTER impuesto_id;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_tipo VARCHAR(20) DEFAULT NULL COMMENT 'Tipo del impuesto aplicado' AFTER impuesto_nombre;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_porcentaje DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Porcentaje del impuesto aplicado' AFTER impuesto_tipo;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_valor_fijo DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Valor fijo del impuesto aplicado' AFTER impuesto_porcentaje;
ALTER TABLE factura ADD COLUMN IF NOT EXISTS impuesto_monto DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Monto del impuesto calculado' AFTER impuesto_valor_fijo;

-- Actualizar el campo impuesto existente para que coincida con el nuevo sistema
-- Convertir el campo impuesto antiguo a impuesto_monto
UPDATE factura SET impuesto_monto = impuesto WHERE impuesto IS NOT NULL;

-- Agregar índice para mejorar la búsqueda por impuesto
ALTER TABLE factura ADD INDEX IF NOT EXISTS idx_impuesto_id (impuesto_id);

-- Insertar impuesto por defecto si no existe
INSERT INTO impuestos (nombre, tipo, porcentaje, valor_fijo, activo) 
SELECT 'IVA', 'porcentaje', 19.00, 0.00, 1 
WHERE NOT EXISTS (SELECT 1 FROM impuestos WHERE nombre = 'IVA');