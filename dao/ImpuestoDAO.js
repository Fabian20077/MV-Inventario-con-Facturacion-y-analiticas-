/**
 * ImpuestoDAO.js
 * Capa de acceso a datos para el módulo de impuestos
 */

import pool from '../config/database.js';

class ImpuestoDAO {
    /**
     * Obtener todos los impuestos activos
     */
    static async obtenerTodos() {
        try {
            const [rows] = await pool.query(`
                SELECT 
                    id, 
                    nombre, 
                    tipo, 
                    porcentaje, 
                    valor_fijo, 
                    activo,
                    fecha_creacion,
                    ultima_actualizacion
                FROM impuestos 
                ORDER BY nombre ASC
            `);
            return rows;
        } catch (error) {
            throw new Error(`Error al obtener impuestos: ${error.message}`);
        }
    }

    /**
     * Obtener impuesto por ID
     */
    static async obtenerPorId(id) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM impuestos WHERE id = ?', 
                [id]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            throw new Error(`Error al obtener impuesto: ${error.message}`);
        }
    }

    /**
     * Crear nuevo impuesto
     */
    static async crear(datos) {
        try {
            const { nombre, tipo, porcentaje = 0, valor_fijo = 0, activo = true } = datos;
            
            const [result] = await pool.query(`
                INSERT INTO impuestos 
                (nombre, tipo, porcentaje, valor_fijo, activo) 
                VALUES (?, ?, ?, ?, ?)
            `, [nombre, tipo, porcentaje, valor_fijo, activo]);

            return await this.obtenerPorId(result.insertId);
        } catch (error) {
            throw new Error(`Error al crear impuesto: ${error.message}`);
        }
    }

    /**
     * Actualizar impuesto existente
     */
    static async actualizar(id, datos) {
        try {
            const { nombre, tipo, porcentaje, valor_fijo, activo } = datos;
            
            await pool.query(`
                UPDATE impuestos 
                SET nombre = ?, tipo = ?, porcentaje = ?, valor_fijo = ?, activo = ?
                WHERE id = ?
            `, [nombre, tipo, porcentaje, valor_fijo, activo, id]);

            return await this.obtenerPorId(id);
        } catch (error) {
            throw new Error(`Error al actualizar impuesto: ${error.message}`);
        }
    }

    /**
     * Eliminar impuesto (soft delete - solo desactivar)
     */
    static async eliminar(id) {
        try {
            await pool.query('UPDATE impuestos SET activo = 0 WHERE id = ?', [id]);
            return { id, deleted: true };
        } catch (error) {
            throw new Error(`Error al eliminar impuesto: ${error.message}`);
        }
    }

    /**
     * Verificar si un impuesto está en uso
     */
    static async estaEnUso(id) {
        try {
            // Verificar en facturas recientes
            const [ventasRows] = await pool.query(`
                SELECT COUNT(*) as count 
                FROM factura 
                WHERE impuesto_id = ? AND estado != 'anulada'
            `, [id]);
            
            return ventasRows[0].count > 0;
        } catch (error) {
            throw new Error(`Error al verificar uso de impuesto: ${error.message}`);
        }
    }
}

export default ImpuestoDAO;