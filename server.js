import http from 'http';
import { testConnection, query } from './config/database.js';
import UsuarioDAO from './dao/UsuarioDAO.js';
import ProductoDAO from './dao/ProductoDAO.js';
import PasswordResetDAO from './dao/PasswordResetDAO.js';
import ReportesService from './routes/reportes.js';
import { generateToken } from './auth/jwt.js';
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

const PORT = 3000;

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

            if (!tokenData) {
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

            console.log(`✅ Contraseña actualizada para usuario: ${tokenData.email}`);

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

            const resultado = await ProductoDAO.actualizar(id, datos);

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

            const { id_producto, cantidad, motivo, usuario_id } = await parseBody(req);

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

            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Salida registrada exitosamente'
            }));
        } catch (error) {
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

    // ==================== ANALYTICS ====================

    // Métricas del mes actual
    if (req.url === '/api/analytics/metricas-mes' && req.method === 'GET') {
        try {
            const mesActual = new Date().getMonth() + 1;
            const añoActual = new Date().getFullYear();

            // Calcular ventas del mes (salidas)
            const ventasSql = `
                SELECT 
                    COALESCE(SUM(m.cantidad), 0) as total_unidades,
                    COALESCE(SUM(m.cantidad * p.precio_venta), 0) as total_ventas
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'salida' 
                AND MONTH(m.fecha) = ? 
                AND YEAR(m.fecha) = ?
            `;
            const ventas = await query(ventasSql, [mesActual, añoActual]);

            // Calcular compras del mes (entradas)
            const comprasSql = `
                SELECT COALESCE(SUM(m.cantidad * p.precio_compra), 0) as total_compras
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'entrada' 
                AND MONTH(m.fecha) = ? 
                AND YEAR(m.fecha) = ?
            `;
            const compras = await query(comprasSql, [mesActual, añoActual]);

            const ganancia = ventas[0].total_ventas - compras[0].total_compras;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: {
                    ganancia_neta: Math.round(ganancia),
                    ventas_unidades: ventas[0].total_unidades,
                    total_ventas: Math.round(ventas[0].total_ventas),
                    total_compras: Math.round(compras[0].total_compras)
                }
            }));
        } catch (error) {
            console.error('Error en métricas:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Error al calcular métricas' }));
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
                    COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * p.precio_venta ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.cantidad * p.precio_compra ELSE 0 END), 0) as ganancia
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.fecha >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                GROUP BY mes, nombre_mes
                ORDER BY mes ASC
            `;

            const ganancias = await query(sql);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: ganancias.map(g => ({
                    mes: g.nombre_mes,
                    ganancia: Math.round(g.ganancia)
                }))
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
                    stock_minimo as minimo
                FROM producto
                WHERE activo = TRUE 
                AND cantidad <= stock_minimo
                ORDER BY cantidad ASC
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

    // 404 - Ruta no encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        message: 'Ruta no encontrada'
    }));
});

// Iniciar servidor
server.listen(PORT, async () => {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║   MV Inventario - Backend API          ║');
    console.log('║   Servidor ejecutándose en puerto 3000 ║');
    console.log('╚═══════════════════════════════════════╝\n');

    // Probar conexión a MySQL
    await testConnection();

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
    console.log('   ESTADÍSTICAS:');
    console.log('   GET  /api/stats\n');
    console.log('   REPORTES:');
    console.log('   GET  /api/reportes/productos/csv');
    console.log('   GET  /api/reportes/productos/excel');
    console.log('   GET  /api/reportes/movimientos/csv');
    console.log('   GET  /api/reportes/movimientos/excel\n');
    console.log('   OTROS:');
    console.log('   GET  /api/health\n');
});

