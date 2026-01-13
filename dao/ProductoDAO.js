import { query } from '../config/database.js';

class ProductoDAO {
    /**
     * Crear un nuevo producto
     */
    async crear(producto) {
        try {
            const sql = `
                INSERT INTO producto (codigo, nombre, descripcion, precio_compra, precio_venta, cantidad, stock_minimo, ubicacion, id_categoria, fecha_vencimiento)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                producto.codigo,
                producto.nombre,
                producto.descripcion || null,
                producto.precio_compra,
                producto.precio_venta,
                producto.cantidad || 0,
                producto.stock_minimo || 10,
                producto.ubicacion || null,
                producto.id_categoria,
                producto.fecha_vencimiento || null // Nuevo campo (opcional)
            ];
            
            const result = await query(sql, params);
            return {
                success: true,
                id: result.insertId,
                message: 'Producto creado exitosamente'
            };
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return {
                    success: false,
                    message: 'El código ya existe'
                };
            }
            console.error('Error en ProductoDAO.crear:', error);
            throw error;
        }
    }

  /**
 * Buscar producto por ID
 */
async buscarPorId(id) {
    try {
        const sql = `
            SELECT p.*, c.nombre as categoria_nombre
            FROM producto p
            LEFT JOIN categoria c ON p.id_categoria = c.id
            WHERE p.id = ?
        `;
        
        const productos = await query(sql, [id]);
        return productos.length > 0 ? productos[0] : null;
    } catch (error) {
        console.error('Error en ProductoDAO.buscarPorId:', error);
        throw error;
    }
}

    /**
     * Buscar producto por código
     */
    async buscarPorCodigo(codigo) {
        try {
            const sql = `
                SELECT p.*, c.nombre as categoria_nombre
                FROM producto p
                LEFT JOIN categoria c ON p.id_categoria = c.id
                WHERE p.codigo = ?
            `;
            
            const productos = await query(sql, [codigo]);
            return productos.length > 0 ? productos[0] : null;
        } catch (error) {
            console.error('Error en ProductoDAO.buscarPorCodigo:', error);
            throw error;
        }
    }

    /**
     * Listar todos los productos
     */
    async listar() {
        try {
            const sql = `
                SELECT p.*, c.nombre as categoria_nombre
                FROM producto p
                LEFT JOIN categoria c ON p.id_categoria = c.id
                WHERE p.activo = TRUE
                ORDER BY p.id DESC
            `;
            
            return await query(sql);
        } catch (error) {
            console.error('Error en ProductoDAO.listar:', error);
            throw error;
        }
    }

    /**
     * Actualizar producto
     * Nota: Llamar desde server.js pasando usuario_id para registrar en historial
     */
    async actualizar(id, datos, usuario_id = 1) {
        try {
            // Primero obtener datos anteriores para comparar precios
            const productoAnterior = await query('SELECT precio_compra, precio_venta FROM producto WHERE id = ?', [id]);
            
            console.log('📊 ProductoDAO.actualizar - Datos anteriores:', productoAnterior);
            console.log('📊 ProductoDAO.actualizar - Datos nuevos:', datos);
            
            const campos = [];
            const valores = [];
            
            if (datos.codigo) {
                campos.push('codigo = ?');
                valores.push(datos.codigo);
            }
            if (datos.nombre) {
                campos.push('nombre = ?');
                valores.push(datos.nombre);
            }
            if (datos.descripcion !== undefined) {
                campos.push('descripcion = ?');
                valores.push(datos.descripcion);
            }
            if (datos.precio_compra !== undefined) {
                campos.push('precio_compra = ?');
                valores.push(datos.precio_compra);
            }
            if (datos.precio_venta !== undefined) {
                campos.push('precio_venta = ?');
                valores.push(datos.precio_venta);
            }
            if (datos.cantidad !== undefined) {
                campos.push('cantidad = ?');
                valores.push(datos.cantidad);
            }
            if (datos.stock_minimo !== undefined) {
                campos.push('stock_minimo = ?');
                valores.push(datos.stock_minimo);
            }
            if (datos.ubicacion !== undefined) {
                campos.push('ubicacion = ?');
                valores.push(datos.ubicacion);
            }
            if (datos.fecha_vencimiento !== undefined) {
                campos.push('fecha_vencimiento = ?');
                valores.push(datos.fecha_vencimiento);
            }
            if (datos.id_categoria) {
                campos.push('id_categoria = ?');
                valores.push(datos.id_categoria);
            }
            if (datos.activo !== undefined) {
                campos.push('activo = ?');
                valores.push(datos.activo);
            }
            
            if (campos.length === 0) {
                return { success: false, message: 'No hay datos para actualizar' };
            }
            
            valores.push(id);
            
            const sql = `UPDATE producto SET ${campos.join(', ')} WHERE id = ?`;
            const result = await query(sql, valores);

            console.log('✏️ UPDATE resultado:', { affectedRows: result.affectedRows });

            // Registrar cambio de precio en historial si corresponde
            if (result.affectedRows > 0 && productoAnterior && productoAnterior.length > 0) {
                const anterior = productoAnterior[0];
                
                console.log('🔎 Verificando cambios de precio:', {
                    precio_compra_enviado: datos.precio_compra,
                    precio_venta_enviado: datos.precio_venta,
                    hay_cambio_compra: datos.precio_compra !== undefined,
                    hay_cambio_venta: datos.precio_venta !== undefined
                });
                
                if (datos.precio_compra !== undefined || datos.precio_venta !== undefined) {
                    try {
                        // Importar dinámicamente para evitar ciclos
                        const { default: HistorialPrecioDAO } = await import('./HistorialPrecioDAO.js');
                        
                        await HistorialPrecioDAO.registrarCambio(
                            id,
                            Number(anterior.precio_compra),
                            Number(datos.precio_compra !== undefined ? datos.precio_compra : anterior.precio_compra),
                            Number(anterior.precio_venta),
                            Number(datos.precio_venta !== undefined ? datos.precio_venta : anterior.precio_venta),
                            usuario_id,
                            datos.razon || 'Actualización de producto'
                        );
                    } catch (error) {
                        console.error('Error al registrar historial:', error);
                    }
                }
            }
            
            return {
                success: result.affectedRows > 0,
                message: result.affectedRows > 0 ? 'Producto actualizado' : 'Producto no encontrado'
            };
        } catch (error) {
            console.error('Error en ProductoDAO.actualizar:', error);
            throw error;
        }
    }

    /**
     * Actualizar stock de un producto
     */
    async actualizarStock(id, cantidad, tipo) {
        try {
            const operador = tipo === 'entrada' ? '+' : '-';
            const sql = `
                UPDATE producto 
                SET cantidad = cantidad ${operador} ? 
                WHERE id = ?
            `;
            
            const result = await query(sql, [cantidad, id]);
            
            return {
                success: result.affectedRows > 0,
                message: result.affectedRows > 0 ? 'Stock actualizado' : 'Producto no encontrado'
            };
        } catch (error) {
            console.error('Error en ProductoDAO.actualizarStock:', error);
            throw error;
        }
    }

    /**
     * Eliminar producto (desactivar)
     */
    async eliminar(id) {
        try {
            const sql = 'UPDATE producto SET activo = FALSE WHERE id = ?';
            const result = await query(sql, [id]);
            
            return {
                success: result.affectedRows > 0,
                message: result.affectedRows > 0 ? 'Producto desactivado' : 'Producto no encontrado'
            };
        } catch (error) {
            console.error('Error en ProductoDAO.eliminar:', error);
            throw error;
        }
    }

    /**
     * Obtener productos con stock bajo
     */
    async obtenerStockBajo() {
        try {
            const sql = `
                SELECT p.*, c.nombre as categoria_nombre
                FROM producto p
                LEFT JOIN categoria c ON p.id_categoria = c.id
                WHERE p.cantidad <= p.stock_minimo 
                AND p.activo = TRUE
                ORDER BY p.cantidad ASC
            `;
            
            return await query(sql);
        } catch (error) {
            console.error('Error en ProductoDAO.obtenerStockBajo:', error);
            throw error;
        }
    }
}

export default new ProductoDAO();