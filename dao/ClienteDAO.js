import pool from '../config/database.js';

class ClienteDAO {
    // Obtener todos los clientes
    async obtenerTodos() {
        try {
            const [clientes] = await pool.promise().query(
                'SELECT * FROM clientes WHERE activo = TRUE ORDER BY nombre ASC'
            );
            return clientes;
        } catch (error) {
            console.error('Error al obtener clientes:', error);
            throw error;
        }
    }

    // Obtener cliente por ID
    async obtenerPorId(id) {
        try {
            const [clientes] = await pool.promise().query(
                'SELECT * FROM clientes WHERE id = ? AND activo = TRUE',
                [id]
            );
            return clientes[0] || null;
        } catch (error) {
            console.error('Error al obtener cliente:', error);
            throw error;
        }
    }

    // Crear nuevo cliente
    async crear(datos) {
        try {
            const { nombre, nit, direccion, telefono, correo } = datos;
            
            const [result] = await pool.promise().query(
                'INSERT INTO clientes (nombre, nit, direccion, telefono, correo) VALUES (?, ?, ?, ?, ?)',
                [nombre, nit, direccion, telefono, correo]
            );
            
            return {
                id: result.insertId,
                ...datos
            };
        } catch (error) {
            console.error('Error al crear cliente:', error);
            throw error;
        }
    }

    // Actualizar cliente
    async actualizar(id, datos) {
        try {
            const { nombre, nit, direccion, telefono, correo } = datos;
            
            await pool.promise().query(
                'UPDATE clientes SET nombre = ?, nit = ?, direccion = ?, telefono = ?, correo = ? WHERE id = ?',
                [nombre, nit, direccion, telefono, correo, id]
            );
            
            return await this.obtenerPorId(id);
        } catch (error) {
            console.error('Error al actualizar cliente:', error);
            throw error;
        }
    }

    // Eliminar cliente (soft delete)
    async eliminar(id) {
        try {
            await pool.promise().query(
                'UPDATE clientes SET activo = FALSE WHERE id = ?',
                [id]
            );
        } catch (error) {
            console.error('Error al eliminar cliente:', error);
            throw error;
        }
    }

    // Buscar cliente por nombre o NIT
    async buscar(termino) {
        try {
            const [clientes] = await pool.promise().query(
                'SELECT * FROM clientes WHERE (nombre LIKE ? OR nit LIKE ?) AND activo = TRUE',
                [`%${termino}%`, `%${termino}%`]
            );
            return clientes;
        } catch (error) {
            console.error('Error al buscar cliente:', error);
            throw error;
        }
    }
}

export default new ClienteDAO();
