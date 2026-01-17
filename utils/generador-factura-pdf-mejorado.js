/**
 * generador-factura-pdf-mejorado.js
 * Genera facturas en formato thermal/POS como en la imagen
 * Compatible con impresoras térmicas de 80mm
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

class GeneradorFacturaPDF {
    constructor(config = {}) {
        this.ancho = config.ancho || 226; // 80mm en puntos
        this.altoLinea = config.altoLinea || 12;
        this.fontSizeNormal = config.fontSizeNormal || 9;
        this.fontSizeGrande = config.fontSizeGrande || 14;
        this.config = config;
    }

    /**
     * Generar factura en PDF
     * @param {Object} factura - Datos de la factura
     * @param {Object} configuracion - Configuración del negocio
     * @param {String} outputPath - Ruta del archivo de salida
     */
    async generarFactura(factura, configuracion, outputPath) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [this.ancho, 600],
                    margin: 10
                });

                const stream = fs.createWriteStream(outputPath);
                doc.pipe(stream);

                // Encabezado con logo
                this._dibujarEncabezado(doc, configuracion);

                // Información de la factura
                this._dibujarSeccion(doc);
                this._dibujarInfoFactura(doc, factura);

                // Información del cliente
                this._dibujarSeccion(doc);
                this._dibujarInfoCliente(doc, factura);

                // Tabla de productos
                this._dibujarSeccion(doc);
                this._dibujarTablProducts(doc, factura);

                // Totales
                this._dibujarSeccion(doc);
                this._dibujarTotales(doc, factura);

                // Forma de pago y observaciones
                this._dibujarSeccion(doc);
                this._dibujarFormaPago(doc, factura);

                // Pie de página
                this._dibujarSeccion(doc);
                this._dibujarPiePagina(doc, configuracion);

                doc.end();

                stream.on('finish', () => {
                    resolve(outputPath);
                });

                stream.on('error', (err) => {
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    _dibujarEncabezado(doc, config) {
        const centerX = this.ancho / 2;
        
        // Logo (si existe)
        if (config.mostrar_logo && config.logo_data) {
            try {
                const logoBuffer = Buffer.from(config.logo_data, 'base64');
                doc.image(logoBuffer, centerX - 30, 10, { width: 60, align: 'center' });
                doc.moveDown(2);
            } catch (e) {
                console.warn('No se pudo cargar el logo');
            }
        }

        // Nombre del negocio
        doc.fontSize(this.fontSizeGrande).font('Helvetica-Bold');
        doc.text(config.nombre_negocio, { align: 'center' });

        // Datos del negocio
        doc.fontSize(this.fontSizeNormal).font('Helvetica');
        if (config.direccion) doc.text(config.direccion, { align: 'center' });
        if (config.telefono) doc.text(`Tel: ${config.telefono}`, { align: 'center' });
        if (config.nit) doc.text(`NIT: ${config.nit}`, { align: 'center' });

        this._dibujarLinea(doc);
    }

    _dibujarInfoFactura(doc, factura) {
        doc.fontSize(this.fontSizeNormal);
        
        const fecha = new Date(factura.fecha);
        const fechaFormato = fecha.toLocaleString('es-CO', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        doc.text(`Factura #: ${factura.numero_factura}`, { width: this.ancho - 20 });
        doc.text(`Fecha: ${fechaFormato}`, { width: this.ancho - 20 });
    }

    _dibujarInfoCliente(doc, factura) {
        doc.fontSize(this.fontSizeNormal).font('Helvetica-Bold');
        doc.text('Cliente: ' + (factura.cliente_nombre || 'Consumidor Final'));
        
        doc.font('Helvetica');
        if (factura.nit) doc.text(`NIT: ${factura.nit}`);
        if (factura.direccion) doc.text(`Dirección: ${factura.direccion}`);
        if (factura.telefono) doc.text(`Teléfono: ${factura.telefono}`);
    }

    _dibujarTablProducts(doc, factura) {
        doc.fontSize(this.fontSizeNormal).font('Helvetica-Bold');
        
        // Encabezados
        const startX = 12;
        const colProducto = startX;
        const colCant = startX + 90;
        const colPrecio = startX + 130;
        const colTotal = startX + 175;

        doc.text('Producto', colProducto, doc.y, { width: 75 });
        doc.text('Cant.', colCant, doc.y, { width: 30 });
        doc.text('Precio', colPrecio, doc.y, { width: 40 });
        doc.text('Total', colTotal, doc.y, { width: 40 });
        doc.moveDown();

        this._dibujarLinea(doc);

        // Detalles
        doc.font('Helvetica');
        factura.detalles.forEach(detalle => {
            const producto = detalle.producto_nombre || 'Producto';
            const cantidad = detalle.cantidad.toFixed(2);
            const precio = detalle.precio_unitario.toLocaleString('es-CO', { 
                style: 'currency', 
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });
            const subtotal = detalle.subtotal.toLocaleString('es-CO', { 
                style: 'currency', 
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            });

            const productoAbreviado = producto.length > 20 ? producto.substring(0, 20) : producto;
            
            doc.text(productoAbreviado, colProducto, doc.y, { width: 75 });
            doc.text(cantidad + detalle.unidad_medida, colCant, doc.y, { width: 30, align: 'right' });
            doc.text(precio, colPrecio, doc.y, { width: 40, align: 'right' });
            doc.text(subtotal, colTotal, doc.y, { width: 40, align: 'right' });
            doc.moveDown();
        });

        this._dibujarLinea(doc);
    }

    _dibujarTotales(doc, factura) {
        doc.fontSize(this.fontSizeNormal);
        
        const startX = 12;
        const colLabel = startX + 130;
        const colValor = startX + 175;

        // Subtotal
        doc.text('Subtotal:', colLabel, doc.y, { width: 40 });
        doc.text(
            factura.subtotal.toLocaleString('es-CO', { 
                style: 'currency', 
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }),
            colValor,
            doc.y - this.altoLinea,
            { width: 40, align: 'right' }
        );
        doc.moveDown();

        // IVA (si aplica)
        if (factura.impuesto_monto > 0 && factura.impuesto_nombre) {
            const impuestoLabel = `${factura.impuesto_nombre} (${factura.impuesto_porcentaje}%):`;
            doc.text(impuestoLabel, colLabel, doc.y, { width: 40 });
            doc.text(
                factura.impuesto_monto.toLocaleString('es-CO', { 
                    style: 'currency', 
                    currency: 'COP',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }),
                colValor,
                doc.y - this.altoLinea,
                { width: 40, align: 'right' }
            );
            doc.moveDown();
        }

        this._dibujarLinea(doc);

        // Total
        doc.font('Helvetica-Bold').fontSize(this.fontSizeGrande);
        doc.text('Total:', colLabel, doc.y, { width: 40 });
        doc.text(
            factura.total.toLocaleString('es-CO', { 
                style: 'currency', 
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }),
            colValor,
            doc.y - this.altoLinea,
            { width: 40, align: 'right' }
        );
        doc.moveDown();
        doc.font('Helvetica').fontSize(this.fontSizeNormal);
    }

    _dibujarFormaPago(doc, factura) {
        doc.fontSize(this.fontSizeNormal).font('Helvetica-Bold');
        doc.text(`Forma de Pago: ${factura.forma_pago.charAt(0).toUpperCase() + factura.forma_pago.slice(1)}`);
        doc.font('Helvetica');

        if (factura.observaciones) {
            doc.text(`Observaciones: ${factura.observaciones}`);
        }
    }

    _dibujarPiePagina(doc, config) {
        if (config.mostrar_pie_pagina && config.pie_pagina) {
            doc.fontSize(8).font('Helvetica-Oblique');
            doc.text(config.pie_pagina, { align: 'center' });
        }

        // QR (si existe)
        if (config.mostrar_qr && config.qr_data) {
            try {
                const qrBuffer = Buffer.from(config.qr_data, 'base64');
                const centerX = this.ancho / 2 - 25;
                doc.image(qrBuffer, centerX, doc.y + 5, { width: 50 });
                doc.moveDown(3);
            } catch (e) {
                console.warn('No se pudo cargar el QR');
            }
        }

        doc.fontSize(7).font('Helvetica');
        doc.text('three.js', { align: 'center' });
    }

    _dibujarSeccion(doc) {
        doc.moveDown(0.3);
    }

    _dibujarLinea(doc) {
        const lineWidth = 0.5;
        const startX = 10;
        const endX = this.ancho - 10;
        
        doc.moveTo(startX, doc.y)
           .lineTo(endX, doc.y)
           .lineWidth(lineWidth)
           .stroke();
        
        doc.moveDown(0.3);
    }
}

export default GeneradorFacturaPDF;
