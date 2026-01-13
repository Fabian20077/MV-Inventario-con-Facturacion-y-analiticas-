import http from 'http';
import fs from 'fs/promises';
import { existsSync, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import { testConnection, query } from './config/database.js';
import UsuarioDAO from './dao/UsuarioDAO.js';
import ProductoDAO from './dao/ProductoDAO.js';
import PasswordResetDAO from './dao/PasswordResetDAO.js';
import ConfiguracionDAO from './dao/ConfiguracionDAO.js';
import HistorialPrecioDAO from './dao/HistorialPrecioDAO.js';
import FacturaDAO from './dao/FacturaDAO.js';
import ReportesService from './routes/reportes.js';
import GeneradorFacturaPDF from './utils/generador-factura-pdf-mejorado.js';
import { generateToken, verifyToken } from './auth/jwt.js';
import { authenticateJWT } from './middleware/auth.js';
import { validateRequest } from './middleware/validate.js';
import {
    loginSchema,
    registerSchema,
    createProductSchema,
    updateProductSchema,
    movementSchema,
    createCategorySchema
} from './validators/schemas.js';
import { forgotPasswordSchema, resetPasswordSchema } from './validators/passwordSchemas.js';
import mysqldump from 'mysqldump';
import configuracionLoader from './config/configuracionLoader.js';

const PORT = 3000;

// ==================== CONFIGURACIÓN DE TIMEZONE ====================
// Soporta: 'America/Guatemala', 'America/Managua', etc.
const APP_TIMEZONE = configuracionLoader.getConfigOrDefault('app.timezone', 'America/Guatemala');

// Función para obtener fecha/hora actual en timezone del cliente
function getNowInTimezone() {
    const formatter = new Intl.DateTimeFormat('es-GT', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const parts = formatter.formatToParts(new Date());
    const date = new Map(parts.map(p => [p.type, p.value]));
    
    return new Date(
        `${date.get('year')}-${date.get('month')}-${date.get('day')}T${date.get('hour')}:${date.get('minute')}:${date.get('second')}`
    );
}

// Helper para parsear body
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
};

/**
 * Helper para parsear multipart/form-data (binario)
 * Implementación nativa para evitar dependencias externas.
 * REESCRITA: Búsqueda binaria robusta de boundaries.
 */
const parseMultipart = (req) => {
    return new Promise((resolve, reject) => {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('multipart/form-data')) {
            return reject(new Error('Content-Type must be multipart/form-data'));
        }

        // console.log('📡 Debug Multipart: Content-Type recibido:', contentType);

        // Extracción robusta del boundary usando Regex (soporta comillas y parámetros extra)
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!boundaryMatch) {
            return reject(new Error('No boundary found in Content-Type'));
        }

        // Limpiar boundary de comillas y espacios
        let boundary = (boundaryMatch[1] || boundaryMatch[2]).trim().replace(/^"+|"+$/g, '');

        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const parts = [];

                if (buffer.length === 0) {
                    return resolve([]);
                }

                // El boundary en el cuerpo siempre empieza con --
                const separator = Buffer.from('--' + boundary);

                let start = buffer.indexOf(separator);

                while (start !== -1) {
                    // Verificar si es el boundary de cierre (--boundary--)
                    // El cierre tiene 2 guiones extra al final (longitud separator + 2)
                    if (start + separator.length + 2 <= buffer.length) {
                        const suffix = buffer.subarray(start + separator.length, start + separator.length + 2);
                        if (suffix.toString() === '--') break;
                    }

                    // Buscar el siguiente boundary
                    const end = buffer.indexOf(separator, start + separator.length);
                    if (end === -1) break;

                    // Definir inicio y fin del contenido (headers + body)
                    // Saltamos el boundary actual y su salto de línea
                    let partStart = start + separator.length;

                    // Detectar salto de línea después del boundary (\r\n o \n)
                    if (partStart < buffer.length) {
                        if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2;
                        else if (buffer[partStart] === 10) partStart += 1;
                    }

                    // El contenido termina antes del siguiente boundary (menos su salto de línea previo)
                    let partEnd = end;
                    if (partEnd > partStart) {
                        if (buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) partEnd -= 2;
                        else if (buffer[partEnd - 1] === 10) partEnd -= 1;
                    }

                    // Extraer el bloque completo
                    const partBuffer = buffer.subarray(partStart, partEnd);

                    // Buscar separación entre Headers y Body (\r\n\r\n o \n\n)
                    const doubleCRLF = partBuffer.indexOf('\r\n\r\n');
                    const doubleLF = partBuffer.indexOf('\n\n');

                    let bodyStart = -1;
                    let headerEnd = -1;

                    if (doubleCRLF !== -1) {
                        headerEnd = doubleCRLF;
                        bodyStart = doubleCRLF + 4;
                    } else if (doubleLF !== -1) {
                        headerEnd = doubleLF;
                        bodyStart = doubleLF + 2;
                    }

                    if (bodyStart !== -1) {
                        const headers = partBuffer.subarray(0, headerEnd).toString();
                        const body = partBuffer.subarray(bodyStart);

                        // Regex robusta para extraer atributos: name="val" o name=val
                        const nameMatch = headers.match(/name=(?:"([^"]+)"|([^;\r\n]+))/i); // Captura nombre del campo
                        const filenameMatch = headers.match(/filename=(?:"([^"]+)"|([^;\r\n]+))/i); // Captura nombre de archivo
                        const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

                        parts.push({
                            name: nameMatch ? (nameMatch[1] || nameMatch[2]) : null,
                            filename: filenameMatch ? (filenameMatch[1] || filenameMatch[2]) : null,
                            contentType: contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream',
                            data: body
                        });
                    }
                    start = end;
                }
                resolve(parts);
            } catch (err) {
                console.error('❌ Error parsing multipart:', err);
                reject(err);
            }
        });
        req.on('error', err => reject(err));
    });
};

// Helper para ejecutar middleware
const runMiddleware = (req, res, middleware) => {
    return new Promise((resolve, reject) => {
        middleware(req, res, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
};

// Middleware de autenticación simple (DEPRECATED - usar authenticateJWT)
const authenticateToken = (req) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    return token != null;
};

const server = http.createServer(async (req, res) => {
    // Log request
    console.log(`${req.method} ${req.url}`);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', database: 'connected' }));
        return;
    }

    // ==================== AUTENTICACIÓN ====================

    // Login con JWT y validación
    if (req.url === '/api/auth/login' && req.method === 'POST') {
        try {
            const body = await parseBody(req);

            // Validar datos de entrada
            const validationResult = loginSchema.safeParse(body);
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));

                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Datos inválidos',
                    errors: errors
                }));
                return;
            }

            const { email, password } = validationResult.data;
            // El frontend envía 'email' pero la BD usa 'correo'
            const resultado = await UsuarioDAO.autenticar(email, password);

            if (resultado.success) {
                // Generar token JWT real
                const token = generateToken(resultado.usuario);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Login exitoso',
                    user: resultado.usuario,
                    token: token
                }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: resultado.message
                }));
            }
        } catch (error) {
            console.error('Error en login:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error en el servidor'
            }));
        }
        return;
    }

    // =====================================================
    // ENDPOINTS DE RECUPERACIÓN DE CONTRASEÑA
    // Agregar estos endpoints en server.js después del endpoint de login
    // =====================================================

    // Forgot Password - Solicitar recuperación
    if (req.url === '/api/auth/forgot-password' && req.method === 'POST') {
        try {
            const body = await parseBody(req);

            // Validar email
            const validationResult = forgotPasswordSchema.safeParse(body);
            if (!validationResult.success) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Email inválido'
                }));
                return;
            }

            const { email } = validationResult.data;

            // Buscar usuario por email
            const usuarios = await query('SELECT * FROM usuario WHERE correo = ?', [email]);

            if (usuarios.length > 0) {
                const usuario = usuarios[0];

                // Generar token único (UUID simulado)
                const crypto = await import('crypto');
                const token = crypto.randomBytes(32).toString('hex');

                // Expiración: 1 hora
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

                // Guardar token en DB
                await PasswordResetDAO.createToken(usuario.id, token, expiresAt);

                // SIMULAR envío de email (mostrar en consola)
                console.log('\n========================================');
                console.log('📧 EMAIL DE RECUPERACIÓN DE CONTRASEÑA');
                console.log('========================================');
                console.log(`Para: ${email}`);
                console.log(`Token: ${token}`);
                console.log(`Enlace: http://localhost:8081/reset-password.html?token=${token}`);
                console.log(`Expira: ${expiresAt.toLocaleString('es-CO')}`);
                console.log('========================================\n');
            }

            // Siempre retornar el mismo mensaje (seguridad)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación'
            }));
        } catch (error) {
            console.error('Error en forgot-password:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error en el servidor'
            }));
        }
        return;
    }

    // Reset Password - Actualizar contraseña
    if (req.url === '/api/auth/reset-password' && req.method === 'POST') {
        try {
            const body = await parseBody(req);

            // Validar token y nueva contraseña
            const validationResult = resetPasswordSchema.safeParse(body);
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));

                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Datos inválidos',
                    errors: errors
                }));
                return;
            }

            const { token, newPassword } = validationResult.data;

            // Buscar token válido
            const tokenData = await PasswordResetDAO.findValidToken(token);

            if (!tokenData || !tokenData.usuario_id) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Token inválido o expirado'
                }));
                return;
            }

            // Hashear nueva contraseña
            const bcrypt = await import('bcryptjs');
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Actualizar contraseña del usuario
            await query('UPDATE usuario SET password = ? WHERE id = ?', [hashedPassword, tokenData.usuario_id]);

            // Marcar token como usado
            await PasswordResetDAO.markTokenAsUsed(token);

            console.log(`✅ Contraseña actualizada para usuario ID: ${tokenData.usuario_id}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Contraseña actualizada exitosamente'
            }));
        } catch (error) {
            console.error('Error en reset-password:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error en el servidor'
            }));
        }
        return;
    }




    // Registro de usuario
    if (req.url === '/api/auth/register' && req.method === 'POST') {
        try {
            const usuario = await parseBody(req);
            const resultado = await UsuarioDAO.crear(usuario);

            res.writeHead(resultado.success ? 201 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resultado));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al crear usuario'
            }));
        }
        return;
    }

    // ==================== PRODUCTOS ====================

    // Listar productos
    if (req.url === '/api/productos' && req.method === 'GET') {
        try {
            const productos = await ProductoDAO.listar();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: productos
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al obtener productos'
            }));
        }
        return;
    }

    // Crear producto (con JWT y validación)
    if (req.url === '/api/productos' && req.method === 'POST') {
        try {
            // Autenticar con JWT
            await runMiddleware(req, res, authenticateJWT);

            // Parsear body
            const body = await parseBody(req);
            req.body = body;

            // Validar datos
            await runMiddleware(req, res, validateRequest(createProductSchema));

            // Manejar categoría: si viene categoria_nombre, buscar o crear
            if (req.body.categoria_nombre && !req.body.id_categoria) {
                const categoriaNombre = req.body.categoria_nombre.trim();

                // Normalizar: Primera letra mayúscula, resto minúsculas
                const nombreNormalizado = categoriaNombre.charAt(0).toUpperCase() +
                    categoriaNombre.slice(1).toLowerCase();

                // Buscar categoría existente (case-insensitive)
                const categoriaExistente = await query(
                    'SELECT id FROM categoria WHERE LOWER(nombre) = LOWER(?) AND activo = TRUE',
                    [nombreNormalizado]
                );

                if (categoriaExistente.length > 0) {
                    // Usar categoría existente
                    req.body.id_categoria = categoriaExistente[0].id;
                } else {
                    // Crear nueva categoría
                    const result = await query(
                        'INSERT INTO categoria (nombre, activo) VALUES (?, TRUE)',
                        [nombreNormalizado]
                    );
                    req.body.id_categoria = result.insertId;
                    console.log(`✅ Nueva categoría creada: "${nombreNormalizado}" (ID: ${result.insertId})`);
                }

                // Eliminar categoria_nombre del body para que no cause error en validación
                delete req.body.categoria_nombre;
            }

            // Crear producto
            const resultado = await ProductoDAO.crear(req.body);

            res.writeHead(resultado.success ? 201 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resultado));
        } catch (error) {
            // Si el error ya fue manejado por el middleware, no hacer nada
            if (res.writableEnded) return;

            console.error('Error al crear producto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al crear producto'
            }));
        }
        return;
    }

    // Actualizar producto
    if (req.url.startsWith('/api/productos/') && req.method === 'PUT') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const datos = await parseBody(req);

            // Obtener usuario_id desde token para historial
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let usuario_id = 1;
            if (token) {
                try {
                    const user = verifyToken(token);
                    usuario_id = user.id;
                } catch (e) {
                    // Por defecto usar 1
                }
            }

            // Manejar categoría: si viene categoria_nombre, buscar o crear
            if (datos.categoria_nombre && !datos.id_categoria) {
                const categoriaNombre = datos.categoria_nombre.trim();

                // Normalizar: Primera letra mayúscula, resto minúsculas
                const nombreNormalizado = categoriaNombre.charAt(0).toUpperCase() +
                    categoriaNombre.slice(1).toLowerCase();

                // Buscar categoría existente (case-insensitive)
                const categoriaExistente = await query(
                    'SELECT id FROM categoria WHERE LOWER(nombre) = LOWER(?) AND activo = TRUE',
                    [nombreNormalizado]
                );

                if (categoriaExistente.length > 0) {
                    // Usar categoría existente
                    datos.id_categoria = categoriaExistente[0].id;
                } else {
                    // Crear nueva categoría
                    const result = await query(
                        'INSERT INTO categoria (nombre, activo) VALUES (?, TRUE)',
                        [nombreNormalizado]
                    );
                    datos.id_categoria = result.insertId;
                    console.log(`✅ Nueva categoría creada: "${nombreNormalizado}" (ID: ${result.insertId})`);
                }

                // Eliminar categoria_nombre del datos para que no cause error
                delete datos.categoria_nombre;
            }

            const resultado = await ProductoDAO.actualizar(id, datos, usuario_id);

            res.writeHead(resultado.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resultado));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al actualizar producto'
            }));
        }
        return;
    }

    // Eliminar producto (soft delete)
    if (req.url.startsWith('/api/productos/') && req.method === 'DELETE') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const resultado = await ProductoDAO.eliminar(id);

            res.writeHead(resultado.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resultado));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al eliminar producto'
            }));
        }
        return;
    }

    // ==================== CATEGORÍAS ====================

    if (req.url === '/api/categorias' && req.method === 'GET') {
        try {
            const sql = 'SELECT * FROM categoria WHERE activo = TRUE ORDER BY nombre';
            const categorias = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: categorias
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al obtener categorías'
            }));
        }
        return;
    }

    // Crear categoría
    if (req.url === '/api/categorias' && req.method === 'POST') {
        try {
            // Autenticar con JWT
            await runMiddleware(req, res, authenticateJWT);

            // Parsear body
            const body = await parseBody(req);
            req.body = body;

            // Validar datos
            await runMiddleware(req, res, validateRequest(createCategorySchema));

            const { nombre } = req.body;

            // Verificar si ya existe (case-insensitive)
            const existente = await query(
                'SELECT id, nombre FROM categoria WHERE LOWER(nombre) = LOWER(?) AND activo = TRUE',
                [nombre]
            );

            if (existente.length > 0) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: existente[0],
                    message: 'Categoría ya existe'
                }));
                return;
            }

            // Crear nueva categoría
            const result = await query(
                'INSERT INTO categoria (nombre, activo) VALUES (?, TRUE)',
                [nombre.trim()]
            );

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: { id: result.insertId, nombre: nombre.trim() },
                message: 'Categoría creada exitosamente'
            }));
        } catch (error) {
            // Si el error ya fue manejado por el middleware, no hacer nada
            if (res.writableEnded) return;

            console.error('Error al crear categoría:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al crear categoría'
            }));
        }
        return;
    }

    // ==================== MOVIMIENTOS ====================

    // Listar movimientos
    if (req.url === '/api/movimientos' && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    m.id,
                    m.tipo,
                    m.cantidad,
                    m.motivo,
                    m.fecha,
                    p.codigo,
                    p.nombre as producto_nombre,
                    u.nombre as usuario_nombre
                FROM movimientos_inventario m
                LEFT JOIN producto p ON m.id_producto = p.id
                LEFT JOIN usuario u ON m.usuario_id = u.id
                ORDER BY m.fecha DESC
                LIMIT 50
            `;

            const movimientos = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: movimientos
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al obtener movimientos'
            }));
        }
        return;
    }

    // Registrar entrada
    if (req.url === '/api/movimientos/entrada' && req.method === 'POST') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const { id_producto, cantidad, motivo, usuario_id } = await parseBody(req);

            // Insertar movimiento
            const sqlMovimiento = `
                INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, usuario_id)
                VALUES (?, 'entrada', ?, ?, ?)
            `;
            await query(sqlMovimiento, [id_producto, cantidad, motivo || 'Entrada de inventario', usuario_id || 1]);

            // Actualizar stock del producto
            await ProductoDAO.actualizarStock(id_producto, cantidad, 'entrada');

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Entrada registrada exitosamente'
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al registrar entrada'
            }));
        }
        return;
    }

    // Registrar salida
    if (req.url === '/api/movimientos/salida' && req.method === 'POST') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const { id_producto, cantidad, motivo, usuario_id, generar_factura, cliente_nombre, observaciones } = await parseBody(req);

            // Verificar stock disponible
            const producto = await ProductoDAO.buscarPorId(id_producto);
            if (!producto) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Producto no encontrado'
                }));
                return;
            }

            // VALIDACIÓN DE VENCIMIENTO REFORZADA
            let vencimientoHabilitado = configuracionLoader.getConfigOrDefault('inventario.vencimiento.habilitado', true);
            let bloquearVenta = configuracionLoader.getConfigOrDefault('inventario.vencimiento.bloquear_venta', false);

            // Fix: Asegurar que strings "false" o "0" se interpreten como booleano false
            if (String(vencimientoHabilitado).toLowerCase() === 'false' || String(vencimientoHabilitado) === '0') vencimientoHabilitado = false;
            if (String(bloquearVenta).toLowerCase() === 'false' || String(bloquearVenta) === '0') bloquearVenta = false;

            if (vencimientoHabilitado && producto.fecha_vencimiento) {
                try {
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    
                    // Normalización robusta de fecha de vencimiento
                    const fechaVencimiento = new Date(producto.fecha_vencimiento);
                    fechaVencimiento.setHours(0, 0, 0, 0);

                    // Validar que la fecha sea válida antes de comparar
                    if (!isNaN(fechaVencimiento.getTime()) && fechaVencimiento < hoy && bloquearVenta) {
                        console.error(`[Seguridad] Venta bloqueada: Producto ${producto.codigo} vencido el ${producto.fecha_vencimiento}`);
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            message: `⛔ Seguridad: Salida bloqueada. El producto venció el ${fechaVencimiento.toLocaleDateString()}.`
                        }));
                        return;
                    }
                } catch (e) {
                    console.error('Error validando vencimiento en salida:', e);
                    // En caso de error de validación, permitimos la operación pero logueamos el fallo (Fail Open vs Fail Close decision)
                }
            }

            if (producto.cantidad < cantidad) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: `Stock insuficiente. Disponible: ${producto.cantidad}`
                }));
                return;
            }

            // Insertar movimiento
            const sqlMovimiento = `
                INSERT INTO movimientos_inventario (id_producto, tipo, cantidad, motivo, usuario_id)
                VALUES (?, 'salida', ?, ?, ?)
            `;
            await query(sqlMovimiento, [id_producto, cantidad, motivo || 'Salida de inventario', usuario_id || 1]);

            // Actualizar stock del producto
            await ProductoDAO.actualizarStock(id_producto, cantidad, 'salida');

            // ==================== GENERAR FACTURA E IMPRIMIRLA ====================
            let facturaData = {
                success: true,
                message: 'Salida registrada exitosamente'
            };

            if (generar_factura && cliente_nombre) {
                try {
                    const ivaConfig = configuracionLoader.getConfigOrDefault('finanzas.impuestos.iva_porcentaje', 19);
                    const iva = parseFloat(ivaConfig);
                    
                    // Obtener configuración de empresa desde settings personalizados
                    const nombreEmpresa = configuracionLoader.getConfigOrDefault('empresa.nombre', 'MI NEGOCIO');
                    const direccionEmpresa = configuracionLoader.getConfigOrDefault('empresa.direccion', '');
                    const telefonoEmpresa = configuracionLoader.getConfigOrDefault('empresa.telefono', '');
                    const nitEmpresa = configuracionLoader.getConfigOrDefault('empresa.nit', '');
                    const logoUrl = configuracionLoader.getConfigOrDefault('empresa.logo_url', '');
                    
                    // Obtener logo si existe
                    let logoData = null;
                    let logoType = 'image/png';
                    if (logoUrl) {
                        try {
                            const logoPath = path.join('./Frontend', logoUrl);
                            if (existsSync(logoPath)) {
                                const logoBuffer = await fs.readFile(logoPath);
                                logoData = logoBuffer.toString('base64');
                                // Detectar tipo de imagen
                                if (logoUrl.toLowerCase().includes('.jpg') || logoUrl.toLowerCase().includes('.jpeg')) {
                                    logoType = 'image/jpeg';
                                } else if (logoUrl.toLowerCase().includes('.png')) {
                                    logoType = 'image/png';
                                }
                            }
                        } catch (logoErr) {
                            console.warn('⚠️ No se pudo cargar el logo:', logoErr.message);
                        }
                    }
                    
                    const config = {
                        nombre_negocio: nombreEmpresa,
                        direccion: direccionEmpresa,
                        telefono: telefonoEmpresa,
                        nit: nitEmpresa,
                        logo_data: logoData,
                        logo_tipo: logoType,
                        pie_pagina: 'Gracias por su compra',
                        mostrar_logo: !!logoData,
                        mostrar_qr: false,
                        mostrar_pie_pagina: true
                    };

                    // Preparar datos de factura
                    const subtotal = producto.precio_venta * cantidad;
                    const impuesto = subtotal * (iva / 100);
                    const total = subtotal + impuesto;

                    const factura = {
                        numero_factura: `FAC-${Date.now()}`,
                        fecha: new Date(),
                        cliente_nombre: cliente_nombre || 'Consumidor Final',
                        nit: config.nit || '',
                        direccion: config.direccion || '',
                        telefono: config.telefono || '',
                        nombre_producto: producto.nombre,
                        codigo_producto: producto.codigo,
                        cantidad: cantidad,
                        precio_unitario: producto.precio_venta,
                        unidad_medida: 'UND',
                        subtotal: subtotal,
                        impuesto: impuesto,
                        total: total,
                        forma_pago: 'efectivo',
                        observaciones: observaciones || '',
                        negocio: {
                            nombre: config.nombre_negocio,
                            direccion: config.direccion,
                            telefono: config.telefono,
                            nit: config.nit,
                            logo_data: config.logo_data,
                            logo_tipo: config.logo_tipo,
                            pie_pagina: config.pie_pagina,
                            mostrar_logo: config.mostrar_logo,
                            mostrar_qr: config.mostrar_qr
                        },
                        detalles: [
                            {
                                producto_nombre: producto.nombre,
                                cantidad: cantidad,
                                precio_unitario: producto.precio_venta,
                                subtotal: subtotal
                            }
                        ]
                    };

                    // Generar PDF
                    const generador = new GeneradorFacturaPDF();
                    const fileName = `factura_${factura.numero_factura}.pdf`;
                    const filePath = path.join('./logs', fileName);

                    // Crear directorio si no existe
                    const logsDir = path.join('.', 'logs');
                    if (!existsSync(logsDir)) {
                        await fs.mkdir(logsDir, { recursive: true });
                    }

                    await generador.generarFactura(factura, config, filePath);

                    console.log(`✅ Factura generada: ${filePath}`);

                    // Retornar información de la factura
                    facturaData = {
                        success: true,
                        message: 'Salida registrada y factura generada',
                        factura: {
                            numero: factura.numero_factura,
                            cliente: cliente_nombre,
                            total: total,
                            pdf_url: `/api/facturas/descargar/${fileName}`
                        }
                    };
                } catch (facturaError) {
                    console.error('⚠️ Error generando factura:', facturaError.message);
                    facturaData.message = 'Salida registrada (Error generando factura)';
                }
            }

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(facturaData));
        } catch (error) {
            console.error('Error en movimientos/salida:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al registrar salida'
            }));
        }
        return;
    }


    // Eliminar movimiento
    if (req.url.startsWith('/api/movimientos/') && req.method === 'DELETE') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];

            // Obtener info del movimiento antes de eliminarlo
            const sqlGet = 'SELECT id_producto, tipo, cantidad FROM movimientos_inventario WHERE id = ?';
            const movimientos = await query(sqlGet, [id]);

            if (movimientos.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Movimiento no encontrado'
                }));
                return;
            }

            const movimiento = movimientos[0];

            // Revertir el stock directamente con SQL
            const operador = movimiento.tipo === 'entrada' ? '-' : '+';
            const sqlRevertir = `UPDATE producto SET cantidad = cantidad ${operador} ? WHERE id = ?`;
            await query(sqlRevertir, [movimiento.cantidad, movimiento.id_producto]);

            // Eliminar el movimiento
            const sqlDelete = 'DELETE FROM movimientos_inventario WHERE id = ?';
            await query(sqlDelete, [id]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Movimiento eliminado y stock revertido'
            }));
        } catch (error) {
            console.error('Error al eliminar movimiento:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al eliminar movimiento'
            }));
        }
        return;
    }

    // ==================== DESCARGA DE FACTURAS ====================

    // Descargar factura en PDF
    if (req.url.startsWith('/api/facturas/descargar/') && req.method === 'GET') {
        try {
            const fileName = req.url.split('/').pop();
            const filePath = path.join('./logs', fileName);

            // Validar que el archivo existe
            if (!existsSync(filePath)) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Archivo no encontrado'
                }));
                return;
            }

            // Leer y enviar archivo
            const fileStream = createReadStream(filePath);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`
            });

            fileStream.pipe(res);

            // Eliminar archivo después de 10 segundos (después de descargar)
            setTimeout(() => {
                fs.unlink(filePath, (err) => {
                    if (!err) {
                        console.log(`🗑️ Factura eliminada: ${fileName}`);
                    }
                });
            }, 10000);
        } catch (error) {
            console.error('Error descargando factura:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al descargar factura'
            }));
        }
        return;
    }

    // ==================== FACTURACIÓN ====================

    // Crear factura
    if (req.url === '/api/facturas' && req.method === 'POST') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const body = await parseBody(req);
            const { detalles, iva_porcentaje = 19, observaciones = '' } = body;

            if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Debe incluir al menos un producto'
                }));
                return;
            }

            // Obtener número de factura
            const secuencia = await query('SELECT proximo_numero, prefijo, prefijo_year, longitud_numero FROM secuencia_documento WHERE tipo_documento = ?', ['FACTURA']);
            if (!secuencia || secuencia.length === 0) {
                throw new Error('No hay configuración de secuencia');
            }

            const config = secuencia[0];
            let numeroFormato = String(config.proximo_numero).padStart(config.longitud_numero, '0');
            let numeroFactura = config.prefijo + '-' + numeroFormato;
            if (config.prefijo_year) {
                const year = new Date().getFullYear();
                numeroFactura = config.prefijo + '-' + year + '-' + numeroFormato;
            }

            // Calcular subtotal
            let subtotal = 0;
            const detallesConPrecio = [];

            for (const detalle of detalles) {
                const prod = await query('SELECT id, nombre, codigo, precio_venta FROM producto WHERE id = ?', [detalle.producto_id]);
                if (!prod || prod.length === 0) {
                    throw new Error(`Producto ${detalle.producto_id} no encontrado`);
                }

                const producto = prod[0];
                const subtotalLinea = producto.precio_venta * detalle.cantidad;
                subtotal += subtotalLinea;

                detallesConPrecio.push({
                    producto_id: detalle.producto_id,
                    nombre_producto: producto.nombre,
                    codigo_producto: producto.codigo,
                    cantidad: detalle.cantidad,
                    precio_unitario: producto.precio_venta,
                    subtotal_linea: subtotalLinea
                });
            }

            // Calcular IVA
            const ivaMonto = Math.round(subtotal * (iva_porcentaje / 100));
            const total = subtotal + ivaMonto;

            // Obtener usuario desde token
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let usuario_id = 1;
            if (token) {
                try {
                    const user = verifyToken(token);
                    usuario_id = user.id;
                } catch (e) {
                    // Por defecto usar 1
                }
            }

            // Crear factura
            const resultFactura = await query(
                `INSERT INTO factura (numero_factura, usuario_id, subtotal, iva_porcentaje, iva_monto, total, observaciones, estado) VALUES (?, ?, ?, ?, ?, ?, ?, 'emitida')`,
                [numeroFactura, usuario_id, subtotal, iva_porcentaje, ivaMonto, total, observaciones]
            );

            const facturaId = resultFactura.insertId;

            // Crear detalles y actualizar stock
            for (const detalle of detallesConPrecio) {
                await query(
                    `INSERT INTO detalle_factura (factura_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal_linea) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [facturaId, detalle.producto_id, detalle.nombre_producto, detalle.codigo_producto, detalle.cantidad, detalle.precio_unitario, detalle.subtotal_linea]
                );

                // Actualizar stock
                await query('UPDATE producto SET cantidad = cantidad - ? WHERE id = ?', [detalle.cantidad, detalle.producto_id]);
            }

            // Incrementar secuencia
            await query('UPDATE secuencia_documento SET proximo_numero = proximo_numero + 1 WHERE tipo_documento = ?', ['FACTURA']);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                mensaje: '✅ Factura creada exitosamente',
                factura: {
                    id: facturaId,
                    numero_factura: numeroFactura,
                    fecha_emision: new Date(),
                    usuario_id,
                    subtotal,
                    iva_porcentaje,
                    iva_monto: ivaMonto,
                    total,
                    detalles: detallesConPrecio,
                    estado: 'emitida'
                }
            }));
        } catch (error) {
            console.error('Error al crear factura:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message || 'Error al crear factura'
            }));
        }
        return;
    }

    // Listar facturas
    if (req.url === '/api/facturas' && req.method === 'GET') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const url = new URL('http://localhost' + req.url);
            const estado = url.searchParams.get('estado') || 'emitida';
            const pagina = parseInt(url.searchParams.get('pagina')) || 1;
            const limite = parseInt(url.searchParams.get('limite')) || 20;
            const offset = (pagina - 1) * limite;

            let query_str = 'SELECT f.*, u.nombre as usuario_nombre FROM factura f JOIN usuario u ON f.usuario_id = u.id WHERE 1=1';
            const params = [];

            if (estado && estado !== 'todas') {
                query_str += ' AND f.estado = ?';
                params.push(estado);
            }

            const total_result = await query('SELECT COUNT(*) as total FROM (' + query_str + ') as sub', params);
            const total = total_result[0].total;

            query_str += ' ORDER BY f.fecha_emision DESC LIMIT ? OFFSET ?';
            params.push(limite, offset);

            const facturas = await query(query_str, params);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                facturas: facturas || [],
                total,
                paginas: Math.ceil(total / limite),
                pagina_actual: pagina
            }));
        } catch (error) {
            console.error('Error al listar facturas:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message || 'Error al listar facturas'
            }));
        }
        return;
    }

    // Obtener factura específica
    if (req.url.startsWith('/api/facturas/') && req.method === 'GET' && !req.url.includes('/pdf')) {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const factura = await query('SELECT f.*, u.nombre as usuario_nombre FROM factura f JOIN usuario u ON f.usuario_id = u.id WHERE f.id = ?', [id]);

            if (!factura || factura.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Factura no encontrada'
                }));
                return;
            }

            const detalles = await query('SELECT * FROM detalle_factura WHERE factura_id = ?', [id]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                factura: {
                    ...factura[0],
                    detalles: detalles || []
                }
            }));
        } catch (error) {
            console.error('Error al obtener factura:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Descargar PDF de factura
    if (req.url.startsWith('/api/facturas/') && req.url.includes('/pdf') && req.method === 'GET') {
        try {
            const id = req.url.split('/')[3];
            const factura = await query('SELECT f.*, u.nombre as usuario_nombre FROM factura f JOIN usuario u ON f.usuario_id = u.id WHERE f.id = ?', [id]);

            if (!factura || factura.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Factura no encontrada' }));
                return;
            }

            const detalles = await query('SELECT * FROM detalle_factura WHERE factura_id = ?', [id]);
            const datos_factura = {
                ...factura[0],
                detalles: detalles || []
            };

            // Importar generador de PDF
            const GeneradorFacturaPDF = (await import('./utils/generador-factura-pdf-mejorado.js')).default;
            const doc = GeneradorFacturaPDF.generarFacturaCoucher(datos_factura);

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Factura-${datos_factura.numero_factura}.pdf"`
            });

            doc.pipe(res);
            doc.end();
        } catch (error) {
            console.error('Error al generar PDF:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Error al generar PDF'
            }));
        }
        return;
    }

    // ==================== ESTADÍSTICAS ====================

    if (req.url === '/api/stats' && req.method === 'GET') {
        try {
            const productos = await ProductoDAO.listar();
            const totalStock = productos.reduce((sum, p) => sum + (p.cantidad || 0), 0);

            const sqlCategorias = 'SELECT COUNT(*) as total FROM categoria WHERE activo = TRUE';
            const categorias = await query(sqlCategorias);

            const sqlMovimientos = 'SELECT COUNT(*) as total FROM movimientos_inventario';
            const movimientos = await query(sqlMovimientos);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: {
                    totalProductos: productos.length,
                    stockTotal: totalStock,
                    totalCategorias: categorias[0]?.total || 0,
                    totalMovimientos: movimientos[0]?.total || 0
                }
            }));
        } catch (error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: {
                    totalProductos: 0,
                    stockTotal: 0,
                    totalCategorias: 0,
                    totalMovimientos: 0
                }
            }));
        }
        return;
    }

    // ==================== ALERTAS ====================

    // Alertas de stock bajo (para campanita)
    if (req.url === '/api/alertas/stock-bajo' && req.method === 'GET') {
        try {
            const diasAlerta = configuracionLoader.getConfigOrDefault('inventario.vencimiento.dias_alerta', 30);

            const sql = `
                SELECT 
                    p.id,
                    p.codigo,
                    p.nombre,
                    p.cantidad as stock_actual,
                    p.stock_minimo,
                    p.fecha_vencimiento,
                    c.nombre as categoria_nombre,
                    CASE 
                        WHEN p.fecha_vencimiento IS NOT NULL AND p.fecha_vencimiento < CURDATE() THEN 'vencido'
                        WHEN p.fecha_vencimiento IS NOT NULL AND p.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 'por_vencer'
                        WHEN p.cantidad = 0 THEN 'agotado'
                        WHEN p.cantidad <= p.stock_minimo THEN 'bajo'
                        ELSE 'normal'
                    END as nivel_alerta
                FROM producto p
                LEFT JOIN categoria c ON p.id_categoria = c.id
                WHERE p.activo = TRUE 
                AND (p.cantidad <= p.stock_minimo 
                     OR (p.fecha_vencimiento IS NOT NULL AND p.fecha_vencimiento <= DATE_ADD(CURDATE(), INTERVAL ? DAY)))
                ORDER BY p.cantidad ASC, p.nombre ASC
            `;

            const alertas = await query(sql, [diasAlerta, diasAlerta]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total: alertas.length,
                data: alertas
            }));
        } catch (error) {
            console.error('Error en alertas de stock:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al obtener alertas'
            }));
        }
        return;
    }

    // ==================== REPORTES ====================

    // Exportar productos a CSV
    if (req.url === '/api/reportes/productos/csv' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarProductosCSV();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar productos a CSV'
            }));
        }
        return;
    }

    // Exportar productos a Excel
    if (req.url === '/api/reportes/productos/excel' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarProductosExcel();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar productos a Excel'
            }));
        }
        return;
    }

    // Exportar productos a PDF
    if (req.url === '/api/reportes/productos/pdf' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarProductosPDF();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar productos a PDF'
            }));
        }
        return;
    }

    // Exportar movimientos a PDF
    if (req.url === '/api/reportes/movimientos/pdf' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarMovimientosPDF();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar movimientos a PDF'
            }));
        }
        return;
    }

    // Exportar movimientos a CSV
    if (req.url === '/api/reportes/movimientos/csv' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarMovimientosCSV();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar movimientos a CSV'
            }));
        }
        return;
    }

    // Exportar movimientos a Excel
    if (req.url === '/api/reportes/movimientos/excel' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarMovimientosExcel();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar movimientos a Excel'
            }));
        }
        return;
    }

    // Exportar análisis a Excel
    if (req.url === '/api/reportes/analytics/excel' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarAnalyticsExcel();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            console.error('Error exportando analytics:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar análisis a Excel'
            }));
        }
        return;
    }

    // Exportar análisis a PDF
    if (req.url === '/api/reportes/analytics/pdf' && req.method === 'GET') {
        try {
            const resultado = await ReportesService.exportarAnalyticsPDF();

            res.writeHead(200, {
                'Content-Type': resultado.contentType,
                'Content-Disposition': `attachment; filename="${resultado.filename}"`
            });
            res.end(resultado.data);
        } catch (error) {
            console.error('Error exportando analytics PDF:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al exportar análisis a PDF'
            }));
        }
        return;
    }

    // ==================== EXPORTACIONES SQL (NUEVO) ====================

    // Exportar productos a SQL (INSERTs)
    if (req.url === '/api/reportes/productos/sql' && req.method === 'GET') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `productos_sql_${timestamp}.sql`;

            const dumpResult = await mysqldump({
                connection: {
                    host: process.env.DB_HOST || 'db',
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || 'outside1234',
                    database: process.env.DB_NAME || 'inventario_ropa',
                },
                dump: {
                    tables: ['producto'],
                    schema: { format: false },
                    data: { format: false }
                }
            });

            res.writeHead(200, {
                'Content-Type': 'application/sql',
                'Content-Disposition': `attachment; filename="${filename}"`
            });

            if (dumpResult.dump.schema) res.write(dumpResult.dump.schema);
            if (dumpResult.dump.data) res.write(dumpResult.dump.data);
            res.end();
        } catch (error) {
            console.error('Error exportando productos SQL:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al exportar productos a SQL' }));
        }
        return;
    }

    // Exportar movimientos a SQL (INSERTs)
    if (req.url === '/api/reportes/movimientos/sql' && req.method === 'GET') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `movimientos_sql_${timestamp}.sql`;

            const dumpResult = await mysqldump({
                connection: {
                    host: process.env.DB_HOST || 'db',
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || 'outside1234',
                    database: process.env.DB_NAME || 'inventario_ropa',
                },
                dump: {
                    tables: ['movimientos_inventario'],
                    schema: { format: false },
                    data: { format: false }
                }
            });

            res.writeHead(200, {
                'Content-Type': 'application/sql',
                'Content-Disposition': `attachment; filename="${filename}"`
            });

            if (dumpResult.dump.schema) res.write(dumpResult.dump.schema);
            if (dumpResult.dump.data) res.write(dumpResult.dump.data);
            res.end();
        } catch (error) {
            console.error('Error exportando movimientos SQL:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al exportar movimientos a SQL' }));
        }
        return;
    }

    // ==================== ANALYTICS ====================

    // Métricas del mes actual
    if (req.url === '/api/analytics/metricas-mes' && req.method === 'GET') {
        try {
            const mesActual = new Date().getMonth() + 1;
            const añoActual = new Date().getFullYear();

            // Calcular métricas del mes actual (Ganancia Neta = Ventas - Costo de Ventas)
            const statsSql = `
                SELECT 
                    COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END), 0) as total_unidades,
                    COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * p.precio_venta ELSE 0 END), 0) as total_ventas,
                    COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * p.precio_compra ELSE 0 END), 0) as costo_ventas,
                    COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad * p.precio_compra ELSE 0 END), 0) as total_compras
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE MONTH(m.fecha) = ? 
                AND YEAR(m.fecha) = ?
            `;
            const stats = await query(statsSql, [mesActual, añoActual]);
            const data = stats[0];

            // CÁLCULO DE PÉRDIDA POR VENCIMIENTO (MERMA)
            // Sumar el costo de todos los productos activos que ya vencieron
            const mermaSql = `
                SELECT COALESCE(SUM(cantidad * precio_compra), 0) as total_merma
                FROM producto
                WHERE activo = TRUE 
                AND fecha_vencimiento IS NOT NULL 
                AND fecha_vencimiento < CURDATE()
            `;
            const mermaResult = await query(mermaSql);
            const totalMerma = mermaResult[0].total_merma;

            // Ganancia Real = (Ventas - Costos) - Merma de productos vencidos
            const ganancia = (data.total_ventas - data.costo_ventas) - totalMerma;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: {
                    ganancia_neta: Math.round(ganancia),
                    total_perdida_merma: Math.round(totalMerma), // Nueva variable expuesta
                    ventas_unidades: data.total_unidades,
                    total_ventas: Math.round(data.total_ventas),
                    total_compras: Math.round(data.total_compras)
                }
            }));
        } catch (error) {
            console.error('Error en métricas:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al calcular métricas' }));
        }
        return;
    }

    // Salud del Inventario (Pie Chart)
    if (req.url === '/api/analytics/salud-inventario' && req.method === 'GET') {
        try {
            const sql = `
                SELECT
                    SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURDATE() THEN 1 ELSE 0 END) as vencidos,
                    SUM(CASE WHEN fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE() THEN 1 ELSE 0 END) as vigentes
                FROM producto
                WHERE activo = TRUE
            `;
            const result = await query(sql);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: result[0]
            }));
        } catch (error) {
            console.error('Error en salud inventario:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener salud del inventario' }));
        }
        return;
    }

    // Exportar SOLO productos vencidos a Excel (Acción Rápida)
    if (req.url === '/api/reportes/productos/vencidos/excel' && req.method === 'GET') {
        try {
            // Importación dinámica para no romper si falta la librería en dev
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Productos Vencidos');

            worksheet.columns = [
                { header: 'Código', key: 'codigo', width: 15 },
                { header: 'Nombre', key: 'nombre', width: 30 },
                { header: 'Categoría', key: 'categoria', width: 20 },
                { header: 'Stock Actual', key: 'stock', width: 12 },
                { header: 'Costo Unit.', key: 'costo', width: 15 },
                { header: 'Fecha Vencimiento', key: 'vencimiento', width: 20 },
                { header: 'Pérdida Total', key: 'perdida', width: 15 }
            ];

            const sql = `
                SELECT p.codigo, p.nombre, c.nombre as categoria, p.cantidad, p.precio_compra, p.fecha_vencimiento
                FROM producto p
                LEFT JOIN categoria c ON p.id_categoria = c.id
                WHERE p.activo = TRUE AND p.fecha_vencimiento < CURDATE()
                ORDER BY p.fecha_vencimiento ASC
            `;
            const productos = await query(sql);

            productos.forEach(p => {
                worksheet.addRow({
                    codigo: p.codigo,
                    nombre: p.nombre,
                    categoria: p.categoria || 'Sin categoría',
                    stock: p.cantidad,
                    costo: p.precio_compra,
                    vencimiento: p.fecha_vencimiento,
                    perdida: p.cantidad * p.precio_compra
                });
            });

            // Estilo de cabecera de alerta
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Rojo

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="URGENTE_Productos_Vencidos.xlsx"');

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Error exportando vencidos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al generar reporte de vencidos' }));
        }
        return;
    }

    // Productos más vendidos
    if (req.url === '/api/analytics/productos-mas-vendidos' && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    p.nombre,
                    COALESCE(SUM(m.cantidad), 0) as unidades_vendidas
                FROM producto p
                LEFT JOIN movimientos_inventario m ON p.id = m.id_producto AND m.tipo = 'salida'
                WHERE p.activo = TRUE
                GROUP BY p.id, p.nombre
                HAVING unidades_vendidas > 0
                ORDER BY unidades_vendidas DESC
                LIMIT 7
            `;

            const productos = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: productos
            }));
        } catch (error) {
            console.error('Error en productos más vendidos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener productos' }));
        }
        return;
    }

    // Ganancias por mes (últimos 6 meses)
    if (req.url === '/api/analytics/ganancias-por-mes' && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    DATE_FORMAT(m.fecha, '%Y-%m') as mes,
                    MONTHNAME(m.fecha) as nombre_mes,
                    COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * (p.precio_venta - p.precio_compra) ELSE 0 END), 0) as ganancia
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY mes, nombre_mes
                ORDER BY mes ASC
            `;

            const ganancias = await query(sql);

            const mesesEspañol = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: ganancias.map(g => {
                    const [year, month] = g.mes.split('-');
                    const nombreMes = mesesEspañol[parseInt(month) - 1];
                    return {
                        mes: nombreMes,
                        ganancia: Math.round(g.ganancia)
                    };
                })
            }));
        } catch (error) {
            console.error('Error en ganancias por mes:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al calcular ganancias' }));
        }
        return;
    }

    // Productos con bajo stock
    if (req.url === '/api/analytics/productos-bajo-stock' && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    nombre,
                    cantidad as stock,
                    stock_minimo as minimo,
                    fecha_vencimiento
                FROM producto
                WHERE activo = TRUE 
                AND (cantidad <= stock_minimo OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURDATE()))
                ORDER BY (fecha_vencimiento < CURDATE()) DESC, cantidad ASC
                LIMIT 10
            `;

            const productos = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: productos
            }));
        } catch (error) {
            console.error('Error en bajo stock:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener productos' }));
        }
        return;
    }

    // Productos con mayor margen
    if (req.url === '/api/analytics/productos-mayor-margen' && req.method === 'GET') {
        try {
            const sql = `
                SELECT 
                    nombre,
                    precio_compra,
                    precio_venta,
                    ROUND(((precio_venta - precio_compra) / precio_venta) * 100, 1) as margen
                FROM producto
                WHERE activo = TRUE
                AND (fecha_vencimiento IS NULL OR fecha_vencimiento >= CURDATE()) -- Excluir vencidos
                ORDER BY margen DESC
                LIMIT 5
            `;

            const productos = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: productos
            }));
        } catch (error) {
            console.error('Error en mayor margen:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener productos' }));
        }
        return;
    }

    // ==================== HISTORIAL DE PRECIOS ====================

    // Obtener historial de precios de un producto
    if (req.url.startsWith('/api/productos/') && req.url.includes('/historial-precio') && req.method === 'GET') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const producto_id = req.url.split('/')[3];
            const historial = await HistorialPrecioDAO.obtenerHistorialProducto(producto_id);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: historial
            }));
        } catch (error) {
            console.error('Error al obtener historial de precios:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener historial' }));
        }
        return;
    }

    // Listar todo el historial de precios
    if (req.url === '/api/historial-precios' && req.method === 'GET') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const url = new URL('http://localhost' + req.url);
            const pagina = parseInt(url.searchParams.get('pagina')) || 1;
            const limite = parseInt(url.searchParams.get('limite')) || 20;
            const producto_id = url.searchParams.get('producto_id');
            const fecha_desde = url.searchParams.get('fecha_desde');
            const fecha_hasta = url.searchParams.get('fecha_hasta');

            const resultado = await HistorialPrecioDAO.listarHistorial({
                pagina,
                limite,
                producto_id,
                fecha_desde,
                fecha_hasta
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...resultado
            }));
        } catch (error) {
            console.error('Error al listar historial:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al listar historial' }));
        }
        return;
    }

    // Análisis de variación de precios (últimos 30 días)
    if (req.url === '/api/analytics/variacion-precios' && req.method === 'GET') {
        try {
            const productos = await HistorialPrecioDAO.obtenerProductosConMayorVariacion();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: productos
            }));
        } catch (error) {
            console.error('Error en variación de precios:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al obtener variación' }));
        }
        return;
    }

    // Análisis de margen histórico
    if (req.url.startsWith('/api/productos/') && req.url.includes('/margen-historico') && req.method === 'GET') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const producto_id = req.url.split('/')[3];
            const analisis = await HistorialPrecioDAO.analizarMargenHistorico(producto_id);

            if (!analisis) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Producto no encontrado' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: analisis
            }));
        } catch (error) {
            console.error('Error en análisis de margen:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al analizar margen' }));
        }
        return;
    }

    // ==================== ADMIN / SYSTEM ====================

    // Descargar copia de seguridad (Backup)
    if (req.url === '/api/admin/backup' && req.method === 'GET') {
        try {
            console.log('Iniciando backup via JS library (ESM)...');

            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `inventario_backup_${timestamp}.sql`;

                // Generar el dump usando la librería JavaScript (ya importada al inicio)
                const dumpResult = await mysqldump({
                    connection: {
                        host: process.env.DB_HOST || 'db',
                        user: process.env.DB_USER || 'root',
                        password: process.env.DB_PASSWORD || 'outside1234',
                        database: process.env.DB_NAME || 'inventario_ropa',
                    },
                    dump: {
                        schema: {
                            format: false,
                        },
                        data: {
                            format: false,
                        }
                    }
                });

                res.writeHead(200, {
                    'Content-Type': 'application/sql',
                    'Content-Disposition': `attachment; filename="${filename}"`
                });

                // Enviar esquema y datos combinados
                if (dumpResult.dump.schema) res.write(dumpResult.dump.schema);
                if (dumpResult.dump.data) res.write(dumpResult.dump.data);

                res.end();
                console.log('Backup completado exitosamente via JS (ESM)');
            } catch (err) {
                console.error('Error en mysqldump JS (ESM):', err);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Error interno al generar backup' }));
                }
            }

        } catch (error) {
            console.error('Error generando backup:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error al generar backup' }));
            } else {
                res.end();
            }
        }
        return;
    }

    // Resetear historial de movimientos (Analytics Reset)
    if (req.url === '/api/admin/reset-movements' && req.method === 'DELETE') {
        try {
            // 1. Validar Token y Rol Admin
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let user = null;

            if (token) {
                try {
                    user = verifyToken(token);
                } catch (e) {
                    // Token inválido
                }
            }

            if (!user || user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado: Requiere rol de Administrador' }));
                return;
            }

            // 2. Ejecutar limpieza (Solo movimientos, mantiene productos)
            await query('SET FOREIGN_KEY_CHECKS = 0');
            await query('TRUNCATE TABLE movimientos_inventario');
            await query('SET FOREIGN_KEY_CHECKS = 1');

            console.log(`🗑️ Historial de movimientos eliminado por admin: ${user.email}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Historial de análisis reiniciado correctamente' }));
        } catch (error) {
            console.error('Error reset movements:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error interno al reiniciar análisis' }));
        }
        return;
    }

    // --- ENDPOINTS DE CONFIGURACIÓN ---
    // NOTA SEGURIDAD: Solo se exponen configuraciones marcadas como 'publico = true' en la BD.
    // No requieren autenticación para facilitar la personalización de la UI inicial (logo, nombre app).

    // Obtener todas las configuraciones públicas
    if (req.url === '/api/configuracion' && req.method === 'GET') {
        try {
            const publicConfigs = configuracionLoader.getPublicConfig();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: publicConfigs
            }));
        } catch (error) {
            console.error('Error al obtener configuraciones públicas:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error interno del servidor' }));
        }
        return;
    }

    // Obtener configuración específica por clave (Solo si es pública)
    if (req.url.startsWith('/api/configuracion/') && req.method === 'GET') {
        const clave = req.url.split('/').pop();
        try {
            if (configuracionLoader.isPublic(clave)) {
                const valor = configuracionLoader.getConfig(clave);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: { [clave]: valor }
                }));
            } else {
                // Si existe pero es privada o no existe, devolvemos 403 o 404
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado a configuración privada' }));
            }
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Configuración no encontrada' }));
        }
        return;
    }

    // ==================== CONFIGURACIÓN: LOGO ====================

    // Subir y actualizar Logo de Empresa
    if (req.url === '/api/admin/configuracion/logo' && req.method === 'POST') {
        try {
            // 1. Validar Token y Rol Admin
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let user = null;

            if (token) {
                try {
                    user = verifyToken(token);
                } catch (e) {
                    // Token inválido
                }
            }

            if (!user || user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado: Requiere rol de Administrador' }));
                return;
            }

            // 2. Procesar Multipart
            const parts = await parseMultipart(req);

            // Buscar la parte del archivo (campo 'file' o cualquiera con filename)
            const filePart = parts.find(p => p.name === 'file' || p.filename);

            // Buscar campo de URL
            const urlPart = parts.find(p => p.name === 'logo_url');

            // Extraer preferencias del usuario (campos de texto en multipart)
            const applyUiPart = parts.find(p => p.name === 'apply_ui');
            const applyReportsPart = parts.find(p => p.name === 'apply_reports');

            let finalPath = '';
            let finalMime = '';
            let isFile = false;

            // LÓGICA DE PRIORIDAD: Archivo > URL
            if (filePart && filePart.data && filePart.data.length > 0) {
                // CASO 1: SE SUBIÓ UN ARCHIVO
                isFile = true;

                // Validar Tipo MIME
                const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
                if (!allowedMimes.includes(filePart.contentType)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Formato no permitido. Use PNG, JPG, JPEG o WEBP.' }));
                    return;
                }

                // Validar Tamaño (2MB)
                const MAX_SIZE = 2 * 1024 * 1024; 
                if (filePart.data.length > MAX_SIZE) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'El archivo excede el tamaño máximo de 2MB.' }));
                    return;
                }

                // Gestión de Archivos
                const uploadDir = path.join(process.cwd(), 'Frontend', 'assets', 'uploads');
                await fs.mkdir(uploadDir, { recursive: true });
                
                // Limpiar logos anteriores
                const existingFiles = await fs.readdir(uploadDir);
                for (const file of existingFiles) {
                    if (file.startsWith('logo_empresa')) {
                        await fs.unlink(path.join(uploadDir, file)).catch(e => console.error('Error borrando archivo viejo:', e));
                    }
                }

                // Guardar nuevo
                let ext = '.png';
                if (filePart.filename) {
                    const originalExt = path.extname(filePart.filename);
                    if (originalExt) ext = originalExt;
                }
                
                const filename = `logo_empresa${ext}`;
                const filePath = path.join(uploadDir, filename);
                finalPath = `/assets/uploads/${filename}`;
                finalMime = filePart.contentType;

                await fs.writeFile(filePath, filePart.data);

            } else if (urlPart && urlPart.data.toString().trim() !== '') {
                // CASO 2: NO HAY ARCHIVO, PERO HAY URL
                finalPath = urlPart.data.toString().trim();
                finalMime = 'url'; // Marcador especial
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Debe subir una imagen o proporcionar una URL válida.' }));
                return;
            }

            // 5. Actualizar Base de Datos
            try {
                if (isFile) {
                    // Si es archivo: Guardamos path y BORRAMOS url para evitar conflictos
                    await upsertConfig('empresa.logo_path', finalPath, 'string', 'Empresa', 'Ruta del logo local');
                    await upsertConfig('empresa.logo_url', '', 'string', 'Empresa', 'URL externa del logo');
                    await upsertConfig('empresa.logo_mime', finalMime, 'string', 'Empresa', 'MIME type');
                } else {
                    // Si es URL: Guardamos url y BORRAMOS path
                    await upsertConfig('empresa.logo_url', finalPath, 'string', 'Empresa', 'URL externa del logo');
                    await upsertConfig('empresa.logo_path', '', 'string', 'Empresa', 'Ruta del logo local');
                    await upsertConfig('empresa.logo_mime', 'url', 'string', 'Empresa', 'MIME type');
                }

                // Guardar preferencias de aplicación (Sistema vs Reportes)
                const applyUiVal = applyUiPart ? (applyUiPart.data.toString() === 'true') : true;
                const applyReportsVal = applyReportsPart ? (applyReportsPart.data.toString() === 'true') : true;

                await upsertConfig('empresa.logo.apply_ui', applyUiVal, 'boolean', 'Empresa', 'Mostrar logo en interfaz');
                await upsertConfig('empresa.logo.apply_reports', applyReportsVal, 'boolean', 'Empresa', 'Mostrar logo en reportes');

            } catch (dbError) {
                console.error('❌ Error DB al guardar logo:', dbError);
                throw new Error('Error al guardar configuración en BD: ' + dbError.message);
            }

            // 6. Recargar Configuración en Memoria
            try {
                // Intentamos recargar. Si falla, NO detenemos el proceso ni lanzamos error.
                if (configuracionLoader && typeof configuracionLoader.loadConfiguraciones === 'function') {
                    await configuracionLoader.loadConfiguraciones();
                }
            } catch (loaderError) {
                // Silenciar error para que el cliente reciba success: true
                // console.log('ℹ️ Configuración guardada en BD. El caché se actualizará al reiniciar el servidor.');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Configuración de marca actualizada',
                data: {
                    path: finalPath,
                    type: isFile ? 'file' : 'url'
                }
            }));

        } catch (error) {
            console.error('❌ Error CRÍTICO en subida de logo:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: `Error interno: ${error.message}`
            }));
        }
        return;
    }

    // --- ENDPOINTS ADMINISTRATIVOS DE CONFIGURACIÓN ---
    // Requieren rol de ADMIN (rol_id = 1) e iniciación de sesión (JWT)

    if (req.url.startsWith('/api/admin/configuracion')) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        const user = token ? verifyToken(token) : null;

        if (!user || user.rol_id !== 1) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Acceso denegado: Se requiere rol de Administrador' }));
            return;
        }

        // GET /api/admin/configuracion - Obtener todas las configuraciones con metadata
        if (req.url === '/api/admin/configuracion' && req.method === 'GET') {
            try {
                const configAdmin = await configuracionLoader.getAllAdmin();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: configAdmin
                }));
            } catch (error) {
                console.error('Error al obtener config admin:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error interno del servidor' }));
            }
            return;
        }

        // PUT /api/admin/configuracion/:clave - Actualizar una configuración
        if (req.method === 'PUT') {
            const clave = req.url.split('/').pop();
            try {
                const body = await parseBody(req);
                let valor = body.valor;

                // Casting automático para tipos definidos
                const configExistente = await ConfiguracionDAO.getByClave(clave);
                if (configExistente) {
                    if (configExistente.tipo_dato === 'boolean' && typeof valor === 'string') {
                        if (valor.toLowerCase() === 'true') valor = true;
                        if (valor.toLowerCase() === 'false') valor = false;
                    } else if (configExistente.tipo_dato === 'number' && typeof valor === 'string') {
                        const num = Number(valor);
                        if (!isNaN(num)) valor = num;
                    }
                }

                const resultado = await ConfiguracionDAO.update(clave, valor);

                // IMPORTANTE: Recargar la caché local inmediatamente para que el cambio sea global
                await configuracionLoader.reloadClave(clave);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(resultado));
            } catch (error) {
                console.error(`Error actualizando config ${clave}:`, error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }
    }

    // 404 - Ruta no encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        message: 'Ruta no encontrada'
    }));
});

// Helper para insertar o actualizar configuración (Upsert simplificado)
async function upsertConfig(clave, valor, tipo, categoria, descripcion) {
    const existe = await ConfiguracionDAO.getByClave(clave);
    if (existe) {
        await ConfiguracionDAO.update(clave, valor);
    } else {
        await query("INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion, publico) VALUES (?, ?, ?, ?, ?, 1)", [clave, valor, tipo, categoria, descripcion]);
    }
}

// --- SCRIPT DE RECUPERACIÓN DE IDENTIDAD ---
async function ensureAdminUser() {
    try {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // 1. Asegurar que existe el rol de admin (ID 1) - Idempotente
        const roles = await query('SELECT * FROM rol WHERE id = 1');
        if (roles.length === 0) {
            await query("INSERT INTO rol (id, nombre, descripcion) VALUES (1, 'Administrador', 'Acceso total')");
            console.log('✅ [SISTEMA] Rol Administrador creado');
        }

        // 2. Verificar si existe el usuario admin
        const users = await query('SELECT * FROM usuario WHERE correo = ?', ['admin@mv.com']);
        
        if (users.length === 0) {
            console.log('⚠️ [SISTEMA] Usuario admin no encontrado. Creando usuario inicial...');
            
            // Crear usuario admin inicial
            await query(
                'INSERT INTO usuario (nombre, correo, password, rol_id, activo) VALUES (?, ?, ?, ?, ?)',
                ['Administrador', 'admin@mv.com', hashedPassword, 1, 1]
            );
            
            console.log('✅ [SISTEMA] Usuario admin creado: admin@mv.com / admin123');
        } else {
            // Si existe, asegurar que tenga la contraseña correcta (idempotente)
            const user = users[0];
            const passwordMatch = await bcrypt.compare('admin123', user.password);
            
            if (!passwordMatch) {
                console.log('🔄 [SISTEMA] Restableciendo contraseña del admin a valor por defecto...');
                await query('UPDATE usuario SET password = ? WHERE correo = ?', [hashedPassword, 'admin@mv.com']);
                console.log('✅ [SISTEMA] Contraseña restablecida a: admin123');
            } else {
                console.log('✅ [SISTEMA] Usuario admin verificado correctamente');
            }
        }
    } catch (error) {
        console.error('❌ Error en script de recuperación:', error);
        // No lanzar error para que el servidor pueda iniciar aunque falle esto
    }
}

// --- SCRIPT DE VERIFICACIÓN DE TABLAS ---
async function ensureTables() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id INT NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ [SISTEMA] Tabla password_reset_tokens verificada.');
    } catch (error) {
        console.error('❌ Error verificando tablas:', error);
    }
}

// Función de arranque unificada
async function startServer() {
    try {
        console.log('🚀 Iniciando MV Inventario - Backend...');

        // 1. Probar conexión a la base de datos
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ No se pudo establecer conexión con la base de datos. Abortando...');
            process.exit(1);
        }

        // 2. Cargar configuraciones globales en caché
        // Esto es crítico para los cálculos financieros del sistema
        await configuracionLoader.loadConfiguraciones();

        // 2.5 Asegurar tablas del sistema
        await ensureTables();

        // 3. Verificar integridad de usuarios (Recuperación)
        await ensureAdminUser();

        // 3. Iniciar escucha de peticiones
        server.listen(PORT, () => {
            console.log('\n╔═══════════════════════════════════════╗');
            console.log('║   MV Inventario - Backend API          ║');
            console.log('║   Servidor ejecutándose en puerto 3000 ║');
            console.log('╚═══════════════════════════════════════╝\n');

            console.log('✅ Sistema listo y configuraciones cargadas.');
            console.log('\n🔌 Endpoints disponibles:');
            console.log('   AUTENTICACIÓN:');
            console.log('   POST /api/auth/login');
            console.log('   POST /api/auth/register\n');
            console.log('   PRODUCTOS:');
            console.log('   GET  /api/productos');
            console.log('   POST /api/productos');
            console.log('   PUT  /api/productos/:id');
            console.log('   DELETE /api/productos/:id\n');
            console.log('   CATEGORÍAS:');
            console.log('   GET  /api/categorias\n');
            console.log('   MOVIMIENTOS:');
            console.log('   GET  /api/movimientos');
            console.log('   POST /api/movimientos/entrada');
            console.log('   POST /api/movimientos/salida');
            console.log('   DELETE /api/movimientos/:id\n');
            console.log('   FACTURACIÓN:');
            console.log('   POST /api/facturas');
            console.log('   GET  /api/facturas');
            console.log('   GET  /api/facturas/:id');
            console.log('   GET  /api/facturas/:id/pdf\n');
            console.log('   ESTADÍSTICAS:');
            console.log('   GET  /api/stats\n');
            console.log('   REPORTES:');
            console.log('   GET  /api/reportes/productos/csv');
            console.log('   GET  /api/reportes/productos/excel');
            console.log('   GET  /api/reportes/movimientos/csv');
            console.log('   GET  /api/reportes/movimientos/excel');
            console.log('   GET  /api/reportes/productos/sql');
            console.log('   GET  /api/reportes/movimientos/sql\n');
            console.log('   OTROS:');
            console.log('   GET  /api/health\n');
        });

    } catch (error) {
        console.error('❌ ERROR CRÍTICO EN EL ARRANQUE DEL SERVIDOR:');
        console.error(error.message);
        process.exit(1);
    }
}

// Ejecutar arranque
startServer();
