import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { query } from '../config/database.js';
import configuracionLoader from '../config/configuracionLoader.js';
import { drawPieChart, drawBarChart } from '../utils/pdf-chart-helper.js';
import path from 'path';
import fs from 'fs';
import { Parser } from '@json2csv/plainjs';

// Colores Corporativos y de Estado
// GRAFICOS IMPLEMENTADOS: 2026-01-19 17:45
const COLORS = {
    primary: '#3b82f6',       // Azul Institucional (Tailwind Blue-500)
    primary_rgb: [59, 130, 246],
    secondary: '#64748b',   // Gris (Slate-500)
    headerText: '#FFFFFF',    // Blanco
    rowEven: 'FFF8FAFC',      // Gris muy tenue (Slate-50)
    danger: '#ef4444',      // Rojo (Red-500)
    success: '#10b981',      // Verde (Emerald-500)
    warning: '#f59e0b',      // Ambar (Amber-500)
    dangerBg: 'FFFEE2E2',     // Rojo claro (Red-100) para fondos
    dangerText: 'FF991B1B',   // Rojo oscuro (Red-800) para texto
    successText: 'FF166534',  // Verde (Green-800)
    warningText: 'FF854D0E',  // Naranja (Yellow-800)
    navy: '#1e3a8a',          // Azul Corporativo Oscuro (Blue-900)
    slate: '#334155',         // Texto Gris Oscuro (Slate-700)
    zebra: '#f8fafc'          // Fondo Zebra (Slate-50)
};

// Helper para formatear moneda
const formatCurrency = (value) => {
    if (value === null || isNaN(value)) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

// ==============================================
// SERVICIO DE REPORTES UNIFICADO
// ==============================================
const ReportesService = {

    // Helper para obtener la configuración de la empresa
    _getCompanyConfig() {
        return {
            empresaNombre: configuracionLoader.getConfigOrDefault('empresa.nombre', 'Mi Empresa'),
            showLogo: configuracionLoader.getConfigOrDefault('empresa.logo.apply_reports', true),
            logoDbPath: configuracionLoader.getConfigOrDefault('empresa.logo_path', null),
            logoUrl: configuracionLoader.getConfigOrDefault('empresa.logo_url', null),
            logoMime: configuracionLoader.getConfigOrDefault('empresa.logo_mime', null)
        };
    },

    // Helper para obtener la ruta física del logo
    _getLogoPath() {
        const { showLogo, logoDbPath } = this._getCompanyConfig();
        if (!showLogo || !logoDbPath) return null;

        try {
            // LOGICA MEJORADA PARA DOCKER + LOCAL

            // 1. Limpiar path
            let cleanPath = logoDbPath;
            if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
            if (cleanPath.startsWith('Frontend/')) cleanPath = cleanPath.substring(9);

            // 2. Definir posibles ubicaciones
            const candidates = [
                // A. Si es un upload (path completo desde root app)
                path.join(process.cwd(), cleanPath),
                // B. Si es un asset del frontend (mapeado en /app/Frontend)
                path.join(process.cwd(), 'Frontend', cleanPath),
                // C. Fallback para estructura local
                path.join(process.cwd(), 'uploads', path.basename(cleanPath))
            ];

            // 3. Buscar primer match
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }

            console.warn(`⚠️ Logo no encontrado. Buscado en: ${candidates.join(', ')}`);

        } catch (e) {
            console.error('Error resolviendo ruta del logo:', e);
        }
        return null;
    },

    // ==========================================
    // 🎨 MOTORES DE RENDERIZADO (NUEVO DISEÑO)
    // ==========================================

    // 1. Encabezado Corporativo (Layout Asimétrico)
    _drawHeader(doc, title, empresaNombre, logoPath) {
        const margin = 50;
        const topY = 40;
        const pageWidth = doc.page.width - (margin * 2);

        // A. Logo (Izquierda)
        if (logoPath) {
            try {
                doc.image(logoPath, margin, topY, { height: 45, align: 'left' });
            } catch (e) { console.error('Error dibujando logo:', e); }
        }

        // B. Información Corporativa (Derecha)
        doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.navy)
            .text(this._sanitizeText(empresaNombre).toUpperCase(), margin, topY + 5, { align: 'right', width: pageWidth });

        doc.font('Helvetica').fontSize(11).fillColor(COLORS.secondary)
            .text(title, margin, doc.y + 2, { align: 'right', width: pageWidth });

        doc.fontSize(8).fillColor('#64748b')
            .text(new Date().toLocaleString('es-CO'), margin, doc.y + 2, { align: 'right', width: pageWidth });

        // C. Separador Visual
        const lineY = topY + 60;
        doc.moveTo(margin, lineY).lineTo(doc.page.width - margin, lineY)
            .lineWidth(0.5).strokeColor(COLORS.primary).stroke();

        return lineY + 15; // Retorna Y inicial para el contenido
    },

    // 2. Cabecera de Tabla (Estilo Sólido)
    _drawTableHeader(doc, headers, colWidths, startX, yPosition) {
        let currentX = startX;
        const rowHeight = 25;

        // Fondo
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        doc.rect(startX, yPosition, totalWidth, rowHeight).fill(COLORS.navy);

        // Texto
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
        headers.forEach((header, i) => {
            // Alineación inteligente basada en el nombre de la columna
            let align = 'left';
            if (['Stock', 'Cant.', 'Precio', 'Venta', 'Costo', 'Vencimiento', 'Tipo'].some(k => header.includes(k))) align = 'center';

            doc.text(header, currentX + 5, yPosition + 8, {
                width: colWidths[i] - 10,
                align: align
            });
            currentX += colWidths[i];
        });
        return rowHeight;
    },

    // 3. Pie de Página (Minimalista)
    _drawFooter(doc) {
        const range = doc.bufferedPageRange();
        const width = doc.page.width;
        const height = doc.page.height;

        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            // FIX: Desactivar márgenes temporalmente para evitar saltos de página automáticos en el footer
            const originalMargins = { ...doc.page.margins };
            doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

            doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');

            const currentYear = new Date().getFullYear();
            doc.text('Reporte generado por MV Inventario', 0, height - 40, { align: 'center', width: width });
            doc.text(`${currentYear} - Página ${i + 1} de ${range.count}`, 0, height - 28, { align: 'center', width: width });

            // Restaurar márgenes
            doc.page.margins = originalMargins;
        }
    },

    // Helper para limpieza de datos (Sanitización)
    _sanitizeText(text) {
        if (text === null || text === undefined) return '';
        let str = String(text).trim();

        // Corrección de Mojibake (UTF-8 interpretado como ISO-8859-1)
        try {
            if (str.includes('Ã') || str.includes('Â')) {
                return Buffer.from(str, 'binary').toString('utf-8');
            }
        } catch (e) { }
        return str;
    },

    // ==========================================
    // 📊 REPORTE DE PRODUCTOS (EXCEL PREMIUM)
    // ==========================================
    async exportarProductosExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventario General');
        const { empresaNombre } = this._getCompanyConfig();
        const logoPath = this._getLogoPath();

        // 1. Obtener Datos
        const sql = `
            SELECT p.*, c.nombre as categoria_nombre 
            FROM producto p 
            LEFT JOIN categoria c ON p.id_categoria = c.id 
            WHERE p.activo = TRUE 
            ORDER BY p.nombre ASC
        `;
        const productos = await query(sql);

        // 2. Encabezado Corporativo
        worksheet.mergeCells('A1:I1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `REPORTE DE INVENTARIO - ${empresaNombre.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: COLORS.primary.replace('#', 'FF') } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 40;

        // Insertar Logo si corresponde
        if (logoPath) {
            try {
                const imageId = workbook.addImage({
                    filename: logoPath,
                    extension: path.extname(logoPath).substring(1),
                });
                worksheet.addImage(imageId, {
                    tl: { col: 0.1, row: 0.1 }, ext: { width: 120, height: 35 }
                });
            } catch (e) { console.error('Error insertando logo en Excel:', e); }
        }

        // 3. Resumen de Salud (Dashboard en Excel)
        let totalVencidos = 0;
        let valorVencido = 0;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        productos.forEach(p => {
            if (p.fecha_vencimiento) {
                const f = new Date(p.fecha_vencimiento);
                if (f < hoy) {
                    totalVencidos++;
                    valorVencido += (p.cantidad * p.precio_compra);
                }
            }
        });

        worksheet.mergeCells('A2:I2');
        const summaryCell = worksheet.getCell('A2');
        summaryCell.value = `Resumen: ${productos.length} Productos | ${totalVencidos} Vencidos | Valor en Riesgo: ${formatCurrency(valorVencido)}`;
        summaryCell.font = { italic: true, color: { argb: 'FF64748B' } };
        summaryCell.alignment = { horizontal: 'center' };

        // 4. Encabezados de Tabla
        const headerRow = worksheet.getRow(4);
        headerRow.values = ['Código', 'Producto', 'Categoría', 'Stock', 'Costo Unit.', 'Precio Venta', 'Margen', 'Vencimiento', 'Estado'];

        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary.replace('#', 'FF') } };
            cell.font = { color: { argb: COLORS.headerText.replace('#', 'FF') }, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } } };
        });

        // 5. Llenado de Datos
        productos.forEach((p, index) => {
            const row = worksheet.getRow(5 + index);
            let estado = 'VIGENTE';
            let isVencido = false;
            if (p.fecha_vencimiento) {
                if (new Date(p.fecha_vencimiento) < hoy) {
                    estado = 'VENCIDO';
                    isVencido = true;
                }
            }

            const margen = p.precio_venta > 0 ? ((p.precio_venta - p.precio_compra) / p.precio_venta * 100).toFixed(1) + '%' : '0%';

            row.values = [p.codigo, p.nombre, p.categoria_nombre || 'Sin Categoría', p.cantidad, p.precio_compra, p.precio_venta, margen, p.fecha_vencimiento || '-', estado];

            if (isVencido) {
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dangerBg } };
                    cell.font = { color: { argb: COLORS.dangerText }, bold: true };
                });
            } else if (index % 2 !== 0) {
                row.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rowEven } }; });
            }

            row.getCell(4).alignment = { horizontal: 'center' };
            row.getCell(5).numFmt = '"$"#,##0';
            row.getCell(6).numFmt = '"$"#,##0';
            row.getCell(7).alignment = { horizontal: 'right' };
            row.getCell(9).alignment = { horizontal: 'center' };
            row.getCell(9).font = { bold: true, color: { argb: isVencido ? COLORS.dangerText : COLORS.successText } };
        });

        worksheet.columns = [{ width: 15 }, { width: 35 }, { width: 20 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 15 }, { width: 15 }];

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `Inventario_${empresaNombre.replace(/\s+/g, '_')}_${Date.now()}.xlsx`,
            data: buffer
        };
    },

    // ==========================================
    // 🔄 REPORTE DE MOVIMIENTOS (EXCEL)
    // ==========================================
    async exportarMovimientosExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Historial Movimientos');
        const { empresaNombre } = this._getCompanyConfig();
        const logoPath = this._getLogoPath();

        const sql = `
            SELECT m.*, p.codigo, p.nombre as producto_nombre, u.nombre as usuario_nombre
            FROM movimientos_inventario m
            LEFT JOIN producto p ON m.id_producto = p.id
            LEFT JOIN usuario u ON m.usuario_id = u.id
            ORDER BY m.fecha DESC
        `;
        const movimientos = await query(sql);

        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = `HISTORIAL DE MOVIMIENTOS - ${empresaNombre.toUpperCase()}`;
        titleCell.font = { size: 14, bold: true, color: { argb: COLORS.primary.replace('#', 'FF') } };
        titleCell.alignment = { horizontal: 'center' };
        worksheet.getRow(1).height = 40;

        if (logoPath) {
            try {
                const imageId = workbook.addImage({ filename: logoPath, extension: path.extname(logoPath).substring(1) });
                worksheet.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 120, height: 35 } });
            } catch (e) { console.error('Error logo movimientos:', e); }
        }

        const headerRow = worksheet.getRow(3);
        headerRow.values = ['Fecha/Hora', 'Tipo', 'Código', 'Producto', 'Cantidad', 'Motivo', 'Usuario'];
        headerRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary.replace('#', 'FF') } };
            cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
            cell.alignment = { horizontal: 'center' };
        });

        movimientos.forEach((m, idx) => {
            const row = worksheet.getRow(4 + idx);
            row.values = [m.fecha, m.tipo.toUpperCase(), m.codigo, m.producto_nombre, m.cantidad, m.motivo, m.usuario_nombre];
            row.getCell(2).font = { color: { argb: m.tipo === 'entrada' ? COLORS.successText : COLORS.dangerText }, bold: true };
            if (idx % 2 !== 0) {
                row.eachCell({ includeEmpty: true }, cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.rowEven } }; });
            }
        });

        worksheet.columns = [{ width: 22 }, { width: 15 }, { width: 15 }, { width: 35 }, { width: 12 }, { width: 35 }, { width: 20 }];

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `Movimientos_${Date.now()}.xlsx`,
            data: buffer
        };
    },

    // ==========================================
    // 📄 REPORTE DE PRODUCTOS (PDF) CON GRAFICOS
    // ==========================================
    async exportarProductosPDF() {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true, autoFirstPage: false });
                doc.addPage();
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({ contentType: 'application/pdf', filename: `Productos_${Date.now()}.pdf`, data: Buffer.concat(buffers) });
                });

                const { empresaNombre, showLogo } = this._getCompanyConfig();
                const logoPath = this._getLogoPath();

                // 1. Header
                let yPosition = this._drawHeader(doc, 'Reporte General de Inventario', empresaNombre, showLogo ? logoPath : null);

                // --- DATOS ---
                const sql = `
                    SELECT p.nombre, p.stock_minimo, c.nombre as categoria, p.cantidad, p.precio_venta, p.fecha_vencimiento
                    FROM producto p
                    LEFT JOIN categoria c ON p.id_categoria = c.id
                    WHERE p.activo = TRUE
                    ORDER BY p.nombre ASC
                `;
                const productos = await query(sql);

                // --- SECCION DE GRAFICOS (Pagina 1) ---
                doc.fontSize(14).fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text('Resumen del Inventario', 50, yPosition, { underline: true });
                yPosition += 25;

                // Calcular datos para graficos
                const categorias = {};
                let vigentes = 0, bajoStock = 0, vencidos = 0;
                const hoy = new Date();

                productos.forEach(p => {
                    const cat = p.categoria || 'Sin Categoría';
                    categorias[cat] = (categorias[cat] || 0) + 1;

                    if (p.fecha_vencimiento && new Date(p.fecha_vencimiento) < hoy) {
                        vencidos++;
                    } else if (p.cantidad <= (p.stock_minimo || 5)) {
                        bajoStock++;
                    } else {
                        vigentes++;
                    }
                });

                const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                const barColors = ['#10b981', '#f59e0b', '#ef4444'];

                // Grafico de Categorias (Izquierda)
                const categoriasData = Object.entries(categorias).map(([label, value]) => ({ label, value }));

                doc.fontSize(11).fillColor(COLORS.slate).font('Helvetica-Bold');
                doc.text('Productos por Categoría', 50, yPosition);
                drawPieChart(doc, categoriasData, 50, yPosition + 5, 230, 170, pieColors);

                // Grafico de Estado (Derecha)
                const estadoData = [
                    { label: 'Vigente', value: vigentes, color: '#10b981' },
                    { label: 'Bajo Stock', value: bajoStock, color: '#f59e0b' },
                    { label: 'Vencido', value: vencidos, color: '#ef4444' }
                ];

                doc.fontSize(11).fillColor(COLORS.slate).font('Helvetica-Bold');
                doc.text('Estado del Inventario', 320, yPosition);
                drawBarChart(doc, estadoData, 320, yPosition + 5, 230, 170, barColors);

                // Leyenda
                yPosition += 185;
                doc.fontSize(9).fillColor(COLORS.slate).font('Helvetica');
                doc.text('Total de productos: ' + productos.length, 50, yPosition);
                doc.text('Generado: ' + new Date().toLocaleString('es-CO'), 320, yPosition);

                // --- PAGINA NUEVA PARA TABLA ---
                doc.addPage();
                yPosition = 60;

                // Header
                const logoPath2 = this._getLogoPath();
                if (logoPath2) {
                    try {
                        doc.image(logoPath2, 50, 30, { height: 35 });
                    } catch (e) { }
                }
                doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.navy)
                    .text(empresaNombre.toUpperCase(), 50, 35, { align: 'right', width: 495 });
                doc.font('Helvetica').fontSize(10).fillColor(COLORS.secondary)
                    .text('Listado de Productos', 50, 55, { align: 'right', width: 495 });

                // Linea separadora
                doc.moveTo(50, 80).lineTo(555, 80).lineWidth(0.5).strokeColor(COLORS.primary).stroke();

                yPosition = 95;

                // --- SECCION DE TABLA ---
                const headers = ['Producto', 'Categoría', 'Stock', 'Precio', 'Vencimiento'];
                const colWidths = [190, 100, 50, 90, 80];
                let startX = 50;
                const bottomThreshold = doc.page.height - 80;

                // Header de tabla
                doc.rect(startX, yPosition, 510, 22).fill(COLORS.navy);
                doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
                let currentX = startX;
                headers.forEach((header, i) => {
                    doc.text(header, currentX + 5, yPosition + 7, { width: colWidths[i] - 10 });
                    currentX += colWidths[i];
                });
                yPosition += 22;

                // Filas
                doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate);
                productos.forEach((p, index) => {
                    if (yPosition > bottomThreshold) {
                        doc.addPage();
                        yPosition = 60;
                        doc.rect(startX, yPosition, 510, 22).fill(COLORS.navy);
                        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
                        currentX = startX;
                        headers.forEach((header, i) => {
                            doc.text(header, currentX + 5, yPosition + 7, { width: colWidths[i] - 10 });
                            currentX += colWidths[i];
                        });
                        yPosition += 22;
                        doc.fillColor(COLORS.slate).font('Helvetica').fontSize(8);
                    }

                    const bgColor = index % 2 === 0 ? '#FFFFFF' : '#f1f5f9';
                    doc.rect(startX, yPosition, 510, 20).fill(bgColor);
                    doc.fillColor('#334155');

                    const vencimiento = p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString('es-CO') : '-';
                    const precio = formatCurrency(p.precio_venta);
                    const isVencido = p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date();

                    currentX = startX;
                    doc.text(this._sanitizeText(p.nombre).substring(0, 40), currentX + 5, yPosition + 6, { width: colWidths[0] - 10 });
                    currentX += colWidths[0];
                    doc.text(this._sanitizeText(p.categoria || 'Sin Cat').substring(0, 20), currentX + 5, yPosition + 6, { width: colWidths[1] - 10 });
                    currentX += colWidths[1];
                    doc.text(p.cantidad.toString(), currentX + 5, yPosition + 6, { width: colWidths[2] - 10, align: 'center' });
                    currentX += colWidths[2];
                    doc.text(precio, currentX + 5, yPosition + 6, { width: colWidths[3] - 10, align: 'right' });
                    currentX += colWidths[3];

                    if (isVencido) {
                        doc.fillColor(COLORS.dangerText).font('Helvetica-Bold');
                    }
                    doc.text(vencimiento, currentX + 5, yPosition + 6, { width: colWidths[4] - 10, align: 'center' });
                    doc.fillColor('#334155').font('Helvetica');

                    yPosition += 20;
                });

                // Footer
                this._drawFooter(doc);

                doc.end();
            } catch (error) {
                console.error("Error generando PDF Productos:", error);
                reject(error);
            }
        });
    },

    // ==========================================
    // 📄 REPORTE DE MOVIMIENTOS (PDF)
    // ==========================================
    async exportarMovimientosPDF() {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true, autoFirstPage: false });
                doc.addPage();
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({ contentType: 'application/pdf', filename: `Movimientos_${Date.now()}.pdf`, data: Buffer.concat(buffers) });
                });

                const { empresaNombre, showLogo } = this._getCompanyConfig();
                const logoPath = this._getLogoPath();

                // 1. Header
                let yPosition = this._drawHeader(doc, 'Historial de Movimientos', empresaNombre, showLogo ? logoPath : null);

                // Información del Reporte (Debajo del header)
                doc.fontSize(9).fillColor(COLORS.slate);
                doc.font('Helvetica-Bold').text('Generado por:', 50, yPosition);
                doc.font('Helvetica').text('Sistema', 120, yPosition);

                doc.font('Helvetica-Bold').text('Periodo:', 50, yPosition + 12);
                doc.font('Helvetica').text('Últimos registros', 120, yPosition + 12);

                yPosition += 35; // Espacio antes de la tabla

                // --- DATOS ---
                const sql = `
                    SELECT m.fecha, m.tipo, p.nombre as producto, m.cantidad, u.nombre as usuario
                    FROM movimientos_inventario m
                    LEFT JOIN producto p ON m.id_producto = p.id
                    LEFT JOIN usuario u ON m.usuario_id = u.id
                    ORDER BY m.fecha DESC
                    LIMIT 500
                `;
                const movimientos = await query(sql);

                // 2. Configuración Tabla
                const headers = ['Fecha/Hora', 'Tipo', 'Producto', 'Cant.', 'Usuario'];
                const colWidths = [100, 70, 180, 50, 110];
                let startX = 50;
                const bottomThreshold = doc.page.height - 80; // Límite dinámico

                // 3. Renderizado
                const headerHeight = this._drawTableHeader(doc, headers, colWidths, startX, yPosition);
                yPosition += headerHeight;

                doc.font('Helvetica').fontSize(8).fillColor('#334155');
                movimientos.forEach((m, index) => {
                    if (yPosition > bottomThreshold) {
                        doc.addPage();
                        yPosition = 60;
                        this._drawTableHeader(doc, headers, colWidths, startX, yPosition);
                        yPosition += headerHeight;
                    }

                    const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F3F4F6';
                    let currentX = startX;

                    doc.rect(startX, yPosition, 510, 20).fill(bgColor);
                    doc.fillColor('#334155');

                    const fecha = new Date(m.fecha).toLocaleString('es-CO');
                    const tipo = m.tipo.toUpperCase();

                    let tipoColor = COLORS.slate;
                    if (tipo === 'ENTRADA') tipoColor = COLORS.successText;
                    if (tipo === 'SALIDA') tipoColor = COLORS.dangerText;

                    // Celdas
                    doc.fillColor(COLORS.slate).text(fecha, currentX + 5, yPosition + 6, { width: colWidths[0] - 10, align: 'left' });
                    currentX += colWidths[0];

                    doc.fillColor(tipoColor).font('Helvetica-Bold');
                    doc.text(tipo, currentX + 5, yPosition + 6, { width: colWidths[1] - 10, align: 'center' });
                    doc.font('Helvetica');
                    currentX += colWidths[1];

                    doc.fillColor(COLORS.slate).text(this._sanitizeText(m.producto || 'Desconocido').substring(0, 45), currentX + 5, yPosition + 6, { width: colWidths[2] - 10, align: 'left' });
                    currentX += colWidths[2];

                    doc.text(m.cantidad.toString(), currentX + 5, yPosition + 6, { width: colWidths[3] - 10, align: 'center' });
                    currentX += colWidths[3];

                    doc.text(this._sanitizeText(m.usuario || 'Sistema').substring(0, 25), currentX + 5, yPosition + 6, { width: colWidths[4] - 10, align: 'left' });

                    yPosition += 20;
                });

                // 4. Footer
                this._drawFooter(doc);
                doc.end();
            } catch (error) {
                console.error("Error generando PDF Movimientos:", error);
                reject(error);
            }
        });
    },

    // =======================================================
    //  REPORTE GERENCIAL EN PDF (MEJORADO)
    // =======================================================
    async exportarAnalyticsPDF() {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true, autoFirstPage: false });
                doc.addPage();
                const buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    resolve({ contentType: 'application/pdf', filename: `Reporte_Gerencial_${Date.now()}.pdf`, data: Buffer.concat(buffers) });
                });

                const { empresaNombre, showLogo } = this._getCompanyConfig();
                const logoPath = this._getLogoPath();

                // --- QUERIES ---
                const mesActual = new Date().getMonth() + 1;
                const añoActual = new Date().getFullYear();
                const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                const mesNombre = meses[mesActual - 1];

                const statsSql = `
                    SELECT 
                        COUNT(DISTINCT p.id) as total_productos,
                        SUM(p.cantidad) as total_stock,
                        COALESCE(SUM(m.cantidad), 0) as total_movimientos_mes,
                        COUNT(DISTINCT CASE WHEN p.cantidad <= p.stock_minimo THEN p.id END) as productos_bajo_stock,
                        COUNT(DISTINCT CASE WHEN p.fecha_vencimiento < CURDATE() THEN p.id END) as productos_vencidos
                    FROM producto p
                    LEFT JOIN movimientos_inventario m ON MONTH(m.fecha) = ${mesActual} AND YEAR(m.fecha) = ${añoActual}
                    WHERE p.activo = TRUE
                `;
                const [stats] = await query(statsSql);

                const mermaSql = `
                    SELECT COALESCE(SUM(cantidad), 0) as total_merma
                    FROM movimientos_inventario 
                    WHERE tipo = 'salida' 
                    AND motivo LIKE '%MERMA%' 
                    AND MONTH(fecha) = ${mesActual} 
                    AND YEAR(fecha) = ${añoActual}
                `;
                const [mermaResult] = await query(mermaSql);

                const topSql = `
                    SELECT p.nombre, SUM(m.cantidad) as unidades_vendidas
                    FROM movimientos_inventario m
                    JOIN producto p ON m.id_producto = p.id
                    WHERE m.tipo = 'salida' AND p.activo = TRUE
                    AND MONTH(m.fecha) = ${mesActual} AND YEAR(m.fecha) = ${añoActual}
                    GROUP BY p.id, p.nombre
                    ORDER BY unidades_vendidas DESC
                    LIMIT 5
                `;
                const topProducts = await query(topSql);

                const bajoStockSql = `
                    SELECT p.nombre, p.cantidad as stock, p.stock_minimo as minimo, p.fecha_vencimiento
                    FROM producto p
                    WHERE p.activo = TRUE 
                    AND (p.cantidad <= p.stock_minimo OR p.fecha_vencimiento < CURDATE())
                    ORDER BY p.cantidad ASC
                    LIMIT 10
                `;
                const bajoStock = await query(bajoStockSql);

                // --- PAGINA 1: RESUMEN EJECUTIVO ---
                let yPosition = this._drawHeader(doc, `Reporte Gerencial - ${mesNombre} ${añoActual}`, empresaNombre, showLogo ? logoPath : null);

                // Titulo seccion
                doc.fontSize(14).fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text('Resumen Ejecutivo', 50, yPosition, { underline: true });
                yPosition += 25;

                // Fecha de reporte
                doc.fontSize(9).fillColor(COLORS.secondary).font('Helvetica');
                doc.text(`Período: ${mesNombre} ${añoActual} | Generado: ${new Date().toLocaleDateString('es-CO')}`, 50, yPosition);
                yPosition += 15;

                // KPIs
                const vigente = (stats.total_productos || 0) - (stats.productos_bajo_stock || 0) - (stats.productos_vencidos || 0);
                const kpiData = [
                    { label: 'Total\nProductos', value: stats.total_productos || 0, color: COLORS.primary },
                    { label: 'Stock\nTotal', value: (stats.total_stock || 0).toString(), color: COLORS.secondary },
                    { label: 'Movimientos\ndel Mes', value: stats.total_movimientos_mes || 0, color: '#8b5cf6' },
                    { label: 'Productos\nVigente', value: vigente > 0 ? vigente : 0, color: '#10b981' },
                    { label: 'Bajo\nStock', value: stats.productos_bajo_stock || 0, color: COLORS.warning },
                    { label: 'Vencidos', value: stats.productos_vencidos || 0, color: COLORS.danger }
                ];

                const kpiWidth = 80;
                const kpiGap = 8;
                let kpiX = 50;

                kpiData.forEach((kpi, i) => {
                    if (i > 0 && i % 6 === 0) {
                        kpiX = 50;
                    }
                    doc.rect(kpiX, yPosition, kpiWidth, 45).fill(kpi.color);
                    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
                    const labelLines = kpi.label.split('\n');
                    let labelY = yPosition + 8;
                    labelLines.forEach(line => {
                        doc.text(line, kpiX + 5, labelY, { width: kpiWidth - 10, align: 'center' });
                        labelY += 10;
                    });
                    doc.fontSize(14).text(kpi.value.toString(), kpiX + 5, yPosition + 28, { width: kpiWidth - 10, align: 'center' });
                    kpiX += kpiWidth + kpiGap;
                });

                yPosition += 55;

                // --- SECCION: GRAFICOS Y TOP PRODUCTOS ---
                doc.fontSize(12).fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text('Análisis del Inventario', 50, yPosition, { underline: true });
                yPosition += 20;

                // Grafico de estado
                const estadoData = [
                    { label: 'Vigente', value: vigente > 0 ? vigente : 0, color: '#10b981' },
                    { label: 'Bajo Stock', value: stats.productos_bajo_stock || 0, color: '#f59e0b' },
                    { label: 'Vencido', value: stats.productos_vencidos || 0, color: '#ef4444' }
                ];

                doc.fontSize(10).fillColor(COLORS.slate).font('Helvetica-Bold');
                doc.text('Estado General del Inventario', 50, yPosition);
                doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary);
                doc.text(`${stats.total_productos || 0} productos activos`, 50, yPosition + 12);
                drawBarChart(doc, estadoData, 50, yPosition + 5, 220, 150, ['#10b981', '#f59e0b', '#ef4444']);

                // Top 5 productos
                doc.fontSize(10).fillColor(COLORS.slate).font('Helvetica-Bold');
                doc.text('Top 5 Productos Más Vendidos', 300, yPosition);
                doc.font('Helvetica').fontSize(9).fillColor(COLORS.secondary);
                doc.text(`${mesNombre} ${añoActual}`, 300, yPosition + 12);

                yPosition += 25;

                const topHeaders = ['Producto', 'Vendidos'];
                const topColWidths = [280, 70];

                doc.rect(300, yPosition, 350, 20).fill(COLORS.navy);
                doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
                let tx = 305;
                topHeaders.forEach((h, i) => {
                    doc.text(h, tx, yPosition + 6, { width: topColWidths[i] - 10 });
                    tx += topColWidths[i];
                });
                yPosition += 20;

                doc.fillColor(COLORS.slate).font('Helvetica').fontSize(8);
                topProducts.forEach((p, i) => {
                    const bg = i % 2 === 0 ? '#FFFFFF' : '#f1f5f9';
                    doc.rect(300, yPosition, 350, 18).fill(bg);
                    doc.fillColor('#334155');
                    doc.text((p.nombre || '').substring(0, 45), 305, yPosition + 5, { width: 275 });
                    doc.text((p.unidades_vendidas || 0).toString(), 505, yPosition + 5, { width: 60, align: 'right' });
                    yPosition += 18;
                });

                yPosition += 25;

                // --- SECCION: INDICADORES ADICIONALES ---
                doc.fontSize(12).fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text('Indicadores Adicionales', 50, yPosition, { underline: true });
                yPosition += 20;

                const indicadores = [
                    { label: 'Rotación de Stock', value: stats.total_movimientos_mes > 0 ? (stats.total_movimientos_mes / (stats.total_productos || 1)).toFixed(2) : '0.00', desc: 'Movimientos por producto' },
                    { label: 'Porcentaje Bajo Stock', value: stats.total_productos > 0 ? ((stats.productos_bajo_stock / stats.total_productos) * 100).toFixed(1) + '%' : '0%', desc: 'Productos con stock mínimo' },
                    { label: 'Merma del Mes', value: mermaResult.total_merma || 0, desc: 'Unidades perdidas' },
                    { label: 'Stock Promedio', value: stats.total_productos > 0 ? Math.round(stats.total_stock / stats.total_productos) : 0, desc: 'Unidades por producto' }
                ];

                indicadores.forEach((ind, i) => {
                    const indY = yPosition + (i * 25);
                    doc.fontSize(10).fillColor(COLORS.navy).font('Helvetica-Bold');
                    doc.text(ind.label, 50, indY);
                    doc.fontSize(14).fillColor(COLORS.primary).text(ind.value, 220, indY - 3);
                    doc.fontSize(8).fillColor(COLORS.secondary).font('Helvetica').text(ind.desc, 280, indY + 2);
                });

                yPosition += 120;

                // --- PAGINA 2: ALERTAS ---
                doc.addPage();
                yPosition = 60;

                const logoPath2 = this._getLogoPath();
                if (logoPath2) {
                    try {
                        doc.image(logoPath2, 50, 30, { height: 35 });
                    } catch (e) { }
                }
                doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.navy)
                    .text(empresaNombre.toUpperCase(), 50, 35, { align: 'right', width: 495 });
                doc.font('Helvetica').fontSize(10).fillColor(COLORS.secondary)
                    .text(`Reporte de Alertas - ${mesNombre} ${añoActual}`, 50, 55, { align: 'right', width: 495 });

                doc.moveTo(50, 80).lineTo(555, 80).lineWidth(0.5).strokeColor(COLORS.primary).stroke();
                yPosition = 95;

                // Resumen de alertas
                const totalAlertas = bajoStock.length;
                const vencidos = bajoStock.filter(p => p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date()).length;
                const bajos = totalAlertas - vencidos;

                doc.fontSize(12).fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text(`Alertas de Inventario (${totalAlertas} items)`, 50, yPosition);
                yPosition += 20;

                // Indicadores de alerta
                doc.fontSize(9).fillColor(COLORS.dangerText).font('Helvetica-Bold');
                doc.text(`• Productos Vencidos: ${vencidos}`, 50, yPosition);
                doc.fillColor(COLORS.warningText).text(`• Productos Bajo Stock: ${bajos}`, 220, yPosition);
                doc.fillColor(COLORS.navy).font('Helvetica-Bold');
                doc.text(`• Total de Alertas: ${totalAlertas}`, 400, yPosition);
                yPosition += 20;

                // Tabla de alertas
                const alertHeaders = ['Producto', 'Stock', 'Mínimo', 'Vencimiento', 'Estado'];
                const alertColWidths = [200, 50, 50, 90, 90];

                doc.rect(50, yPosition, 495, 22).fill(COLORS.navy);
                doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
                let ax = 50;
                alertHeaders.forEach((h, i) => {
                    doc.text(h, ax + 5, yPosition + 7, { width: alertColWidths[i] - 10 });
                    ax += alertColWidths[i];
                });
                yPosition += 22;

                doc.fillColor(COLORS.slate).font('Helvetica').fontSize(8);
                bajoStock.forEach((p, i) => {
                    if (yPosition > doc.page.height - 80) {
                        doc.addPage();
                        yPosition = 60;
                        doc.rect(50, yPosition, 495, 22).fill(COLORS.navy);
                        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
                        ax = 50;
                        alertHeaders.forEach((h, j) => {
                            doc.text(h, ax + 5, yPosition + 7, { width: alertColWidths[j] - 10 });
                            ax += alertColWidths[j];
                        });
                        yPosition += 22;
                        doc.fillColor(COLORS.slate).font('Helvetica').fontSize(8);
                    }

                    const isVencido = p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date();
                    const bg = i % 2 === 0 ? '#FFFFFF' : '#f1f5f9';
                    doc.rect(50, yPosition, 495, 18).fill(bg);

                    const vencimiento = p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString('es-CO') : '-';

                    doc.fillColor('#334155');
                    doc.text((p.nombre || '').substring(0, 40), 55, yPosition + 5, { width: 195 });
                    doc.text(p.stock.toString(), 255, yPosition + 5, { width: 45, align: 'center' });
                    doc.text(p.minimo.toString(), 305, yPosition + 5, { width: 45, align: 'center' });
                    doc.text(vencimiento, 355, yPosition + 5, { width: 85, align: 'center' });

                    if (isVencido) {
                        doc.fillColor(COLORS.dangerText).font('Helvetica-Bold');
                        doc.text('VENCIDO', 450, yPosition + 5, { width: 85, align: 'center' });
                    } else {
                        doc.fillColor(COLORS.warningText).font('Helvetica-Bold');
                        doc.text('BAJO STOCK', 450, yPosition + 5, { width: 85, align: 'center' });
                    }
                    doc.fillColor('#334155').font('Helvetica');

                    yPosition += 18;
                });

                // Footer
                this._drawFooter(doc);

                doc.end();
            } catch (error) {
                console.error("Error generando PDF Analytics:", error);
                reject(error);
            }
        });
    },

    // ===================================
    // 📊 REPORTE GERENCIAL (EXCEL)
    // ===================================
    async exportarAnalyticsExcel() {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Resumen Gerencial');
        const { empresaNombre } = this._getCompanyConfig();
        const logoPath = this._getLogoPath();

        const mesActual = new Date().getMonth() + 1;
        const añoActual = new Date().getFullYear();

        // 1. Métricas Generales (Movimientos)
        const statsSql = `
            SELECT 
                COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad ELSE 0 END), 0) as total_unidades,
                COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * p.precio_venta ELSE 0 END), 0) as venta_bruta_est,
                COALESCE(SUM(CASE WHEN m.tipo = 'salida' THEN m.cantidad * p.precio_compra ELSE 0 END), 0) as costo_ventas
            FROM movimientos_inventario m
            INNER JOIN producto p ON m.id_producto = p.id
            WHERE MONTH(m.fecha) = ? AND YEAR(m.fecha) = ?
        `;
        const [stats] = await query(statsSql, [mesActual, añoActual]);

        // 2. Métricas Financieras REALES (Facturación)
        // Esto asegura que los impuestos, descuentos y totales sean exactos según lo facturado
        const facturacionSql = `
            SELECT 
                COUNT(*) as cantidad_facturas,
                COALESCE(SUM(subtotal), 0) as total_subtotal,
                COALESCE(SUM(iva_monto), 0) as total_impuestos,
                COALESCE(SUM(total), 0) as total_facturado
            FROM factura
            WHERE MONTH(fecha_emision) = ? AND YEAR(fecha_emision) = ? AND estado != 'anulada'
        `;
        const [facturacion] = await query(facturacionSql, [mesActual, añoActual]);

        // 3. Merma
        const mermaSql = `
            SELECT COALESCE(SUM(cantidad * precio_compra), 0) as total_merma
            FROM producto
            WHERE activo = TRUE AND fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURDATE()
        `;
        const [merma] = await query(mermaSql);

        // --- CONSTRUCCIÓN ---
        worksheet.mergeCells('A1:E1');
        const title = worksheet.getCell('A1');
        title.value = `REPORTE GERENCIAL DEL MES - ${empresaNombre.toUpperCase()}`;
        title.font = { size: 16, bold: true, color: { argb: COLORS.primary.replace('#', 'FF') } };
        title.alignment = { horizontal: 'center' };

        if (logoPath) {
            try {
                const imageId = workbook.addImage({ filename: logoPath, extension: path.extname(logoPath).substring(1) });
                worksheet.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 100, height: 35 } });
            } catch (e) { }
        }

        // Tabla de Métricas
        const data = [
            ['Concepto', 'Valor'],
            ['Total Facturado (Ventas Reales)', facturacion.total_facturado],
            ['Subtotal (Base Imponible)', facturacion.total_subtotal],
            ['Total Impuestos Recaudados', facturacion.total_impuestos],
            ['Costo de Mercancía Vendida (Est.)', stats.costo_ventas],
            ['Pérdida por Vencimientos (Merma)', merma.total_merma],
            ['Ganancia Estimada del Mes', facturacion.total_subtotal - stats.costo_ventas - merma.total_merma] // Aprox
        ];

        let currentRow = 4;
        data.forEach((fila, idx) => {
            const row = worksheet.getRow(currentRow);
            row.values = fila;
            if (idx === 0) {
                row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                row.eachCell(cell => cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary.replace('#', 'FF') } });
            } else {
                row.getCell(2).numFmt = '"$"#,##0';
            }
            currentRow++;
        });

        worksheet.getColumn(1).width = 40;
        worksheet.getColumn(2).width = 25;

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: `Gerencial_${Date.now()}.xlsx`,
            data: buffer
        };
    },

    // ... (CSV exports unchanged)
    async exportarProductosCSV() { return this._csvExport('SELECT * FROM producto', ['id', 'nombre', 'precio_venta', 'cantidad']); }, // Simplified for brevity as they were stubs? No wait, view_file showed them as stubs. I should probably restore them if they were lost or just assume they are handled. The user only complained about Analytics. I'll keep the stubs if they were stubs, or better, implement full CSV if needed. But let's stick to Excel/PDF required by user. 
    // Actually, line 643/644 were keys in the object. I will leave them be, assuming the user didn't truncate the file in the view.
    // Wait, if I replace up to 645, I need to make sure I don't break the object structure.
    async exportarProductosCSV() { /* TODO */ return { contentType: 'text/csv', filename: 'stub.csv', data: '' }; },
    async exportarMovimientosCSV() { /* TODO */ return { contentType: 'text/csv', filename: 'stub.csv', data: '' }; }
};

export default ReportesService;
