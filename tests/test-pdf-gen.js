
import GeneradorFacturaPDF from '../utils/generador-factura-pdf-mejorado.js';
import path from 'path';
import fs from 'fs';

const mockFactura = {
    numero_factura: 'FAC-TEST-002',
    fecha_emision: new Date(),
    cliente_nombre: 'Cristian Cano',
    cliente_nit: '12345678',
    cliente_direccion: 'Calle 52 Sur # 70-90',
    cliente_telefono: '300 123 4567',
    subtotal: 9400,
    impuesto_monto: 0,
    impuesto_nombre: 'IVA',
    impuesto_porcentaje: 0,
    total: 9400,
    forma_pago: 'Efectivo',
    detalles: [
        {
            producto_nombre: 'Bandeja de granadilla',
            cantidad: 3,
            precio_unitario: 2300,
            subtotal_linea: 6900
        },
        {
            producto_nombre: 'Manzana roja',
            cantidad: 1,
            precio_unitario: 2500,
            subtotal_linea: 2500
        }
    ]
};

const mockConfig = {
    nombre_negocio: 'ECL FRUVER',
    nit: '1128460388',
    direccion: 'CALLE 52 SUR # 70 - 90',
    telefono: '312 888 0719',
    pie_pagina: 'three.js',
    logo_data: '' // Add base64 if needed
};

const outputDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const outputPath = path.join(outputDir, 'test_factura_fruver.pdf');

console.log('Generando factura estilo Fruver...');
const generador = new GeneradorFacturaPDF(mockConfig);
generador.generarFactura(mockFactura, mockConfig, outputPath)
    .then(path => console.log(`Factura generada en: ${path}`))
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
