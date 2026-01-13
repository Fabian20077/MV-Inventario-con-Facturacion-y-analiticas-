// =====================================================
// CONFIGURACIÓN DE LA PÁGINA DE AJUSTES
// Módulo de Administración de Configuraciones (Admin Only)
// =====================================================
const API_BASE_URL = 'http://127.0.0.1:3000';

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

            const sectionNormalized = item.textContent.trim();
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
            const labelContainer = card.querySelector('.flex.items-center.gap-2.mb-1');
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
    const contentArea = document.getElementById('settingsContent');
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    contentArea.innerHTML = `
        <div class="flex items-center justify-center h-full">
            <div class="text-center animate-spin">
                <i class="bi bi-arrow-repeat text-4xl block text-blue-400"></i>
            </div>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/configuracion`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            const itemsInCategory = result.data[category] || [];
            renderSection(category, itemsInCategory);
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }

    } catch (error) {
        showToast('Error de conexión al servidor', 'error');
    }
}

/**
 * Renderiza la interfaz de una sección específica
 */
function renderSection(title, items) {
    const container = document.getElementById('settingsContent');

    let html = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold flex items-center gap-2">
                <i class="bi bi-sliders"></i> Sección: ${title}
            </h2>
            <button id="btnSaveAll" onclick="saveAllSettings()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-blue-500/20">
                <i class="bi bi-save"></i> <span>Guardar Todo</span>
            </button>
        </div>
        <div class="space-y-4">
    `;

    if (items.length === 0) {
        if (title !== 'General') {
            html += `<p class="text-gray-400 italic text-center py-20">No hay configuraciones disponibles para "${title}".</p>`;
        }
    } else {
        // Filtrar configuraciones técnicas que no queremos mostrar como texto
        let filteredItems;

        if (title === 'General') {
            // Mostrar todos los campos de empresa excepto logo_path y logo_mime que son técnicos
            filteredItems = items.filter(item => 
                item.clave.startsWith('empresa.') && 
                !['empresa.logo_path', 'empresa.logo_mime'].includes(item.clave)
            );
        } else {
            filteredItems = items.filter(item => !['empresa.logo_path', 'empresa.logo_mime', 'empresa.logo_url', 'empresa.logo.apply_ui', 'empresa.logo.apply_reports'].includes(item.clave));
        }

        // Organizar configuraciones: Separar vencimientos del resto en Inventario
        if (title === 'Inventario') {
            const vencimientos = filteredItems.filter(item => item.clave.startsWith('inventario.vencimiento'));
            const otras = filteredItems.filter(item => !item.clave.startsWith('inventario.vencimiento'));

            // Renderizar otras configuraciones primero
            otras.forEach(item => {
                html += renderConfigCard(item);
            });

            // Renderizar sección de Gestión de Vencimientos
            if (vencimientos.length > 0) {
                html += `
                    <div class="mt-8 mb-6">
                        <div class="border-t-2 border-blue-500 pt-4">
                            <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                                <i class="bi bi-calendar-event text-blue-600 text-xl"></i> Gestión de Vencimientos
                            </h3>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Configuración de alertas y controles para productos con fecha de caducidad</p>
                        </div>
                    </div>
                `;
                vencimientos.forEach(item => {
                    html += renderConfigCard(item);
                });
            }
        } else {
            // Para otras secciones, renderizar normalmente
            filteredItems.forEach(item => {
                html += renderConfigCard(item);
            });
        }
    }

    // Si estamos en la sección General, agregar el módulo de Logo al final
    if (title === 'General') {
        // Buscar el path actual del logo en los items originales (antes de filtrar)
        const logoItem = items.find(i => i.clave === 'empresa.logo_path');
        const urlItem = items.find(i => i.clave === 'empresa.logo_url');
        
        // Prioridad visual: Si hay path local úsalo, si no, usa la URL
        const currentLogoSrc = (logoItem && logoItem.valor) ? logoItem.valor : (urlItem ? urlItem.valor : '');

        html += `
            <div class="config-card p-6 mt-6 transition-all duration-300">
                <div class="flex flex-col md:flex-row gap-8 items-center">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <label class="block font-bold text-xl text-black dark:text-white flex items-center gap-2">
                                <i class="bi bi-card-image text-blue-600 text-2xl"></i> Logo del Sistema
                            </label>
                        </div>
                        <p class="text-base text-black dark:text-slate-300 mb-4 ml-9 font-medium opacity-90">
                            Personaliza la imagen que aparece en el menú y los reportes. Formatos: PNG, JPG, WEBP (Max 2MB).
                            <br><span class="text-xs text-gray-500">Nota: Si subes un archivo, tendrá prioridad sobre la URL.</span>
                        </p>
                        <div class="ml-9 space-y-4">
                            <!-- Opción 1: Archivo -->
                            <div>
                                <label class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 block">Opción A: Subir Archivo</label>
                                <input type="file" id="logoInput" accept="image/*" class="block w-full text-sm text-black dark:text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg">
                            </div>
                            
                            <!-- Opción 2: URL -->
                            <div>
                                <label class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 block">Opción B: URL de Imagen</label>
                                <div class="flex gap-2">
                                    <input type="url" id="logoUrlInput" placeholder="https://ejemplo.com/mi-logo.png" value="${urlItem ? urlItem.valor : ''}" class="flex-1 bg-slate-50 dark:bg-slate-800 text-black dark:text-white p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                                </div>
                            </div>

                            <button id="btnUploadLogo" onclick="uploadLogo()" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 shadow-md">
                                <i class="bi bi-check-circle"></i> Subir y Actualizar
                            </button>
                        </div>
                    </div>
                    <div class="w-48 h-48 flex-shrink-0 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex justify-center items-center bg-slate-50 dark:bg-slate-800 p-2 relative overflow-hidden">
                        <img id="logoPreview" src="${currentLogoSrc ? currentLogoSrc + '?t=' + Date.now() : ''}" class="${currentLogoSrc ? '' : 'hidden'} max-w-full max-h-full object-contain z-10" alt="Logo Preview" onerror="this.style.display='none'; document.getElementById('noLogoText').classList.remove('hidden');">
                        <div id="noLogoText" class="${currentLogoSrc ? 'hidden' : ''} text-center text-slate-400">
                            <i class="bi bi-image text-4xl mb-2 block"></i>
                            <span class="text-xs">Sin logo</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL DE PERSONALIZACIÓN DE IDENTIDAD -->
            <div id="identityModal" class="fixed inset-0 bg-black/50 z-[9999] hidden backdrop-blur-sm">
                <div class="flex items-center justify-center min-h-screen p-4">
                    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div class="p-6 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <i class="bi bi-palette text-blue-600"></i> Personalizar Identidad del Sistema
                            </h3>
                        </div>
                        <div class="p-6 space-y-6">
                            <p class="text-gray-600 dark:text-gray-300 text-sm">¿Dónde deseas aplicar estos cambios?</p>
                            
                            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <span class="font-medium text-gray-800 dark:text-gray-200"><i class="bi bi-laptop me-2"></i> Interfaz del Sistema</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="checkApplyUI" class="sr-only peer" checked>
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <span class="font-medium text-gray-800 dark:text-gray-200"><i class="bi bi-file-earmark-pdf me-2"></i> Documentos Oficiales</span>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="checkApplyReports" class="sr-only peer" checked>
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                        <div class="p-6 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
                            <button onclick="document.getElementById('identityModal').style.display='none'" class="px-4 py-2 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                            <button id="btnConfirmIdentity" onclick="confirmIdentityUpdate()" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105">Confirmar y Aplicar Cambios</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Activar listeners para el logo si estamos en General
    if (title === 'General') {
        setupLogoListeners();
    }
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
 * 🚀 PROCESO DE GUARDADO (SAVE ALL)
 * Envía peticiones individuales para cada ajuste modificado.
 */
async function saveAllSettings() {
    if (dirtySettings.size === 0) {
        showToast('No hay cambios pendientes por guardar.', 'info');
        return;
    }

    const btn = document.getElementById('btnSaveAll');
    const originalContent = btn.innerHTML;
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    // Estado visual del botón
    btn.disabled = true;
    btn.innerHTML = `<i class="bi bi-arrow-repeat animate-spin"></i> Guardando...`;

    let successCount = 0;
    let failCount = 0;

    // Procesar cada ajuste modificado de forma independiente
    for (const [clave, valor] of dirtySettings) {
        const card = document.querySelector(`[data-key="${clave}"]`).closest('.config-card');
        const errorDisplay = card.querySelector('.error-msg');
        errorDisplay.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/configuracion/${clave}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ valor })
            });

            const result = await response.json();

            if (result.success) {
                markAsClean(card);
                dirtySettings.delete(clave);
                successCount++;
                showToast(`✅ ${clave} actualizado`, 'success');
            } else {
                failCount++;
                errorDisplay.textContent = `❌ ${result.message || 'Error de validación'}`;
                errorDisplay.classList.remove('hidden');
                showToast(`❌ Error en ${clave}`, 'error');
            }
        } catch (error) {
            failCount++;
            showToast(`🔥 Error de red al guardar ${clave}`, 'error');
        }
    }

    // Restaurar botón
    btn.disabled = false;
    btn.innerHTML = originalContent;

    if (successCount > 0) {
        showToast(`🎉 Proceso terminado. ${successCount} guardados con éxito.`, 'success');
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
    container.className = 'fixed bottom-5 right-5 z-[9999] flex flex-col items-end pointer-events-none';
    const children = container.querySelectorAll('div');
    container.style.pointerEvents = 'none'; // Permitir clicks en lo que hay debajo
    document.body.appendChild(container);
    return container;
}

function setupLogoListeners() {
    const logoInput = document.getElementById('logoInput');
    if (!logoInput) return;
    const urlInput = document.getElementById('logoUrlInput');

    logoInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('logoPreview').src = e.target.result;
                document.getElementById('logoPreview').classList.remove('hidden');
                document.getElementById('noLogoText').classList.add('hidden');
            }
            reader.readAsDataURL(file);
        }
    });

    // Preview de URL en tiempo real
    if(urlInput) {
        urlInput.addEventListener('input', function(e) {
            const url = e.target.value;
            if(url && !logoInput.files[0]) { // Solo si no hay archivo seleccionado
                document.getElementById('logoPreview').src = url;
                document.getElementById('logoPreview').classList.remove('hidden');
                document.getElementById('noLogoText').classList.add('hidden');
            }
        });
    }
}

window.uploadLogo = async function () {
    // Abrir modal directamente, la validación se hace al confirmar
    document.getElementById('identityModal').style.display = 'block';
}

window.confirmIdentityUpdate = async function() {
    const file = document.getElementById('logoInput').files[0];
    const url = document.getElementById('logoUrlInput').value;

    const btn = document.getElementById('btnConfirmIdentity');
    const originalContent = btn.innerHTML;
    
    // 1. Feedback Visual: Estado de Carga
    btn.disabled = true;
    btn.innerHTML = `<span class="flex items-center gap-2"><i class="bi bi-arrow-repeat animate-spin"></i> Guardando...</span>`;

    const formData = new FormData();
    if (file) {
        formData.append('file', file);
    }
    formData.append('logo_url', url);
    // Enviar preferencias del usuario
    formData.append('apply_ui', document.getElementById('checkApplyUI').checked);
    formData.append('apply_reports', document.getElementById('checkApplyReports').checked);

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/configuracion/logo`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}` },
            body: formData
        });
        const result = await response.json();
        if (result.success) {
            // 2. Éxito: Cerrar modal y notificar
            document.getElementById('identityModal').style.display = 'none';
            showToast('¡Configuración de marca actualizada!', 'success');
            
            // 3. Actualización en Tiempo Real (Anti-Caché)
            const newSrc = result.data.path + '?t=' + Date.now();
            
            // Actualizar vista previa en settings
            const preview = document.getElementById('logoPreview');
            if (preview) {
                preview.src = newSrc;
                preview.classList.remove('hidden');
                document.getElementById('noLogoText').classList.add('hidden');
            }

            // Actualizar logo del header globalmente
            const headerLogo = document.getElementById('headerLogo');
            if (headerLogo) headerLogo.src = newSrc;
            
        } else {
            showToast(`Error: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast('Error de conexión con el servidor', 'error');
    } finally {
        // 4. Restaurar botón
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}
