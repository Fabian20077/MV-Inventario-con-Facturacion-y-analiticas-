import { query } from '../config/database.js';

/**
 * Data Access Object para la tabla de configuraciones.
 * Centraliza la interacción con los ajustes persistentes del sistema.
 */
class ConfiguracionDAO {
    /**
     * Obtiene todos los registros de configuración.
     * @returns {Promise<Array>} Lista completa de ajustes.
     */
    static async getAll() {
        const sql = 'SELECT * FROM configuracion ORDER BY categoria, clave';
        return await query(sql);
    }

    /**
     * Obtiene configuraciones filtradas por categoría.
     * @param {string} categoria - Nombre de la categoría a filtrar.
     * @returns {Promise<Array>} Ajustes de la categoría especificada.
     */
    static async getByCategoria(categoria) {
        const sql = 'SELECT * FROM configuracion WHERE categoria = ?';
        return await query(sql, [categoria]);
    }

    /**
     * Obtiene una configuración específica por su clave única.
     * @param {string} clave - Identificador único de la configuración.
     * @returns {Promise<Object|null>} El objeto de configuración o null si no existe.
     */
    static async getByClave(clave) {
        const sql = 'SELECT * FROM configuracion WHERE clave = ?';
        const rows = await query(sql, [clave]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Actualiza el valor de una configuración existente.
     * Aplica reglas estrictas de bloqueo y validación de tipos.
     * @param {string} clave - Clave de la configuración a actualizar.
     * @param {any} nuevoValor - El nuevo valor a persistir.
     * @returns {Promise<Object>} Resultado de la operación.
     */
    static async update(clave, nuevoValor) {
        // 1. Verificar existencia y bloqueo
        const configActual = await this.getByClave(clave);
        if (!configActual) {
            throw new Error(`La configuración con clave "${clave}" no existe.`);
        }

        if (configActual.bloqueado) {
            throw new Error(`La configuración "${clave}" está bloqueada para edición de seguridad.`);
        }

        // 2. Validar tipos de datos
        this._validarTipo(nuevoValor, configActual.tipo_dato, clave);

        // 3. Serializar valor para MySQL (si es necesario)
        const valorAStore = (configActual.tipo_dato === 'json')
            ? JSON.stringify(nuevoValor)
            : String(nuevoValor);

        // 4. Ejecutar actualización
        const sql = 'UPDATE configuracion SET valor = ? WHERE clave = ?';
        await query(sql, [valorAStore, clave]);

        return {
            success: true,
            message: `Configuración "${clave}" actualizada correctamente.`,
            nuevoValor: nuevoValor
        };
    }

    /**
     * Validador privado de tipos de datos.
     * Asegura que el nuevo valor coincida con el esquema definido en la BD.
     */
    static _validarTipo(valor, tipo_dato, clave) {
        let esValido = false;

        switch (tipo_dato) {
            case 'string':
                esValido = typeof valor === 'string';
                break;
            case 'number':
                esValido = typeof valor === 'number' && !isNaN(valor);
                break;
            case 'boolean':
                esValido = typeof valor === 'boolean';
                break;
            case 'json':
                try {
                    // Si ya es objeto, es válido. Si es string, intentamos parsear.
                    if (typeof valor === 'object' && valor !== null) {
                        esValido = true;
                    } else {
                        JSON.parse(valor);
                        esValido = true;
                    }
                } catch (e) {
                    esValido = false;
                }
                break;
            default:
                esValido = false;
        }

        if (!esValido) {
            throw new Error(`Error de tipado: La clave "${clave}" espera un tipo "${tipo_dato}", se recibió "${typeof valor}".`);
        }
    }
}

export default ConfiguracionDAO;
