-- Migración: Agregar configuración de timezone
-- Fecha: 12 de enero de 2026
-- Descripción: Configura timezone para Guatemala y permite cambios futuros

-- Insertar configuración de timezone si no existe
INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'app.timezone', 'America/Guatemala', 'Huso horario de la aplicación (América/Guatemala)'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'app.timezone');

-- Insertar configuración de IVA para Guatemala (si no existe)
INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'finanzas.iva_porcentaje', '12', 'Porcentaje de IVA para facturas (Guatemala = 12%)'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'finanzas.iva_porcentaje');

-- Insertar información de empresa por defecto
INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'empresa.nombre', 'MV Inventario', 'Nombre de la empresa'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'empresa.nombre');

INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'empresa.logo_path', '/assets/logo.png', 'Ruta del logo de empresa'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'empresa.logo_path');

-- Configuración de vencimientos para Guatemala
INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'inventario.vencimiento.habilitado', '1', 'Habilitar validación de vencimientos'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'inventario.vencimiento.habilitado');

INSERT INTO configuracion (clave, valor, descripcion)
SELECT 'inventario.vencimiento.bloquear_venta', '0', 'Bloquear venta de productos vencidos (1=sí, 0=no)'
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'inventario.vencimiento.bloquear_venta');

-- Confirmar éxito
SELECT '✅ Configuración de timezone y datos básicos inicializados correctamente' AS mensaje;
