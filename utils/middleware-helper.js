/**
 * Helper para ejecutar middleware en servidor HTTP nativo
 * Convierte middleware estilo Express a funciones compatibles con http.createServer
 */
export function runMiddleware(req, res, middleware) {
    return new Promise((resolve, reject) => {
        middleware(req, res, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Helper para ejecutar múltiples middlewares en secuencia
 */
export async function runMiddlewares(req, res, middlewares) {
    for (const middleware of middlewares) {
        try {
            await runMiddleware(req, res, middleware);
        } catch (error) {
            throw error;
        }
    }
}
