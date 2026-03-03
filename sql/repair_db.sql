USE inventario_ropa;

-- Desactivar llaves foráneas temporalmente para limpiar
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS factura_anulacion;
DROP TABLE IF EXISTS detalle_factura;
DROP TABLE IF EXISTS factura;
DROP TABLE IF EXISTS secuencia_documento;
DROP TABLE IF EXISTS impuesto;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. TABLA DE IMPUESTOS (singular 'impuesto' para consistencia con ImpuestoDAO)
CREATE TABLE IF NOT EXISTS impuesto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    tipo ENUM('porcentaje', 'fijo', 'mixto') NOT NULL DEFAULT 'porcentaje',
    porcentaje DECIMAL(10,2) DEFAULT 0,
    valor_fijo DECIMAL(10,2) DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    seleccionado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar valores iniciales si no existen
INSERT IGNORE INTO impuesto (nombre, tipo, porcentaje, seleccionado) VALUES 
('IVA General (19%)', 'porcentaje', 19.00, TRUE),
('Exento de IVA', 'porcentaje', 0.00, FALSE),
('Impoconsumo (8%)', 'porcentaje', 8.00, FALSE);

-- 2. TABLA DE SECUENCIAS
CREATE TABLE IF NOT EXISTS secuencia_documento (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_documento VARCHAR(50) NOT NULL UNIQUE,
    proximo_numero INT NOT NULL DEFAULT 1,
    prefijo VARCHAR(20) NOT NULL DEFAULT 'FAC',
    prefijo_year BOOLEAN DEFAULT TRUE,
    longitud_numero INT DEFAULT 6,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo_documento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración inicial para FACTURA
INSERT IGNORE INTO secuencia_documento (tipo_documento, proximo_numero, prefijo, prefijo_year, longitud_numero)
VALUES ('FACTURA', 1, 'FAC', TRUE, 6);

-- 3. TABLA DE FACTURAS (Esquema Unificado para server.js y FacturaDAO.js)
CREATE TABLE IF NOT EXISTS factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_factura VARCHAR(50) NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    cliente_nombre VARCHAR(150) DEFAULT 'Consumidor Final',
    
    -- Subtotales
    subtotal DECIMAL(18, 2) NOT NULL DEFAULT 0,
    
    -- Detalle de Impuesto aplicado (snapshot)
    impuesto_id INT NULL,
    impuesto_nombre VARCHAR(50) DEFAULT 'IVA',
    impuesto_tipo VARCHAR(20) DEFAULT 'porcentaje',
    impuesto_porcentaje DECIMAL(10, 2) DEFAULT 0,
    impuesto_valor_fijo DECIMAL(10, 2) DEFAULT 0,
    impuesto_monto DECIMAL(18, 2) NOT NULL DEFAULT 0,
    
    -- Compatibilidad legacy (algunos scripts usan estos nombres directamente)
    iva_porcentaje DECIMAL(10, 2) AS (impuesto_porcentaje) STORED,
    iva_monto DECIMAL(18, 2) AS (impuesto_monto) STORED,
    
    total DECIMAL(18, 2) NOT NULL DEFAULT 0,
    
    -- Control
    observaciones TEXT,
    estado ENUM('emitida', 'anulada', 'pagada', 'borrador') DEFAULT 'emitida',
    motivo_anulacion TEXT,
    
    -- Auditoría
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_numero (numero_factura),
    INDEX idx_usuario (usuario_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha_emision),
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLA DE DETALLES DE FACTURA
CREATE TABLE IF NOT EXISTS detalle_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    nombre_producto VARCHAR(200) NOT NULL,
    codigo_producto VARCHAR(50),
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(18, 2) NOT NULL,
    subtotal_linea DECIMAL(18, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id),
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABLA DE ANULACIONES
CREATE TABLE IF NOT EXISTS factura_anulacion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    usuario_anula_id INT NOT NULL,
    motivo TEXT NOT NULL,
    fecha_anulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_anula_id) REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Base de datos reparada con todos los requerimientos de facturación' AS resultado;
