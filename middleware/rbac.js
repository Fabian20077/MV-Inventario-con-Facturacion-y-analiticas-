/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Defined Roles:
 *   1 = Administrador - Full system access, users, settings, logs.
 *   2 = Gerente       - Analytics, global reports, inventory, price editing.
 *   3 = Cliente       - Catalog access, restricted view.
 *   4 = Cajero        - Sales, stock view, inventory movements, invoicing.
 */

const PERMISOS = {
    // Inventory & Products
    'productos.leer': [1, 2, 3, 4],
    'productos.crear': [1, 2],
    'productos.editar': [1, 2],
    'productos.eliminar': [1],

    // Inventory Movements
    'movimientos.leer': [1, 2, 4],
    'movimientos.crear': [1, 2, 4],
    'movimientos.eliminar': [1],

    // Invoicing
    'facturas.leer': [1, 2, 4],
    'facturas.crear': [1, 2, 4],
    'facturas.anular': [1],

    // Analytics & Reports
    'analytics.leer': [1, 2],
    'analytics.exportar': [1, 2],
    'analytics.resetear': [1],

    // User Management
    'usuarios.leer': [1],
    'usuarios.crear': [1],
    'usuarios.editar': [1],
    'usuarios.eliminar': [1],

    // Technical Configuration
    'configuracion.leer': [1],
    'configuracion.editar': [1],
    'backup': [1],
    'logs': [1]
};

/**
 * Middleware to check if the authenticated user has permission for a specific action
 * @param {string} permiso - The permission key to check against PERMISOS mapping
 */
export function requirePermission(permiso) {
    return (req, res, next) => {
        // req.usuario should be populated by authenticateJWT middleware
        const user = req.usuario || req.user;
        const userRol = user ? user.rol_id : null;

        if (!userRol) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Autenticación requerida' }));
            return;
        }

        const rolesPermitidos = PERMISOS[permiso] || [];

        if (!rolesPermitidos.includes(userRol)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Acceso denegado: No tienes permisos para esta acción'
            }));
            return;
        }

        next();
    };
}

/**
 * Shortcut middleware for admin-only routes
 */
export function requireAdmin(req, res, next) {
    return requirePermission('configuracion.editar')(req, res, next);
}

/**
 * Shortcut middleware for manager or admin routes
 */
export function requireGerente(req, res, next) {
    const user = req.usuario || req.user;
    if (user && (user.rol_id === 1 || user.rol_id === 2)) {
        next();
    } else {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Acceso restringido a Gerentes o Administradores' }));
    }
}
