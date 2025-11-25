import jwt from 'jsonwebtoken';

// Clave secreta para firmar tokens (en producción debe estar en variable de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'inventario_mv_secret_key_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generar un token JWT para un usuario
 * @param {Object} user - Datos del usuario (id, email, rol, etc.)
 * @returns {string} Token JWT firmado
 */
export function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.correo || user.email,
        nombre: user.nombre,
        rol_id: user.rol_id,
        rol_nombre: user.rol_nombre
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verificar y decodificar un token JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object|null} Datos decodificados del token o null si es inválido
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('Error verificando token:', error.message);
        return null;
    }
}

/**
 * Decodificar un token sin verificar (útil para debugging)
 * @param {string} token - Token JWT a decodificar
 * @returns {Object|null} Datos decodificados o null si es inválido
 */
export function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}
