/**
 * Invoice PDF Generator for Thermal/POS Printers
 * Compatible with 80mm thermal printers (226 points width)
 * 
 * @module generador-factura-pdf-mejorado
 * @version 2.0.0
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

class GeneradorFacturaPDF {
    constructor(config = {}) {
        this.ancho = config.ancho || 226;
        this.margen = 10;
        this.fontSizeSmall = 7;
        this.fontSizeNormal = 9;
        this.fontSizeMedium = 11;
        this.fontSizeLarge = 14;
    }

    /**
     * Formats a number as Colombian currency
     * @param {number} valor - The value to format
     * @returns {string} Formatted currency string
     */
    _formatearMoneda(valor) {
        if (typeof valor !== 'number' || isNaN(valor)) {
            return '$0';
        }
        return '$' + valor.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    /**
     * Formats a date in Colombian locale
     * @param {Date|string} fecha - Date to format
     * @returns {string} Formatted date string
     */
    _formatearFecha(fecha) {
        try {
            const date = new Date(fecha);
            return date.toLocaleString('es-CO', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return new Date().toLocaleString('es-CO');
        }
    }

    /**
     * Generate invoice PDF
     * @param {Object} factura - Invoice data
     * @param {Object} configuracion - Business configuration
     * @param {string} outputPath - Output file path
     * @returns {Promise<string>} Path to generated PDF
     */
    async generarFactura(factura, configuracion, outputPath) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [this.ancho, 600],
                    margin: this.margen,
                    bufferPages: true
                });

                const stream = fs.createWriteStream(outputPath);
                doc.pipe(stream);

                // Header with logo and business info
                this._dibujarEncabezado(doc, configuracion);

                // Invoice info (number and date)
                this._dibujarLinea(doc);
                this._dibujarInfoFactura(doc, factura);

                // Client info
                this._dibujarLinea(doc);
                this._dibujarInfoCliente(doc, factura);

                // Products table
                this._dibujarLinea(doc);
                this._dibujarTablaProductos(doc, factura);

                // Totals section
                this._dibujarTotales(doc, factura);

                // Payment method
                this._dibujarLinea(doc);
                this._dibujarFormaPago(doc, factura);

                // Footer
                this._dibujarPiePagina(doc, configuracion);

                doc.end();

                stream.on('finish', () => resolve(outputPath));
                stream.on('error', (err) => reject(err));

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Draw header section with logo and business information
     */
    _dibujarEncabezado(doc, config) {
        const centerX = this.ancho / 2;
        let currentY = 15;

        // Company logo (only if configured and available)
        if (config.mostrar_logo && config.logo_data) {
            try {
                const logoBuffer = Buffer.from(config.logo_data, 'base64');
                doc.image(logoBuffer, centerX - 25, currentY, {
                    width: 50,
                    height: 50,
                    align: 'center'
                });
                currentY += 55;
                doc.y = currentY;
            } catch (e) {
                // Logo not available, continue without it
            }
        }

        // Business name
        doc.fontSize(this.fontSizeLarge)
            .font('Helvetica-Bold')
            .text(config.nombre_negocio || 'MI NEGOCIO', this.margen, doc.y, {
                width: this.ancho - (this.margen * 2),
                align: 'center'
            });

        // Business details
        doc.fontSize(this.fontSizeNormal).font('Helvetica');

        if (config.direccion) {
            doc.text(config.direccion, {
                width: this.ancho - (this.margen * 2),
                align: 'center'
            });
        }

        if (config.telefono) {
            doc.text(`Tel: ${config.telefono}`, {
                width: this.ancho - (this.margen * 2),
                align: 'center'
            });
        }

        if (config.nit) {
            doc.text(`NIT: ${config.nit}`, {
                width: this.ancho - (this.margen * 2),
                align: 'center'
            });
        }

        doc.moveDown(0.5);
    }

    /**
     * Draw invoice information (number and date)
     */
    _dibujarInfoFactura(doc, factura) {
        doc.moveDown(0.3);
        doc.fontSize(this.fontSizeNormal).font('Helvetica');

        const numeroFactura = factura.numero_factura || `FAC-${Date.now()}`;
        const fecha = this._formatearFecha(factura.fecha || factura.fecha_emision || new Date());

        doc.text(`Factura #: ${numeroFactura}`, this.margen, doc.y, {
            width: this.ancho - (this.margen * 2)
        });
        doc.text(`Fecha: ${fecha}`, {
            width: this.ancho - (this.margen * 2)
        });

        doc.moveDown(0.3);
    }

    /**
     * Draw client information
     */
    _dibujarInfoCliente(doc, factura) {
        doc.moveDown(0.3);

        // Client name (bold)
        doc.fontSize(this.fontSizeNormal).font('Helvetica-Bold');
        doc.text(`Cliente: ${factura.cliente_nombre || 'Consumidor Final'}`, this.margen, doc.y, {
            width: this.ancho - (this.margen * 2)
        });

        // Client details (regular)
        doc.font('Helvetica');

        if (factura.cliente_direccion || factura.direccion) {
            doc.text(`Direccion: ${factura.cliente_direccion || factura.direccion}`, {
                width: this.ancho - (this.margen * 2)
            });
        }

        if (factura.cliente_telefono || factura.telefono) {
            doc.text(`Telefono: ${factura.cliente_telefono || factura.telefono}`, {
                width: this.ancho - (this.margen * 2)
            });
        }

        if (factura.cliente_nit || factura.nit) {
            doc.text(`NIT: ${factura.cliente_nit || factura.nit}`, {
                width: this.ancho - (this.margen * 2)
            });
        }

        doc.moveDown(0.3);
    }

    /**
     * Draw products table with proper alignment
     */
    _dibujarTablaProductos(doc, factura) {
        doc.moveDown(0.3);

        // Column positions (adjusted for 226pt width)
        const col = {
            producto: this.margen,
            cantidad: 85,
            precio: 125,
            total: 170
        };

        // Column widths
        const width = {
            producto: 70,
            cantidad: 35,
            precio: 40,
            total: 45
        };

        // Table header
        doc.fontSize(this.fontSizeSmall).font('Helvetica-Bold');
        const headerY = doc.y;

        doc.text('Producto', col.producto, headerY, { width: width.producto });
        doc.text('Cant.', col.cantidad, headerY, { width: width.cantidad, align: 'right' });
        doc.text('Precio', col.precio, headerY, { width: width.precio, align: 'right' });
        doc.text('Total', col.total, headerY, { width: width.total, align: 'right' });

        doc.moveDown(0.8);
        this._dibujarLineaPunteada(doc);

        // Product rows
        doc.font('Helvetica').fontSize(this.fontSizeSmall);

        const detalles = factura.detalles || [];

        detalles.forEach(detalle => {
            const rowY = doc.y;

            // Product name (truncate if too long)
            const nombreProducto = detalle.producto_nombre || detalle.nombre_producto || 'Producto';
            const nombreTruncado = nombreProducto.length > 18
                ? nombreProducto.substring(0, 15) + '...'
                : nombreProducto;

            // Quantity with unit
            const cantidad = detalle.cantidad || 0;
            const unidad = detalle.unidad_medida || 'UND';
            const cantidadTexto = `${cantidad}${unidad}`;

            // Prices
            const precioUnitario = detalle.precio_unitario || 0;
            const subtotalLinea = detalle.subtotal || detalle.subtotal_linea || (precioUnitario * cantidad);

            doc.text(nombreTruncado, col.producto, rowY, { width: width.producto });
            doc.text(cantidadTexto, col.cantidad, rowY, { width: width.cantidad, align: 'right' });
            doc.text(this._formatearMoneda(precioUnitario), col.precio, rowY, { width: width.precio, align: 'right' });
            doc.text(this._formatearMoneda(subtotalLinea), col.total, rowY, { width: width.total, align: 'right' });

            doc.moveDown(0.7);
        });

        this._dibujarLinea(doc);
    }

    /**
     * Draw totals section with subtotal, tax, and total
     */
    _dibujarTotales(doc, factura) {
        const labelX = 100;
        const valueX = 165;
        const valueWidth = 50;

        doc.moveDown(0.3);

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
        if (factura.impuesto > 0) {
            doc.text('IVA (19%):', colLabel, doc.y, { width: 40 });
            doc.text(
                factura.impuesto.toLocaleString('es-CO', { 
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

        this._dibujarLineaPunteada(doc);

        // Total (highlighted)
        doc.fontSize(this.fontSizeMedium).font('Helvetica-Bold');
        const totalY = doc.y;
        doc.text('TOTAL:', labelX, totalY, { width: 60 });
        doc.text(this._formatearMoneda(factura.total || 0), valueX, totalY, {
            width: valueWidth,
            align: 'right'
        });

        doc.fontSize(this.fontSizeNormal).font('Helvetica');
        doc.moveDown(0.5);
    }

    /**
     * Draw payment method and observations
     */
    _dibujarFormaPago(doc, factura) {
        doc.moveDown(0.3);
        doc.fontSize(this.fontSizeNormal).font('Helvetica-Bold');

        const formaPago = factura.forma_pago || 'Efectivo';
        const formaPagoCapitalized = formaPago.charAt(0).toUpperCase() + formaPago.slice(1).toLowerCase();

        doc.text(`Forma de Pago: ${formaPagoCapitalized}`, this.margen, doc.y, {
            width: this.ancho - (this.margen * 2),
            align: 'center'
        });

        doc.font('Helvetica');

        if (factura.observaciones) {
            doc.moveDown(0.3);
            doc.fontSize(this.fontSizeSmall);
            doc.text(`Obs: ${factura.observaciones}`, {
                width: this.ancho - (this.margen * 2),
                align: 'center'
            });
        }

        doc.moveDown(0.5);
    }

    /**
     * Draw footer with thank you message
     */
    _dibujarPiePagina(doc, config) {
        this._dibujarLinea(doc);
        doc.moveDown(0.3);

        // Thank you message
        doc.fontSize(this.fontSizeSmall).font('Helvetica-Oblique');
        const mensaje = config.pie_pagina || 'Gracias por su compra!';
        doc.text(mensaje, this.margen, doc.y, {
            width: this.ancho - (this.margen * 2),
            align: 'center'
        });

        // QR code (if configured)
        if (config.mostrar_qr && config.qr_data) {
            try {
                doc.moveDown(0.5);
                const qrBuffer = Buffer.from(config.qr_data, 'base64');
                const centerX = (this.ancho / 2) - 25;
                doc.image(qrBuffer, centerX, doc.y, { width: 50 });
            } catch (e) {
                // QR not available, skip
            }
        }
    }

    /**
     * Draw a solid horizontal line
     */
    _dibujarLinea(doc) {
        const startX = this.margen;
        const endX = this.ancho - this.margen;

        doc.moveTo(startX, doc.y)
            .lineTo(endX, doc.y)
            .lineWidth(0.5)
            .stroke();

        doc.moveDown(0.3);
    }

    /**
     * Draw a dotted/dashed horizontal line
     */
    _dibujarLineaPunteada(doc) {
        const startX = this.margen;
        const endX = this.ancho - this.margen;

        doc.moveTo(startX, doc.y)
            .lineTo(endX, doc.y)
            .lineWidth(0.3)
            .dash(3, { space: 2 })
            .stroke();

        doc.undash();
        doc.moveDown(0.3);
    }
}

export default GeneradorFacturaPDF;
