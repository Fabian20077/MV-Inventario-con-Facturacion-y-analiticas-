/* 
   Migración 003: Fase 1 de Saneamiento
   Descripción: Configuración fiscal, blindaje UTF-8 y limpieza de caracteres corruptos
*/

-- 1. ASEGURAR TABLA DE CONFIGURACIÓN (Punto 4)
-- Verificamos que la tabla soporte los campos necesarios para reportes y facturación
CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(50) PRIMARY KEY,
    valor TEXT,
    descripcion VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar valores por defecto para hacer el sistema "vendible" (marca blanca)
INSERT IGNORE INTO configuracion (clave, valor, descripcion) VALUES 
('nombre_empresa', 'MV Inventario', 'Nombre legal de la empresa para reportes'),
('logo_path', '/assets/img/logo-default.png', 'Ruta o URL del logo de la empresa'),
('nombre_impuesto', 'IVA', 'Nombre del impuesto principal (IVA, VAT, IGV)'),
('porcentaje_impuesto', '12', 'Porcentaje del impuesto (ej. 12, 19, 21)'),
('estado_impuesto', '1', '1 = Activo, 0 = Inactivo'),
('moneda_simbolo', 'Q', 'Símbolo de moneda para reportes');

-- 2. FORZAR UTF-8 EN TODAS LAS TABLAS (Punto 1 - Prevención)
-- Esto previene que futuros datos entren corruptos
ALTER TABLE producto CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE movimiento CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE usuario CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE historial_precio CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE factura CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE detalle_factura CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. SANEAMIENTO DE DATOS EXISTENTES (Punto 1 - Corrección)
-- Corrige el "Mojibake" (UTF-8 interpretado como Latin-1) común en migraciones previas

-- Correcciones para 'producto'
UPDATE producto SET nombre = REPLACE(nombre, 'Ã¡', 'á');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã©', 'é');
UPDATE producto SET nombre = REPLACE(nombre, 'Ãed', 'í'); -- Caso borde común
UPDATE producto SET nombre = REPLACE(nombre, 'Ã­', 'í');  -- Caso estándar
UPDATE producto SET nombre = REPLACE(nombre, 'Ã³', 'ó');
UPDATE producto SET nombre = REPLACE(nombre, 'Ãº', 'ú');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã±', 'ñ');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã‘', 'Ñ');

-- Correcciones para 'movimiento' (observaciones)
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ã¡', 'á');
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ã©', 'é');
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ã­', 'í');
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ã³', 'ó');
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ãº', 'ú');
UPDATE movimiento SET observaciones = REPLACE(observaciones, 'Ã±', 'ñ');

-- Correcciones para 'historial_precio' (razon)
UPDATE historial_precio SET razon = REPLACE(razon, 'Ã¡', 'á');
UPDATE historial_precio SET razon = REPLACE(razon, 'Ã©', 'é');
UPDATE historial_precio SET razon = REPLACE(razon, 'Ã­', 'í');
UPDATE historial_precio SET razon = REPLACE(razon, 'Ã³', 'ó');
UPDATE historial_precio SET razon = REPLACE(razon, 'Ãº', 'ú');
UPDATE historial_precio SET razon = REPLACE(razon, 'Ã±', 'ñ');