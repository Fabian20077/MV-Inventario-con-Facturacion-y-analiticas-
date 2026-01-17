-- =====================================================
-- MIGRACIÓN: Crear tablas de Facturación
-- Fecha: 2026-01-12
-- Descripción: Implementa el sistema de facturación
-- =====================================================

USE inventario_ropa;

-- =====================================================
-- TABLA DE FACTURAS
-- =====================================================
CREATE TABLE IF NOT EXISTS factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Identificación
    numero_factura VARCHAR(50) NOT NULL UNIQUE COMMENT 'Número secuencial único de factura (ej: FAC-2026-000001)',
    
    -- Información comercial
    fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha y hora de creación de la factura',
    usuario_id INT NOT NULL COMMENT 'Usuario que emitió la factura',
    
    -- Subtotales y totales
    subtotal DECIMAL(18,2) NOT NULL COMMENT 'Suma total sin impuestos',
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 19 COMMENT 'Porcentaje de IVA aplicado',
    iva_monto DECIMAL(18,2) NOT NULL COMMENT 'Monto del impuesto',
    total DECIMAL(18,2) NOT NULL COMMENT 'Total a pagar = subtotal + iva_monto',
    
    -- Observaciones
    observaciones TEXT COMMENT 'Notas adicionales del vendedor',
    
    -- Estado y auditoría
    estado ENUM('borrador', 'emitida', 'anulada', 'devuelta') DEFAULT 'emitida' COMMENT 'Estado de la factura',
    motivo_anulacion VARCHAR(500) COMMENT 'Razón si fue anulada',
    fecha_anulacion TIMESTAMP NULL COMMENT 'Fecha de anulación',
    usuario_anulacion_id INT NULL COMMENT 'Quién anuló la factura',
    
    -- Auditoría
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices para búsquedas rápidas
    INDEX idx_numero (numero_factura),
    INDEX idx_fecha (fecha_emision),
    INDEX idx_usuario (usuario_id),
    INDEX idx_estado (estado),
    
    -- Relaciones
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_anulacion_id) REFERENCES usuario(id) ON DELETE SET NULL,
    
    -- Restricciones
    CHECK (subtotal >= 0),
    CHECK (iva_porcentaje >= 0),
    CHECK (iva_monto >= 0),
    CHECK (total >= 0),
    CHECK (total = (subtotal + iva_monto) OR estado = 'borrador')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA DE DETALLES DE FACTURA (Productos en cada factura)
-- =====================================================
CREATE TABLE IF NOT EXISTS detalle_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Relación con factura y producto
    factura_id INT NOT NULL,
    producto_id INT NOT NULL,
    
    -- Información del producto en el momento de la venta
    nombre_producto VARCHAR(200) NOT NULL COMMENT 'Nombre del producto (snapshot en el momento)',
    codigo_producto VARCHAR(50) NOT NULL COMMENT 'Código del producto (snapshot)',
    
    -- Precios y cantidades
    cantidad INT NOT NULL COMMENT 'Cantidad vendida',
    precio_unitario DECIMAL(18,2) NOT NULL COMMENT 'Precio de venta unitario al momento de la venta',
    subtotal_linea DECIMAL(18,2) NOT NULL COMMENT 'cantidad * precio_unitario',
    
    -- Auditoría
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id),
    
    -- Relaciones
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE RESTRICT,
    
    -- Restricciones
    CHECK (cantidad > 0),
    CHECK (precio_unitario >= 0),
    CHECK (subtotal_linea = (cantidad * precio_unitario))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA DE HISTORIAL DE PRECIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_precio (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Relación con producto
    producto_id INT NOT NULL,
    
    -- Precios anteriores y nuevos
    precio_compra_anterior DECIMAL(18,2) COMMENT 'Precio de compra antes del cambio',
    precio_compra_nuevo DECIMAL(18,2) NOT NULL COMMENT 'Precio de compra después del cambio',
    
    precio_venta_anterior DECIMAL(18,2) COMMENT 'Precio de venta antes del cambio',
    precio_venta_nuevo DECIMAL(18,2) NOT NULL COMMENT 'Precio de venta después del cambio',
    
    -- Razón del cambio
    razon VARCHAR(255) COMMENT 'Motivo del cambio de precio (ej: inflación, promoción, error)',
    
    -- Quién hizo el cambio
    usuario_id INT NOT NULL,
    
    -- Auditoría
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices
    INDEX idx_producto (producto_id),
    INDEX idx_fecha (fecha_cambio),
    INDEX idx_usuario (usuario_id),
    
    -- Relaciones
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA DE SECUENCIAS (Para numeración de facturas)
-- =====================================================
CREATE TABLE IF NOT EXISTS secuencia_documento (
    id INT PRIMARY KEY AUTO_INCREMENT,
    
    -- Tipo de documento
    tipo_documento VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tipo: FACTURA, NOTA_CREDITO, REMISION, etc.',
    
    -- Contador actual
    proximo_numero INT NOT NULL DEFAULT 1 COMMENT 'Próximo número a usar',
    
    -- Configuración
    prefijo VARCHAR(10) NOT NULL DEFAULT 'FAC' COMMENT 'Prefijo del documento (ej: FAC para factura)',
    prefijo_year BOOLEAN DEFAULT TRUE COMMENT 'Incluir año en el número (ej: FAC-2026-000001)',
    longitud_numero INT NOT NULL DEFAULT 6 COMMENT 'Cantidad de dígitos para el número secuencial',
    
    -- Auditoría
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración inicial de secuencias
INSERT INTO secuencia_documento (tipo_documento, proximo_numero, prefijo, prefijo_year, longitud_numero) VALUES
('FACTURA', 1, 'FAC', TRUE, 6)
ON DUPLICATE KEY UPDATE
    proximo_numero = VALUES(proximo_numero);

-- =====================================================
-- TRIGGERS PARA AUDITORÍA Y INTEGRIDAD
-- =====================================================

-- Trigger: Actualizar stock al crear factura
DELIMITER //
CREATE TRIGGER tr_factura_actualizar_stock
AFTER INSERT ON detalle_factura
FOR EACH ROW
BEGIN
    UPDATE producto 
    SET cantidad = cantidad - NEW.cantidad
    WHERE id = NEW.producto_id;
END//
DELIMITER ;

-- Trigger: Validar fecha vencimiento al crear factura (si está activo el control)
-- Nota: Se valida en la aplicación, no en BD por flexibilidad

-- Trigger: Registrar cambios de precio en historial
DELIMITER //
CREATE TRIGGER tr_producto_historial_precio_update
BEFORE UPDATE ON producto
FOR EACH ROW
BEGIN
    -- Solo registra si el precio cambió
    IF NEW.precio_compra != OLD.precio_compra OR NEW.precio_venta != OLD.precio_venta THEN
        INSERT INTO historial_precio (
            producto_id,
            precio_compra_anterior,
            precio_compra_nuevo,
            precio_venta_anterior,
            precio_venta_nuevo,
            usuario_id,
            razon
        ) VALUES (
            NEW.id,
            OLD.precio_compra,
            NEW.precio_compra,
            OLD.precio_venta,
            NEW.precio_venta,
            -- Nota: Requiere passar usuario_id desde la aplicación
            1,
            'Cambio automático registrado por trigger'
        );
    END IF;
END//
DELIMITER ;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Resumen de facturas por día
CREATE OR REPLACE VIEW v_facturas_diarias AS
SELECT 
    DATE(fecha_emision) as fecha,
    COUNT(*) as cantidad_facturas,
    SUM(subtotal) as total_subtotal,
    SUM(iva_monto) as total_iva,
    SUM(total) as total_ventas
FROM factura
WHERE estado != 'anulada'
GROUP BY DATE(fecha_emision)
ORDER BY fecha DESC;

-- Vista: Historial de precios de un producto
CREATE OR REPLACE VIEW v_historial_precios AS
SELECT 
    hp.producto_id,
    p.codigo,
    p.nombre,
    hp.precio_compra_anterior,
    hp.precio_compra_nuevo,
    ROUND(((hp.precio_compra_nuevo - hp.precio_compra_anterior) / hp.precio_compra_anterior * 100), 2) as cambio_compra_porciento,
    hp.precio_venta_anterior,
    hp.precio_venta_nuevo,
    ROUND(((hp.precio_venta_nuevo - hp.precio_venta_anterior) / hp.precio_venta_anterior * 100), 2) as cambio_venta_porciento,
    hp.razon,
    u.nombre as usuario,
    hp.fecha_cambio
FROM historial_precio hp
JOIN producto p ON hp.producto_id = p.id
JOIN usuario u ON hp.usuario_id = u.id
ORDER BY hp.fecha_cambio DESC;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Inserts de ejemplo después de las tablas creadas
-- Se harán a través de la API de la aplicación

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
SELECT 'Migración de facturación creada exitosamente' AS resultado;
