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
                    seleccionado,
                    fecha_creacion,
                    ultima_actualizacion
                FROM impuesto 
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
                'SELECT * FROM impuesto WHERE id = ?',
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
            const { nombre, tipo, porcentaje = 0, valor_fijo = 0, activo = true, seleccionado = false } = datos;

            const [result] = await pool.query(`
                INSERT INTO impuesto 
                (nombre, tipo, porcentaje, valor_fijo, activo, seleccionado) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [nombre, tipo, porcentaje, valor_fijo, activo, seleccionado]);

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
            const { nombre, tipo, porcentaje, valor_fijo, activo, seleccionado } = datos;

            await pool.query(`
                UPDATE impuesto 
                SET nombre = ?, tipo = ?, porcentaje = ?, valor_fijo = ?, activo = ?, seleccionado = ?
                WHERE id = ?
            `, [nombre, tipo, porcentaje, valor_fijo, activo, seleccionado, id]);

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
            await pool.query('UPDATE impuesto SET activo = 0 WHERE id = ?', [id]);
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

    /**
     * Actualizar impuesto seleccionado (activar)
     */
    static async actualizarSeleccionado(id) {
        try {
            // Primero deseleccionar todos los impuestos
            await pool.query('UPDATE impuesto SET seleccionado = FALSE');
            
            // Luego seleccionar el impuesto especificado
            await pool.query('UPDATE impuesto SET seleccionado = TRUE WHERE id = ?', [id]);
            
            return { id, selected: true };
        } catch (error) {
            throw new Error(`Error al actualizar impuesto seleccionado: ${error.message}`);
        }
    }
}

export default ImpuestoDAO;