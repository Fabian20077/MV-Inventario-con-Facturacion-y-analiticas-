/**
 * routes/facturacion.js
 * Rutas para gestión de facturas y configuración
 */

import express from 'express';
import FacturaDAO from '../dao/FacturaDAO.js';
import ClienteDAO from '../dao/ClienteDAO.js';
import GeneradorFacturaPDF from '../utils/generador-factura-pdf-mejorado.js';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

// =====================================================
// RUTAS: CLIENTES
// =====================================================

/**
 * GET /api/clientes - Obtener todos los clientes
 */
router.get('/clientes', async (req, res) => {
    try {
        const clientes = await ClienteDAO.obtenerTodos();
        res.json({
            success: true,
            data: clientes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clientes/:id - Obtener cliente por ID
 */
router.get('/clientes/:id', async (req, res) => {
    try {
        const cliente = await ClienteDAO.obtenerPorId(req.params.id);
        if (!cliente) {
            return res.status(404).json({
                success: false,
                error: 'Cliente no encontrado'
            });
        }
        res.json({
            success: true,
            data: cliente
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/clientes - Crear nuevo cliente
 */
router.post('/clientes', async (req, res) => {
    try {
        const { nombre, nit, direccion, telefono, correo } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                error: 'El nombre del cliente es requerido'
            });
        }

        const cliente = await ClienteDAO.crear({
            nombre,
            nit,
            direccion,
            telefono,
            correo
        });

        res.status(201).json({
            success: true,
            data: cliente,
            message: 'Cliente creado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/clientes/:id - Actualizar cliente
 */
router.put('/clientes/:id', async (req, res) => {
    try {
        const cliente = await ClienteDAO.actualizar(req.params.id, req.body);
        res.json({
            success: true,
            data: cliente,
            message: 'Cliente actualizado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/clientes/:id - Eliminar cliente
 */
router.delete('/clientes/:id', async (req, res) => {
    try {
        await ClienteDAO.eliminar(req.params.id);
        res.json({
            success: true,
            message: 'Cliente eliminado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// RUTAS: FACTURAS
// =====================================================

/**
 * GET /api/facturas - Obtener todas las facturas
 */
router.get('/facturas', async (req, res) => {
    try {
        const facturas = await FacturaDAO.obtenerTodas(req.query);
        res.json({
            success: true,
            data: facturas
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:id - Obtener factura por ID
 */
router.get('/facturas/:id', async (req, res) => {
    try {
        const factura = await FacturaDAO.obtenerPorId(req.params.id);
        if (!factura) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }
        res.json({
            success: true,
            data: factura
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/facturas - Crear nueva factura
 */
router.post('/facturas', async (req, res) => {
    try {
        const { cliente_id, items, forma_pago, observaciones, impuesto_id } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Debe agregar al menos un producto a la factura'
            });
        }

        const factura = await FacturaDAO.crear({
            cliente_id,
            usuario_id: req.user.id,
            items,
            forma_pago,
            observaciones,
            impuesto_id
        });

        res.status(201).json({
            success: true,
            data: factura,
            message: 'Factura creada exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:id/pdf - Descargar factura en PDF
 */
router.get('/facturas/:id/pdf', async (req, res) => {
    try {
        const factura = await FacturaDAO.obtenerPorId(req.params.id);
        if (!factura) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        const config = await FacturaDAO.obtenerConfiguracionImpresion();
        const generador = new GeneradorFacturaPDF();
        
        const fileName = `factura_${factura.numero_factura}.pdf`;
        const filePath = path.join(__dirname, '../logs', fileName);

        // Crear directorio si no existe
        if (!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }

        await generador.generarFactura(factura, config, filePath);

        // Enviar archivo
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error al descargar archivo:', err);
            }
            // Eliminar archivo después de descargarlo
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) console.error('Error al eliminar archivo:', unlinkErr);
            });
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/facturas/:id/estado - Actualizar estado de factura
 */
router.put('/facturas/:id/estado', async (req, res) => {
    try {
        const { estado } = req.body;
        
        if (!['pendiente', 'pagada', 'cancelada'].includes(estado)) {
            return res.status(400).json({
                success: false,
                error: 'Estado inválido'
            });
        }

        const factura = await FacturaDAO.actualizarEstado(req.params.id, estado);
        res.json({
            success: true,
            data: factura,
            message: 'Estado de factura actualizado'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/facturas/:id - Anular factura
 */
router.delete('/facturas/:id', async (req, res) => {
    try {
        const factura = await FacturaDAO.anular(req.params.id);
        res.json({
            success: true,
            data: factura,
            message: 'Factura anulada exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// RUTAS: CONFIGURACIÓN DE IMPRESIÓN
// =====================================================

/**
 * GET /api/configuracion/impresion - Obtener configuración
 */
router.get('/configuracion/impresion', async (req, res) => {
    try {
        const config = await FacturaDAO.obtenerConfiguracionImpresion();
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/configuracion/impresion - Actualizar configuración
 */
router.put('/configuracion/impresion', async (req, res) => {
    try {
        const config = await FacturaDAO.actualizarConfiguracionImpresion(req.body);
        res.json({
            success: true,
            data: config,
            message: 'Configuración actualizada exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;
