/**
 * Middleware genérico para validar datos con Zod
 * @param {ZodSchema} schema - Esquema de Zod para validar
 * @returns {Function} Middleware function
 */
export function validateRequest(schema) {
    return async (req, res, next) => {
        try {
            // Validar el body con el schema
            const validatedData = schema.parse(req.body);

            // Reemplazar req.body con los datos validados
            req.body = validatedData;

            next();
        } catch (error) {
            // Si la validación falla, retornar errores
            const errors = error.errors?.map(err => ({
                field: err.path.join('.'),
                message: err.message
            })) || [{ message: 'Error de validación' }];

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Datos inválidos',
                errors: errors
            }));
        }
    };
}
