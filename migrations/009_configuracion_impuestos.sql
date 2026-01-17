-- Semilla para configuración de impuestos
INSERT IGNORE INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) VALUES
('finanzas.impuestos.habilitado', 'true', 'boolean', 'Finanzas', 'Habilitar o deshabilitar impuestos globalmente'),
('finanzas.impuestos.iva_porcentaje', '19', 'number', 'Finanzas', 'Porcentaje de IVA por defecto'),
('finanzas.impuestos.iva_valor_fijo', '0', 'number', 'Finanzas', 'Valor fijo de impuesto por defecto'),
('finanzas.impuestos.nombre_activo', 'IVA General', 'string', 'Finanzas', 'Nombre del impuesto activo actualmente');
