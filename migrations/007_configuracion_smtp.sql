-- =====================================================
-- CONFIGURACIÓN DE SMTP Y URL DE LA APP
-- =====================================================

-- Insertar configuraciones necesarias para el servicio de correo y links
INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion, publico) VALUES 
('smtp.host', 'smtp.gmail.com', 'string', 'Correo', 'Servidor SMTP para envíos', 0),
('smtp.port', '587', 'number', 'Correo', 'Puerto SMTP (587 TLS, 465 SSL)', 0),
('smtp.user', 'tu-correo@gmail.com', 'string', 'Correo', 'Usuario del servidor SMTP', 0),
('smtp.pass', 'tu-contraseña-app', 'string', 'Correo', 'Contraseña o Token de aplicación SMTP', 0),
('smtp.from', 'Inventario MV <no-reply@mv-inventario.com>', 'string', 'Correo', 'Remitente de los correos', 1),
('app.url', 'http://localhost:3000', 'string', 'Sistema', 'URL base de la aplicación para enlaces en correos', 1)
ON DUPLICATE KEY UPDATE valor = VALUES(valor);
