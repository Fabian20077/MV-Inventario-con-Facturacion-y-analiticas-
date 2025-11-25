import { Parser } from '@json2csv/plainjs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import ProductoDAO from '../dao/ProductoDAO.js';
import { query } from '../config/database.js';

class ReportesService {
    /**
     * Calcular métricas del mes actual
     */
    async calcularMetricasMes() {
        try {
            const mesActual = new Date().getMonth() + 1;
            const añoActual = new Date().getFullYear();

            // Ventas del mes (salidas)
            const ventasSql = `
                SELECT 
                    COALESCE(SUM(m.cantidad), 0) as total_unidades,
                    COALESCE(SUM(m.cantidad * p.precio_venta), 0) as total_ventas
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'salida' 
                AND MONTH(m.fecha) = ? 
                AND YEAR(m.fecha) = ?
            `;
            const ventas = await query(ventasSql, [mesActual, añoActual]);

            // Compras del mes (entradas)
            const comprasSql = `
                SELECT COALESCE(SUM(m.cantidad * p.precio_compra), 0) as total_compras
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'entrada' 
                AND MONTH(m.fecha) = ? 
                AND YEAR(m.fecha) = ?
            `;
            const compras = await query(comprasSql, [mesActual, añoActual]);

            const ganancia = ventas[0].total_ventas - compras[0].total_compras;

            return {
                ganancia_neta: Math.round(ganancia),
                ventas_totales: Math.round(ventas[0].total_ventas),
                ventas_unidades: ventas[0].total_unidades,
                compras_totales: Math.round(compras[0].total_compras)
            };
        } catch (error) {
            console.error('Error calculando métricas:', error);
            return {
                ganancia_neta: 0,
                ventas_totales: 0,
                ventas_unidades: 0,
                compras_totales: 0
            };
        }
    }

    /**
     * Exportar productos a CSV
     */
    async exportarProductosCSV() {
        try {
            const productos = await ProductoDAO.listar();
            const metricas = await this.calcularMetricasMes();

            // Sección de encabezado y métricas
            let csv = 'REPORTE DE PRODUCTOS\n';
            csv += `Fecha,${new Date().toLocaleDateString('es-CO')}\n`;
            csv += '\n';
            csv += 'MÉTRICAS DEL MES\n';
            csv += `Ganancia Neta,$${metricas.ganancia_neta.toLocaleString('es-CO')}\n`;
            csv += `Ventas Totales,$${metricas.ventas_totales.toLocaleString('es-CO')}\n`;
            csv += `Unidades Vendidas,${metricas.ventas_unidades}\n`;
            csv += `Compras del Mes,$${metricas.compras_totales.toLocaleString('es-CO')}\n`;
            csv += '\n';
            csv += 'LISTA DE PRODUCTOS\n';

            // Datos de productos
            const campos = [
                { label: 'ID', value: 'id' },
                { label: 'Código', value: 'codigo' },
                { label: 'Nombre', value: 'nombre' },
                { label: 'Descripción', value: 'descripcion' },
                { label: 'Precio Venta', value: 'precio_venta' },
                { label: 'Stock Actual', value: 'cantidad' },
                { label: 'Categoría', value: 'categoria_nombre' }
            ];

            const parser = new Parser({ fields: campos });
            csv += parser.parse(productos);

            return {
                success: true,
                data: csv,
                filename: `productos_${Date.now()}.csv`,
                contentType: 'text/csv'
            };
        } catch (error) {
            console.error('Error en exportarProductosCSV:', error);
            throw error;
        }
    }

    /**
     * Exportar productos a Excel
     */
    async exportarProductosExcel() {
        try {
            const productos = await ProductoDAO.listar();
            const metricas = await this.calcularMetricasMes();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Productos');

            // SECCIÓN DE ENCABEZADO
            const titleRow = worksheet.addRow(['REPORTE DE PRODUCTOS']);
            titleRow.font = { bold: true, size: 16 };
            worksheet.addRow(['Fecha:', new Date().toLocaleDateString('es-CO')]);
            worksheet.addRow([]);

            // SECCIÓN DE MÉTRICAS
            const metricsTitle = worksheet.addRow(['MÉTRICAS DEL MES']);
            metricsTitle.font = { bold: true, size: 14 };
            worksheet.addRow(['Ganancia Neta:', `$${metricas.ganancia_neta.toLocaleString('es-CO')}`]);
            worksheet.addRow(['Ventas Totales:', `$${metricas.ventas_totales.toLocaleString('es-CO')}`]);
            worksheet.addRow(['Unidades Vendidas:', metricas.ventas_unidades]);
            worksheet.addRow(['Compras del Mes:', `$${metricas.compras_totales.toLocaleString('es-CO')}`]);
            worksheet.addRow([]);

            // SECCIÓN DE DATOS
            const dataTitle = worksheet.addRow(['LISTA DE PRODUCTOS']);
            dataTitle.font = { bold: true, size: 14 };

            // Encabezados de columnas
            const headerRow = worksheet.addRow(['ID', 'Código', 'Nombre', 'Descripción', 'Precio Venta', 'Stock', 'Categoría']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF003366' }
            };

            // Agregar datos de productos
            productos.forEach(producto => {
                worksheet.addRow([
                    producto.id,
                    producto.codigo,
                    producto.nombre,
                    producto.descripcion,
                    producto.precio_venta,
                    producto.cantidad,
                    producto.categoria_nombre
                ]);
            });

            // Ajustar anchos de columnas
            worksheet.getColumn(1).width = 10;
            worksheet.getColumn(2).width = 15;
            worksheet.getColumn(3).width = 30;
            worksheet.getColumn(4).width = 40;
            worksheet.getColumn(5).width = 15;
            worksheet.getColumn(6).width = 15;
            worksheet.getColumn(7).width = 20;

            // Generar buffer
            const buffer = await workbook.xlsx.writeBuffer();

            return {
                success: true,
                data: buffer,
                filename: `productos_${Date.now()}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            console.error('Error en exportarProductosExcel:', error);
            throw error;
        }
    }

    /**
     * Exportar movimientos a CSV
     */
    async exportarMovimientosCSV() {
        try {
            const sql = `
                SELECT 
                    m.id,
                    p.codigo,
                    p.nombre as producto_nombre,
                    m.tipo,
                    m.cantidad,
                    m.fecha,
                    u.nombre as usuario_nombre
                FROM movimientos_inventario m
                LEFT JOIN producto p ON m.id_producto = p.id
                LEFT JOIN usuario u ON m.usuario_id = u.id
                ORDER BY m.fecha DESC
            `;

            const movimientos = await query(sql);
            const metricas = await this.calcularMetricasMes();

            // Sección de encabezado y métricas
            let csv = 'REPORTE DE MOVIMIENTOS\n';
            csv += `Fecha,${new Date().toLocaleDateString('es-CO')}\n`;
            csv += '\n';
            csv += 'MÉTRICAS DEL MES\n';
            csv += `Ganancia Neta,$${metricas.ganancia_neta.toLocaleString('es-CO')}\n`;
            csv += `Ventas Totales,$${metricas.ventas_totales.toLocaleString('es-CO')}\n`;
            csv += `Unidades Vendidas,${metricas.ventas_unidades}\n`;
            csv += `Compras del Mes,$${metricas.compras_totales.toLocaleString('es-CO')}\n`;
            csv += '\n';
            csv += 'LISTA DE MOVIMIENTOS\n';

            const campos = [
                { label: 'ID', value: 'id' },
                { label: 'Código Producto', value: 'codigo' },
                { label: 'Producto', value: 'producto_nombre' },
                { label: 'Tipo', value: 'tipo' },
                { label: 'Cantidad', value: 'cantidad' },
                { label: 'Fecha', value: 'fecha' },
                { label: 'Usuario', value: 'usuario_nombre' }
            ];

            const parser = new Parser({ fields: campos });
            csv += parser.parse(movimientos);

            return {
                success: true,
                data: csv,
                filename: `movimientos_${Date.now()}.csv`,
                contentType: 'text/csv'
            };
        } catch (error) {
            console.error('Error en exportarMovimientosCSV:', error);
            throw error;
        }
    }

    /**
     * Exportar movimientos a Excel
     */
    async exportarMovimientosExcel() {
        try {
            const sql = `
                SELECT 
                    m.id,
                    p.codigo,
                    p.nombre as producto_nombre,
                    m.tipo,
                    m.cantidad,
                    m.fecha,
                    u.nombre as usuario_nombre
                FROM movimientos_inventario m
                LEFT JOIN producto p ON m.id_producto = p.id
                LEFT JOIN usuario u ON m.usuario_id = u.id
                ORDER BY m.fecha DESC
            `;

            const movimientos = await query(sql);
            const metricas = await this.calcularMetricasMes();

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Movimientos');

            // SECCIÓN DE ENCABEZADO
            const titleRow = worksheet.addRow(['REPORTE DE MOVIMIENTOS']);
            titleRow.font = { bold: true, size: 16 };
            worksheet.addRow(['Fecha:', new Date().toLocaleDateString('es-CO')]);
            worksheet.addRow([]);

            // SECCIÓN DE MÉTRICAS
            const metricsTitle = worksheet.addRow(['MÉTRICAS DEL MES']);
            metricsTitle.font = { bold: true, size: 14 };
            worksheet.addRow(['Ganancia Neta:', `$${metricas.ganancia_neta.toLocaleString('es-CO')}`]);
            worksheet.addRow(['Ventas Totales:', `$${metricas.ventas_totales.toLocaleString('es-CO')}`]);
            worksheet.addRow(['Unidades Vendidas:', metricas.ventas_unidades]);
            worksheet.addRow(['Compras del Mes:', `$${metricas.compras_totales.toLocaleString('es-CO')}`]);
            worksheet.addRow([]);

            // SECCIÓN DE DATOS
            const dataTitle = worksheet.addRow(['LISTA DE MOVIMIENTOS']);
            dataTitle.font = { bold: true, size: 14 };

            // Encabezados de columnas
            const headerRow = worksheet.addRow(['ID', 'Código', 'Producto', 'Tipo', 'Cantidad', 'Fecha', 'Usuario']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF003366' }
            };

            // Agregar datos de movimientos
            movimientos.forEach(movimiento => {
                worksheet.addRow([
                    movimiento.id,
                    movimiento.codigo,
                    movimiento.producto_nombre,
                    movimiento.tipo,
                    movimiento.cantidad,
                    movimiento.fecha,
                    movimiento.usuario_nombre
                ]);
            });

            // Ajustar anchos de columnas
            worksheet.getColumn(1).width = 10;
            worksheet.getColumn(2).width = 15;
            worksheet.getColumn(3).width = 30;
            worksheet.getColumn(4).width = 15;
            worksheet.getColumn(5).width = 15;
            worksheet.getColumn(6).width = 20;
            worksheet.getColumn(7).width = 20;

            // Generar buffer
            const buffer = await workbook.xlsx.writeBuffer();

            return {
                success: true,
                data: buffer,
                filename: `movimientos_${Date.now()}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            console.error('Error en exportarMovimientosExcel:', error);
            throw error;
        }
    }

    /**
     * Exportar análisis completo a Excel
     */
    async exportarAnalyticsExcel() {
        try {
            const metricas = await this.calcularMetricasMes();
            const productos = await ProductoDAO.listar();

            // Obtener top productos vendidos
            const topProductosSql = `
                SELECT 
                    p.nombre,
                    p.codigo,
                    SUM(m.cantidad) as total_vendido,
                    SUM(m.cantidad * p.precio_venta) as ingresos
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'salida'
                AND MONTH(m.fecha) = MONTH(CURRENT_DATE())
                AND YEAR(m.fecha) = YEAR(CURRENT_DATE())
                GROUP BY p.id, p.nombre, p.codigo
                ORDER BY total_vendido DESC
                LIMIT 10
            `;
            const topProductos = await query(topProductosSql);

            // Productos con bajo stock
            const bajoStock = productos.filter(p => p.cantidad <= (p.stock_minimo || 0)).slice(0, 10);

            // Productos con mayor margen
            const mayorMargen = productos
                .map(p => ({
                    ...p,
                    margen: p.precio_compra > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_compra * 100) : 0
                }))
                .sort((a, b) => b.margen - a.margen)
                .slice(0, 10);

            const workbook = new ExcelJS.Workbook();

            // ========================================
            // HOJA 1: MÉTRICAS DEL MES
            // ========================================
            const sheetMetricas = workbook.addWorksheet('Métricas del Mes');

            // Título
            sheetMetricas.mergeCells('A1:D1');
            const titleCell = sheetMetricas.getCell('A1');
            titleCell.value = 'ANÁLISIS DE VENTAS Y RENDIMIENTO';
            titleCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a8a' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            sheetMetricas.getRow(1).height = 35;

            // Fecha
            sheetMetricas.mergeCells('A2:D2');
            const dateCell = sheetMetricas.getCell('A2');
            dateCell.value = `Generado: ${new Date().toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short' })}`;
            dateCell.font = { italic: true };
            dateCell.alignment = { horizontal: 'center' };

            sheetMetricas.addRow([]);

            // Métricas - Headers
            const metricasHeaders = sheetMetricas.addRow(['Métrica', 'Valor']);
            ['A4', 'B4'].forEach(cell => {
                const c = sheetMetricas.getCell(cell);
                c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
                c.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            sheetMetricas.addRow(['Ganancia Neta', metricas.ganancia_neta]);
            sheetMetricas.addRow(['Ventas Totales', metricas.ventas_totales]);
            sheetMetricas.addRow(['Unidades Vendidas', metricas.ventas_unidades]);
            sheetMetricas.addRow(['Compras del Mes', metricas.compras_totales]);

            // Formato de moneda
            sheetMetricas.getCell('B5').numFmt = '$#,##0';
            sheetMetricas.getCell('B6').numFmt = '$#,##0';
            sheetMetricas.getCell('B8').numFmt = '$#,##0';

            // Bordes a todas las celdas de datos
            for (let row = 5; row <= 8; row++) {
                ['A', 'B'].forEach(col => {
                    const cell = sheetMetricas.getCell(`${col}${row}`);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            }

            sheetMetricas.getColumn(1).width = 25;
            sheetMetricas.getColumn(2).width = 20;

            // ========================================
            // HOJA 2: TOP PRODUCTOS
            // ========================================
            const sheetTop = workbook.addWorksheet('Top Productos');

            sheetTop.mergeCells('A1:D1');
            const topTitle = sheetTop.getCell('A1');
            topTitle.value = 'TOP 10 PRODUCTOS MÁS VENDIDOS';
            topTitle.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            topTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10b981' } };
            topTitle.alignment = { horizontal: 'center', vertical: 'middle' };
            sheetTop.getRow(1).height = 30;

            sheetTop.addRow([]);
            const topHeaders = sheetTop.addRow(['Código', 'Nombre', 'Unidades Vendidas', 'Ingresos']);
            ['A3', 'B3', 'C3', 'D3'].forEach(cell => {
                const c = sheetTop.getCell(cell);
                c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
                c.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            let topRowNum = 4;
            topProductos.forEach(p => {
                sheetTop.addRow([p.codigo, p.nombre, p.total_vendido, p.ingresos]);
                ['A', 'B', 'C', 'D'].forEach(col => {
                    const cell = sheetTop.getCell(`${col}${topRowNum}`);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                topRowNum++;
            });

            sheetTop.getColumn(1).width = 15;
            sheetTop.getColumn(2).width = 30;
            sheetTop.getColumn(3).width = 18;
            sheetTop.getColumn(4).width = 18;
            sheetTop.getColumn(4).numFmt = '$#,##0';

            // ========================================
            // HOJA 3: BAJO STOCK
            // ========================================
            const sheetBajo = workbook.addWorksheet('Bajo Stock');

            sheetBajo.mergeCells('A1:E1');
            const bajoTitle = sheetBajo.getCell('A1');
            bajoTitle.value = 'PRODUCTOS CON BAJO STOCK';
            bajoTitle.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            bajoTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFef4444' } };
            bajoTitle.alignment = { horizontal: 'center', vertical: 'middle' };
            sheetBajo.getRow(1).height = 30;

            sheetBajo.addRow([]);
            const bajoHeaders = sheetBajo.addRow(['Código', 'Nombre', 'Stock Actual', 'Stock Mínimo', 'Categoría']);
            ['A3', 'B3', 'C3', 'D3', 'E3'].forEach(cell => {
                const c = sheetBajo.getCell(cell);
                c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
                c.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            let bajoRowNum = 4;
            bajoStock.forEach(p => {
                const row = sheetBajo.addRow([p.codigo, p.nombre, p.cantidad, p.stock_minimo || 0, p.categoria_nombre || 'Sin categoría']);
                ['A', 'B', 'C', 'D', 'E'].forEach(col => {
                    const cell = sheetBajo.getCell(`${col}${bajoRowNum}`);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (col === 'C') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
                        cell.font = { color: { argb: 'FF991b1b' }, bold: true };
                    }
                });
                bajoRowNum++;
            });

            sheetBajo.getColumn(1).width = 15;
            sheetBajo.getColumn(2).width = 30;
            sheetBajo.getColumn(3).width = 15;
            sheetBajo.getColumn(4).width = 15;
            sheetBajo.getColumn(5).width = 20;

            // ========================================
            // HOJA 4: MAYOR MARGEN
            // ========================================
            const sheetMargen = workbook.addWorksheet('Mayor Margen');

            sheetMargen.mergeCells('A1:F1');
            const margenTitle = sheetMargen.getCell('A1');
            margenTitle.value = 'PRODUCTOS CON MAYOR MARGEN';
            margenTitle.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            margenTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFa855f7' } };
            margenTitle.alignment = { horizontal: 'center', vertical: 'middle' };
            sheetMargen.getRow(1).height = 30;

            sheetMargen.addRow([]);
            const margenHeaders = sheetMargen.addRow(['Código', 'Nombre', 'Precio Compra', 'Precio Venta', 'Margen %', 'Stock']);
            ['A3', 'B3', 'C3', 'D3', 'E3', 'F3'].forEach(cell => {
                const c = sheetMargen.getCell(cell);
                c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
                c.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            let margenRowNum = 4;
            mayorMargen.forEach(p => {
                sheetMargen.addRow([
                    p.codigo,
                    p.nombre,
                    p.precio_compra,
                    p.precio_venta,
                    p.margen.toFixed(1),
                    p.cantidad
                ]);
                ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
                    const cell = sheetMargen.getCell(`${col}${margenRowNum}`);
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
                margenRowNum++;
            });

            sheetMargen.getColumn(1).width = 15;
            sheetMargen.getColumn(2).width = 30;
            sheetMargen.getColumn(3).width = 15;
            sheetMargen.getColumn(4).width = 15;
            sheetMargen.getColumn(5).width = 12;
            sheetMargen.getColumn(6).width = 12;
            sheetMargen.getColumn(3).numFmt = '$#,##0';
            sheetMargen.getColumn(4).numFmt = '$#,##0';
            sheetMargen.getColumn(5).numFmt = '0.0"%"';

            const buffer = await workbook.xlsx.writeBuffer();

            return {
                success: true,
                data: buffer,
                filename: `analisis_${new Date().toISOString().split('T')[0]}.xlsx`,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            };
        } catch (error) {
            console.error('Error en exportarAnalyticsExcel:', error);
            throw error;
        }
    }

    /**
     * Exportar análisis completo a PDF
     */
    async exportarAnalyticsPDF() {
        try {
            const metricas = await this.calcularMetricasMes();
            const productos = await ProductoDAO.listar();

            // Obtener top productos vendidos
            const topProductosSql = `
                SELECT 
                    p.nombre,
                    p.codigo,
                    SUM(m.cantidad) as total_vendido,
                    SUM(m.cantidad * p.precio_venta) as ingresos
                FROM movimientos_inventario m
                INNER JOIN producto p ON m.id_producto = p.id
                WHERE m.tipo = 'salida'
                AND MONTH(m.fecha) = MONTH(CURRENT_DATE())
                AND YEAR(m.fecha) = YEAR(CURRENT_DATE())
                GROUP BY p.id, p.nombre, p.codigo
                ORDER BY total_vendido DESC
                LIMIT 10
            `;
            const topProductos = await query(topProductosSql);

            // Productos con bajo stock
            const bajoStock = productos.filter(p => p.cantidad <= (p.stock_minimo || 0)).slice(0, 10);

            // Productos con mayor margen
            const mayorMargen = productos
                .map(p => ({
                    ...p,
                    margen: p.precio_compra > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_compra * 100) : 0
                }))
                .sort((a, b) => b.margen - a.margen)
                .slice(0, 10);

            // Crear PDF
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));

            // ========================================
            // PORTADA
            // ========================================
            doc.fontSize(28).fillColor('#1e3a8a').text('MV INVENTARIO', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(20).fillColor('#3b82f6').text('Analisis de Ventas y Rendimiento', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('#64748b').text(
                `Generado: ${new Date().toLocaleString('es-CO', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                    timeZone: 'America/Bogota'
                })}`,
                { align: 'center' }
            );
            doc.moveDown(3);

            // ========================================
            // METRICAS DEL MES
            // ========================================
            doc.fontSize(18).fillColor('#1e293b').text('Metricas del Mes', { underline: true });
            doc.moveDown(1.5);

            const formatCurrency = (value) => `$${value.toLocaleString('es-CO')}`;

            // Tarjetas de metricas (mas grandes para que quepan los numeros)
            const metricsY = doc.y;
            const cardWidth = 250;
            const cardHeight = 90;
            const gap = 15;

            // Ganancia Neta (Verde)
            doc.rect(50, metricsY, cardWidth, cardHeight).fillAndStroke('#d1fae5', '#10b981');
            doc.fillColor('#065f46').fontSize(11).text('Ganancia Neta', 60, metricsY + 15, { width: cardWidth - 20 });
            doc.fontSize(18).text(formatCurrency(metricas.ganancia_neta), 60, metricsY + 45, { width: cardWidth - 20 });

            // Ventas Totales (Azul)
            doc.rect(50 + cardWidth + gap, metricsY, cardWidth, cardHeight).fillAndStroke('#dbeafe', '#3b82f6');
            doc.fillColor('#1e40af').fontSize(11).text('Ventas Totales', 60 + cardWidth + gap, metricsY + 15, { width: cardWidth - 20 });
            doc.fontSize(18).text(formatCurrency(metricas.ventas_totales), 60 + cardWidth + gap, metricsY + 45, { width: cardWidth - 20 });

            // Segunda fila de tarjetas - guardar posicion Y
            const secondRowY = metricsY + cardHeight + gap + 10;

            // Unidades Vendidas (Purpura)
            doc.rect(50, secondRowY, cardWidth, cardHeight).fillAndStroke('#f3e8ff', '#a855f7');
            doc.fillColor('#7e22ce').fontSize(11).text('Unidades Vendidas', 60, secondRowY + 15, { width: cardWidth - 20 });
            doc.fontSize(18).text(metricas.ventas_unidades.toString(), 60, secondRowY + 45, { width: cardWidth - 20 });

            // Compras del Mes (Naranja) - usar la misma posicion Y
            doc.rect(50 + cardWidth + gap, secondRowY, cardWidth, cardHeight).fillAndStroke('#fed7aa', '#f59e0b');
            doc.fillColor('#92400e').fontSize(11).text('Compras del Mes', 60 + cardWidth + gap, secondRowY + 15, { width: cardWidth - 20 });
            doc.fontSize(18).text(formatCurrency(metricas.compras_totales), 60 + cardWidth + gap, secondRowY + 45, { width: cardWidth - 20 });

            doc.y = secondRowY + cardHeight + 30;

            // ========================================
            // TOP 10 PRODUCTOS
            // ========================================
            doc.addPage();
            doc.fontSize(16).fillColor('#1e293b').text('Top 10 Productos Mas Vendidos', { underline: true });
            doc.moveDown(1);

            // Tabla header
            const tableTop = doc.y;
            const col1 = 50;
            const col2 = 130;
            const col3 = 350;
            const col4 = 450;

            // Header con texto blanco
            doc.rect(col1, tableTop, 495, 20).fill('#3b82f6');
            doc.fontSize(10).fillColor('#ffffff');
            doc.text('Codigo', col1 + 5, tableTop + 5);
            doc.text('Producto', col2 + 5, tableTop + 5);
            doc.text('Unidades', col3 + 5, tableTop + 5);
            doc.text('Total Ventas', col4 + 5, tableTop + 5);

            let y = tableTop + 25;
            doc.fontSize(9).fillColor('#1e293b');

            topProductos.forEach((p, i) => {
                const bgColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';
                doc.rect(col1, y - 2, 495, 18).fill(bgColor);
                doc.fillColor('#1e293b');
                doc.text(p.codigo, col1 + 5, y);
                doc.text(p.nombre.substring(0, 28), col2 + 5, y);
                doc.text(p.total_vendido.toString(), col3 + 5, y);
                // Formato consistente de moneda sin decimales
                const ingresosFormateados = `$${Math.round(p.ingresos).toLocaleString('es-CO')}`;
                doc.text(ingresosFormateados, col4 + 5, y);
                y += 20;
            });

            doc.moveDown(2);

            // ========================================
            // PRODUCTOS BAJO STOCK
            // ========================================
            doc.addPage();
            doc.fontSize(16).fillColor('#1e293b').text('Productos con Bajo Stock', { underline: true });
            doc.moveDown(1);

            if (bajoStock.length > 0) {
                const tableTop2 = doc.y;
                const colBajo1 = 50;
                const colBajo2 = 130;
                const colBajo3 = 350;
                const colBajo4 = 450;

                // Header con texto blanco
                doc.rect(colBajo1, tableTop2, 495, 20).fill('#ef4444');
                doc.fontSize(10).fillColor('#ffffff');
                doc.text('Codigo', colBajo1 + 5, tableTop2 + 5);
                doc.text('Producto', colBajo2 + 5, tableTop2 + 5);
                doc.text('Stock Actual', colBajo3 + 5, tableTop2 + 5);
                doc.text('Stock Minimo', colBajo4 + 5, tableTop2 + 5);

                let y2 = tableTop2 + 25;
                doc.fontSize(9);

                bajoStock.forEach((p, i) => {
                    const bgColor = '#fee2e2';
                    doc.rect(colBajo1, y2 - 2, 495, 18).fill(bgColor);
                    doc.fillColor('#991b1b');
                    doc.text(p.codigo, colBajo1 + 5, y2);
                    doc.text(p.nombre.substring(0, 28), colBajo2 + 5, y2);
                    doc.text(p.cantidad.toString(), colBajo3 + 5, y2);
                    doc.text((p.stock_minimo || 0).toString(), colBajo4 + 5, y2);
                    y2 += 20;
                });
            } else {
                doc.fontSize(12).fillColor('#10b981').text('No hay productos con bajo stock', { align: 'center' });
            }

            doc.moveDown(2);

            // ========================================
            // MAYOR MARGEN
            // ========================================
            doc.addPage();
            doc.fontSize(16).fillColor('#1e293b').text('Productos con Mayor Margen', { underline: true });
            doc.moveDown(1);

            const tableTop3 = doc.y;
            const colMargen1 = 50;
            const colMargen2 = 130;
            const colMargen3 = 350;
            const colMargen4 = 450;

            // Header con texto blanco
            doc.rect(colMargen1, tableTop3, 495, 20).fill('#a855f7');
            doc.fontSize(10).fillColor('#ffffff');
            doc.text('Codigo', colMargen1 + 5, tableTop3 + 5);
            doc.text('Producto', colMargen2 + 5, tableTop3 + 5);
            doc.text('Margen %', colMargen3 + 5, tableTop3 + 5);
            doc.text('Stock', colMargen4 + 5, tableTop3 + 5);

            let y3 = tableTop3 + 25;
            doc.fontSize(9).fillColor('#1e293b');

            mayorMargen.forEach((p, i) => {
                const bgColor = i % 2 === 0 ? '#faf5ff' : '#ffffff';
                doc.rect(colMargen1, y3 - 2, 495, 18).fill(bgColor);
                doc.fillColor('#1e293b');
                doc.text(p.codigo, colMargen1 + 5, y3);
                doc.text(p.nombre.substring(0, 28), colMargen2 + 5, y3);
                doc.text(`${p.margen.toFixed(1)}%`, colMargen3 + 5, y3);
                doc.text(p.cantidad.toString(), colMargen4 + 5, y3);
                y3 += 20;
            });

            // Finalizar documento
            doc.end();

            return new Promise((resolve, reject) => {
                doc.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve({
                        success: true,
                        data: buffer,
                        filename: `analisis_${new Date().toISOString().split('T')[0]}.pdf`,
                        contentType: 'application/pdf'
                    });
                });
                doc.on('error', reject);
            });
        } catch (error) {
            console.error('Error en exportarAnalyticsPDF:', error);
            throw error;
        }
    }
}

export default new ReportesService();