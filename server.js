import 'dotenv/config';
import http from 'http';
import fs from 'fs/promises';
import { existsSync, statSync, createWriteStream, createReadStream } from 'fs';
import path from 'path';
import { testConnection, query } from './config/database.js';
import UsuarioDAO from './dao/UsuarioDAO.js';
import ProductoDAO from './dao/ProductoDAO.js';
import PasswordResetDAO from './dao/PasswordResetDAO.js';
import ConfiguracionDAO from './dao/ConfiguracionDAO.js';
import HistorialPrecioDAO from './dao/HistorialPrecioDAO.js';
import FacturaDAO from './dao/FacturaDAO.js';
import ImpuestoDAO from './dao/ImpuestoDAO.js';
import ReportesService from './routes/reportes.js';
import GeneradorFacturaPDF from './utils/generador-factura-pdf-mejorado.js';
import { generateToken, verifyToken, decodeToken } from './auth/jwt.js';
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
import { requirePermission, requireAdmin, requireGerente } from './middleware/rbac.js';
import EmailService from './utils/email-service.js';
// Temporalmente comentado para que el sistema funcione
// Importaciones de sistema de backup - Temporalmente desactivado
// import { BackupManager } from './utils/backup-manager.js';
// import { backupMiddleware } from './middleware/backup-middleware.js';
// import backupRoutes from './routes/backups.js';

const PORT = 3000;

// ==================== GLOBAL ERROR HANDLERS ====================
// Prevenir que excepciones no manejadas tumben el servidor
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION (servidor NO se detendrá):', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

// ==================== CONFIGURACIÓN DE TIMEZONE ====================
// Soporta: 'America/Guatemala', 'America/Managua', etc.
// Nota: La zona horaria se resuelve dinámicamente desde la configuración en memoria
// para reflejar cambios en runtime sin necesidad de reiniciar el servidor.

// Función para obtener fecha/hora actual en timezone del cliente
function getNowInTimezone() {
    const APP_TIMEZONE = configuracionLoader.getConfigOrDefault('app.timezone', 'America/Guatemala');
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

// Helper para parsear body (JSON)
// Lee el body de la request y lo parsea como JSON. Rechaza en caso de JSON inválido.
const parseBody = (req) => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                resolve(parsed);
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', (err) => reject(err));
    });
};

/**
 * Helper para parsear multipart/form-data (binario)
 * Implementación nativa para evitar dependencias externas.
 * REESCRITA: Búsqueda binaria robusta de boundaries.
 * MEJORADO: Manejo de eventos 'close' y timeout para evitar promesas colgadas.
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
        let totalSize = 0;
        const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB de límite de seguridad para evitar leaks
        let isResolved = false;

        // Función helper para limpiar listeners y resolver/rechazar de forma segura
        const cleanup = () => {
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            req.removeListener('error', onError);
            req.removeListener('close', onClose);
        };

        const resolveOnce = (value) => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                resolve(value);
            }
        };

        const rejectOnce = (err) => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                reject(err);
            }
        };

        // Timeout de 30 segundos
        const timeout = setTimeout(() => {
            if (!isResolved) {
                console.error('⏰ Timeout en parseMultipart (30 segundos)');
                rejectOnce(new Error('Timeout: El procesamiento del multipart excedió 30 segundos'));
            }
        }, 30000);

        // Listener para datos
        const onData = (chunk) => {
            chunks.push(chunk);
            totalSize += chunk.length;

            // Corte defensivo: si el upload supera el límite, abortar para proteger la memoria
            if (totalSize > MAX_UPLOAD_SIZE) {
                console.error('❌ Upload demasiado grande, abortando para proteger memoria (>', MAX_UPLOAD_SIZE, 'bytes)');
                req.pause();
                rejectOnce(new Error('Payload demasiado grande: límite de 20MB excedido'));
            }
        };

        // Listener para fin del stream
        const onEnd = () => {
            clearTimeout(timeout);
            try {
                const buffer = Buffer.concat(chunks);
                const parts = [];

                if (buffer.length === 0) {
                    return resolveOnce([]);
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
                }
                resolveOnce(parts);
            } catch (err) {
                console.error('Multipart parsing error:', err);
                rejectOnce(err);
            }
        };

        // Listener para errores del stream
        const onError = (err) => {
            clearTimeout(timeout);
            console.error('❌ Error en stream multipart:', err);
            rejectOnce(err);
        };

        // Listener para cierre de conexión (crítico para evitar promesas colgadas)
        const onClose = () => {
            clearTimeout(timeout);
            if (!isResolved) {
                console.warn('⚠️ Cliente cerró la conexión durante parseMultipart');
                rejectOnce(new Error('Cliente cerró la conexión antes de completar el upload'));
            }
        };

        // Registrar todos los listeners
        req.on('data', onData);
        req.on('end', onEnd);
        req.on('error', onError);
        req.on('close', onClose);
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

    // ==================== SERVIR ARCHIVOS ESTÁTICOS ====================
    // Servir archivos HTML, CSS, JS desde Frontend/
    if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
        let filePath = req.url;

        // Si es raíz, servir login.html
        if (filePath === '/' || filePath === '') {
            filePath = '/pages/login.html';
        }

        // Normalizar rutas que empiezan con /
        if (filePath.startsWith('/')) {
            filePath = filePath.substring(1);
        }

        // Construir ruta completa
        const frontendDir = path.normalize(path.join(process.cwd(), 'Frontend'));
        let fullPath = path.join(frontendDir, filePath);

        // Si es un HTML sin /pages/, buscar en pages/
        if (filePath.endsWith('.html') && !filePath.includes('/pages/') &&
            !filePath.includes('/assets/') && !filePath.includes('/scripts/') &&
            !filePath.includes('/styles/')) {
            const pagesPath = path.join(frontendDir, 'pages', path.basename(filePath));
            if (existsSync(pagesPath)) {
                fullPath = pagesPath;
            }
        }

        // Normalizar la ruta
        fullPath = path.normalize(fullPath);

        // Verificar que el archivo existe y está dentro de Frontend/
        if (fullPath.startsWith(frontendDir) && existsSync(fullPath) && !statSync(fullPath).isDirectory()) {
            try {
                const ext = path.extname(fullPath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html; charset=utf-8',
                    '.css': 'text/css',
                    '.js': 'application/javascript',
                    '.json': 'application/json',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2',
                    '.ttf': 'font/ttf',
                    '.ico': 'image/x-icon'
                };

                const contentType = mimeTypes[ext] || 'application/octet-stream';
                const fileContent = await fs.readFile(fullPath);

                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(fileContent);
                }
                return;
            } catch (error) {
                console.error(`Error sirviendo archivo ${fullPath}:`, error.message);
            }
        }
    }

    // Servir uploads (logos, etc.)
    const uploadsPath = req.url.split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && uploadsPath.startsWith('/uploads/')) {
        try {
            const filePath = path.join(process.cwd(), uploadsPath.substring(1));
            const normalizedPath = path.normalize(filePath);
            const uploadsDir = path.normalize(path.join(process.cwd(), 'uploads'));
            
            console.log(`📁 Petition uploads: ${uploadsPath}`);
            console.log(`📁 Full path: ${normalizedPath}`);
            console.log(`📁 Exists: ${existsSync(normalizedPath)}`);

            if (normalizedPath.startsWith(uploadsDir) && existsSync(normalizedPath) && !statSync(normalizedPath).isDirectory()) {
                const ext = path.extname(normalizedPath).toLowerCase();
                const mimeTypes = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                const fileContent = await fs.readFile(normalizedPath);

                if (!res.headersSent) {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(fileContent);
                }
                return;
            } else {
                console.log(`❌ File not found or not allowed: ${normalizedPath}`);
            }
        } catch (error) {
            console.error(`Error sirviendo upload ${req.url}:`, error.message);
        }
    }

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // OPTIONS para CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Aplicar middleware de backup automático (solo para rutas API)
    if (req.url.startsWith('/api')) {
        // Sistema de backup temporalmente desactivado
        // const backupResult = backupMiddleware.middleware()(req, res, () => {});
        console.log('🔄 Request procesado sin backup automático');
    }

    // Health check (para Docker healthcheck)
    if ((req.url === '/health' || req.url === '/api/health') && req.method === 'GET') {
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

    // Refresh token endpoint (token rotation)
    if (req.url === '/api/auth/refresh' && req.method === 'POST') {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Token de acceso no proporcionado' }));
                return;
            }

            const payload = decodeToken(token);
            if (!payload) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Token de acceso inválido' }));
                return;
            }

            const newToken = generateToken(payload);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accessToken: newToken }));
        } catch (err) {
            console.error('Error al renovar token:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al renovar token' }));
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

                // Enviar email real usando el servicio
                try {
                    await EmailService.sendPasswordReset(email, token, usuario.nombre);
                } catch (emailError) {
                    console.error('Error al enviar email de recuperación:', emailError.message);
                    // No bloqueamos la respuesta al usuario, pero logueamos el error
                }
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


    // ==================== GESTIÓN DE IMPUESTOS ====================
    // Requiere rol de Administrador (rol_id = 1)

    // GET /api/impuestos - Listar todos
    if (req.url.startsWith('/api/impuestos') && req.method === 'GET') {
        console.log(`🔍 [DEBUG] Solicitud Impuestos: ${req.url}`);
        try {
            await runMiddleware(req, res, authenticateJWT);

            if (!req.user || req.user.rol_id !== 1) {
                console.log('⛔ [DEBUG] Acceso denegado o usuario no autenticado');
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                return;
            }

            const impuestos = await query('SELECT * FROM impuesto ORDER BY id ASC');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: impuestos }));
        } catch (error) {
            console.error('❌ [ERROR] Error al listar impuestos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        }
        return;
    }

    // POST /api/impuestos - Crear nuevo
    if (req.url === '/api/impuestos' && req.method === 'POST') {
        try {
            await runMiddleware(req, res, authenticateJWT);
            if (req.user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                return;
            }

            const body = await parseBody(req);
            const { nombre, porcentaje, valor_fijo = 0 } = body;

            if (!nombre || porcentaje === undefined) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Nombre y porcentaje obligatorios' }));
                return;
            }

            await query('INSERT INTO impuesto (nombre, porcentaje, valor_fijo, seleccionado) VALUES (?, ?, ?, FALSE)', [nombre, porcentaje, valor_fijo]);

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Impuesto creado' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        }
        return;
    }

    // PUT /api/impuestos/:id/activar - Seleccionar como activo
    if (req.url.match(/\/api\/impuestos\/\d+\/activar/) && req.method === 'PUT') {
        try {
            await runMiddleware(req, res, authenticateJWT);
            if (req.user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                return;
            }

            const id = req.url.split('/')[3];

            // 1. Desmarcar todos
            await query('UPDATE impuesto SET seleccionado = FALSE');
            // 2. Marcar el solicitado
            await query('UPDATE impuesto SET seleccionado = TRUE WHERE id = ?', [id]);

            // 3. Obtener info para actualizar config global
            const impuestos = await query('SELECT * FROM impuesto WHERE id = ?', [id]);
            if (impuestos.length > 0) {
                const nuevoImpuesto = impuestos[0];

                // Actualizar tabla configuracion. 
                // Guardamos Porcentaje Y Valor Fijo en claves separadas.
                await query(`
                    INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) 
                    VALUES ('finanzas.impuestos.iva_porcentaje', ?, 'number', 'Finanzas', 'Porcentaje de impuesto activo')
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                `, [nuevoImpuesto.porcentaje]);

                await query(`
                    INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) 
                    VALUES ('finanzas.impuestos.iva_valor_fijo', ?, 'number', 'Finanzas', 'Valor fijo de impuesto activo')
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                `, [nuevoImpuesto.valor_fijo || 0]);

                await query(`
                    INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) 
                    VALUES ('finanzas.impuestos.nombre_activo', ?, 'string', 'Finanzas', 'Nombre del impuesto activo')
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                `, [nuevoImpuesto.nombre]);

                // Recargar caché
                if (configuracionLoader && typeof configuracionLoader.loadConfiguraciones === 'function') {
                    await configuracionLoader.loadConfiguraciones();
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Impuesto activado exitosamente' }));
        } catch (error) {
            console.error('Error activando impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        }
        return;
    }

    // DELETE /api/impuestos/:id - Eliminar (Sin restricciones de uso, el snapshot nos protege)
    if (req.url.match(/\/api\/impuestos\/\d+$/) && req.method === 'DELETE') {
        try {
            await runMiddleware(req, res, authenticateJWT);
            if (req.user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                return;
            }

            const id = req.url.split('/')[3];

            // Ya no bloqueamos la eliminación si está seleccionado.
            // Si el usuario borra el activo, la configuración global seguirá teniendo los valores cacheados
            // hasta que seleccione otro.

            await query('DELETE FROM impuesto WHERE id = ?', [id]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Impuesto eliminado' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        }
        return;
    }

    // PUT /api/impuestos/:id - Editar (Nombre/Porcentaje/ValorFijo)
    if (req.url.match(/\/api\/impuestos\/\d+$/) && req.method === 'PUT') {
        try {
            await runMiddleware(req, res, authenticateJWT);
            if (req.user.rol_id !== 1) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const body = await parseBody(req);
            const { nombre, porcentaje, valor_fijo = 0 } = body;

            if (!nombre || porcentaje === undefined) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Nombre y porcentaje obligatorios' }));
                return;
            }

            // Actualizar DB
            await query('UPDATE impuesto SET nombre = ?, porcentaje = ?, valor_fijo = ? WHERE id = ?', [nombre, porcentaje, valor_fijo, id]);

            // Si es el activo, actualizar config global
            const check = await query('SELECT seleccionado FROM impuesto WHERE id = ?', [id]);
            if (check.length > 0 && check[0].seleccionado) {
                await query(`
                    INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) 
                    VALUES ('finanzas.impuestos.iva_porcentaje', ?, 'number', 'Finanzas', 'Porcentaje de impuesto activo')
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                `, [porcentaje]);

                await query(`
                    INSERT INTO configuracion (clave, valor, tipo_dato, categoria, descripcion) 
                    VALUES ('finanzas.impuestos.iva_valor_fijo', ?, 'number', 'Finanzas', 'Valor fijo de impuesto activo')
                    ON DUPLICATE KEY UPDATE valor = VALUES(valor)
                `, [valor_fijo]);

                // Recargar caché
                if (configuracionLoader && typeof configuracionLoader.loadConfiguraciones === 'function') {
                    await configuracionLoader.loadConfiguraciones();
                }
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Impuesto actualizado' }));
        } catch (error) {
            console.error('Error editando impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        }
        return;
    }

    // ==================== SISTEMA DE BACKUPS ====================

    // GET /api/backups/status - Obtener estado del sistema de backups
    if (req.url === '/api/backups/status' && req.method === 'GET') {
        try {
            // Sistema de backups temporalmente desactivado
            const status = {
                enabled: false,
                message: 'Sistema de backups temporalmente desactivado para restaurar funcionamiento principal',
                reason: 'Errores de importación - será reactivado en próxima versión'
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: status
            }));
        } catch (error) {
            console.error('Error obteniendo estado de backups:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error obteniendo estado de backups',
                error: error.message
            }));
        }
        return;
    }

    // GET /api/backups/list - Listar backups disponibles
    if (req.url === '/api/backups/list' && req.method === 'GET') {
        try {
            const result = await BackupManager.listBackups();

            if (result.success) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: result.backups,
                    count: result.backups.length
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Error obteniendo lista de backups',
                    error: result.error
                }));
            }
        } catch (error) {
            console.error('Error listando backups:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error interno del servidor'
            }));
        }
        return;
    }

    // POST /api/backups/create - Crear backup manual
    if (req.url === '/api/backups/create' && req.method === 'POST') {
        try {
            // Sistema de backups temporalmente desactivado
            const body = await parseBody(req);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Sistema de backups temporalmente desactivado',
                reason: 'En proceso de corrección de errores de importación. Próximamente disponible.',
                backup: {
                    name: null,
                    path: null,
                    size: 0,
                    timestamp: new Date().toISOString()
                }
            }));
        } catch (error) {
            console.error('Error en endpoint de backup:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            }));
        }
        return;
    }

    // GET /api/backups/:backupName - Obtener detalles de un backup
    if (req.url.match(/\/api\/backups\/[^\/]+$/) && req.method === 'GET') {
        try {
            const backupName = req.url.split('/').pop();

            const fs = require('fs').promises;
            const path = require('path');
            const backupsDir = './backups';
            const backupPath = path.join(backupsDir, backupName);

            try {
                const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
                const stats = await fs.stat(backupPath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: {
                        name: backupName,
                        path: backupPath,
                        size: stats.size,
                        created: stats.birthtime.toISOString(),
                        modified: stats.mtime.toISOString(),
                        metadata: backupData.metadata,
                        hasDatabase: !!backupData.database,
                        hasFiles: !!backupData.files,
                        hasConfig: !!backupData.config
                    }
                }));
            } catch (error) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Backup no encontrado o no se puede leer'
                }));
            }
        } catch (error) {
            console.error('Error obteniendo detalles de backup:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error interno del servidor'
            }));
        }
        return;
    }

    // DELETE /api/backups/:backupName - Eliminar un backup
    if (req.url.match(/\/api\/backups\/[^\/]+$/) && req.method === 'DELETE') {
        try {
            const backupName = req.url.split('/').pop();

            const fs = require('fs').promises;
            const path = require('path');
            const backupsDir = './backups';
            const backupPath = path.join(backupsDir, backupName);

            try {
                await fs.unlink(backupPath);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Backup eliminado exitosamente',
                    backup: {
                        name: backupName,
                        path: backupPath
                    }
                }));
            } catch (error) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Backup no encontrado'
                }));
            }
        } catch (error) {
            console.error('Error eliminando backup:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error interno del servidor'
            }));
        }
        return;
    }

    // ==================== PRODUCTOS ====================

    // Listar productos (soporta búsqueda y filtrado)
    if (req.url.startsWith('/api/productos') && req.method === 'GET' && !req.url.match(/^\/api\/productos\/\d+(\/.*)?$/)) {
        try {
            // Parsear parámetros de búsqueda
            const urlParsed = new URL('http://localhost' + req.url);
            const filtros = {
                buscar: urlParsed.searchParams.get('buscar') || '',
                categoria: urlParsed.searchParams.get('categoria') || null
            };

            const productos = await ProductoDAO.listar(filtros);
            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: productos, // Compatible con dashboard (app.js)
                    productos: productos // Compatible con facturación (facturacion.js)
                }));
            }
        } catch (error) {
            console.error('Error al obtener productos:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Error al obtener productos'
                }));
            }
        }
        return;
    }

    // Obtener producto por ID
    const productoMatch = req.url.match(/^\/api\/productos\/(\d+)$/);
    if (productoMatch && req.method === 'GET') {
        const id = parseInt(productoMatch[1]);
        try {
            const producto = await ProductoDAO.buscarPorId(id);
            if (producto) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    data: producto
                }));
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    message: 'Producto no encontrado'
                }));
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al obtener producto'
            }));
        }
        return;
    }

    // Crear producto (con JWT y validación)
    if (req.url === '/api/productos' && req.method === 'POST') {
        try {
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('productos.crear'));

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
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('productos.editar'));

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
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('productos.eliminar'));

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
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('productos.crear'));

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
    if (req.url.startsWith('/api/movimientos') && req.method === 'GET' && !req.url.startsWith('/api/movimientos/')) {
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
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('movimientos.crear'));

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
            // Autenticar con JWT y verificar permisos
            await runMiddleware(req, res, authenticateJWT);
            await runMiddleware(req, res, requirePermission('movimientos.crear'));

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
                    // Obtener configuración de impuestos dinâmica
                    const habilitado = String(configuracionLoader.getConfigOrDefault('finanzas.impuestos.habilitado', 'true')) === 'true';
                    const ivaPorcentaje = parseFloat(configuracionLoader.getConfigOrDefault('finanzas.impuestos.iva_porcentaje', 0));
                    const ivaValorFijo = parseFloat(configuracionLoader.getConfigOrDefault('finanzas.impuestos.iva_valor_fijo', 0));
                    const nombreImpuesto = configuracionLoader.getConfigOrDefault('finanzas.impuestos.nombre_activo', 'IVA');

                    // Obtener configuración de empresa desde settings personalizados
                    const nombreEmpresa = configuracionLoader.getConfigOrDefault('empresa.nombre', 'MI NEGOCIO');
                    const direccionEmpresa = configuracionLoader.getConfigOrDefault('empresa.direccion', '');
                    const telefonoEmpresa = configuracionLoader.getConfigOrDefault('empresa.telefono', '');
                    const nitEmpresa = configuracionLoader.getConfigOrDefault('empresa.nit', '');
                    // Leer logo_path (archivo local) con fallback a logo_url (URL externa)
                    const logoPathConfig = configuracionLoader.getConfigOrDefault('empresa.logo_path', '');
                    const logoUrlConfig = configuracionLoader.getConfigOrDefault('empresa.logo_url', '');

                    // Obtener logo si existe
                    let logoData = null;
                    let logoType = 'image/png';
                    const logoSource = logoPathConfig || logoUrlConfig;
                    if (logoSource) {
                        try {
                            // Resolver path: quitar / inicial y buscar desde cwd (dentro de Docker = /app)
                            let cleanLogoPath = logoSource;
                            if (cleanLogoPath.startsWith('/')) cleanLogoPath = cleanLogoPath.substring(1);
                            const resolvedLogoPath = path.join(process.cwd(), cleanLogoPath);
                            if (existsSync(resolvedLogoPath)) {
                                const logoBuffer = await fs.readFile(resolvedLogoPath);
                                logoData = logoBuffer.toString('base64');
                                // Detectar tipo de imagen
                                if (logoSource.toLowerCase().includes('.jpg') || logoSource.toLowerCase().includes('.jpeg')) {
                                    logoType = 'image/jpeg';
                                } else if (logoSource.toLowerCase().includes('.webp')) {
                                    logoType = 'image/webp';
                                } else {
                                    logoType = 'image/png';
                                }
                            } else {
                                console.warn(`⚠️ Logo no encontrado en: ${resolvedLogoPath}`);
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
                    let impuesto = 0;
                    if (habilitado) {
                        impuesto = (subtotal * (ivaPorcentaje / 100)) + ivaValorFijo;
                    }
                    const total = subtotal + impuesto;

                    const factura = {
                        numero_factura: `FAC-${Date.now()}`,
                        fecha_emision: new Date().toLocaleString('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        }),
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
            console.error('❌ Error CRÍTICO descargando/generando factura PDF:', error);
            // Mostrar stack trace para depuración
            if (error.stack) console.error(error.stack);

            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Error al descargar factura: ' + error.message,
                detail: error.toString()
            }));
        }
        return;
    }

    // ==================== IMPUESTOS ====================

    // Listar impuestos
    if (req.url === '/api/impuestos' && req.method === 'GET') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const impuestos = await ImpuestoDAO.obtenerTodos();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: impuestos
            }));
        } catch (error) {
            console.error('Error al listar impuestos:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Obtener impuesto por ID
    if (req.url.startsWith('/api/impuestos/') && req.method === 'GET' && !req.url.includes('/api/impuestos')) {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const impuesto = await ImpuestoDAO.obtenerPorId(id);

            if (!impuesto) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Impuesto no encontrado'
                }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: impuesto
            }));
        } catch (error) {
            console.error('Error al obtener impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Crear impuesto
    if (req.url === '/api/impuestos' && req.method === 'POST') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const body = await parseBody(req);
            const { nombre, tipo, porcentaje = 0, valor_fijo = 0, activo = true } = body;

            if (!nombre || !tipo) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Nombre y tipo son requeridos'
                }));
                return;
            }

            // Validar tipo de impuesto
            const tiposValidos = ['porcentaje', 'fijo', 'mixto'];
            if (!tiposValidos.includes(tipo.toLowerCase())) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Tipo de impuesto no válido. Debe ser: porcentaje, fijo o mixto'
                }));
                return;
            }

            // Validar que porcentaje y valor_fijo sean números válidos
            const porc = parseFloat(porcentaje) || 0;
            const valFijo = parseFloat(valor_fijo) || 0;

            if (porc < 0 || valFijo < 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Porcentaje y valor fijo deben ser números positivos'
                }));
                return;
            }

            const impuesto = await ImpuestoDAO.crear({
                nombre,
                tipo: tipo.toLowerCase(),
                porcentaje: porc,
                valor_fijo: valFijo,
                activo: Boolean(activo)
            });

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: impuesto,
                message: 'Impuesto creado exitosamente'
            }));
        } catch (error) {
            console.error('Error al crear impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Actualizar impuesto
    if (req.url.startsWith('/api/impuestos/') && req.method === 'PUT') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const body = await parseBody(req);
            const { nombre, tipo, porcentaje, valor_fijo, activo } = body;

            const impuestoExistente = await ImpuestoDAO.obtenerPorId(id);
            if (!impuestoExistente) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Impuesto no encontrado'
                }));
                return;
            }

            // Validar tipo de impuesto
            if (tipo) {
                const tiposValidos = ['porcentaje', 'fijo', 'mixto'];
                if (!tiposValidos.includes(tipo.toLowerCase())) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Tipo de impuesto no válido. Debe ser: porcentaje, fijo o mixto'
                    }));
                    return;
                }
            }

            // Validar que porcentaje y valor_fijo sean números válidos
            let porc = impuestoExistente.porcentaje;
            let valFijo = impuestoExistente.valor_fijo;

            if (porcentaje !== undefined) {
                porc = parseFloat(porcentaje);
                if (isNaN(porc) || porc < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Porcentaje debe ser un número positivo'
                    }));
                    return;
                }
            }

            if (valor_fijo !== undefined) {
                valFijo = parseFloat(valor_fijo);
                if (isNaN(valFijo) || valFijo < 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Valor fijo debe ser un número positivo'
                    }));
                    return;
                }
            }

            const impuesto = await ImpuestoDAO.actualizar(id, {
                nombre: nombre || impuestoExistente.nombre,
                tipo: tipo ? tipo.toLowerCase() : impuestoExistente.tipo,
                porcentaje: porc,
                valor_fijo: valFijo,
                activo: activo !== undefined ? Boolean(activo) : impuestoExistente.activo
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: impuesto,
                message: 'Impuesto actualizado exitosamente'
            }));
        } catch (error) {
            console.error('Error al actualizar impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }

    // Eliminar impuesto (desactivar)
    if (req.url.startsWith('/api/impuestos/') && req.method === 'DELETE') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const id = req.url.split('/')[3];
            const impuesto = await ImpuestoDAO.obtenerPorId(id);

            if (!impuesto) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'Impuesto no encontrado'
                }));
                return;
            }

            // Verificar si está en uso
            const enUso = await ImpuestoDAO.estaEnUso(id);
            if (enUso) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: 'No se puede eliminar el impuesto porque está en uso en facturas'
                }));
                return;
            }

            await ImpuestoDAO.eliminar(id);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Impuesto desactivado exitosamente'
            }));
        } catch (error) {
            console.error('Error al eliminar impuesto:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: error.message
            }));
        }
        return;
    }
    if (req.url === '/api/facturas' && req.method === 'POST') {
        try {
            if (!authenticateToken(req)) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'No autorizado' }));
                return;
            }

            const body = await parseBody(req);
            const {
                detalles,
                iva_porcentaje = 19,
                observaciones = '',
                cliente_nombre = 'Consumidor Final',
                impuesto_id = null
            } = body;

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

            let ivaMonto = 0;
            let ivaAplicado = 0;
            let ivaValorFijo = 0;
            let ivaNombre = 'IVA';
            let ivaTipo = 'porcentaje';

            if (impuesto_id) {
                const impuestoRows = await query('SELECT * FROM impuesto WHERE id = ?', [impuesto_id]);
                if (impuestoRows && impuestoRows.length > 0) {
                    const imp = impuestoRows[0];
                    ivaNombre = imp.nombre;
                    ivaTipo = imp.tipo;
                    ivaAplicado = parseFloat(imp.porcentaje);
                    ivaValorFijo = parseFloat(imp.valor_fijo);

                    if (ivaTipo === 'porcentaje') {
                        ivaMonto = Math.round(subtotal * (ivaAplicado / 100));
                    } else if (ivaTipo === 'fijo') {
                        ivaMonto = ivaValorFijo;
                    } else if (ivaTipo === 'mixto') {
                        ivaMonto = Math.round(subtotal * (ivaAplicado / 100)) + ivaValorFijo;
                    }
                }
            } else {
                // Fallback: buscar impuesto seleccionado en la tabla
                const impSelRows = await query('SELECT * FROM impuesto WHERE seleccionado = TRUE LIMIT 1');
                if (impSelRows && impSelRows.length > 0) {
                    const imp = impSelRows[0];
                    ivaNombre = imp.nombre;
                    ivaTipo = imp.tipo;
                    ivaAplicado = parseFloat(imp.porcentaje);
                    ivaValorFijo = parseFloat(imp.valor_fijo);

                    if (ivaTipo === 'porcentaje') {
                        ivaMonto = Math.round(subtotal * (ivaAplicado / 100));
                    } else if (ivaTipo === 'fijo') {
                        ivaMonto = ivaValorFijo;
                    } else if (ivaTipo === 'mixto') {
                        ivaMonto = Math.round(subtotal * (ivaAplicado / 100)) + ivaValorFijo;
                    }
                }
            }

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
                `INSERT INTO factura 
                (numero_factura, usuario_id, cliente_nombre, subtotal, impuesto_id, impuesto_nombre, impuesto_tipo, impuesto_porcentaje, impuesto_valor_fijo, impuesto_monto, total, observaciones, estado) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'emitida')`,
                [
                    numeroFactura,
                    usuario_id,
                    cliente_nombre,
                    subtotal,
                    impuesto_id,
                    ivaNombre,
                    ivaTipo,
                    ivaAplicado,
                    ivaValorFijo,
                    ivaMonto,
                    total,
                    observaciones
                ]
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
                    iva_porcentaje: ivaAplicado,
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
    if (req.method === 'GET' && (req.url === '/api/facturas' || req.url.startsWith('/api/facturas?'))) {
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

            // Conteo simplificado para evitar errores de argumentos
            const countParams = (estado && estado !== 'todas') ? [estado] : [];
            const countSql = (estado && estado !== 'todas')
                ? 'SELECT COUNT(*) as total FROM factura WHERE estado = ?'
                : 'SELECT COUNT(*) as total FROM factura';

            const countResult = await query(countSql, countParams);
            const total = countResult[0].total;

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
            // Log para debug
            console.log('📄 Solicitud de PDF recibida:', req.url);

            // Validar Token (Soporta Header y Query para PDFs)
            const authHeader = req.headers['authorization'];
            const urlParams = new URL('http://localhost' + req.url).searchParams;
            const token = (authHeader && authHeader.split(' ')[1]) || urlParams.get('token');

            if (!token || !verifyToken(token)) {
                console.warn(`[AUTH] Intento de acceso a PDF denegado: ${req.url}`);
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No autorizado para ver PDF' }));
                return;
            }

            const id = req.url.split('/')[3];
            const factura = await query('SELECT f.*, u.nombre as usuario_nombre FROM factura f JOIN usuario u ON f.usuario_id = u.id WHERE f.id = ?', [id]);

            if (!factura || factura.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Factura no encontrada' }));
                return;
            }

            const detalles = await query('SELECT * FROM detalle_factura WHERE factura_id = ?', [id]);

            // Obtener configuración de empresa para el PDF
            const config = {
                nombre_negocio: configuracionLoader.getConfigOrDefault('empresa.nombre', 'Factura de Venta'),
                direccion: configuracionLoader.getConfigOrDefault('empresa.direccion', ''),
                telefono: configuracionLoader.getConfigOrDefault('empresa.telefono', ''),
                nit: configuracionLoader.getConfigOrDefault('empresa.nit', ''),
                pie_pagina: configuracionLoader.getConfigOrDefault('empresa.pie_pagina', '¡Gracias por su compra!'),
                mostrar_logo: String(configuracionLoader.getConfigOrDefault('empresa.logo.apply_reports', 'true')) === 'true',
                mostrar_qr: false
            };

            // Cargar logo si existe (usando lógica mejorada)
            const logoPathRaw = configuracionLoader.getConfigOrDefault('empresa.logo_path', null);
            if (config.mostrar_logo && logoPathRaw) {
                try {
                    // Importación dinámica para evitar ciclos
                    const ReportesService = (await import('./routes/reportes.js')).default;
                    const logoPath = ReportesService._getLogoPath();
                    if (logoPath && existsSync(logoPath)) {
                        const fs_promises = (await import('fs/promises'));
                        const logoBuffer = await fs_promises.readFile(logoPath);
                        config.logo_data = logoBuffer.toString('base64');
                    }
                } catch (err) {
                    console.warn('No se pudo cargar el logo para el PDF:', err.message);
                }
            }

            const datos_factura = {
                ...factura[0],
                detalles: detalles || []
            };

            // Generar PDF usando la nueva clase
            const GeneradorFacturaPDF = (await import('./utils/generador-factura-pdf-mejorado.js')).default;
            const generador = new GeneradorFacturaPDF();

            const tempFileName = `temp_factura_${Date.now()}.pdf`;
            const tempPath = path.join('./logs', tempFileName);

            await generador.generarFactura(datos_factura, config, tempPath);

            // Leer y enviar el PDF generado
            const fileStream = createReadStream(tempPath);
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Factura-${datos_factura.numero_factura}.pdf"`
            });

            fileStream.pipe(res);

            // Limpiar archivo temporal
            fileStream.on('end', () => {
                setTimeout(() => {
                    fs.unlink(tempPath, (err) => {
                        if (err) console.error('Error al borrar PDF temporal:', err);
                    });
                }, 10000);
            });

        } catch (error) {
            console.error('Error al generar PDF:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Error al generar PDF: ' + error.message
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

    // Subir y actualizar Logo de Empresa (JSON Base64, sin multipart pesado)
    if (req.url === '/api/admin/configuracion/logo' && req.method === 'POST') {
        console.log('📡 Logo upload request received (JSON Base64)');

        try {
            // 1. Validar Token y Rol Admin
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            let user = null;

            if (token) {
                try {
                    user = verifyToken(token);
                } catch (e) {
                    console.error('❌ Error verificando token en upload de logo:', e.message);
                }
            }

            if (!user || user.rol_id !== 1) {
                if (!res.headersSent) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Acceso denegado' }));
                }
                return;
            }

            // 2. Leer cuerpo JSON con imagen en Base64
            const body = await parseBody(req);
            const { imageBase64, logo_url, apply_ui, apply_reports } = body || {};

            if (!imageBase64 && !logo_url) {
                if (!res.headersSent) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Imagen requerida' }));
                }
                return;
            }

            let finalPath = '';
            let finalMime = '';
            let isFile = false;

            if (imageBase64) {
                isFile = true;

                // Extraer cabecera data URL si existe
                let base64String = imageBase64;
                let ext = '.png';

                const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageBase64);
                if (dataUrlMatch) {
                    const mime = dataUrlMatch[1];
                    base64String = dataUrlMatch[2];

                    if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
                    else if (mime.includes('webp')) ext = '.webp';
                    else if (mime.includes('gif')) ext = '.gif';

                    finalMime = mime;
                }

                const buffer = Buffer.from(base64String, 'base64');

                const MAX_SIZE = 5 * 1024 * 1024;
                if (buffer.length > MAX_SIZE) {
                    if (!res.headersSent) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, message: 'Archivo > 5MB' }));
                    }
                    return;
                }

                const filename = `logo_${Date.now()}${ext}`;
                const uploadDir = path.join(process.cwd(), 'uploads', 'logo');
                const filePath = path.join(uploadDir, filename);

                await fs.mkdir(uploadDir, { recursive: true });
                await fs.writeFile(filePath, buffer);

                finalPath = `/uploads/logo/${filename}`;

                if (!finalMime) {
                    finalMime = 'image/png';
                }
            } else if (logo_url && typeof logo_url === 'string' && logo_url.trim() !== '') {
                finalPath = logo_url.trim();
                finalMime = 'url';
            }

            // 3. Actualizar configuración en BD
            if (isFile) {
                await upsertConfig('empresa.logo_path', finalPath, 'string', 'Empresa', 'Ruta logo');
                await upsertConfig('empresa.logo_url', '', 'string', 'Empresa', 'URL logo');
                await upsertConfig('empresa.logo_mime', finalMime, 'string', 'Empresa', 'MIME logo');
            } else {
                await upsertConfig('empresa.logo_url', finalPath, 'string', 'Empresa', 'URL logo');
                await upsertConfig('empresa.logo_path', '', 'string', 'Empresa', 'Ruta logo');
                await upsertConfig('empresa.logo_mime', 'url', 'string', 'Empresa', 'MIME logo');
            }

            const applyUiVal = typeof apply_ui === 'boolean' ? apply_ui : true;
            const applyReportsVal = typeof apply_reports === 'boolean' ? apply_reports : true;

            await upsertConfig('empresa.logo.apply_ui', applyUiVal, 'boolean', 'Empresa', 'UI');
            await upsertConfig('empresa.logo.apply_reports', applyReportsVal, 'boolean', 'Empresa', 'Reportes');

            // Recargar configuraciones en memoria
            try {
                if (configuracionLoader) {
                    await configuracionLoader.loadConfiguraciones();
                    console.log('✅ Configuraciones recargadas después de actualizar logo');
                }
            } catch (reloadErr) {
                console.error('❌ Error recargando configuraciones después de logo:', reloadErr);
            }

            if (!res.headersSent) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Logo actualizado correctamente',
                    data: {
                        path: finalPath,
                        type: isFile ? 'file' : 'url'
                    }
                }));
            }
        } catch (error) {
            console.error('❌ Error general en handler de logo (JSON Base64):', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error interno procesando logo' }));
            }
        }
        return;
    }

    // --- ENDPOINTS ADMINISTRATIVOS DE CONFIGURACIÓN ---
    // Requieren rol de ADMIN (rol_id = 1) e iniciación de sesión (JWT)

    if (req.url.startsWith('/api/admin/configuracion') && !req.url.includes('/logo')) {
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

        // GET /api/admin/configuracion/:clave - Obtener una configuración específica
        if (req.method === 'GET' && req.url !== '/api/admin/configuracion' && !req.url.startsWith('/uploads/')) {
            const clave = req.url.split('/').pop();
            try {
                const config = await ConfiguracionDAO.getByClave(clave);
                if (config) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        valor: String(config.valor) // Convertir a string para consistencia
                    }));
                } else {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, message: 'Configuración no encontrada' }));
                }
            } catch (error) {
                console.error(`Error al obtener conig ${clave}:`, error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error interno' }));
            }
            return;
        }

        // PUT /api/admin/configuracion/:clave - Actualizar una configuración
        if (req.method === 'PUT') {
            const clave = req.url.split('/').pop();
            console.log(`🔧 PUT Config Request for: ${clave}`); // UPDATE LOG
            try {
                const body = await parseBody(req);
                console.log('📦 Body received:', JSON.stringify(body)); // UPDATE LOG

                let valor = body.valor;

                // Casting automático para tipos definidos
                const configExistente = await ConfiguracionDAO.getByClave(clave);

                if (configExistente) {
                    console.log(`📄 Config found. Type: ${configExistente.tipo_dato}, Current Value: ${configExistente.valor}`); // UPDATE LOG

                    if (configExistente.tipo_dato === 'boolean' && typeof valor === 'string') {
                        if (valor.toLowerCase() === 'true') valor = true;
                        if (valor.toLowerCase() === 'false') valor = false;
                    } else if (configExistente.tipo_dato === 'number' && typeof valor === 'string') {
                        const num = Number(valor);
                        if (!isNaN(num)) valor = num;
                    }
                } else {
                    console.warn(`⚠️ Config NOT found: ${clave}`); // UPDATE LOG
                }

                console.log(`📝 Attempting update with value: ${valor} (Type: ${typeof valor})`); // UPDATE LOG

                const resultado = await ConfiguracionDAO.update(clave, valor);

                // IMPORTANTE: Recargar la caché local inmediatamente para que el cambio sea global
                await configuracionLoader.reloadClave(clave);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(resultado));
            } catch (error) {
                console.error(`❌ Error actualizando config ${clave}:`, error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }
        // ==========================================
        // 💰 GESTIÓN DE IMPUESTOS (CRUD COMPLETO)
        // ==========================================

        // Listar Impuestos
        if (req.url.startsWith('/api/impuestos') && req.method === 'GET') {
            try {
                await runMiddleware(req, res, authenticateJWT);

                // Obtener impuestos
                const impuestos = await query('SELECT * FROM impuesto ORDER BY nombre ASC');
                // Obtener activo desde config
                const configNombre = configuracionLoader.getConfig('finanzas.impuestos.nombre_activo');

                // Marcar cuál está seleccionado realmente según la configuración global (Single Source of Truth)
                const impuestosMarcados = impuestos.map(i => ({
                    ...i,
                    seleccionado: (i.nombre === configNombre) ? 1 : 0
                }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, impuestos: impuestosMarcados }));
            } catch (error) {
                console.error(error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }

        // Crear Impuesto
        if (req.url === '/api/impuestos' && req.method === 'POST') {
            try {
                await runMiddleware(req, res, authenticateJWT);
                // Validar admin? (Opcional, pero recomendado)

                const body = await parseBody(req);
                const { nombre, porcentaje, valor_fijo } = body;

                if (!nombre) throw new Error('El nombre es obligatorio');

                await query('INSERT INTO impuesto (nombre, porcentaje, valor_fijo, activo) VALUES (?, ?, ?, TRUE)',
                    [nombre, porcentaje || 0, valor_fijo || 0]);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Impuesto creado' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }

        // Editar Impuesto
        if (req.url.startsWith('/api/impuestos/') && req.method === 'PUT' && !req.url.includes('/activar')) {
            try {
                await runMiddleware(req, res, authenticateJWT);
                const id = req.url.split('/')[3];
                const body = await parseBody(req);
                const { nombre, porcentaje, valor_fijo } = body;

                await query('UPDATE impuesto SET nombre = ?, porcentaje = ?, valor_fijo = ? WHERE id = ?',
                    [nombre, porcentaje || 0, valor_fijo || 0, id]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Impuesto actualizado' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }

        // Eliminar Impuesto (Sin Restricciones - Snapshotting protege facturas viejas)
        if (req.url.startsWith('/api/impuestos/') && req.method === 'DELETE') {
            try {
                await runMiddleware(req, res, authenticateJWT);
                const id = req.url.split('/')[3];

                await query('DELETE FROM impuesto WHERE id = ?', [id]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Impuesto eliminado correctamente' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Error: ' + error.message }));
            }
            return;
        }

        // Activar Impuesto (Set as Default)
        if (req.url.startsWith('/api/impuestos/') && req.url.includes('/activar') && req.method === 'PUT') {
            try {
                await runMiddleware(req, res, authenticateJWT);
                const id = req.url.split('/')[3];

                // 1. Obtener datos del impuesto a activar
                const results = await query('SELECT * FROM impuesto WHERE id = ?', [id]);
                if (results.length === 0) throw new Error('Impuesto no encontrado');
                const target = results[0];

                // 2. Actualizar Configuración Global
                await ConfiguracionDAO.update('finanzas.impuestos.iva_porcentaje', target.porcentaje);
                await ConfiguracionDAO.update('finanzas.impuestos.iva_valor_fijo', target.valor_fijo || 0);
                await ConfiguracionDAO.update('finanzas.impuestos.nombre_activo', target.nombre);

                // Recargar caché config
                await configuracionLoader.reloadClave('finanzas.impuestos.iva_porcentaje');
                await configuracionLoader.reloadClave('finanzas.impuestos.iva_valor_fijo');
                await configuracionLoader.reloadClave('finanzas.impuestos.nombre_activo');

                // 3. Visual: Marcar en tabla (opcional, legacy column)
                await query('UPDATE impuesto SET seleccionado = FALSE');
                await query('UPDATE impuesto SET seleccionado = TRUE WHERE id = ?', [id]);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Impuesto activado globalmente' }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: error.message }));
            }
            return;
        }
    }

    // 404 - Ruta no encontrada (solo si no se ha enviado respuesta)
    if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>404 - Página no encontrada</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 50px; text-align: center; }
                h1 { color: #333; }
                p { color: #666; }
            </style>
        </head>
        <body>
            <h1>404 - Página no encontrada</h1>
            <p>La ruta solicitada no existe: ${req.url}</p>
            <a href="/">Volver al inicio</a>
        </body>
        </html>
    `);
    }
});

// Helper para insertar o actualizar configuración (Upsert simplificado)
async function upsertConfig(clave, valor, tipo, categoria, descripcion) {
    const existe = await ConfiguracionDAO.getByClave(clave);
    if (existe) {
        await query("UPDATE configuracion SET valor = ?, publico = 1 WHERE clave = ?", [valor, clave]);
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

        // 1. Probar conexión a la base de datos (Con reintentos)
        let dbConnected = false;
        const maxRetries = 20;

        for (let i = 0; i < maxRetries; i++) {
            dbConnected = await testConnection();
            if (dbConnected) {
                console.log('✅ Conexión a base de datos establecida.');
                break;
            }
            console.log(`⏳ Esperando a la base de datos... (Intento ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!dbConnected) {
            console.error('❌ No se pudo establecer conexión con la base de datos tras varios intentos. Abortando...');
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
        // 3. Iniciar escucha de peticiones
        server.listen(PORT, () => {
            console.log('\n╔═══════════════════════════════════════╗');
            console.log('║   MV Inventario - Backend API          ║');
            console.log(`║   Servidor ejecutándose en puerto ${PORT} ║`);
            console.log('╚═══════════════════════════════════════╝\n');
            console.log('⭐ Nueva versión de factura (80mm) cargada.');

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
