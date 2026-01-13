/**
 * facturas.js
 * Rutas de API para la gestión de facturas
 * 
 * Endpoints:
 * POST   /api/facturas                    - Crear nueva factura
 * GET    /api/facturas                    - Listar facturas con filtros
 * GET    /api/facturas/:id                - Obtener una factura específica
 * DELETE /api/facturas/:id/anular         - Anular una factura
 * GET    /api/facturas/resumen/:fecha     - Resumen de ventas del día
 */

import express from 'express';
import FacturaDAO from '../dao/FacturaDAO.js';
import { verificarToken, verificarAdmin } from '../middleware/auth.js';
import { validarDatos } from '../middleware/validate.js';
import { z } from 'zod';
import GeneradorFacturaPDF from '../utils/generador-factura-pdf.js';

const router = express.Router();

// Esquemas de validación
const schemaCrearFactura = z.object({
    detalles: z.array(
        z.object({
            producto_id: z.number().int().positive('Producto ID debe ser positivo'),
            cantidad: z.number().int().positive('Cantidad debe ser mayor a 0')
        })
    ).min(1, 'Debe incluir al menos un producto'),
    
    iva_porcentaje: z.number().positive().default(19),
    observaciones: z.string().optional().default('')
});

const schemaAnularFactura = z.object({
    motivo: z.string().min(5, 'El motivo debe tener al menos 5 caracteres').optional().default('')
});

const schemaFiltros = z.object({
    estado: z.enum(['emitida', 'anulada', 'devuelta', 'todas']).optional().default('emitida'),
    fecha_desde: z.string().date().optional(),
    fecha_hasta: z.string().date().optional(),
    usuario_id: z.number().int().optional(),
    pagina: z.number().int().positive().optional().default(1),
    limite: z.number().int().positive().max(100).optional().default(20)
});

/**
 * POST /api/facturas
 * Crear una nueva factura
 * 
 * Body:
 * {
 *   "detalles": [
 *     {"producto_id": 1, "cantidad": 2},
 *     {"producto_id": 3, "cantidad": 1}
 *   ],
 *   "iva_porcentaje": 19,
 *   "observaciones": "Cliente especial"
 * }
 */
router.post('/', verificarToken, async (req, res) => {
    try {
        // Validar datos
        const datosValidados = schemaCrearFactura.parse(req.body);

        // Crear factura
        const factura = await FacturaDAO.crearFactura({
            usuario_id: req.usuario.id,
            ...datosValidados
        });

        res.status(201).json({
            success: true,
            mensaje: '✅ Factura creada exitosamente',
            factura
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validación fallida',
                detalles: error.errors
            });
        }

        console.error('Error al crear factura:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al crear factura'
        });
    }
});

/**
 * GET /api/facturas
 * Listar facturas con filtros
 * 
 * Query params:
 * - estado: emitida | anulada | devuelta | todas (default: emitida)
 * - fecha_desde: YYYY-MM-DD
 * - fecha_hasta: YYYY-MM-DD
 * - usuario_id: number
 * - pagina: number (default: 1)
 * - limite: number (default: 20)
 */
router.get('/', verificarToken, async (req, res) => {
    try {
        // Validar filtros
        const filtros = schemaFiltros.parse(req.query);

        // Si no es admin, solo ve sus propias facturas
        if (req.usuario.rol_id !== 1) {
            filtros.usuario_id = req.usuario.id;
        }

        const resultado = await FacturaDAO.listarFacturas(filtros);

        res.json({
            success: true,
            ...resultado
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validación de filtros fallida',
                detalles: error.errors
            });
        }

        console.error('Error al listar facturas:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al listar facturas'
        });
    }
});

/**
 * GET /api/facturas/:id
 * Obtener una factura específica
 */
router.get('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const factura = await FacturaDAO.obtenerFacturaPorId(id);

        if (!factura) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        // Si no es admin, solo puede ver sus propias facturas
        if (req.usuario.rol_id !== 1 && factura.usuario_id !== req.usuario.id) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permiso para ver esta factura'
            });
        }

        res.json({
            success: true,
            factura
        });

    } catch (error) {
        console.error('Error al obtener factura:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al obtener factura'
        });
    }
});

/**
 * DELETE /api/facturas/:id/anular
 * Anular una factura
 * 
 * Body:
 * {
 *   "motivo": "Error en cálculo"
 * }
 */
router.delete('/:id/anular', verificarToken, verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const datosValidados = schemaAnularFactura.parse(req.body);

        const factura = await FacturaDAO.anularFactura(
            id,
            req.usuario.id,
            datosValidados.motivo
        );

        res.json({
            success: true,
            mensaje: '✅ Factura anulada correctamente',
            factura
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validación fallida',
                detalles: error.errors
            });
        }

        console.error('Error al anular factura:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al anular factura'
        });
    }
});

/**
 * GET /api/facturas/resumen/:fecha
 * Obtener resumen de ventas del día
 * 
 * Params:
 * - fecha: YYYY-MM-DD
 */
router.get('/resumen/:fecha', verificarToken, async (req, res) => {
    try {
        const { fecha } = req.params;

        // Validar formato de fecha
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de fecha inválido. Use YYYY-MM-DD'
            });
        }

        const resumen = await FacturaDAO.obtenerResumenDia(fecha);

        res.json({
            success: true,
            fecha,
            resumen
        });

    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al obtener resumen'
        });
    }
});

/**
 * GET /api/facturas/:id/pdf
 * Generar y descargar PDF de factura en formato voucher/coucher
 */
router.get('/:id/pdf', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener factura
        const factura = await FacturaDAO.obtenerFacturaPorId(id);

        if (!factura) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        // Si no es admin, solo puede descargar sus propias facturas
        if (req.usuario.rol_id !== 1 && factura.usuario_id !== req.usuario.id) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permiso para descargar esta factura'
            });
        }

        // Generar PDF
        const doc = GeneradorFacturaPDF.generarFacturaCoucher(factura);

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Factura-${factura.numero_factura}.pdf"`);

        // Enviar PDF al cliente
        doc.pipe(res);
        doc.end();

    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error al generar PDF de factura'
        });
    }
});

export default router;
