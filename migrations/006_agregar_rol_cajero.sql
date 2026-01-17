-- =====================================================
-- AGREGAR ROL CAJERO
-- =====================================================

-- Insertar rol Cajero
INSERT INTO rol (nombre, descripcion) VALUES 
('Cajero', 'Acceso a ventas, stock, movimientos y facturación');

-- Actualizar descripciones de roles existentes para mayor claridad profesional
UPDATE rol SET descripcion = 'Acceso total al sistema, gestión de usuarios y configuración técnica' WHERE id = 1;
UPDATE rol SET descripcion = 'Análisis de ganancias, reportes globales y gestión de inventario' WHERE id = 2;
UPDATE rol SET descripcion = 'Acceso limitado a catálogo y perfil personal' WHERE id = 3;
