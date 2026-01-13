/**
 * FacturaDAO.js
 * Capa de acceso a datos para el módulo de facturación
 * 
 * Responsabilidades:
 * - CRUD de facturas
 * - CRUD de detalles de factura
 * - Generación de números de factura secuenciales
 * - Cálculos de totales e impuestos
 * - Auditoría y anulación de facturas
 */

import pool from '../config/database.js';

class FacturaDAO {
    /**
     * Obtener el próximo número de factura disponible
     * @returns {Promise<string>} Número de factura formateado (ej: FAC-2026-000001)
     */
    static async obtenerProximoNumeroFactura() {
        try {
            const [resultado] = await pool.query(
                'SELECT proximo_numero, prefijo, prefijo_year, longitud_numero FROM secuencia_documento WHERE tipo_documento = ?',
                ['FACTURA']
            );

            if (!resultado || resultado.length === 0) {
                throw new Error('No hay configuración de secuencia para facturas');
            }

            const config = resultado[0];
            let numeroFormato = String(config.proximo_numero).padStart(config.longitud_numero, '0');
            
            let numeroFactura = config.prefijo + '-' + numeroFormato;
            if (config.prefijo_year) {
                const year = new Date().getFullYear();
                numeroFactura = config.prefijo + '-' + year + '-' + numeroFormato;
            }

            return numeroFactura;
        } catch (error) {
            throw new Error(`Error al obtener número de factura: ${error.message}`);
        }
    }

    /**
     * Incrementar el contador de factura
     * @returns {Promise<void>}
     */
    static async incrementarSecuenciaFactura() {
        try {
            await pool.query(
                'UPDATE secuencia_documento SET proximo_numero = proximo_numero + 1 WHERE tipo_documento = ?',
                ['FACTURA']
            );
        } catch (error) {
            throw new Error(`Error al actualizar secuencia: ${error.message}`);
        }
    }

    /**
     * Crear una nueva factura
     * @param {Object} datosFactura - Datos de la factura
     * @param {number} datosFactura.usuario_id - ID del usuario que emite
     * @param {Array} datosFactura.detalles - Array de detalles {producto_id, cantidad}
     * @param {number} datosFactura.iva_porcentaje - Porcentaje de IVA
     * @param {string} datosFactura.cliente_nombre - Nombre del cliente/consumidor
     * @param {string} datosFactura.observaciones - Notas adicionales
     * @returns {Promise<Object>} Factura creada con ID
     */
    static async crearFactura(datosFactura) {
        const conexion = await pool.getConnection();
        
        try {
            await conexion.beginTransaction();

            const { usuario_id, detalles, iva_porcentaje = 19, observaciones = '', cliente_nombre = 'Cliente General' } = datosFactura;

            // 1. Obtener número de factura
            const numeroFactura = await this.obtenerProximoNumeroFactura();

            // 2. Calcular subtotal y detalles
            let subtotal = 0;
            const detallesConPrecio = [];

            for (const detalle of detalles) {
                const [producto] = await conexion.query(
                    'SELECT id, nombre, codigo, precio_venta FROM producto WHERE id = ?',
                    [detalle.producto_id]
                );

                if (!producto || producto.length === 0) {
                    throw new Error(`Producto ${detalle.producto_id} no encontrado`);
                }

                const prod = producto[0];
                const subtotalLinea = prod.precio_venta * detalle.cantidad;
                subtotal += subtotalLinea;

                detallesConPrecio.push({
                    producto_id: detalle.producto_id,
                    nombre_producto: prod.nombre,
                    codigo_producto: prod.codigo,
                    cantidad: detalle.cantidad,
                    precio_unitario: prod.precio_venta,
                    subtotal_linea: subtotalLinea
                });
            }

            // 3. Calcular impuesto
            const ivaMonto = Math.round(subtotal * (iva_porcentaje / 100));
            const total = subtotal + ivaMonto;

            // 4. Crear factura
            const [resultFactura] = await conexion.query(
                `INSERT INTO factura 
                 (numero_factura, usuario_id, cliente_nombre, subtotal, iva_porcentaje, iva_monto, total, observaciones, estado) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'emitida')`,
                [numeroFactura, usuario_id, cliente_nombre, subtotal, iva_porcentaje, ivaMonto, total, observaciones]
            );

            const facturaId = resultFactura.insertId;

            // 5. Crear detalles de factura y actualizar stock
            for (const detalle of detallesConPrecio) {
                await conexion.query(
                    `INSERT INTO detalle_factura 
                     (factura_id, producto_id, nombre_producto, codigo_producto, cantidad, precio_unitario, subtotal_linea) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        facturaId,
                        detalle.producto_id,
                        detalle.nombre_producto,
                        detalle.codigo_producto,
                        detalle.cantidad,
                        detalle.precio_unitario,
                        detalle.subtotal_linea
                    ]
                );

                // Actualizar stock
                await conexion.query(
                    'UPDATE producto SET cantidad = cantidad - ? WHERE id = ?',
                    [detalle.cantidad, detalle.producto_id]
                );
            }

            // 6. Incrementar secuencia
            await this.incrementarSecuenciaFactura();

            await conexion.commit();

            return {
                id: facturaId,
                numero_factura: numeroFactura,
                fecha_emision: new Date(),
                usuario_id,
                cliente_nombre,
                subtotal,
                iva_porcentaje,
                iva_monto: ivaMonto,
                total,
                detalles: detallesConPrecio,
                observaciones,
                estado: 'emitida'
            };

        } catch (error) {
            await conexion.rollback();
            throw new Error(`Error al crear factura: ${error.message}`);
        } finally {
            conexion.release();
        }
    }

    /**
     * Obtener una factura por ID con sus detalles
     * @param {number} facturaId - ID de la factura
     * @returns {Promise<Object>} Datos de la factura
     */
    static async obtenerFacturaPorId(facturaId) {
        try {
            const [factura] = await pool.query(
                `SELECT f.*, u.nombre as usuario_nombre 
                 FROM factura f 
                 JOIN usuario u ON f.usuario_id = u.id 
                 WHERE f.id = ?`,
                [facturaId]
            );

            if (!factura || factura.length === 0) {
                return null;
            }

            const [detalles] = await pool.query(
                'SELECT * FROM detalle_factura WHERE factura_id = ?',
                [facturaId]
            );

            return {
                ...factura[0],
                detalles: detalles || []
            };
        } catch (error) {
            throw new Error(`Error al obtener factura: ${error.message}`);
        }
    }

    /**
     * Listar facturas con filtros
     * @param {Object} filtros - {estado, fecha_desde, fecha_hasta, usuario_id, pagina, limite}
     * @returns {Promise<Object>} {facturas, total, paginas}
     */
    static async listarFacturas(filtros = {}) {
        try {
            const {
                estado = null,
                fecha_desde = null,
                fecha_hasta = null,
                usuario_id = null,
                pagina = 1,
                limite = 20
            } = filtros;

            let query = 'SELECT f.*, u.nombre as usuario_nombre FROM factura f JOIN usuario u ON f.usuario_id = u.id WHERE 1=1';
            const params = [];

            if (estado && estado !== 'todas') {
                query += ' AND f.estado = ?';
                params.push(estado);
            }

            if (fecha_desde) {
                query += ' AND f.fecha_emision >= ?';
                params.push(fecha_desde);
            }

            if (fecha_hasta) {
                query += ' AND f.fecha_emision <= ?';
                params.push(fecha_hasta + ' 23:59:59');
            }

            if (usuario_id) {
                query += ' AND f.usuario_id = ?';
                params.push(usuario_id);
            }

            // Total
            const [resultTotal] = await pool.query(
                'SELECT COUNT(*) as total FROM (' + query + ') as sub',
                params
            );
            const total = resultTotal[0].total;

            // Paginación
            const offset = (pagina - 1) * limite;
            query += ' ORDER BY f.fecha_emision DESC LIMIT ? OFFSET ?';
            params.push(limite, offset);

            const [facturas] = await pool.query(query, params);

            return {
                facturas: facturas || [],
                total,
                paginas: Math.ceil(total / limite),
                pagina_actual: pagina
            };
        } catch (error) {
            throw new Error(`Error al listar facturas: ${error.message}`);
        }
    }

    /**
     * Anular una factura
     * @param {number} facturaId - ID de la factura a anular
     * @param {number} usuarioId - ID del usuario que anula
     * @param {string} motivo - Motivo de la anulación
     * @returns {Promise<Object>} Factura anulada
     */
    static async anularFactura(facturaId, usuarioId, motivo = '') {
        const conexion = await pool.getConnection();
        
        try {
            await conexion.beginTransaction();

            // 1. Obtener factura
            const [factura] = await conexion.query(
                'SELECT * FROM factura WHERE id = ?',
                [facturaId]
            );

            if (!factura || factura.length === 0) {
                throw new Error('Factura no encontrada');
            }

            if (factura[0].estado === 'anulada') {
                throw new Error('La factura ya fue anulada');
            }

            // 2. Obtener detalles
            const [detalles] = await conexion.query(
                'SELECT * FROM detalle_factura WHERE factura_id = ?',
                [facturaId]
            );

            // 3. Revertir stock
            for (const detalle of detalles) {
                await conexion.query(
                    'UPDATE producto SET cantidad = cantidad + ? WHERE id = ?',
                    [detalle.cantidad, detalle.producto_id]
                );
            }

            // 4. Marcar factura como anulada
            await conexion.query(
                `UPDATE factura 
                 SET estado = 'anulada', motivo_anulacion = ?, usuario_anulacion_id = ?, fecha_anulacion = NOW() 
                 WHERE id = ?`,
                [motivo, usuarioId, facturaId]
            );

            await conexion.commit();

            return await this.obtenerFacturaPorId(facturaId);

        } catch (error) {
            await conexion.rollback();
            throw new Error(`Error al anular factura: ${error.message}`);
        } finally {
            conexion.release();
        }
    }

    /**
     * Obtener resumen de ventas diarias
     * @param {string} fecha - Fecha a consultar (YYYY-MM-DD)
     * @returns {Promise<Object>} Totales del día
     */
    static async obtenerResumenDia(fecha) {
        try {
            const [resultado] = await pool.query(
                `SELECT 
                    COUNT(*) as cantidad_facturas,
                    SUM(subtotal) as total_subtotal,
                    SUM(iva_monto) as total_iva,
                    SUM(total) as total_ventas
                 FROM factura 
                 WHERE DATE(fecha_emision) = ? AND estado != 'anulada'`,
                [fecha]
            );

            return resultado[0] || {
                cantidad_facturas: 0,
                total_subtotal: 0,
                total_iva: 0,
                total_ventas: 0
            };
        } catch (error) {
            throw new Error(`Error al obtener resumen: ${error.message}`);
        }
    }

    /**
     * Obtener detalles de una factura
     * @param {number} facturaId - ID de la factura
     * @returns {Promise<Array>} Detalles
     */
    static async obtenerDetallesFactura(facturaId) {
        try {
            const [detalles] = await pool.query(
                'SELECT * FROM detalle_factura WHERE factura_id = ? ORDER BY id ASC',
                [facturaId]
            );

            return detalles || [];
        } catch (error) {
            throw new Error(`Error al obtener detalles: ${error.message}`);
        }
    }
}

export default FacturaDAO;
