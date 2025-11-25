import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';

class UsuarioDAO {
    /**
     * Crear un nuevo usuario con contraseña cifrada
     */
    async crear(usuario) {
        try {
            // Cifrar la contraseña con BCrypt (10 rounds de salt)
            const passwordHash = await bcrypt.hash(usuario.password, 10);
            
            const sql = `
                INSERT INTO usuario (nombre, correo, password, rol_id, activo)
                VALUES (?, ?, ?, ?, ?)
            `;
            
            const params = [
                usuario.nombre,
                usuario.correo,
                passwordHash,  // Guardar el hash, NO la contraseña en texto plano
                usuario.rol_id || 3,  // Por defecto rol Cliente (id=3)
                usuario.activo !== undefined ? usuario.activo : true
            ];
            
            const result = await query(sql, params);
            return {
                success: true,
                id: result.insertId,
                message: 'Usuario creado exitosamente'
            };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return {
                    success: false,
                    message: 'El correo ya está registrado'
                };
            }
            console.error('Error en UsuarioDAO.crear:', error);
            throw error;
        }
    }

    /**
     * Autenticar usuario (login) comparando contraseña con BCrypt
     */
  async autenticar(correo, password) {
    try {
        console.log('🔍 UsuarioDAO.autenticar llamado con:', correo); // ← AGREGAR
        
        const sql = `
            SELECT u.id, u.nombre, u.correo, u.password, u.activo, 
                   u.fecha_creacion, u.ultimo_acceso,
                   r.id as rol_id, r.nombre as rol_nombre
            FROM usuario u
            INNER JOIN rol r ON u.rol_id = r.id
            WHERE u.correo = ?
        `;
        
        const usuarios = await query(sql, [correo]);
        console.log('📊 Usuarios encontrados:', usuarios.length); // ← AGREGAR
        
        if (usuarios.length === 0) {
            console.log('❌ Usuario no encontrado'); // ← AGREGAR
            return {
                success: false,
                message: 'Usuario no encontrado'
            };
        }
        
        const usuario = usuarios[0];
        console.log('👤 Usuario encontrado:', usuario.correo, 'Activo:', usuario.activo); // ← AGREGAR
        
        // Verificar si el usuario está activo
        if (!usuario.activo) {
            console.log('❌ Usuario inactivo'); // ← AGREGAR
            return {
                success: false,
                message: 'Usuario inactivo'
            };
        }
        
        // Comparar la contraseña ingresada con el hash almacenado
        console.log('🔐 Verificando contraseña...'); // ← AGREGAR
        const passwordValida = await bcrypt.compare(password, usuario.password);
        console.log('🔐 Contraseña válida:', passwordValida); // ← AGREGAR
        
        if (!passwordValida) {
            console.log('❌ Contraseña incorrecta'); // ← AGREGAR
            return {
                success: false,
                message: 'Contraseña incorrecta'
            };
        }
        
        // ... resto del código
            
            // Actualizar último acceso
            await query('UPDATE usuario SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ?', [usuario.id]);
            
            // NO devolver el password en la respuesta
            delete usuario.password;
            
            return {
                success: true,
                usuario: usuario,
                message: 'Autenticación exitosa'
            };
        } catch (error) {
            console.error('Error en UsuarioDAO.autenticar:', error);
            throw error;
        }
    }

    /**
     * Buscar usuario por correo
     */
    async buscarPorCorreo(correo) {
        try {
            const sql = `
                SELECT u.id, u.nombre, u.correo, u.activo, 
                       u.fecha_creacion, u.ultimo_acceso,
                       r.id as rol_id, r.nombre as rol_nombre
                FROM usuario u
                INNER JOIN rol r ON u.rol_id = r.id
                WHERE u.correo = ?
            `;
            
            const usuarios = await query(sql, [correo]);
            return usuarios.length > 0 ? usuarios[0] : null;
        } catch (error) {
            console.error('Error en UsuarioDAO.buscarPorCorreo:', error);
            throw error;
        }
    }

    /**
     * Buscar usuario por ID
     */
    async buscarPorId(id) {
        try {
            const sql = `
                SELECT u.id, u.nombre, u.correo, u.activo, 
                       u.fecha_creacion, u.ultimo_acceso,
                       r.id as rol_id, r.nombre as rol_nombre
                FROM usuario u
                INNER JOIN rol r ON u.rol_id = r.id
                WHERE u.id = ?
            `;
            
            const usuarios = await query(sql, [id]);
            return usuarios.length > 0 ? usuarios[0] : null;
        } catch (error) {
            console.error('Error en UsuarioDAO.buscarPorId:', error);
            throw error;
        }
    }

    /**
     * Listar todos los usuarios
     */
    async listar() {
        try {
            const sql = `
                SELECT u.id, u.nombre, u.correo, u.activo, 
                       u.fecha_creacion, u.ultimo_acceso,
                       r.id as rol_id, r.nombre as rol_nombre
                FROM usuario u
                INNER JOIN rol r ON u.rol_id = r.id
                WHERE u.activo = TRUE
                ORDER BY u.fecha_creacion DESC
            `;
            
            return await query(sql);
        } catch (error) {
            console.error('Error en UsuarioDAO.listar:', error);
            throw error;
        }
    }

    /**
     * Actualizar usuario
     */
    async actualizar(id, datos) {
        try {
            const campos = [];
            const valores = [];
            
            if (datos.nombre) {
                campos.push('nombre = ?');
                valores.push(datos.nombre);
            }
            if (datos.correo) {
                campos.push('correo = ?');
                valores.push(datos.correo);
            }
            if (datos.password) {
                // Cifrar la nueva contraseña
                const passwordHash = await bcrypt.hash(datos.password, 10);
                campos.push('password = ?');
                valores.push(passwordHash);
            }
            if (datos.rol_id) {
                campos.push('rol_id = ?');
                valores.push(datos.rol_id);
            }
            if (datos.activo !== undefined) {
                campos.push('activo = ?');
                valores.push(datos.activo);
            }
            
            if (campos.length === 0) {
                return { success: false, message: 'No hay datos para actualizar' };
            }
            
            valores.push(id);
            
            const sql = `UPDATE usuario SET ${campos.join(', ')} WHERE id = ?`;
            const result = await query(sql, valores);
            
            return {
                success: result.affectedRows > 0,
                message: result.affectedRows > 0 ? 'Usuario actualizado' : 'Usuario no encontrado'
            };
        } catch (error) {
            console.error('Error en UsuarioDAO.actualizar:', error);
            throw error;
        }
    }

    /**
     * Eliminar usuario (desactivar)
     */
    async eliminar(id) {
        try {
            const sql = 'UPDATE usuario SET activo = FALSE WHERE id = ?';
            const result = await query(sql, [id]);
            
            return {
                success: result.affectedRows > 0,
                message: result.affectedRows > 0 ? 'Usuario desactivado' : 'Usuario no encontrado'
            };
        } catch (error) {
            console.error('Error en UsuarioDAO.eliminar:', error);
            throw error;
        }
    }

    /**
     * Cambiar contraseña
     */
    async cambiarPassword(id, passwordActual, passwordNueva) {
        try {
            // Primero obtener el hash actual
            const sqlGet = 'SELECT password FROM usuario WHERE id = ?';
            const usuarios = await query(sqlGet, [id]);
            
            if (usuarios.length === 0) {
                return {
                    success: false,
                    message: 'Usuario no encontrado'
                };
            }
            
            // Verificar contraseña actual
            const passwordValida = await bcrypt.compare(passwordActual, usuarios[0].password);
            
            if (!passwordValida) {
                return {
                    success: false,
                    message: 'Contraseña actual incorrecta'
                };
            }
            
            // Actualizar con la nueva contraseña
            const passwordHash = await bcrypt.hash(passwordNueva, 10);
            const sqlUpdate = 'UPDATE usuario SET password = ? WHERE id = ?';
            await query(sqlUpdate, [passwordHash, id]);
            
            return {
                success: true,
                message: 'Contraseña actualizada exitosamente'
            };
        } catch (error) {
            console.error('Error en UsuarioDAO.cambiarPassword:', error);
            throw error;
        }
    }
}

export default new UsuarioDAO();