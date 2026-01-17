/**
 * routes/impuestos.js
 * Rutas para gestión de impuestos
 */

import express from 'express';
import ImpuestoDAO from '../dao/ImpuestoDAO.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Middleware de autenticación para todas las rutas
router.use(authenticateToken);

/**
 * GET /api/impuestos - Obtener todos los impuestos
 */
router.get('/impuestos', async (req, res) => {
    try {
        const impuestos = await ImpuestoDAO.obtenerTodos();
        res.json({
            success: true,
            data: impuestos
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/impuestos/:id - Obtener impuesto por ID
 */
router.get('/impuestos/:id', async (req, res) => {
    try {
        const impuesto = await ImpuestoDAO.obtenerPorId(req.params.id);
        if (!impuesto) {
            return res.status(404).json({
                success: false,
                error: 'Impuesto no encontrado'
            });
        }
        res.json({
            success: true,
            data: impuesto
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/impuestos - Crear nuevo impuesto
 */
router.post('/impuestos', async (req, res) => {
    try {
        const { nombre, tipo, porcentaje, valor_fijo, activo } = req.body;

        if (!nombre || !tipo) {
            return res.status(400).json({
                success: false,
                error: 'Nombre y tipo son requeridos'
            });
        }

        // Validar tipo de impuesto
        const tiposValidos = ['porcentaje', 'fijo', 'mixto'];
        if (!tiposValidos.includes(tipo.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Tipo de impuesto no válido. Debe ser: porcentaje, fijo o mixto'
            });
        }

        // Validar que porcentaje y valor_fijo sean números válidos
        const porc = parseFloat(porcentaje) || 0;
        const valFijo = parseFloat(valor_fijo) || 0;

        if (porc < 0 || valFijo < 0) {
            return res.status(400).json({
                success: false,
                error: 'Porcentaje y valor fijo deben ser números positivos'
            });
        }

        const impuesto = await ImpuestoDAO.crear({
            nombre,
            tipo: tipo.toLowerCase(),
            porcentaje: porc,
            valor_fijo: valFijo,
            activo: activo !== undefined ? Boolean(activo) : true
        });

        res.status(201).json({
            success: true,
            data: impuesto,
            message: 'Impuesto creado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/impuestos/:id - Actualizar impuesto
 */
router.put('/impuestos/:id', async (req, res) => {
    try {
        const { nombre, tipo, porcentaje, valor_fijo, activo } = req.body;

        const impuestoExistente = await ImpuestoDAO.obtenerPorId(req.params.id);
        if (!impuestoExistente) {
            return res.status(404).json({
                success: false,
                error: 'Impuesto no encontrado'
            });
        }

        // Validar tipo de impuesto
        if (tipo) {
            const tiposValidos = ['porcentaje', 'fijo', 'mixto'];
            if (!tiposValidos.includes(tipo.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de impuesto no válido. Debe ser: porcentaje, fijo o mixto'
                });
            }
        }

        // Validar que porcentaje y valor_fijo sean números válidos
        let porc = impuestoExistente.porcentaje;
        let valFijo = impuestoExistente.valor_fijo;

        if (porcentaje !== undefined) {
            porc = parseFloat(porcentaje);
            if (isNaN(porc) || porc < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Porcentaje debe ser un número positivo'
                });
            }
        }

        if (valor_fijo !== undefined) {
            valFijo = parseFloat(valor_fijo);
            if (isNaN(valFijo) || valFijo < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valor fijo debe ser un número positivo'
                });
            }
        }

        const impuesto = await ImpuestoDAO.actualizar(req.params.id, {
            nombre: nombre || impuestoExistente.nombre,
            tipo: tipo ? tipo.toLowerCase() : impuestoExistente.tipo,
            porcentaje: porc,
            valor_fijo: valFijo,
            activo: activo !== undefined ? Boolean(activo) : impuestoExistente.activo
        });

        res.json({
            success: true,
            data: impuesto,
            message: 'Impuesto actualizado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/impuestos/:id - Eliminar impuesto (desactivar)
 */
router.delete('/impuestos/:id', async (req, res) => {
    try {
        const impuesto = await ImpuestoDAO.obtenerPorId(req.params.id);
        if (!impuesto) {
            return res.status(404).json({
                success: false,
                error: 'Impuesto no encontrado'
            });
        }

        // Verificar si está en uso
        const enUso = await ImpuestoDAO.estaEnUso(req.params.id);
        if (enUso) {
            return res.status(400).json({
                success: false,
                error: 'No se puede eliminar el impuesto porque está en uso en facturas'
            });
        }

        await ImpuestoDAO.eliminar(req.params.id);

        res.json({
            success: true,
            message: 'Impuesto desactivado exitosamente'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;