-- =====================================================
-- SISTEMA DE INVENTARIO DE ROPA - MV
-- Script completo y simplificado para MySQL Workbench
-- Incluye BCrypt para contraseñas
-- =====================================================

USE inventario_ropa;

-- Eliminar tablas existentes en orden correcto (por dependencias)
DROP TABLE IF EXISTS historial_precio;
DROP TABLE IF EXISTS movimientos_inventario;
DROP TABLE IF EXISTS producto;
DROP TABLE IF EXISTS categoria;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS rol;

-- =====================================================
-- TABLA DE ROLES
-- =====================================================
CREATE TABLE rol (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rol (nombre, descripcion) VALUES 
('Administrador', 'Acceso completo al sistema'),
('Gerente', 'Gestión de inventario y reportes'),
('Cliente', 'Acceso a catálogo y compras');

-- =====================================================
-- TABLA DE USUARIOS (con password para BCrypt)
-- =====================================================
CREATE TABLE usuario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL COMMENT 'Hash BCrypt de la contraseña',
    rol_id INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL,
    FOREIGN KEY (rol_id) REFERENCES rol(id) ON DELETE RESTRICT,
    INDEX idx_correo (correo),
    INDEX idx_rol (rol_id)
);

-- Usuario admin con password: admin123
-- Usuario gerente con password: gerente123
INSERT INTO usuario (nombre, correo, password, rol_id) VALUES
('Admin', 'admin@mv.com', '$2b$10$cGds3o0Knwou4Xs/HB4e6uP50tWi3guEmVVcqqbqxoauXWXMCNIFtW', 1),
('Gerente Demo', 'gerente@mv.com', '$2b$10$YlGOrTZeg0V/mHn5zgeTYe/eEvqqKw3NNnidj2JVGT8gcY/WQ/ehIG', 2);

-- =====================================================
-- TABLA DE CATEGORÍAS
-- =====================================================
CREATE TABLE categoria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categoria (nombre, descripcion) VALUES 
('Camisetas', 'Camisetas de diferentes estilos y materiales'),
('Pantalones', 'Pantalones jeans, deportivos y formales'),
('Vestidos', 'Vestidos casuales y de ocasión'),
('Zapatos', 'Calzado deportivo y formal'),
('Accesorios', 'Bolsos, cinturones y otros accesorios');

-- =====================================================
-- TABLA DE PRODUCTOS
-- =====================================================
CREATE TABLE producto (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio_compra DECIMAL(18,2) NOT NULL,
    precio_venta DECIMAL(18,2) NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    stock_minimo INT DEFAULT 10,
    ubicacion VARCHAR(100),
    id_categoria INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE NULL COMMENT 'Fecha de vencimiento del producto (opcional)',
    FOREIGN KEY (id_categoria) REFERENCES categoria(id) ON DELETE RESTRICT,
    INDEX idx_codigo (codigo),
    INDEX idx_categoria (id_categoria),
    INDEX idx_activo (activo),
    CHECK (precio_compra >= 0),
    CHECK (precio_venta >= precio_compra),
    CHECK (cantidad >= 0)
);

INSERT INTO producto (codigo, nombre, descripcion, precio_compra, precio_venta, cantidad, stock_minimo, ubicacion, id_categoria) VALUES 
('CAM001', 'Camiseta Básica Algodón', 'Camiseta 100% algodón, disponible en varios colores', 15000, 25000, 50, 10, 'Estante A-1', 1),
('CAM002', 'Camiseta Polo Clásica', 'Polo de algodón con cuello', 20000, 35000, 40, 10, 'Estante A-2', 1),
('PAN001', 'Jeans Clásico Azul', 'Jeans de denim azul, corte recto', 45000, 75000, 30, 5, 'Estante B-1', 2),
('PAN002', 'Pantalón Formal Negro', 'Pantalón de vestir negro', 35000, 60000, 25, 5, 'Estante B-2', 2),
('VES001', 'Vestido Casual Floral', 'Vestido estampado floral, perfecto para el día', 35000, 60000, 25, 8, 'Estante C-1', 3),
('VES002', 'Vestido de Noche Elegante', 'Vestido largo para ocasiones especiales', 80000, 130000, 15, 5, 'Estante C-2', 3),
('ZAP001', 'Zapatos Deportivos Running', 'Zapatos para correr, suela acolchada', 60000, 95000, 20, 5, 'Estante D-1', 4),
('ZAP002', 'Zapatos Formales Cuero', 'Zapatos de cuero genuino para oficina', 70000, 110000, 18, 5, 'Estante D-2', 4),
('ACC001', 'Bolso de Cuero Marrón', 'Bolso de cuero genuino color marrón', 40000, 70000, 15, 5, 'Estante E-1', 5),
('ACC002', 'Cinturón de Cuero Negro', 'Cinturón clásico de cuero', 15000, 28000, 30, 10, 'Estante E-2', 5);

-- =====================================================
-- TABLA DE MOVIMIENTOS DE INVENTARIO
-- =====================================================
CREATE TABLE movimientos_inventario (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_producto INT NOT NULL,
    tipo ENUM('entrada', 'salida') NOT NULL,
    cantidad INT NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT,
    FOREIGN KEY (id_producto) REFERENCES producto(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL,
    INDEX idx_producto (id_producto),
    INDEX idx_fecha (fecha),
    INDEX idx_tipo (tipo),
    CHECK (cantidad > 0)
);

-- Movimientos de ejemplo (stock inicial)
INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, usuario_id) VALUES 
(1, 'entrada', 50, 'Stock inicial', 1),
(2, 'entrada', 40, 'Stock inicial', 1),
(3, 'entrada', 30, 'Stock inicial', 1),
(4, 'entrada', 25, 'Stock inicial', 1),
(5, 'entrada', 25, 'Stock inicial', 1),
(6, 'entrada', 15, 'Stock inicial', 1),
(7, 'entrada', 20, 'Stock inicial', 1),
(8, 'entrada', 18, 'Stock inicial', 1),
(9, 'entrada', 15, 'Stock inicial', 1),
(10, 'entrada', 30, 'Stock inicial', 1);

-- =====================================================
-- TABLA DE HISTORIAL DE PRECIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS historial_precio (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producto_id INT NOT NULL,
    precio_compra_anterior DECIMAL(18,2) NOT NULL,
    precio_compra_nuevo DECIMAL(18,2) NOT NULL,
    precio_venta_anterior DECIMAL(18,2) NOT NULL,
    precio_venta_nuevo DECIMAL(18,2) NOT NULL,
    usuario_id INT,
    razon VARCHAR(255),
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES producto(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL,
    INDEX idx_producto (producto_id),
    INDEX idx_fecha (fecha_cambio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLA DE CONFIGURACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT NOT NULL,
    tipo_dato ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    categoria VARCHAR(50) NOT NULL COMMENT 'Agrupación para la UI (General, Seguridad, Finanzas, etc.)',
    descripcion TEXT,
    bloqueado BOOLEAN DEFAULT FALSE COMMENT 'Si es TRUE, no debe editarse desde la UI basica',
    publico BOOLEAN DEFAULT TRUE COMMENT 'Si es TRUE, se puede exponer al frontend sin token de admin',
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Indices para busqueda rapida por categoria
    INDEX idx_categoria (categoria),
    INDEX idx_bloqueado (bloqueado),
    INDEX idx_publico (publico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion, bloqueado, publico) VALUES
-- EMPRESA
('empresa.nombre', 'MV Inventario', 'string', 'General', 'Nombre oficial del negocio para reportes y facturas', FALSE, TRUE),
('empresa.logo_url', '/assets/img/logo_default.png', 'string', 'General', 'Ruta al logo de la empresa', FALSE, TRUE),
('empresa.direccion', '', 'string', 'General', 'Dirección del negocio para facturas y reportes', FALSE, TRUE),
('empresa.telefono', '', 'string', 'General', 'Número de teléfono del negocio', FALSE, TRUE),
('empresa.nit', '', 'string', 'General', 'NIT o número de identificación fiscal', FALSE, TRUE),
('empresa.email', '', 'string', 'General', 'Correo electrónico del negocio', FALSE, TRUE),

-- FINANZAS & IMPUESTOS
('finanzas.impuestos.iva_porcentaje', '19', 'number', 'Finanzas', 'Porcentaje de IVA aplicado a las ventas (0 para exento)', FALSE, TRUE),
('finanzas.calculo.iva_incluido', 'true', 'boolean', 'Finanzas', 'Define si los precios de venta ingresados ya incluyen el impuesto', FALSE, TRUE),
('finanzas.calculo.decimales', '0', 'number', 'Finanzas', 'Cantidad de decimales a mostrar en pantallas y reportes', FALSE, TRUE),
('finanzas.moneda.simbolo', '$', 'string', 'Finanzas', 'Simbolo de la moneda local', FALSE, TRUE),

-- INVENTARIO
('inventario.stock.alerta_global', '10', 'number', 'Inventario', 'Nivel de stock minimo por defecto para alertas preventivas', FALSE, TRUE),
('inventario.stock.permitir_negativos', 'false', 'boolean', 'Inventario', 'Permite registrar salidas incluso si no hay stock disponible', TRUE, FALSE),

-- GESTIÓN DE VENCIMIENTOS
('inventario.vencimiento.habilitado', 'true', 'boolean', 'Inventario', 'Activar gestión de caducidad de productos', FALSE, TRUE),
('inventario.vencimiento.dias_alerta', '30', 'number', 'Inventario', 'Días de anticipación para aviso de vencimiento (campanita)', FALSE, TRUE),
('inventario.vencimiento.bloquear_venta', 'false', 'boolean', 'Inventario', 'Impedir venta de productos caducados', FALSE, TRUE),

-- SEGURIDAD
('seguridad.auth.token_expiracion', '24', 'number', 'Seguridad', 'Tiempo de vida del token de acceso en horas', TRUE, FALSE),
('seguridad.usuarios.registro_abierto', 'false', 'boolean', 'Seguridad', 'Permitir el registro de nuevos usuarios desde el login', FALSE, TRUE)

ON DUPLICATE KEY UPDATE
    descripcion = VALUES(descripcion),
    categoria = VALUES(categoria);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT 'Base de datos creada exitosamente' AS resultado;
