-- =====================================================
-- MIGRACIÓN: Crear tablas de Facturación completas
-- Incluye requisitos DGI de Nicaragua
-- Fecha: 12 de Enero de 2026
-- =====================================================

-- Crear tabla de secuencia de documentos
CREATE TABLE IF NOT EXISTS secuencia_documento (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_documento VARCHAR(50) NOT NULL UNIQUE,
    proximo_numero INT NOT NULL DEFAULT 1,
    prefijo VARCHAR(20) NOT NULL DEFAULT 'FAC',
    prefijo_year BOOLEAN DEFAULT TRUE,
    longitud_numero INT DEFAULT 6,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo_documento)
);

-- Insertar configuración inicial
INSERT IGNORE INTO secuencia_documento (tipo_documento, proximo_numero, prefijo, prefijo_year, longitud_numero)
VALUES ('FACTURA', 1, 'FAC', TRUE, 6);

-- Crear tabla de facturas (FACTURA DE CONSUMIDOR FINAL - DGI)
CREATE TABLE IF NOT EXISTS factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_factura VARCHAR(50) NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    cliente_nombre VARCHAR(150),
    
    -- Datos fiscales
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    iva_porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 19,
    iva_monto DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    
    -- Control
    observaciones TEXT,
    estado ENUM('emitida', 'anulada', 'pagada') DEFAULT 'emitida',
    
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
);

-- Crear tabla de detalles de factura
CREATE TABLE IF NOT EXISTS detalle_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    nombre_producto VARCHAR(200) NOT NULL,
    codigo_producto VARCHAR(50),
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(12, 2) NOT NULL,
    subtotal_linea DECIMAL(12, 2) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id),
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE RESTRICT
);

-- Crear tabla de anulación de facturas (Auditoría DGI)
CREATE TABLE IF NOT EXISTS factura_anulacion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    usuario_anula_id INT NOT NULL,
    motivo TEXT NOT NULL,
    numero_comprobante_anulacion VARCHAR(50),
    fecha_anulacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_factura (factura_id),
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_anula_id) REFERENCES usuario(id) ON DELETE RESTRICT
);
