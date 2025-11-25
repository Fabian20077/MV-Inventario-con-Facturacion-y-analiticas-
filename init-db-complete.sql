-- =====================================================
-- SISTEMA DE INVENTARIO DE ROPA - MV
-- Script completo y simplificado para MySQL Workbench
-- Incluye BCrypt para contraseñas
-- =====================================================

USE inventario_ropa;

-- Eliminar tablas existentes en orden correcto (por dependencias)
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

-- Usuario admin con password: password123
-- NOTA: El hash se actualiza via script Node.js después del primer inicio
INSERT INTO usuario (nombre, correo, password, rol_id) VALUES 
('Admin', 'admin@mv.com', 'PLACEHOLDER_HASH_60_CHARS_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 1),
('Gerente Demo', 'gerente@mv.com', 'PLACEHOLDER_HASH_60_CHARS_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 2);

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
    precio_compra DECIMAL(10,2) NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    cantidad INT NOT NULL DEFAULT 0,
    stock_minimo INT DEFAULT 10,
    ubicacion VARCHAR(100),
    id_categoria INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
-- VERIFICACIÓN FINAL
-- =====================================================
SELECT 'Base de datos creada exitosamente' AS resultado;