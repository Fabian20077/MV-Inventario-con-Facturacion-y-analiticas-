-- =====================================================
-- TABLA DE IMPUESTOS (Gestión Dinámica)
-- =====================================================

CREATE TABLE IF NOT EXISTS impuesto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    porcentaje DECIMAL(5,2) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    seleccionado BOOLEAN DEFAULT FALSE COMMENT 'Define el impuesto activo globalmente para facturación',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar valores iniciales
INSERT INTO impuesto (nombre, porcentaje, seleccionado) VALUES 
('IVA General', 19.00, TRUE),
('Exento de IVA', 0.00, FALSE),
('Impoconsumo', 8.00, FALSE)
ON DUPLICATE KEY UPDATE porcentaje = VALUES(porcentaje);
