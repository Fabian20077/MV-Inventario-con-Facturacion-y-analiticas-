import ConfiguracionDAO from '../dao/ConfiguracionDAO.js';

/**
 * Loader Global de Configuraciones.
 * Se encarga de pre-cargar los ajustes en memoria para evitar consultas recurrentes a la BD.
 */
class ConfiguracionLoader {
    constructor() {
        this.cache = {};
        this.initialized = false;
    }

    /**
     * Carga inicial de todas las configuraciones.
     * Debe llamarse al arrancar el servidor (server.js).
     */
    async loadConfiguraciones() {
        try {
            console.log('📦 Cargando configuraciones del sistema...');
            const configuraciones = await ConfiguracionDAO.getAll();

            configuraciones.forEach(config => {
                this.cache[config.clave] = {
                    valor: this._parseValor(config.valor, config.tipo_dato),
                    publico: config.publico === 1 || config.publico === true
                };
            });

            this.initialized = true;
            console.log(`✅ ${configuraciones.length} configuraciones cargadas en caché.`);
        } catch (error) {
            console.error('❌ Error crítico al cargar configuraciones:', error);
            // Si falla la carga inicial, el sistema podría estar en un estado inconsistente
            throw error;
        }
    }

    /**
     * Obtiene una configuración de la caché de forma síncrona.
     * @param {string} clave - La clave de la configuración.
     * @returns {any} El valor parseado.
     */
    getConfig(clave) {
        if (!this.initialized) {
            console.warn(`⚠️ Intento de acceder a "${clave}" antes de inicializar el loader.`);
        }

        if (this.cache[clave] === undefined) {
            throw new Error(`Configuración crítica faltante: "${clave}". Verifique la base de datos.`);
        }

        return this.cache[clave].valor;
    }

    /**
     * Obtiene una configuración o un valor predeterminado si no existe.
     * @param {string} clave - La clave de la configuración.
     * @param {any} defaultValue - Valor de respaldo.
     * @returns {any} El valor encontrado o el default.
     */
    getConfigOrDefault(clave, defaultValue) {
        return this.cache[clave] !== undefined ? this.cache[clave].valor : defaultValue;
    }

    /**
     * Retorna todas las configuraciones marcadas como públicas.
     * Útil para exponer al frontend de forma segura.
     * @returns {Object} Mapa de clave: valor de configs públicas.
     */
    getPublicConfig() {
        const publicas = {};
        for (const [clave, data] of Object.entries(this.cache)) {
            if (data.publico) {
                publicas[clave] = data.valor;
            }
        }
        return publicas;
    }

    /**
     * Verifica si una clave es pública.
     */
    isPublic(clave) {
        return this.cache[clave] ? this.cache[clave].publico : false;
    }

    /**
     * Recarga una configuración específica desde la base de datos.
     * Útil después de una actualización para mantener la caché sincronizada.
     */
    async reloadClave(clave) {
        const config = await ConfiguracionDAO.getByClave(clave);
        if (config) {
            this.cache[clave] = {
                valor: this._parseValor(config.valor, config.tipo_dato),
                publico: config.publico === 1 || config.publico === true
            };
            console.log(`🔄 Caché actualizada para: ${clave}`);
        }
    }

    /**
     * Retorna todas las configuraciones con sus metadatos.
     * Diseñado para el panel de administración.
     */
    async getAllAdmin() {
        const rows = await ConfiguracionDAO.getAll();

        // Agrupar por categoría
        const agrupado = {};
        rows.forEach(row => {
            if (!agrupado[row.categoria]) {
                agrupado[row.categoria] = [];
            }
            agrupado[row.categoria].push({
                clave: row.clave,
                valor: this._parseValor(row.valor, row.tipo_dato),
                tipo_dato: row.tipo_dato,
                descripcion: row.descripcion,
                bloqueado: row.bloqueado === 1 || row.bloqueado === true,
                publico: row.publico === 1 || row.publico === true,
                ultima_actualizacion: row.ultima_actualizacion
            });
        });

        return agrupado;
    }

    /**
     * Parsea el valor string de la BD al tipo real de JS.
     * @private
     */
    _parseValor(valor, tipo_dato) {
        switch (tipo_dato) {
            case 'number':
                return Number(valor);
            case 'boolean':
                return valor === 'true' || valor === '1' || valor === 1;
            case 'json':
                try {
                    return typeof valor === 'string' ? JSON.parse(valor) : valor;
                } catch (e) {
                    console.error(`Error parseando JSON para valor: ${valor}`);
                    return {};
                }
            case 'string':
            default:
                return valor;
        }
    }
}

// Exportar una única instancia para ser compartida en toda la app (Singleton)
const loader = new ConfiguracionLoader();
export default loader;
export const getConfig = (clave) => loader.getConfig(clave);
export const getConfigOrDefault = (clave, def) => loader.getConfigOrDefault(clave, def);
