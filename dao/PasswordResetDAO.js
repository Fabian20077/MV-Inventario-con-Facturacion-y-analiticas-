import { query } from '../config/database.js';

/**
 * DAO para gestionar tokens de recuperación de contraseña
 */
class PasswordResetDAO {
    /**
     * Crear un nuevo token de recuperación
     */
    async createToken(usuarioId, token, expiresAt) {
        const sql = `
            INSERT INTO password_reset_tokens (usuario_id, token, expires_at)
            VALUES (?, ?, ?)
        `;

        try {
            const result = await query(sql, [usuarioId, token, expiresAt]);
            return {
                success: true,
                tokenId: result.insertId
            };
        } catch (error) {
            console.error('Error creando token de recuperación:', error);
            throw error;
        }
    }

    /**
     * Buscar un token válido (no usado y no expirado)
     */
    async findValidToken(token) {
        const sql = `
            SELECT 
                prt.*,
                u.id as usuario_id,
                u.correo,
                u.nombre
            FROM password_reset_tokens prt
            INNER JOIN usuario u ON prt.usuario_id = u.id
            WHERE prt.token = ?
            AND prt.used = FALSE
            AND prt.expires_at > NOW()
            LIMIT 1
        `;

        try {
            const results = await query(sql, [token]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error('Error buscando token:', error);
            throw error;
        }
    }

    /**
     * Marcar un token como usado
     */
    async markTokenAsUsed(token) {
        const sql = `
            UPDATE password_reset_tokens
            SET used = TRUE
            WHERE token = ?
        `;

        try {
            await query(sql, [token]);
            return { success: true };
        } catch (error) {
            console.error('Error marcando token como usado:', error);
            throw error;
        }
    }

    /**
     * Eliminar tokens expirados (limpieza)
     */
    async deleteExpiredTokens() {
        const sql = `
            DELETE FROM password_reset_tokens
            WHERE expires_at < NOW()
            OR used = TRUE
        `;

        try {
            const result = await query(sql);
            return {
                success: true,
                deletedCount: result.affectedRows
            };
        } catch (error) {
            console.error('Error eliminando tokens expirados:', error);
            throw error;
        }
    }

    /**
     * Eliminar todos los tokens de un usuario
     */
    async deleteUserTokens(usuarioId) {
        const sql = `
            DELETE FROM password_reset_tokens
            WHERE usuario_id = ?
        `;

        try {
            await query(sql, [usuarioId]);
            return { success: true };
        } catch (error) {
            console.error('Error eliminando tokens del usuario:', error);
            throw error;
        }
    }
}

export default new PasswordResetDAO();
