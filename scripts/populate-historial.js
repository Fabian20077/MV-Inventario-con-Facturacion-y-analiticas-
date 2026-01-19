/**
 * Script para poblar historial de precios con datos de ejemplo
 * Solo se ejecuta si no hay datos existentes
 */

import { query } from '../config/database.js';

async function populateHistorialPrecios() {
    try {
        console.log('🔍 Verificando si existe historial de precios...');
        
        // Verificar si ya hay datos
        const existingCount = await query('SELECT COUNT(*) as count FROM historial_precios');
        
        if (existingCount[0].count > 0) {
            console.log('✅ El historial de precios ya tiene datos. No se necesita poblar.');
            return { success: true, message: 'Historial ya existe' };
        }
        
        console.log('📝 Poblando historial de precios con datos de ejemplo...');
        
        // Obtener productos actuales
        const productos = await query('SELECT id, nombre, precio_compra, precio_venta FROM productos WHERE activo = 1 ORDER BY id LIMIT 10');
        
        if (productos.length === 0) {
            console.log('⚠️ No hay productos para crear historial');
            return { success: false, message: 'No hay productos' };
        }
        
        // Obtener primer usuario para asignar cambios
        const usuarios = await query('SELECT id, nombre FROM usuarios LIMIT 1');
        const usuarioDemo = usuarios.length > 0 ? usuarios[0] : { id: 1, nombre: 'Demo User' };
        
        // Datos de ejemplo de historial
        const historialEjemplos = [
            {
                dias_atras: 30,
                cambio_compra: 0.85,  // 15% más barato
                cambio_venta: 0.90,   // 10% más barato
                razon: 'Ajuste inicial de precios',
                tipo_cambio: 'INCREMENTO'
            },
            {
                dias_atras: 15,
                cambio_compra: 0.92,  // 8% más caro
                cambio_venta: 0.95,   // 5% más caro
                razon: 'Incremento por costo de proveedor',
                tipo_cambio: 'INCREMENTO'
            },
            {
                dias_atras: 7,
                cambio_compra: 0.88,  // 12% más caro
                cambio_venta: 0.93,   // 7% más caro
                razon: 'Ajuste estacional',
                tipo_cambio: 'INCREMENTO'
            },
            {
                dias_atras: 3,
                cambio_compra: 0.95,  // 5% más barato
                cambio_venta: 0.97,   // 3% más barato
                razon: 'Promoción especial',
                tipo_cambio: 'DESCUENTO'
            }
        ];
        
        let totalInserts = 0;
        
        for (const producto of productos) {
            for (const ejemplo of historialEjemplos) {
                const fechaCambio = new Date();
                fechaCambio.setDate(fechaCambio.getDate() - ejemplo.dias_atras);
                
                const precioCompraActual = Number(producto.precio_compra);
                const precioVentaActual = Number(producto.precio_venta);
                
                // Calcular precios anteriores (inverso del cambio)
                const precioCompraAnterior = Math.round(precioCompraActual / ejemplo.cambio_compra);
                const precioVentaAnterior = Math.round(precioVentaActual / ejemplo.cambio_venta);
                
                // Insertar en historial
                await query(`
                    INSERT INTO historial_precios 
                    (producto_id, precio_compra_anterior, precio_compra_nuevo, 
                     precio_venta_anterior, precio_venta_nuevo, 
                     usuario_id, razon, fecha_cambio, tipo_cambio)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    producto.id,
                    precioCompraAnterior,
                    precioCompraActual,
                    precioVentaAnterior,
                    precioVentaActual,
                    usuarioDemo.id,
                    ejemplo.razon,
                    fechaCambio,
                    ejemplo.tipo_cambio
                ]);
                
                totalInserts++;
            }
            
            console.log(`📊 Historial creado para producto: ${producto.nombre}`);
        }
        
        console.log(`✅ Historial de precios poblado exitosamente!`);
        console.log(`📈 Total de registros creados: ${totalInserts}`);
        console.log(`👤 Usuario asignado: ${usuarioDemo.nombre}`);
        
        return {
            success: true,
            message: `Historial poblado con ${totalInserts} registros`,
            totalRegistros: totalInserts
        };
        
    } catch (error) {
        console.error('❌ Error poblando historial de precios:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    populateHistorialPrecios()
        .then((result) => {
            if (result.success) {
                console.log('\n🎉 Script completado exitosamente!');
                process.exit(0);
            } else {
                console.log('\n⚠️ Script completado con advertencias.');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('\n💥 Error fatal en el script:', error);
            process.exit(1);
        });
}

export default populateHistorialPrecios;