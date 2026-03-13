/**
 * Helpers para manejar peticiones HTTP
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Parsea el cuerpo de una petición JSON
 */
export const parseBody = (req) => {
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
 * Ejecuta un middleware de forma asíncrona
 */
export const runMiddleware = (req, res, middleware) => {
    return new Promise((resolve, reject) => {
        middleware(req, res, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
};

/**
 * Parsea los parámetros de query string de una URL
 */
export const parseQueryParams = (url) => {
    const params = {};
    const queryString = url.split('?')[1];
    if (queryString) {
        const pairs = queryString.split('&');
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
        });
    }
    return params;
};

/**
 * Verifica el token JWT y devuelve el usuario decodificado o null
 * También envía respuesta de error si el token es inválido
 */
export const verifyToken = (req, res) => {
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        // Intento alternativo: token en query
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
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        if (err && err.name === 'TokenExpiredError') {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'token_expired', message: 'Token expirado' }));
        } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'invalid_token', message: 'Token inválido' }));
        }
        return null;
    }
};
