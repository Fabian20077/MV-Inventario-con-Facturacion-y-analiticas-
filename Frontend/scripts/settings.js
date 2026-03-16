// =====================================================
// CONFIGURACIÓN DE LA PÁGINA DE AJUSTES
// Módulo de Administración de Configuraciones (Admin Only)
// =====================================================
var API_BASE_URL = 'http://localhost:3000'; // Backend API URL
console.log('🔗 API_BASE_URL in settings.js:', API_BASE_URL);

// Verificar si el token ha expirado
function isTokenExpired(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = JSON.parse(decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));

        const currentTime = Math.floor(Date.now() / 1000);
        return jsonPayload.exp < currentTime;
    } catch (error) {
        console.error('Error al verificar token:', error);
        return true; // Si no se puede decodificar, considerar expirado
    }
}

// Obtener token de autenticación verificando expiración
function getAuthToken() {
    // Soportar ambos keys para compatibilidad con diferentes flujos de login
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
        console.warn('❌ No hay token de autenticación');
        return null;
    }

    if (isTokenExpired(token)) {
        console.warn('❌ Token ha expirado');
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }

    return token;
}

/**
 * 🛠️ TRACKING DE CAMBIOS (DIRTY STATE)
 * Almacena solo las claves que han sido modificadas por el usuario.
 * Estructura: Map<clave, nuevoValor>
 */
const dirtySettings = new Map();

/**
 * 🎨 DICCIONARIO VISUAL DE CONFIGURACIONES
 * Mapea las claves técnicas a nombres amigables e iconos.
 */
const CONFIG_UI_MAP = {
    'empresa.nombre': { label: 'Empresa', icon: 'bi-building', description: 'Nombre comercial visible en reportes' },
    'empresa.direccion': { label: 'Dirección', icon: 'bi-geo-alt', description: 'Ubicación física del negocio' },
    'empresa.telefono': { label: 'Teléfono', icon: 'bi-telephone', description: 'Línea de atención al cliente' },
    'empresa.email': { label: 'Correo', icon: 'bi-envelope', description: 'Email para notificaciones' },
    'empresa.nit': { label: 'NIT', icon: 'bi-file-earmark-text', description: 'Número de identificación tributaria' },
    'empresa.logo_path': { label: 'Ruta Logo', icon: 'bi-image', description: 'Ubicación del archivo de imagen' },
    'empresa.logo_mime': { label: 'Formato', icon: 'bi-filetype-png', description: 'Tipo de archivo (PNG/JPG)' },
    'empresa.logo_url': { label: 'URL Logo', icon: 'bi-link-45deg', description: 'Enlace externo de la imagen' },

    'inventario.vencimiento.habilitado': { label: 'Habilitar Gestión de Vencimientos', icon: 'bi-calendar-check', description: 'Activar gestión de caducidad. Si está activo, el sistema pedirá obligatoriamente la fecha de vencimiento al crear productos nuevos.' },
    'inventario.vencimiento.dias_alerta': { label: 'Días de Alerta de Vencimiento', icon: 'bi-alarm', description: 'Días antes de vencer para activar la campanita de notificaciones' },
    'inventario.vencimiento.bloquear_venta': { label: 'Bloquear Venta de Productos Vencidos', icon: 'bi-slash-circle', description: 'Si está activo, el sistema no permitirá generar una Salida de un producto cuya fecha de vencimiento ya pasó' },
    'inventario.stock_negativo': { label: 'Permitir Stock Negativo', icon: 'bi-graph-down-arrow', description: 'Permite registrar ventas incluso si el inventario queda en negativo' },

    'finanzas.impuesto.habilitado': { label: 'Habilitar Cálculo de Impuestos', icon: 'bi-receipt', description: 'Activar el cálculo de impuestos (IVA/Impuesto General de Ventas) en las facturas' },
    'finanzas.impuesto.porcentaje': { label: 'Porcentaje de Impuesto (%)', icon: 'bi-percent', description: 'Porcentaje de impuesto a aplicar en todas las transacciones (Ej: 19% para IVA, 0% para exento)' },
    'finanzas.impuesto.incluido_en_precio': { label: 'Impuesto Incluido en Precio', icon: 'bi-tags', description: 'Si está activo, el precio mostrado ya incluye el impuesto. Si no, se suma al final.' },

    'reporte.formato_impresion': { label: 'Formato de Impresión', icon: 'bi-printer', description: 'Selecciona el formato de impresión para las facturas: Voucher (POS), Coucher (A4), o ambos' },

    'seguridad.session_timeout': { label: 'Timeout Sesión', icon: 'bi-hourglass-split', description: 'Minutos de inactividad para cierre' },
    'seguridad.max_login_attempts': { label: 'Intentos Login', icon: 'bi-shield-lock', description: 'Máximo de fallos antes de bloqueo' }
};

function getConfigUI(clave) {
    return CONFIG_UI_MAP[clave] || {
        // Fallback: Si no está en el mapa, formatear el texto original
        label: clave.split('.').pop().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        icon: 'bi-gear',
        description: null
    };
}

/**
 * Inicialización al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mostrar nombre de usuario desde la sesión ya validada en el head
    if (window.userSession) {
        document.getElementById('userNameDisplay').textContent = window.userSession.nombre || 'Admin';
    }

    // 2. Inicializar navegación de la barra lateral
    initSidebar();

    // 3. Cargar sección inicial (General por defecto)
    loadSettings('General');

    // 4. Delegación de eventos para detectar cambios en inputs
    setupChangeDetection();
});

/**
 * Gestiona el intercambio de pestañas en el sidebar
 */
function initSidebar() {
    const items = document.querySelectorAll('.sidebar-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            if (dirtySettings.size > 0) {
                if (!confirm('⚠️ Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de sección?')) {
                    return;
                }
                dirtySettings.clear();
            }

            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const sectionKey = item.getAttribute('data-section');
            // Capitalizar primera letra para mantener compatibilidad con keys del backend
            const sectionNormalized = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);

            loadSettings(sectionNormalized);
        });
    });
}

/**
 * Registra eventos para detectar modificaciones
 */
function setupChangeDetection() {
    const container = document.getElementById('settingsContent');

    // Escuchar cambios en inputs, textareas y checkboxes
    container.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.hasAttribute('data-key')) return;

        const clave = target.getAttribute('data-key');
        let valor;

        if (target.type === 'checkbox') {
            valor = target.checked;
        } else if (target.type === 'number') {
            valor = parseFloat(target.value);
        } else {
            valor = target.value;
        }

        markAsDirty(clave, valor, target);
    });
}

/**
 * Marca visualmente una configuración como modificada
 */
function markAsDirty(clave, valor, element) {
    dirtySettings.set(clave, valor);

    const card = element.closest('.config-card');
    if (card) {
        card.classList.add('border-l-4', 'border-blue-500', 'bg-blue-50/10');

        // Agregar badge de "Modificado" si no existe
        if (!card.querySelector('.badge-modified')) {
            const labelContainer = card.querySelector('.flex.items-center.gap-3.mb-2');
            const badge = document.createElement('span');
            badge.className = 'badge-modified text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full animate-pulse';
            badge.innerHTML = '<i class="bi bi-pencil-fill"></i> Modificado';
            labelContainer.appendChild(badge);
        }
    }
}

/**
 * Limpia el estado dirty de una tarjeta
 */
function markAsClean(card) {
    card.classList.remove('border-l-4', 'border-blue-500', 'bg-blue-50/10');
    const badge = card.querySelector('.badge-modified');
    if (badge) badge.remove();
}

/**
 * Función central para cargar configuraciones desde el Backend
 */
async function loadSettings(category) {
    // Interceptar carga especial para Impuestos
    if (category.toLowerCase() === 'impuestos') {
        loadImpuestosUI();
        return;
    }

    const contentArea = document.getElementById('settingsContent');
    const token = getAuthToken();

    contentArea.innerHTML = `
        <div class="flex items-center justify-center h-full">
            <div class="text-center animate-spin">
                <i class="bi bi-arrow-repeat text-4xl block text-blue-400"></i>
            </div>
        </div>
    `;

    try {
        const fullUrl = `${API_BASE_URL}/api/admin/configuracion`;
        console.log('🌐 Fetching from URL:', fullUrl);
        
        // Timeout de 15 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            // Verificar que result.data es un objeto
            if (typeof result.data !== 'object' || result.data === null) {
                console.error('result.data no es un objeto:', result.data);
                result.data = {};
            }
            
            const itemsInCategory = result.data[category] || [];
            renderSection(category, itemsInCategory);
        } else {
            showToast(`Error: ${result.message}`, 'error');
            contentArea.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-center py-20">
                    <i class="bi bi-exclamation-triangle text-5xl text-yellow-400 mb-4"></i>
                    <h3 class="text-xl font-bold text-yellow-400 mb-2">Error del Servidor</h3>
                    <p class="text-gray-400 mb-4">${result.message || 'Error desconocido'}</p>
                    <button onclick="loadSettings('${category}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                        <i class="bi bi-arrow-clockwise"></i> Reintentar
                    </button>
                </div>
            `;
        }

    } catch (error) {
        console.error('Error cargando configuraciones:', error);
        const errorMessage = error.name === 'AbortError' 
            ? 'La solicitud tardó demasiado tiempo'
            : error.message || 'No se pudo conectar con el servidor';
            
        contentArea.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center py-20">
                <i class="bi bi-exclamation-triangle text-5xl text-red-400 mb-4"></i>
                <h3 class="text-xl font-bold text-red-400 mb-2">Error de Conexión</h3>
                <p class="text-gray-400 mb-4">${errorMessage}</p>
                <button onclick="loadSettings('${category}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    <i class="bi bi-arrow-clockwise"></i> Reintentar
                </button>
            </div>
        `;
        showToast('Error de conexión al servidor', 'error');
    }
}

/**
 * Renderiza la interfaz de una sección específica
 */
// =====================================================
// RENDERIZADO DE SECCIONES (NUEVO DISEÑO FASE 2)
// =====================================================

function renderSection(title, items) {
    const container = document.getElementById('settingsContent');

    // 🎨 DISEÑO ESPECÍFICO PARA LA SECCIÓN GENERAL
    if (title === 'General') {
        // Verificar que items es un array
        if (!Array.isArray(items)) {
            console.error('items no es un array:', items);
            items = [];
        }
        
        const logoItem = items.find(i => i.clave === 'empresa.logo_path');
        const urlItem = items.find(i => i.clave === 'empresa.logo_url');
        const currentLogoSrc = (logoItem && logoItem.valor) ? logoItem.valor : (urlItem ? urlItem.valor : '');

        // Filtrar items de texto (todo menos logos y configs técnicas)
        const textItems = items.filter(item =>
            item.clave.startsWith('empresa.') &&
            !['empresa.logo_path', 'empresa.logo_mime', 'empresa.logo_url', 'empresa.logo.apply_ui', 'empresa.logo.apply_reports'].includes(item.clave)
        );

        let html = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                    <i class="bi bi-building"></i> Configuración General
                </h2>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- COLUMNA IZQUIERDA: DATOS DE LA EMPRESA -->
                <div class="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h3 class="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
                        <i class="bi bi-file-text"></i> Datos de la Empresa
                    </h3>
                    <div class="space-y-4">
                        ${textItems.map(item => renderCompactField(item)).join('')}
                    </div>
                    <div class="mt-6 flex justify-end">
                         <button id="btnSaveGeneral" onclick="saveAllSettings()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2">
                            <i class="bi bi-save"></i> Guardar Datos
                        </button>
                    </div>
                </div>

                <!-- COLUMNA DERECHA: GESTIÓN DE LOGO (RECONSTRUIDO) -->
                <div class="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h3 class="text-lg font-bold text-blue-300 mb-4 flex items-center gap-2">
                        <i class="bi bi-card-image"></i> Identidad Visual (Logo)
                    </h3>
                    
                    <div class="flex flex-col items-center justify-center mb-6">
                        <div class="w-48 h-48 relative border-2 border-dashed border-gray-500 rounded-xl flex justify-center items-center bg-black/20 overflow-hidden mb-4 group">
                            <img id="logoPreview" src="${currentLogoSrc ? currentLogoSrc + '?t=' + Date.now() : ''}" 
                                 class="${currentLogoSrc ? '' : 'hidden'} max-w-full max-h-full object-contain z-10 transition-transform duration-300 group-hover:scale-105" 
                                 alt="Logo Preview" 
                                 onerror="this.classList.add('hidden'); document.getElementById('noLogoText').classList.remove('hidden');">
                            
                            <div id="noLogoText" class="${currentLogoSrc ? 'hidden' : ''} text-center text-gray-500">
                                <i class="bi bi-image text-4xl mb-2 block"></i>
                                <span class="text-xs">Sin logo</span>
                            </div>

                            <!-- Overlay de carga -->
                            <div id="logoUploadOverlay" class="absolute inset-0 bg-black/80 z-20 hidden flex-col items-center justify-center text-white">
                                <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                <span class="text-xs font-bold" id="uploadProgressText">Subiendo...</span>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <!-- Selector de Archivo -->
                        <div>
                            <label class="block text-sm font-medium text-gray-300 mb-1">Seleccionar Archivo (Máx 5MB)</label>
                            <input type="file" id="logoInput" accept="image/*" class="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer bg-slate-800 rounded-lg border border-slate-700">
                        </div>

                        <!-- Opciones de Aplicación -->
                        <div class="grid grid-cols-2 gap-3 text-xs text-gray-400">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="checkApplyUI" checked class="rounded border-gray-600 bg-slate-800 text-blue-600">
                                Aplicar en Interfaz
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="checkApplyReports" checked class="rounded border-gray-600 bg-slate-800 text-blue-600">
                                Aplicar en Facturas
                            </label>
                        </div>

                        <!-- Botón Subir -->
                        <button id="btnUploadLogo" onclick="uploadLogo()" class="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center gap-2">
                            <i class="bi bi-cloud-upload"></i> Subir Logo
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;
        setupLogoListeners(); // Inicializar listeners del preview
        return;
    }

    // 🎨 RENDERIZADO GENÉRICO PARA OTRAS SECCIONES (SISTEMA, IMPUESTOS, ETC)
    let html = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold flex items-center gap-2">
                <i class="bi bi-sliders"></i> Sección: ${title}
            </h2>
            <button id="btnSaveAll" onclick="saveAllSettings()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-blue-500/20">
                <i class="bi bi-save"></i> <span>Guardar Cambios</span>
            </button>
        </div>
        <div class="space-y-4">
    `;

    // Verificar que items es un array
    if (!Array.isArray(items)) {
        console.error('items no es un array:', items);
        items = [];
    }
    
    if (items.length === 0) {
        html += `<p class="text-gray-400 italic text-center py-20">No hay configuraciones disponibles para "${title}".</p>`;
    } else {
        const otherItems = items.filter(item => !['empresa.logo_path', 'empresa.logo_mime', 'empresa.logo_url'].includes(item.clave));
        otherItems.forEach(item => {
            html += renderConfigCard(item);
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// Helper para renderizar campos compactos en la sección General
function renderCompactField(item) {
    const ui = getConfigUI(item.clave);
    return `
        <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">${ui.label}</label>
            ${renderInputField(item)} <!-- Reutiliza la función existente -->
        </div>
    `;
}

/**
 * Renderiza una tarjeta de configuración individual
 */
function renderConfigCard(item) {
    const isBlocked = item.bloqueado;
    const ui = getConfigUI(item.clave);
    const description = ui.description || item.descripcion || '';

    return `
        <div class="config-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 ${isBlocked ? 'opacity-70 grayscale-[0.5]' : ''}">
            <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                    <label class="block font-bold text-xl text-black dark:text-white flex items-center gap-2">
                        <i class="bi ${ui.icon} text-blue-600 text-2xl"></i> ${ui.label}
                    </label>
                    ${isBlocked ? '<span class="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full"><i class="bi bi-lock-fill"></i> Sistema</span>' : ''}
                    ${item.publico ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><i class="bi bi-eye-fill"></i> Público</span>' : ''}
                </div>
                <p class="text-base text-black dark:text-slate-300 mb-4 ml-9 font-medium opacity-90">${description}</p>
                
                <div class="flex items-center gap-4">
                    ${renderInputField(item)}
                </div>
                <div class="error-msg text-red-500 text-[10px] mt-1 hidden font-bold"></div>
            </div>
        </div>
    `;
}

/**
 * Genera el input HTML correcto según el tipo de dato
 */
function renderInputField(item) {
    const readonly = item.bloqueado ? 'disabled' : '';
    const inputClass = "w-full md:w-1/2 bg-slate-50 dark:bg-slate-800 text-black dark:text-white p-3 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base transition-all font-medium";

    switch (item.tipo_dato) {
        case 'boolean':
            const isChecked = (item.valor === true || item.valor === 'true' || item.valor === 1);
            return `
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" ${isChecked ? 'checked' : ''} ${readonly} data-key="${item.clave}">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
            `;

        case 'number':
            return `<input type="number" data-key="${item.clave}" value="${item.valor}" ${readonly} class="${inputClass}">`;

        case 'json':
            return `<textarea data-key="${item.clave}" ${readonly} class="${inputClass} h-24 font-mono text-xs">${typeof item.valor === 'object' ? JSON.stringify(item.valor, null, 2) : item.valor}</textarea>`;

        default: // string
            return `<input type="text" data-key="${item.clave}" value="${item.valor}" ${readonly} class="${inputClass}">`;
    }
}

/**
 * 🚀 PROCESO DE GUARDADO (SAVE ALL) con manejo robusto de errores y timeout
 * Envía peticiones individuales para cada ajuste modificado.
 */
async function saveAllSettings() {
    if (dirtySettings.size === 0) {
        showToast('No hay cambios pendientes por guardar.', 'info');
        return;
    }

    // Identificar el botón activo (puede ser el genérico o el de la sección General)
    const btn = document.getElementById('btnSaveAll') || document.getElementById('btnSaveGeneral');

    if (!btn) {
        console.error('❌ No se encontró el botón de guardado');
        showToast('Error interno: Botón no encontrado', 'error');
        return;
    }

    const originalContent = btn.innerHTML;
    const token = getAuthToken();

    // Validar token antes de comenzar
    if (!token) {
        showToast('❌ No hay token de autenticación. Inicia sesión nuevamente.', 'error');
        return;
    }

    // Estado visual del botón
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-arrow-repeat animate-spin"></i> Guardando...`;

    let successCount = 0;
    let failCount = 0;
    const totalItems = dirtySettings.size;

    try {
        // Procesar cada ajuste modificado de forma independiente
        const settingsArray = Array.from(dirtySettings.entries());

        for (let i = 0; i < settingsArray.length; i++) {
            const [clave, valor] = settingsArray[i];
            const card = document.querySelector(`[data-key="${clave}"]`);

            if (!card) {
                console.warn(`Card no encontrado para la configuración: ${clave}`);
                continue;
            }

            const errorDisplay = card.querySelector('.error-msg');
            if (errorDisplay) {
                errorDisplay.classList.add('hidden');
            }

            try {
                // Agregar timeout individual para cada petición (12 segundos)
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 12000)
                );

                const savePromise = fetch(`${API_BASE_URL}/api/admin/configuracion/${clave}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ valor })
                });

                // Ejecutar con timeout
                const response = await Promise.race([timeoutPromise, savePromise]);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();

                if (result.success) {
                    markAsClean(card);
                    dirtySettings.delete(clave);
                    successCount++;
                    showToast(`✅ ${getConfigUI(clave).label || clave} actualizado`, 'success');
                } else {
                    failCount++;
                    if (errorDisplay) {
                        errorDisplay.textContent = `❌ ${result.message || 'Error de validación'}`;
                        errorDisplay.classList.remove('hidden');
                    }
                    showToast(`❌ Error en ${getConfigUI(clave).label || clave}`, 'error');
                }
            } catch (error) {
                failCount++;
                console.error(`Error guardando ${clave}:`, error);

                if (errorDisplay) {
                    let errorMessage = '❌ Error de conexión';
                    if (error.message.includes('Timeout')) {
                        errorMessage = '❌ Tiempo de espera agotado';
                    } else if (error.message.includes('HTTP 401')) {
                        errorMessage = '❌ Sesión expirada';
                    } else if (error.message.includes('HTTP 403')) {
                        errorMessage = '❌ Permiso denegado';
                    }
                    errorDisplay.textContent = errorMessage;
                    errorDisplay.classList.remove('hidden');
                }

                showToast(`🔥 Error al guardar ${getConfigUI(clave).label || clave}`, 'error');

                // Si hay error de autenticación, detener todo
                if (error.message.includes('HTTP 401') || error.message.includes('403')) {
                    showToast('🔐 Sesión expirada. Redirigiendo al login...', 'warning');
                    setTimeout(() => {
                        window.location.href = '../pages/login.html';
                    }, 2000);
                    break;
                }
            }

            // Actualizar progreso en el botón
            const progress = Math.round(((i + 1) / totalItems) * 100);
            btn.innerHTML = `<i class="bi bi-arrow-repeat animate-spin"></i> Guardando... ${progress}%`;
        }
    } catch (error) {
        console.error('Error general en saveAllSettings:', error);
        showToast('❌ Error inesperado al guardar configuraciones', 'error');
    } finally {
        // Restaurar botón siempre
        btn.disabled = false;
        btn.innerHTML = originalContent;

        // Mensaje final resumido
        if (successCount > 0 && failCount === 0) {
            showToast(`🎉 ¡Éxito! ${successCount} configuración(es) guardada(s) correctamente.`, 'success');
        } else if (successCount > 0 && failCount > 0) {
            showToast(`⚠️ Proceso completado: ${successCount} guardada(s), ${failCount} con error(es).`, 'warning');
        } else if (failCount > 0) {
            showToast(`❌ Falló el guardado de ${failCount} configuración(es).`, 'error');
        }
    }
}

/**
 * 🍞 SISTEMA DE TOASTS DINÁMICOS
 */
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-500'
    };

    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `${colors[type]} text-white px-4 py-3 rounded-lg shadow-2xl mb-2 flex items-center justify-between min-w-[300px] animate-slide-in-right`;
    toast.innerHTML = `
        <span class="text-sm font-medium">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 opacity-70 hover:opacity-100">&times;</button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col items-end';
    container.style.pointerEvents = 'auto';
    document.body.appendChild(container);
    return container;
}

/**
 * Comprime una imagen usando canvas antes de subirla al servidor.
 * Evita bloquear el hilo principal al procesar imágenes grandes.
 * @param {File} file - Archivo de imagen original
 * @param {number} maxDimension - Dimensión máxima (ancho o alto) en px
 * @param {number} quality - Calidad de compresión (0-1, donde 1 = máxima calidad)
 * @returns {Promise<File>} - Archivo comprimido
 */
async function compressImageForUpload(file, maxDimension = 1200, quality = 0.85) {
    // Si el archivo es pequeño, no comprimir
    if (file.size <= 800 * 1024) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = function () {
            URL.revokeObjectURL(objectUrl);

            // Calcular nuevas dimensiones manteniendo aspect ratio
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
            }

            // Comprimir con canvas (operación asíncrona via toBlob)
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file); // Fallback al original si toBlob falla
                        return;
                    }
                    // Crear nuevo File con el blob comprimido
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    console.log(`🗜️ Imagen comprimida: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
                    resolve(compressedFile);
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = function () {
            URL.revokeObjectURL(objectUrl);
            resolve(file); // Fallback al original si no se puede cargar
        };

        img.src = objectUrl;
    });
}

function setupLogoListeners() {
    const logoInput = document.getElementById('logoInput');
    if (!logoInput) return;
    const urlInput = document.getElementById('logoUrlInput');
    const preview = document.getElementById('logoPreview');
    const noLogoText = document.getElementById('noLogoText');

    // Validar archivo seleccionado
    logoInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            // Validar tipo de archivo
            if (!file.type.startsWith('image/')) {
                showToast('⚠️ Por favor selecciona un archivo de imagen válido', 'warning');
                logoInput.value = '';
                return;
            }

            // Validar tamaño (máximo 5MB - se comprimirá antes de subir)
            if (file.size > 5 * 1024 * 1024) {
                showToast('⚠️ La imagen no debe superar los 5MB', 'warning');
                logoInput.value = '';
                return;
            }

            // ✅ Usar createObjectURL en lugar de FileReader.readAsDataURL
            // createObjectURL es instantáneo y no bloquea el hilo principal
            if (preview) {
                preview.style.opacity = '0.5';
            }

            const objectUrl = URL.createObjectURL(file);

            // Validar que es una imagen cargable
            const img = new Image();
            img.onload = function () {
                if (preview) {
                    // Revocar URL anterior si existe para liberar memoria
                    if (preview.src && preview.src.startsWith('blob:')) {
                        URL.revokeObjectURL(preview.src);
                    }
                    preview.src = objectUrl;
                    preview.classList.remove('hidden');
                    preview.style.opacity = '1';
                    preview.onerror = null;
                }

                if (noLogoText) {
                    noLogoText.classList.add('hidden');
                }
            };

            img.onerror = function () {
                URL.revokeObjectURL(objectUrl);
                showToast('⚠️ El archivo seleccionado no es una imagen válida', 'error');
                logoInput.value = '';
                if (preview) {
                    preview.style.opacity = '1';
                }
            };

            img.src = objectUrl;
        }
    });

    // Preview de URL en tiempo real
    if (urlInput) {
        urlInput.addEventListener('input', function (e) {
            const url = e.target.value.trim();

            if (url && !logoInput.files[0]) { // Solo si no hay archivo seleccionado
                // Validar URL básica
                if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)) {
                    showToast('⚠️ URL debe apuntar a una imagen válida (jpg, png, gif, webp)', 'warning');
                    return;
                }

                // Mostrar indicador de carga
                if (preview) {
                    preview.style.opacity = '0.5';
                }

                const img = new Image();
                img.onload = function () {
                    if (preview) {
                        preview.src = url;
                        preview.classList.remove('hidden');
                        preview.style.opacity = '1';
                        preview.onerror = null;
                    }

                    if (noLogoText) {
                        noLogoText.classList.add('hidden');
                    }
                };

                img.onerror = function () {
                    showToast('⚠️ No se pudo cargar la imagen desde la URL', 'error');
                    if (preview) {
                        preview.style.opacity = '1';
                    }
                };

                img.src = url;
            } else if (!url && !logoInput.files[0]) {
                // Limpiar preview si no hay ni archivo ni URL
                if (preview) {
                    preview.classList.add('hidden');
                    preview.src = '';
                }
                if (noLogoText) {
                    noLogoText.classList.remove('hidden');
                }
            }
        });
    }
}

// Flag para prevenir múltiples subidas simultáneas
let isUploading = false;

/**
 * 🚀 SUBIDA DIRECTA DE LOGO (Sin modal)
 * Lee el archivo desde el input de la sección General y lo envía al backend.
 */
window.uploadLogo = async function () {
    console.log('📂 Función uploadLogo llamada');

    // Prevenir múltiples subidas simultáneas
    if (isUploading) {
        console.warn('⚠️ Subida ya en progreso, ignorando click');
        return;
    }

    // Verificar autenticación
    const token = getAuthToken();
    if (!token) {
        console.error('❌ No hay token de autenticación');
        showToast('❌ Debes iniciar sesión para subir logos', 'error');
        return;
    }

    // Leer archivo directamente del input de la sección General
    const logoInput = document.getElementById('logoInput');
    const file = logoInput ? logoInput.files[0] : null;

    // Validar que hay un archivo seleccionado
    if (!file) {
        showToast('⚠️ Selecciona un archivo de imagen primero', 'warning');
        return;
    }

    // Obtener referencia al botón para feedback visual
    const btn = document.getElementById('btnUploadLogo');
    const originalContent = btn ? btn.innerHTML : '';

    // Marcar como subiendo
    isUploading = true;

    // Mostrar overlay de carga
    const overlay = document.getElementById('logoUploadOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    // Feedback Visual: Estado de Carga en el botón
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="flex items-center gap-2"><i class="bi bi-arrow-repeat animate-spin"></i> Subiendo...</span>`;
    }

    try {
        console.log('📁 Archivo seleccionado:', file.name, `(${(file.size / 1024).toFixed(0)}KB)`);

        // Comprimir imagen antes de subir para evitar congelamientos con archivos grandes
        const compressedFile = await compressImageForUpload(file, 1200, 0.85);

        // Convertir la imagen comprimida a Base64 para enviarla como JSON
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(compressedFile);
        });

        // Enviar preferencias del usuario
        const applyUI = document.getElementById('checkApplyUI');
        const applyReports = document.getElementById('checkApplyReports');

        const payload = {
            imageBase64: base64Data,
            logo_url: '',
            apply_ui: applyUI ? applyUI.checked : true,
            apply_reports: applyReports ? applyReports.checked : true
        };

        console.log('🚀 Iniciando subida de logo (JSON)...');

        const response = await fetch(`${API_BASE_URL}/api/admin/configuracion/logo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('📡 Respuesta del servidor:', response.status);

        let result;
        try {
            result = await response.json();
        } catch (e) {
            console.error('❌ Respuesta no es JSON válido', e);
            showToast('❌ Respuesta inválida del servidor al subir logo', 'error');
            return;
        }

        console.log('📦 Resultado:', result);

        if (result.success) {
            showToast('✅ ¡Logo actualizado correctamente!', 'success');

            // Actualización en Tiempo Real (Anti-Caché)
            const normalizedPath = result.data.path || '';
            const newSrc = normalizedPath
                ? `${API_BASE_URL}${normalizedPath}?t=${Date.now()}`
                : null;

            // Actualizar vista previa en settings
            const preview = document.getElementById('logoPreview');
            if (preview && newSrc) {
                preview.src = newSrc;
                preview.classList.remove('hidden');
                const noLogoText = document.getElementById('noLogoText');
                if (noLogoText) noLogoText.classList.add('hidden');
            }

            // Actualizar logo del header globalmente
            const headerLogo = document.getElementById('headerLogo');
            if (headerLogo && newSrc) headerLogo.src = newSrc;

            // Limpiar el input de archivo
            if (logoInput) logoInput.value = '';

        } else {
            console.error('❌ Error del servidor:', result.message);
            showToast(`❌ Error: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('❌ Error en subida:', error);
        showToast('❌ Error de conexión con el servidor', 'error');
    } finally {
        // Restaurar botón
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }

        // Ocultar overlay de carga
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }

        isUploading = false; // Reset flag
        console.log('🔄 Subida finalizada');
    }
}

/**
 * =====================================================
 * 💰 GESTIÓN DE IMPUESTOS (UI DINÁMICA)
 * =====================================================
 */
async function loadImpuestosUI() {
    const container = document.getElementById('settingsContent');
    // Contenedor principal
    const html = `
        <div class="space-y-6 animate-fade-in-up">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <i class="bi bi-receipt text-blue-600"></i> Gestión de Impuestos
                    </h2>
                    <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Configura los impuestos aplicables a tus ventas.</p>
                </div>
                <button onclick="openCreateImpuestoModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all flex items-center gap-2">
                    <i class="bi bi-plus-lg"></i> Nuevo Impuesto
                </button>
            </div>

            <!-- MASTER SWITCH -->
            <div class="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between mb-4">
                <div>
                    <h3 class="font-bold text-gray-800 dark:text-white">Habilitar Impuestos Globalmente</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Si está desactivado, no se calcularán impuestos en ninguna venta.</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="masterTaxSwitch" class="sr-only peer" onchange="toggleMasterTax(this.checked)">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-gray-700">
                                <th class="p-4 font-semibold text-gray-600 dark:text-gray-300">Nombre</th>
                                <th class="p-4 font-semibold text-gray-600 dark:text-gray-300">Porcentaje</th>
                                <th class="p-4 font-semibold text-gray-600 dark:text-gray-300">Valor Fijo</th>
                                <th class="p-4 font-semibold text-gray-600 dark:text-gray-300 text-center">Estado</th> 
                                <th class="p-4 font-semibold text-gray-600 dark:text-gray-300 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="lista-impuestos" class="divide-y divide-gray-100 dark:divide-gray-700">
                            <tr><td colspan="5" class="p-8 text-center text-gray-500">Cargando impuestos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    loadImpuestosData(); // Cargar estado del switch y tabla
}

// Cargar datos (Switch + Tabla) con timeout y manejo robusto de errores
async function loadImpuestosData() {
    const listaElement = document.getElementById('lista-impuestos');
    const switchElement = document.getElementById('masterTaxSwitch');

    // Mostrar estado de carga
    if (listaElement) {
        listaElement.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-500"><i class="bi bi-arrow-repeat animate-spin text-2xl mb-2 block"></i> Cargando impuestos...</td></tr>';
    }

    try {
        // Agregar timeout de 15 segundos para evitar carga infinita
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout: La carga de impuestos tomó demasiado tiempo')), 15000)
        );

        const dataPromise = async () => {
            const taxesUrl = `${API_BASE_URL}/api/impuestos`;
            console.log('💰 Fetching taxes from:', taxesUrl);

            const configUrl = `${API_BASE_URL}/api/admin/configuracion/finanzas.impuestos.habilitado`;
            console.log('⚙️ Fetching config from:', configUrl);

            const responses = await Promise.allSettled([
                fetch(taxesUrl, {
                    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                }).catch(() => ({ ok: false, json: () => ({ impuestos: [] }) })),

                fetch(configUrl, {
                    headers: { 'Authorization': `Bearer ${getAuthToken()}` }
                }).catch(() => ({ ok: false, json: () => ({ valor: 'true' }) }))
            ]);

            // Procesar respuesta de impuestos
            const impuestosResult = responses[0];
            let impuestos = [];
            if (impuestosResult.status === 'fulfilled' && impuestosResult.value.ok) {
                const data = await impuestosResult.value.json();
                impuestos = data.data || data.impuestos || [];
            }

            // Procesar respuesta de configuración
            const configResult = responses[1];
            let configValor = 'true';
            if (configResult.status === 'fulfilled' && configResult.value.ok) {
                const config = await configResult.value.json();
                configValor = config.valor || 'true';
            }

            // Actualizar UI
            if (switchElement) {
                switchElement.checked = (configValor === 'true');
            }

            renderImpuestosTable(impuestos);

            return { success: true, impuestos, configValor };
        };

        // Ejecutar con timeout
        await Promise.race([timeoutPromise, dataPromise()]);

    } catch (error) {
        console.error('Error cargando impuestos:', error);

        // Mostrar mensaje de error específico
        if (error.message.includes('Timeout')) {
            showToast('⏰ La carga de impuestos está tomando demasiado tiempo', 'error');
            if (listaElement) {
                listaElement.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center">
                            <i class="bi bi-exclamation-triangle text-3xl text-yellow-500 mb-2 block"></i>
                            <p class="text-gray-600 font-medium">Tiempo de espera agotado</p>
                            <p class="text-gray-400 text-sm mt-1">La carga está demorando demasiado. Intenta recargar la página.</p>
                            <button onclick="loadImpuestosData()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <i class="bi bi-arrow-clockwise"></i> Reintentar
                            </button>
                        </td>
                    </tr>
                `;
            }
        } else {
            showToast('Error de conexión al cargar impuestos', 'error');
            if (listaElement) {
                listaElement.innerHTML = `
                    <tr>
                        <td colspan="5" class="p-8 text-center">
                            <i class="bi bi-wifi-off text-3xl text-red-500 mb-2 block"></i>
                            <p class="text-gray-600 font-medium">Error de conexión</p>
                            <p class="text-gray-400 text-sm mt-1">No se pudieron cargar los impuestos</p>
                            <button onclick="loadImpuestosData()" class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <i class="bi bi-arrow-clockwise"></i> Reintentar
                            </button>
                        </td>
                    </tr>
                `;
            }
        }
    }
}

async function toggleMasterTax(enabled) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/configuracion/finanzas.impuestos.habilitado`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ valor: !!enabled })
        });

        if (response.ok) {
            showToast(enabled ? 'Impuestos habilitados' : 'Impuestos deshabilitados', 'info');
            loadImpuestosData(); // Recargar para asegurar
        } else {
            document.getElementById('masterTaxSwitch').checked = !enabled; // Revertir
            showToast('Error al actualizar configuración', 'error');
        }
    } catch (error) {
        document.getElementById('masterTaxSwitch').checked = !enabled;
        showToast('Error de conexión', 'error');
    }
}

function renderImpuestosTable(impuestos) {
    const container = document.getElementById('lista-impuestos');

    if (impuestos.length === 0) {
        container.innerHTML = `
            <div class="p-10 text-center text-gray-400">
                <i class="bi bi-inbox text-5xl mb-3 block"></i>
                <p>No hay impuestos configurados.</p>
            </div>
        `;
        return;
    }

    let html = '';

    impuestos.forEach(imp => {
        const isSelected = imp.seleccionado === 1 || imp.seleccionado === true;
        html += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="p-4 font-medium text-slate-800 dark:text-white">
                    ${imp.nombre}
                    ${isSelected ? '<span class="ml-2 text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase font-bold">Activo</span>' : ''}
                </td>
                <td class="p-4 text-center font-bold text-slate-600 dark:text-slate-300">${imp.porcentaje}%</td>
                <td class="p-4 text-center font-bold text-slate-600 dark:text-slate-300">${imp.valor_fijo ? `$${imp.valor_fijo}` : '-'}</td>
                <td class="p-4 text-center">
                    <span class="w-3 h-3 rounded-full inline-block ${isSelected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-300 dark:bg-slate-600'}"></span>
                </td>
                <td class="p-4 text-right space-x-2">
                    <!-- BOTONES SIEMPRE VISIBLES (Flexibilidad Total) -->
                    ${!isSelected ? `
                        <button onclick="activarImpuesto(${imp.id})" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1.5 rounded-md font-bold transition-colors border border-blue-200" title="Usar este impuesto">
                            <i class="bi bi-check-lg"></i> Seleccionar
                        </button>
                    `: ''}

                    <button onclick="openEditImpuestoModal(${imp.id}, '${imp.nombre}', ${imp.porcentaje}, ${imp.valor_fijo || 0})" class="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-600 px-3 py-1.5 rounded-md font-bold transition-colors border border-yellow-200" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    
                    <button onclick="eliminarImpuesto(${imp.id})" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-md font-bold transition-colors border border-red-200" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    container.innerHTML = html;
}

// ==========================================
// 🌍 EXPORTAR FUNCIONES AL ÁMBITO GLOBAL
// ==========================================
// Esto asegura que los eventos onclick="..." en el HTML funcionen correctamente
window.toggleMasterTax = toggleMasterTax;
window.loadImpuestosData = loadImpuestosData;
window.loadImpuestosUI = loadImpuestosUI;
window.openCreateImpuestoModal = openCreateImpuestoModal;
window.openEditImpuestoModal = openEditImpuestoModal;
window.guardarNuevoImpuesto = guardarNuevoImpuesto;
window.guardarEdicionImpuesto = guardarEdicionImpuesto;
window.eliminarImpuesto = eliminarImpuesto;
window.activarImpuesto = activarImpuesto;
window.setImpuestoTipo = setImpuestoTipo;

// Lógica de Modales
async function openCreateImpuestoModal(id = null, currentNombre = '', currentPorcentaje = '', currentValorFijo = '') {
    const existingModal = document.getElementById('createImpuestoModal');
    if (existingModal) existingModal.remove();

    const isEdit = id !== null;
    const title = isEdit ? 'Editar Impuesto' : 'Nuevo Impuesto';
    const action = isEdit ? `guardarEdicionImpuesto(${id})` : 'guardarNuevoImpuesto()';

    const modalHtml = `
        <div id="createImpuestoModal" class="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                <div class="p-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
                    <h3 class="font-bold text-lg text-gray-800 dark:text-white">${title}</h3>
                </div>
                <div class="p-6 space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                        <input type="text" id="newImpNombre" value="${currentNombre}" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="Ej: IVA General">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Porcentaje (%)</label>
                            <input type="number" id="newImpPorcentaje" value="${currentPorcentaje}" step="0.01" class="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="0">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Fijo ($)</label>
                            <div class="relative">
                                <span class="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span>
                                <input type="number" id="newImpValorFijo" value="${currentValorFijo}" class="w-full p-2.5 pl-7 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="0">
                            </div>
                        </div>
                    </div>
                    
                    <p class="text-xs text-gray-500 italic bg-blue-50 dark:bg-slate-800/50 p-2 rounded border border-blue-100 dark:border-slate-700">
                        <i class="bi bi-info-circle"></i> Puedes combinar ambos. El impuesto total será la suma del porcentaje más el valor fijo.
                    </p>
                </div>
                <div class="p-5 flex justify-end gap-3 bg-gray-50 dark:bg-slate-900/50">
                    <button onclick="document.getElementById('createImpuestoModal').remove()" class="px-4 py-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                    <button onclick="${action}" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-transform hover:scale-105">Guardar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('newImpNombre').focus();
}

function setImpuestoTipo(tipo) {
    document.getElementById('newImpTipo').value = tipo;

    // Actualizar estilos botones
    const btnP = document.getElementById('btnTipoPorcentaje');
    const btnF = document.getElementById('btnTipoFijo');

    if (tipo === 'porcentaje') {
        btnP.className = 'flex-1 py-1.5 text-sm font-bold rounded-md transition-all bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400';
        btnF.className = 'flex-1 py-1.5 text-sm font-bold rounded-md transition-all text-gray-500 hover:text-gray-700';
        document.getElementById('lblValor').textContent = 'Porcentaje (%)';
        document.getElementById('newImpPorcentaje').placeholder = 'Ej: 19';
        document.getElementById('helpText').textContent = 'Se calculará el porcentaje sobre el subtotal.';
    } else {
        btnF.className = 'flex-1 py-1.5 text-sm font-bold rounded-md transition-all bg-white dark:bg-slate-600 shadow text-green-600 dark:text-green-400';
        btnP.className = 'flex-1 py-1.5 text-sm font-bold rounded-md transition-all text-gray-500 hover:text-gray-700';
        document.getElementById('lblValor').textContent = 'Valor del Impuesto ($)';
        document.getElementById('newImpPorcentaje').placeholder = 'Ej: 1000';
        document.getElementById('helpText').textContent = 'Se sumará este valor fijo al total.';
    }
}

function openEditImpuestoModal(id, nombre, porcentaje, valorFijo) {
    openCreateImpuestoModal(id, nombre, porcentaje, valorFijo);
}

async function guardarEdicionImpuesto(id) {
    const nombre = document.getElementById('newImpNombre').value.trim();
    const porcentaje = document.getElementById('newImpPorcentaje').value;
    const valorFijo = document.getElementById('newImpValorFijo').value;

    if (!nombre) {
        showToast('El nombre es obligatorio', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/impuestos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                nombre,
                porcentaje: parseFloat(porcentaje) || 0,
                valor_fijo: parseFloat(valorFijo) || 0
            })
        });
        const result = await response.json();

        if (result.success) {
            document.getElementById('createImpuestoModal').remove();
            showToast('Impuesto actualizado', 'success');
            loadImpuestosUI();
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

async function guardarNuevoImpuesto() {
    const nombre = document.getElementById('newImpNombre').value.trim();
    const porcentaje = document.getElementById('newImpPorcentaje').value;
    const valorFijo = document.getElementById('newImpValorFijo').value;

    if (!nombre) {
        showToast('El nombre es obligatorio', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/impuestos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                nombre,
                porcentaje: parseFloat(porcentaje) || 0,
                valor_fijo: parseFloat(valorFijo) || 0
            })
        });
        const result = await response.json();

        if (result.success) {
            document.getElementById('createImpuestoModal').remove();
            showToast('Impuesto creado exitosamente', 'success');
            loadImpuestosUI();
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

async function activarImpuesto(id) {
    showToast('Actualizando configuración de impuestos...', 'info');

    try {
        const response = await fetch(`${API_BASE_URL}/api/impuestos/${id}/activar`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const result = await response.json();

        if (result.success) {
            showToast('✅ Impuesto activado y aplicado globalmente', 'success');
            loadImpuestosUI();
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

async function eliminarImpuesto(id) {
    if (!confirm('¿Estás seguro de eliminar este impuesto? Las facturas antiguas NO se verán afectadas.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/impuestos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });
        const result = await response.json();

        if (result.success) {
            showToast('Impuesto eliminado', 'success');
            loadImpuestosUI();
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast('Error de conexión', 'error');
    }
}

