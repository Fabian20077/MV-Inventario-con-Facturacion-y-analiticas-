-- =====================================================
-- MIGRACIÓN: FACTURACIÓN ELECTRÓNICA MEJORADA
-- Script para agregar tablas de facturación al sistema
-- Compatible con: inventario_ropa
-- =====================================================

-- =====================================================
-- TABLA: CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS clientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    nit VARCHAR(50) UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nombre (nombre),
    INDEX idx_nit (nit),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: FACTURAS
-- =====================================================
CREATE TABLE IF NOT EXISTS facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_factura VARCHAR(50) NOT NULL UNIQUE,
    cliente_id INT,
    usuario_id INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    impuesto DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    forma_pago ENUM('efectivo', 'transferencia', 'tarjeta', 'cheque', 'datos') NOT NULL DEFAULT 'efectivo',
    estado ENUM('pendiente', 'pagada', 'cancelada') NOT NULL DEFAULT 'pendiente',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT,
    INDEX idx_numero (numero_factura),
    INDEX idx_cliente (cliente_id),
    INDEX idx_fecha (fecha),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: DETALLE_FACTURA
-- =====================================================
CREATE TABLE IF NOT EXISTS detalle_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    unidad_medida ENUM('KG', 'UND', 'LB', 'GR', 'ML') DEFAULT 'UND',
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE RESTRICT,
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA: CONFIGURACION_IMPRESION
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracion_impresion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_negocio VARCHAR(100) NOT NULL DEFAULT 'Mi Negocio',
    direccion TEXT,
    telefono VARCHAR(20),
    nit VARCHAR(50),
    correo VARCHAR(100),
    pie_pagina TEXT,
    ancho_papel INT DEFAULT 80 COMMENT 'Ancho en caracteres para impresora térmica',
    font_size INT DEFAULT 1,
    logo_data LONGBLOB COMMENT 'Logo en base64',
    logo_tipo VARCHAR(50) COMMENT 'Tipo: PNG, JPG, etc',
    qr_data LONGBLOB COMMENT 'QR en base64',
    qr_tipo VARCHAR(50),
    mostrar_logo BOOLEAN DEFAULT TRUE,
    mostrar_qr BOOLEAN DEFAULT FALSE,
    mostrar_pie_pagina BOOLEAN DEFAULT TRUE,
    numero_factura_actual INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_principal (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- INSERTS DE EJEMPLO
-- =====================================================

-- Configuración inicial para "ECL FRUVER"
INSERT INTO configuracion_impresion (
    nombre_negocio, 
    direccion, 
    telefono, 
    nit, 
    pie_pagina,
    ancho_papel,
    font_size,
    mostrar_logo,
    mostrar_qr,
    mostrar_pie_pagina,
    numero_factura_actual
) VALUES (
    'ECL FRUVER',
    'CALLE 52 SUR # 70 - 90',
    '312 898 0718',
    '1128460388',
    'Gracias por su compra - Vuelva pronto',
    80,
    1,
    TRUE,
    FALSE,
    TRUE,
    53
) ON DUPLICATE KEY UPDATE
    nombre_negocio = VALUES(nombre_negocio);

-- Cliente de ejemplo
INSERT IGNORE INTO clientes (nombre, nit, direccion, telefono) 
VALUES ('Cristian cano', '1128460388', 'calle 52 sur # 70 - 90', '2863427');

-- =====================================================
-- VISTAS ÚTILES PARA REPORTES
-- =====================================================

-- Vista: Facturas con datos del cliente y usuario
DROP VIEW IF EXISTS v_facturas_completas;
CREATE VIEW v_facturas_completas AS
SELECT 
    f.id,
    f.numero_factura,
    f.fecha,
    c.nombre AS cliente,
    c.nit,
    c.direccion,
    c.telefono,
    u.nombre AS usuario,
    f.subtotal,
    f.impuesto,
    f.total,
    f.forma_pago,
    f.estado
FROM facturas f
LEFT JOIN clientes c ON f.cliente_id = c.id
LEFT JOIN usuario u ON f.usuario_id = u.id
ORDER BY f.fecha DESC;

-- Vista: Detalle completo de facturas
DROP VIEW IF EXISTS v_detalle_facturas;
CREATE VIEW v_detalle_facturas AS
SELECT 
    df.id,
    f.numero_factura,
    f.fecha,
    p.codigo,
    p.nombre AS producto,
    df.cantidad,
    df.unidad_medida,
    df.precio_unitario,
    df.subtotal
FROM detalle_factura df
JOIN facturas f ON df.factura_id = f.id
JOIN producto p ON df.producto_id = p.id
ORDER BY f.fecha DESC, df.id;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
