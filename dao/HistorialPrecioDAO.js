/**
 * HistorialPrecioDAO.js
 * Capa de acceso a datos para el historial de precios
 * 
 * Responsabilidades:
 * - Registro automático de cambios de precio
 * - Consulta de historial
 * - Análisis de tendencias de precios
 * - Cálculo de márgenes históricos
 */

import { query } from '../config/database.js';

class HistorialPrecioDAO {
    /**
     * Registrar un cambio de precio (se llama automáticamente cuando se actualiza un producto)
     * @param {number} producto_id - ID del producto
     * @param {number} precioCompraAnterior - Precio anterior
     * @param {number} precioCompraNuevo - Nuevo precio de compra
     * @param {number} precioVentaAnterior - Precio de venta anterior
     * @param {number} precioVentaNuevo - Nuevo precio de venta
     * @param {number} usuario_id - ID del usuario que realizó el cambio
     * @param {string} razon - Motivo del cambio
     * @returns {Promise<Object>} Registro creado
     */
    static async registrarCambio(
        producto_id,
        precioCompraAnterior,
        precioCompraNuevo,
        precioVentaAnterior,
        precioVentaNuevo,
        usuario_id,
        razon = ''
    ) {
        try {
            // Asegurar tipos numéricos para comparación correcta
            const pcAnt = Number(precioCompraAnterior);
            const pcNue = Number(precioCompraNuevo);
            const pvAnt = Number(precioVentaAnterior);
            const pvNue = Number(precioVentaNuevo);

            console.log('🔍 DEBUG registrarCambio:', {
                precioCompraAnterior: pcAnt,
                precioCompraNuevo: pcNue,
                precioVentaAnterior: pvAnt,
                precioVentaNuevo: pvNue,
                cambioCompra: pcNue !== pcAnt,
                cambioVenta: pvNue !== pvAnt,
                huboAlgunCambio: (pcNue !== pcAnt || pvNue !== pvAnt)
            });

            // Solo registrar si hay cambio real
            if (pcNue === pcAnt && pvNue === pvAnt) {
                console.log('⚠️ No hay cambio real - no se registra');
                return null;
            }

            const result = await query(
                `INSERT INTO historial_precio 
                 (producto_id, precio_compra_anterior, precio_compra_nuevo, 
                  precio_venta_anterior, precio_venta_nuevo, usuario_id, razon) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    producto_id,
                    precioCompraAnterior,
                    precioCompraNuevo,
                    precioVentaAnterior,
                    precioVentaNuevo,
                    usuario_id,
                    razon
                ]
            );

            console.log('✅ Cambio registrado con ID:', result.insertId);

            return {
                id: result.insertId,
                producto_id,
                precio_compra_anterior: precioCompraAnterior,
                precio_compra_nuevo: precioCompraNuevo,
                precio_venta_anterior: precioVentaAnterior,
                precio_venta_nuevo: precioVentaNuevo,
                razon,
                usuario_id,
                fecha_cambio: new Date()
            };
        } catch (error) {
            console.error('❌ Error en registrarCambio:', error);
            throw new Error(`Error al registrar cambio de precio: ${error.message}`);
        }
    }

    /**
     * Obtener historial completo de un producto
     * @param {number} producto_id - ID del producto
     * @returns {Promise<Array>} Historial de cambios
     */
    static async obtenerHistorialProducto(producto_id) {
        try {
            const historial = await query(
                `SELECT 
                    hp.id,
                    hp.producto_id,
                    p.codigo,
                    p.nombre,
                    hp.precio_compra_anterior,
                    hp.precio_compra_nuevo,
                    ROUND(((hp.precio_compra_nuevo - hp.precio_compra_anterior) / 
                        NULLIF(hp.precio_compra_anterior, 0) * 100), 2) as cambio_compra_porciento,
                    hp.precio_venta_anterior,
                    hp.precio_venta_nuevo,
                    ROUND(((hp.precio_venta_nuevo - hp.precio_venta_anterior) / 
                        NULLIF(hp.precio_venta_anterior, 0) * 100), 2) as cambio_venta_porciento,
                    hp.razon,
                    u.nombre as usuario,
                    hp.fecha_cambio
                 FROM historial_precio hp
                 JOIN producto p ON hp.producto_id = p.id
                 LEFT JOIN usuario u ON hp.usuario_id = u.id
                 WHERE hp.producto_id = ?
                 ORDER BY hp.fecha_cambio DESC`,
                [producto_id]
            );

            return historial || [];
        } catch (error) {
            throw new Error(`Error al obtener historial: ${error.message}`);
        }
    }

    /**
     * Obtener estadísticas de cambios de precio en un rango de fechas
     * @param {string} fechaDesde - YYYY-MM-DD
     * @param {string} fechaHasta - YYYY-MM-DD
     * @returns {Promise<Object>} Estadísticas
     */
    static async obtenerEstadisticas(fechaDesde, fechaHasta) {
        try {
            const stats = await query(
                `SELECT 
                    COUNT(*) as total_cambios,
                    COUNT(DISTINCT producto_id) as productos_afectados,
                    ROUND(AVG(precio_compra_nuevo - precio_compra_anterior), 2) as cambio_promedio_compra,
                    ROUND(MIN(precio_compra_nuevo), 2) as precio_compra_minimo,
                    ROUND(MAX(precio_compra_nuevo), 2) as precio_compra_maximo,
                    ROUND(AVG(precio_venta_nuevo - precio_venta_anterior), 2) as cambio_promedio_venta
                 FROM historial_precio
                 WHERE fecha_cambio BETWEEN ? AND ?`,
                [fechaDesde + ' 00:00:00', fechaHasta + ' 23:59:59']
            );

            return stats[0] || {
                total_cambios: 0,
                productos_afectados: 0,
                cambio_promedio_compra: 0,
                precio_compra_minimo: 0,
                precio_compra_maximo: 0,
                cambio_promedio_venta: 0
            };
        } catch (error) {
            throw new Error(`Error al obtener estadísticas: ${error.message}`);
        }
    }

    /**
     * Obtener productos con mayor variación de precio (últimos 30 días)
     * @returns {Promise<Array>} Top 10 productos con mayor variación
     */
    static async obtenerProductosConMayorVariacion() {
        try {
            const productos = await query(
                `SELECT 
                    p.id,
                    p.nombre,
                    p.codigo,
                    MAX(hp.precio_compra_nuevo) as precio_compra_actual,
                    MIN(hp.precio_compra_anterior) as precio_compra_minimo_30d,
                    MAX(hp.precio_compra_nuevo) - MIN(hp.precio_compra_anterior) as diferencia_compra,
                    ROUND(((MAX(hp.precio_compra_nuevo) - MIN(hp.precio_compra_anterior)) / 
                        NULLIF(MIN(hp.precio_compra_anterior), 0) * 100), 2) as variacion_porciento,
                    COUNT(*) as cantidad_cambios,
                    MAX(hp.fecha_cambio) as ultimo_cambio
                 FROM historial_precio hp
                 JOIN producto p ON hp.producto_id = p.id
                 WHERE hp.fecha_cambio >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY p.id, p.nombre, p.codigo
                 HAVING cantidad_cambios > 0
                 ORDER BY variacion_porciento DESC
                 LIMIT 10`,
                []
            );

            return productos || [];
        } catch (error) {
            throw new Error(`Error al obtener variaciones: ${error.message}`);
        }
    }

    /**
     * Analizar margen de ganancia histórico
     * @param {number} producto_id - ID del producto
     * @returns {Promise<Object>} Análisis de márgenes
     */
    static async analizarMargenHistorico(producto_id) {
        try {
            const analisis = await query(
                `SELECT 
                    p.nombre,
                    p.precio_compra as precio_actual_compra,
                    p.precio_venta as precio_actual_venta,
                    ROUND(((p.precio_venta - p.precio_compra) / p.precio_venta * 100), 2) as margen_actual,
                    (SELECT ROUND(AVG(precio_venta_nuevo - precio_compra_nuevo) / 
                        NULLIF(AVG(precio_venta_nuevo), 0) * 100, 2)
                     FROM historial_precio 
                     WHERE producto_id = p.id) as margen_promedio_historico,
                    (SELECT MIN(precio_venta_nuevo - precio_compra_nuevo)
                     FROM historial_precio 
                     WHERE producto_id = p.id) as margen_minimo_historico,
                    (SELECT MAX(precio_venta_nuevo - precio_compra_nuevo)
                     FROM historial_precio 
                     WHERE producto_id = p.id) as margen_maximo_historico,
                    (SELECT COUNT(*) 
                     FROM historial_precio 
                     WHERE producto_id = p.id) as cantidad_cambios_registrados
                 FROM producto p
                 WHERE p.id = ?`,
                [producto_id]
            );

            return analisis[0] || null;
        } catch (error) {
            throw new Error(`Error al analizar margen: ${error.message}`);
        }
    }

    /**
     * Listar todo el historial de precios con filtros
     * @param {Object} filtros - {fecha_desde, fecha_hasta, producto_id, usuario_id, pagina, limite}
     * @returns {Promise<Object>} {historial, total, paginas}
     */
    static async listarHistorial(filtros = {}) {
        try {
            const {
                fecha_desde = null,
                fecha_hasta = null,
                producto_id = null,
                usuario_id = null,
                pagina = 1,
                limite = 20
            } = filtros;

            let where = 'WHERE 1=1';
            const params = [];

            if (fecha_desde) {
                where += ' AND hp.fecha_cambio >= ?';
                params.push(fecha_desde + ' 00:00:00');
            }

            if (fecha_hasta) {
                where += ' AND hp.fecha_cambio <= ?';
                params.push(fecha_hasta + ' 23:59:59');
            }

            if (producto_id) {
                where += ' AND hp.producto_id = ?';
                params.push(producto_id);
            }

            if (usuario_id) {
                where += ' AND hp.usuario_id = ?';
                params.push(usuario_id);
            }

            // Contar total
            const countResult = await query(
                `SELECT COUNT(*) as total FROM historial_precio hp ${where}`,
                params
            );
            const total = countResult[0]?.total || 0;

            // Paginar
            const limitNum = parseInt(limite, 10) || 20;
            const pageNum = parseInt(pagina, 10) || 1;
            const offset = (pageNum - 1) * limitNum;
            
            const historial = await query(
                `SELECT 
                    hp.*,
                    p.nombre as producto_nombre,
                    p.codigo as producto_codigo,
                    u.nombre as usuario_nombre
                 FROM historial_precio hp
                 JOIN producto p ON hp.producto_id = p.id
                 LEFT JOIN usuario u ON hp.usuario_id = u.id
                 ${where}
                 ORDER BY hp.fecha_cambio DESC
                 LIMIT ${limitNum} OFFSET ${offset}`,
                params
            );

            return {
                historial: historial || [],
                total,
                paginas: Math.ceil(total / limite),
                pagina_actual: pagina
            };
        } catch (error) {
            throw new Error(`Error al listar historial: ${error.message}`);
        }
    }

    /**
     * Obtener precio promedio de compra de los últimos 6 meses
     * @param {number} producto_id - ID del producto
     * @returns {Promise<number>} Precio promedio
     */
    static async obtenerPrecioPromedioHistorico(producto_id) {
        try {
            const result = await query(
                `SELECT ROUND(AVG(precio_compra_nuevo), 2) as precio_promedio
                 FROM historial_precio
                 WHERE producto_id = ?
                 AND fecha_cambio >= DATE_SUB(NOW(), INTERVAL 6 MONTH)`,
                [producto_id]
            );

            return result[0]?.precio_promedio || 0;
        } catch (error) {
            throw new Error(`Error al obtener precio promedio: ${error.message}`);
        }
    }
}

export default HistorialPrecioDAO;
