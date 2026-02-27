import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';

class GeneradorFacturaPDF {
    constructor(config = {}) {
        this.config = config;
        this.templatePath = path.join(process.cwd(), 'utils', 'templates', 'factura.hbs');
    }

    _formatearMoneda(valor) {
        const numero = parseFloat(valor);
        if (isNaN(numero)) return '$0';
        return '$' + numero.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    _formatearNumero(valor) {
        const numero = parseFloat(valor);
        if (isNaN(numero)) return '0';
        return numero.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    _formatearFecha(fecha) {
        try {
            if (!fecha) return new Date().toLocaleDateString('es-CO');

            // Si ya viene formateada (tiene coma), devolverla tal cual
            if (typeof fecha === 'string' && fecha.includes(',')) {
                return fecha;
            }

            const date = new Date(fecha);
            // Validar si es fecha válida
            if (isNaN(date.getTime())) return new Date().toLocaleDateString('es-CO');
            return date.toLocaleDateString('es-CO') + ', ' + date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return new Date().toLocaleDateString('es-CO');
        }
    }

    async generarFactura(factura, configuracion, outputPath) {
        let browser = null;
        try {
            // 1. Preparar datos para el template
            let templateHtml;
            try {
                templateHtml = fs.readFileSync(this.templatePath, 'utf8');
            } catch (err) {
                console.error('Error leyendo template:', err);
                throw new Error(`No se encontró el template en ${this.templatePath}`);
            }

            const template = handlebars.compile(templateHtml);

            // Preparar items con formato limpio para la tabla
            const items = (factura.detalles || []).map(d => {
                const precio = parseFloat(d.precio_unitario || 0);
                const subtotal = d.subtotal_linea || (d.cantidad * precio);
                return {
                    nombre: d.producto_nombre || d.nombre_producto || 'Producto',
                    cantidad: d.cantidad,
                    precio_unitario_fmt: this._formatearMoneda(precio),
                    precio_unitario_clean: this._formatearNumero(precio),
                    subtotal_linea_fmt: this._formatearMoneda(subtotal),
                    subtotal_linea_clean: this._formatearNumero(subtotal)
                };
            });

            // Usar fecha_emision si existe, sino fallback a fecha, sino fallback a ahora.
            // Asegurar que _formatearFecha maneje cualquier input.
            const fechaRaw = factura.fecha_emision || factura.fecha || new Date();
            const fechaFormateada = this._formatearFecha(fechaRaw);

            const data = {
                numero_factura: factura.numero_factura,
                fecha_emision: fechaFormateada,
                cliente_nombre: factura.cliente_nombre || 'Consumidor Final',
                cliente_nit: factura.cliente_nit || '',
                direccion_cliente: factura.cliente_direccion || factura.direccion || '',
                telefono_cliente: factura.cliente_telefono || factura.telefono || '',

                direccion: configuracion.direccion || '',
                telefono: configuracion.telefono || '',
                nit: configuracion.nit || '',
                nombre_negocio: configuracion.nombre_negocio || 'MI NEGOCIO',
                logo_data: configuracion.logo_data || null,

                detalles: items,

                subtotal_fmt: this._formatearMoneda(factura.subtotal),
                impuesto_nombre: factura.impuesto_nombre || 'IVA',
                impuesto_porcentaje: factura.impuesto_porcentaje || 0,
                impuesto_monto: parseFloat(factura.impuesto_monto) > 0 ? factura.impuesto_monto : null,
                impuesto_monto_fmt: this._formatearMoneda(factura.impuesto_monto),
                total_fmt: this._formatearMoneda(factura.total),

                forma_pago: (factura.forma_pago || 'Efectivo').toUpperCase(),
                observaciones: factura.observaciones,
                pie_pagina: configuracion.pie_pagina || '¡Gracias por su compra!'
            };

            const htmlContent = template(data);

            // 2. Lanzar Puppeteer
            const launchConfig = {
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            };

            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }

            browser = await puppeteer.launch(launchConfig);

            const page = await browser.newPage();

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // 3. Generar PDF (80mm width standard)
            // Calculamos altura dinámica
            const bodyHeight = await page.evaluate(() => {
                const body = document.querySelector('.receipt');
                return body ? body.scrollHeight + 20 : 800;
            });

            await page.pdf({
                path: outputPath,
                width: '80mm',
                height: bodyHeight + 'px', // Altura dinámica corregida
                scale: 1,
                printBackground: true,
                margin: {
                    top: '0px',
                    bottom: '0px',
                    left: '0px',
                    right: '0px'
                }
            });

            console.log(`✅ PDF generado (Puppeteer): ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error('❌ Error fatal generando PDF con Puppeteer:', error);
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    }
}

export default GeneradorFacturaPDF;
