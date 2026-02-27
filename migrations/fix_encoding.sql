-- =====================================================
-- SCRIPT DE CORRECCIÓN DE ENCODING (utf8mb4)
-- Ejecutar en phpMyAdmin, DBeaver, o línea de comandos MySQL
-- =====================================================

-- Nota: Hacer BACKUP antes de ejecutar en producción

-- Corrección de caracteres Mojibake (Ã¡ → á, etc)
-- Para la tabla de productos
UPDATE producto SET nombre = REPLACE(nombre, 'Ã¡', 'á');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã©', 'é');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã­', 'í');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã³', 'ó');
UPDATE producto SET nombre = REPLACE(nombre, 'Ãº', 'ú');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã±', 'ñ');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã‘', 'Ñ');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã‰', 'É');
UPDATE producto SET nombre = REPLACE(nombre, 'Ã‘', 'Ñ');
UPDATE producto SET nombre = REPLACE(nombre, 'Â¿', '¿');
UPDATE producto SET nombre = REPLACE(nombre, 'Â¡', '¡');

-- Para descripción si existe
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ã¡', 'á') WHERE descripcion IS NOT NULL;
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ã©', 'é') WHERE descripcion IS NOT NULL;
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ã­', 'í') WHERE descripcion IS NOT NULL;
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ã³', 'ó') WHERE descripcion IS NOT NULL;
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ãº', 'ú') WHERE descripcion IS NOT NULL;
UPDATE producto SET descripcion = REPLACE(descripcion, 'Ã±', 'ñ') WHERE descripcion IS NOT NULL;

-- Para categorías
UPDATE categoria SET nombre = REPLACE(nombre, 'Ã¡', 'á');
UPDATE categoria SET nombre = REPLACE(nombre, 'Ã©', 'é');
UPDATE categoria SET nombre = REPLACE(nombre, 'Ã­', 'í');
UPDATE categoria SET nombre = REPLACE(nombre, 'Ã³', 'ó');
UPDATE categoria SET nombre = REPLACE(nombre, 'Ãº', 'ú');
UPDATE categoria SET nombre = REPLACE(nombre, 'Ã±', 'ñ');

-- Para usuarios
UPDATE usuario SET nombre = REPLACE(nombre, 'Ã¡', 'á');
UPDATE usuario SET nombre = REPLACE(nombre, 'Ã©', 'é');
UPDATE usuario SET nombre = REPLACE(nombre, 'Ã­', 'í');
UPDATE usuario SET nombre = REPLACE(nombre, 'Ã³', 'ó');
UPDATE usuario SET nombre = REPLACE(nombre, 'Ãº', 'ú');
UPDATE usuario SET nombre = REPLACE(nombre, 'Ã±', 'ñ');

-- =====================================================
-- CONVERSIÓN PERMANENTE A UTF8MB4
-- Descomentar las líneas siguientes SOLO si los caracteres aún están corruptos
-- =====================================================

-- ALTER TABLE producto CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE categoria CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE usuario CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE movimientos_inventario CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- ALTER TABLE configuracion CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Verificar resultado
-- SELECT id, nombre FROM producto LIMIT 5;
