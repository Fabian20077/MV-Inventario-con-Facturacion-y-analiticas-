import fs from 'fs';
import path from 'path';
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
     * Asegura que las claves necesarias para branding y facturación existan con valores por defecto.
     */
    static async ensureDefaults() {
        const defaults = [
            {
                clave: 'empresa.logo_path',
                valor: '',
                tipo_dato: 'string',
                categoria: 'Branding',
                descripcion: 'Ruta pública del logo corporativo',
                bloqueado: 0,
                publico: 1
            },
            {
                clave: 'empresa.logo_data',
                valor: '',
                tipo_dato: 'string',
                categoria: 'Branding',
                descripcion: 'Imagen base64 del logo para PDFs',
                bloqueado: 0,
                publico: 0
            },
            {
                clave: 'empresa.logo_mime',
                valor: '',
                tipo_dato: 'string',
                categoria: 'Branding',
                descripcion: 'Tipo MIME del logo (image/png, image/jpeg, etc.)',
                bloqueado: 0,
                publico: 0
            },
            {
                clave: 'empresa.logo.apply_ui',
                valor: '1',
                tipo_dato: 'boolean',
                categoria: 'Branding',
                descripcion: 'Aplica el logo en la interfaz',
                bloqueado: 0,
                publico: 1
            },
            {
                clave: 'empresa.logo.apply_reports',
                valor: '1',
                tipo_dato: 'boolean',
                categoria: 'Branding',
                descripcion: 'Aplica el logo en facturas y reportes',
                bloqueado: 0,
                publico: 0
            },
            {
                clave: 'empresa.mostrar_logo',
                valor: '1',
                tipo_dato: 'boolean',
                categoria: 'Branding',
                descripcion: 'Si se debe mostrar el logo en los documentos',
                bloqueado: 0,
                publico: 1
            },
            {
                clave: 'facturacion.pie_pagina',
                valor: '¡Gracias por su compra!',
                tipo_dato: 'string',
                categoria: 'Facturación',
                descripcion: 'Mensaje de pie de página en facturas',
                bloqueado: 0,
                publico: 1
            }
        ];

        const promises = defaults.map(item => this._upsertDefaultConfig(item));
        await Promise.all(promises);
    }

    static async _upsertDefaultConfig(config) {
        const sql = `
            INSERT INTO configuracion 
                (clave, valor, tipo_dato, categoria, descripcion, bloqueado, publico)
            VALUES
                (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                valor = VALUES(valor),
                tipo_dato = VALUES(tipo_dato),
                categoria = VALUES(categoria),
                descripcion = VALUES(descripcion),
                bloqueado = VALUES(bloqueado),
                publico = VALUES(publico)
        `;
        await query(sql, [
            config.clave,
            config.valor,
            config.tipo_dato,
            config.categoria,
            config.descripcion,
            config.bloqueado,
            config.publico
        ]);
    }

    static async setValue(clave, valor) {
        const sql = 'UPDATE configuracion SET valor = ? WHERE clave = ?';
        const result = await query(sql, [String(valor), clave]);
        if (result.affectedRows === 0) {
            await query(
                `INSERT INTO configuracion 
                    (clave, valor, tipo_dato, categoria, descripcion, bloqueado, publico)
                 VALUES (?, ?, 'string', 'Branding', 'Valor generado automáticamente', 0, 1)
                 ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
                [clave, String(valor)]
            );
        }
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
        const configActual = await this.getByClave(clave);
        if (!configActual) {
            throw new Error(`La configuración con clave "${clave}" no existe.`);
        }

        if (configActual.bloqueado) {
            throw new Error(`La configuración "${clave}" está bloqueada para edición de seguridad.`);
        }

        this._validarTipo(nuevoValor, configActual.tipo_dato, clave);

        const valorAStore = (configActual.tipo_dato === 'json')
            ? JSON.stringify(nuevoValor)
            : String(nuevoValor);

        const sql = 'UPDATE configuracion SET valor = ? WHERE clave = ?';
        await query(sql, [valorAStore, clave]);

        return {
            success: true,
            message: `Configuración "${clave}" actualizada correctamente.`,
            nuevoValor: nuevoValor
        };
    }

    static async obtenerConfiguracionParaPDF() {
        const config = {
            nombre_negocio: 'MI NEGOCIO',
            direccion: '',
            telefono: '',
            nit: '',
            mostrar_logo: false,
            apply_reports: true,
            logo_data: null,
            logo_path: '',
            logo_mime: '',
            pie_pagina: '¡Gracias por su compra!'
        };

        const claves = [
            'empresa.nombre',
            'empresa.direccion',
            'empresa.telefono',
            'empresa.nit',
            'empresa.mostrar_logo',
            'empresa.logo_data',
            'empresa.logo_path',
            'empresa.logo_mime',
            'empresa.logo.apply_reports',
            'facturacion.pie_pagina'
        ];

        for (const clave of claves) {
            try {
                const row = await this.getByClave(clave);
                if (row) {
                    const key = clave.split('.').pop();
                    switch (clave) {
                        case 'empresa.logo_data':
                            if (row.valor) config.logo_data = row.valor;
                            break;
                        case 'empresa.logo_path':
                            config.logo_path = row.valor || '';
                            break;
                        case 'empresa.logo_mime':
                            config.logo_mime = row.valor || '';
                            break;
                        case 'empresa.mostrar_logo':
                            config.mostrar_logo = row.valor === '1' || row.valor === true;
                            break;
                        case 'empresa.logo.apply_reports':
                            config.apply_reports = row.valor === '1' || row.valor === true;
                            break;
                        default:
                            if (row.valor) {
                                config[key] = row.valor;
                            }
                    }
                }
            } catch (e) {
                // Ignorar errores de claves no existentes
            }
        }

        // Respetar bandera de uso en reportes/facturación.
        config.mostrar_logo = Boolean(config.mostrar_logo && config.apply_reports);

        if ((!config.logo_data || config.logo_data === '') && config.logo_path) {
            try {
                const absolutePath = path.isAbsolute(config.logo_path)
                    ? config.logo_path
                    : path.join(process.cwd(), config.logo_path);

                if (fs.existsSync(absolutePath)) {
                    const buffer = fs.readFileSync(absolutePath);
                    config.logo_data = buffer.toString('base64');
                    if (!config.logo_mime) {
                        config.logo_mime = this._guessMimeType(absolutePath);
                    }
                }
            } catch (e) {
                // No hacemos nada si no se puede leer el archivo
            }
        }

        return config;
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

    static _guessMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        return map[ext] || 'application/octet-stream';
    }
}

export default ConfiguracionDAO;
