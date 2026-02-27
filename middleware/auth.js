import jwt from 'jsonwebtoken';
import { decodeToken } from '../auth/jwt.js';
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para autenticar requests con JWT
 * Verifica que el token sea válido y agrega los datos del usuario a req.user
 */
export function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        // Intento alternativo: token en query (históricamente usado)
        if (authHeader && authHeader.includes('?')) {
            try {
                const url = new URL('http://localhost' + req.url);
                token = url.searchParams.get('token');
            } catch (e) {
                // ignore parse errors
            }
        }
    }

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Token de autenticación no proporcionado'
        }));
        return;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err && err.name === 'TokenExpiredError') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'token_expired', message: 'Token expirado' }));
        } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'invalid_token', message: 'Token inválido' }));
        }
    }
}

/**
 * Middleware opcional de autenticación
 * Si hay token, lo verifica. Si no hay, continúa sin agregar req.user
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (e) {
            // ignore verification errors for optional auth
        }
    }
    next();
}
