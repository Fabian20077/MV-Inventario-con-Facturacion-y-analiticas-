import { verifyToken } from '../auth/jwt.js';

/**
 * Middleware para autenticar requests con JWT
 * Verifica que el token sea válido y agrega los datos del usuario a req.user
 */
export function authenticateJWT(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Token de autenticación no proporcionado'
        }));
        return;
    }

    // Extraer token del header "Bearer TOKEN"
    const token = authHeader.split(' ')[1];

    if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Formato de token inválido'
        }));
        return;
    }

    // Verificar token
    const decoded = verifyToken(token);

    if (!decoded) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            message: 'Token inválido o expirado'
        }));
        return;
    }

    // Agregar datos del usuario al request
    req.user = decoded;
    next();
}

/**
 * Middleware opcional de autenticación
 * Si hay token, lo verifica. Si no hay, continúa sin agregar req.user
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            const decoded = verifyToken(token);
            if (decoded) {
                req.user = decoded;
            }
        }
    }

    next();
}
