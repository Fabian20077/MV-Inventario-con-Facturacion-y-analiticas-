// =====================================================
// CONFIGURACIÓN DE LA API
// =====================================================
const API_BASE_URL = ''; // Ruta relativa automática para evitar errores de CORS/Puerto

// =====================================================
// HELPERS
// =====================================================

// Obtener token de autenticación
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Obtener usuario actual
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Headers con autenticación
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Mostrar alerta
function showAlert(elementId, message, type = 'success') {
    const alertElement = document.getElementById(elementId);
    alertElement.className = `alert alert-${type}`;
    alertElement.innerHTML = message;
    alertElement.style.display = 'block';

    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 5000);
}

// Formatear moneda COP (con puntos como separadores de miles)
function formatCurrency(value) {
    if (value === null || value === undefined) return '$ 0';
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Limpiar formato de moneda para obtener número puro (Ej: "1.000" -> 1000)
function parseCurrency(value) {
    if (!value) return 0;
    // Eliminar todo lo que no sea dígito ni coma/punto decimal
    const cleanValue = value.toString().replace(/[^\d]/g, '');
    return parseFloat(cleanValue) || 0;
}

// Formatear un input mientras se escribe (Máscara)
function applyPriceMask(input) {
    let value = input.value.replace(/[^\d]/g, '');
    if (value) {
        input.value = new Intl.NumberFormat('es-CO').format(value);
    } else {
        input.value = '';
    }
}

// Formatear fecha
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Verificar visibilidad de campo vencimiento según configuración
async function checkVencimientoVisibility(modalId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/configuracion/inventario.vencimiento.habilitado`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            const isEnabled = result.data['inventario.vencimiento.habilitado'] === true ||
                result.data['inventario.vencimiento.habilitado'] === 'true';

            let input = null;
            if (modalId === 'productModal') {
                const modal = document.getElementById(modalId);
                // Buscar input por nombre en el formulario de creación
                input = modal.querySelector('input[name="fecha_vencimiento"]');
            } else if (modalId === 'editProductModal') {
                input = document.getElementById('editFechaVencimiento');
            }

            if (input) {
                const container = input.closest('div');
                if (container) {
                    if (isEnabled) {
                        container.classList.remove('hidden');
                        container.style.display = '';
                        // Agregar listeners para el checkbox si existe
                        setupVencimientoCheckbox(modalId);
                    } else {
                        container.classList.add('hidden');
                        container.style.display = 'none';
                        input.required = false;
                        input.value = '';
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error verificando configuración de vencimiento:', error);
    }
}

// Setup del checkbox de vencimiento
function setupVencimientoCheckbox(modalId) {
    const checkboxId = modalId === 'productModal' ? 'tieneVencimiento' : 'editTieneVencimiento';
    const fieldId = modalId === 'productModal' ? 'fechaVencimientoField' : 'editFechaVencimientoField';
    const inputId = modalId === 'productModal' ? 'input[name="fecha_vencimiento"]' : '#editFechaVencimiento';

    setTimeout(() => {
        const checkbox = document.getElementById(checkboxId);
        const field = document.getElementById(fieldId);
        const input = modalId === 'productModal'
            ? document.querySelector(`#${modalId} ${inputId}`)
            : document.querySelector(inputId);

        if (!checkbox || !field || !input) return;

        // Remover listeners anteriores
        checkbox.onchange = null;

        // Mostrar/ocultar campo según checkbox
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                field.classList.remove('hidden');
                input.required = true;
            } else {
                field.classList.add('hidden');
                input.required = false;
                input.value = '';
            }
        });
    }, 100);
}

// =====================================================
// VERIFICACIÓN DE AUTENTICACIÓN
// =====================================================
window.addEventListener('load', () => {
    const user = getCurrentUser();
    const token = getAuthToken();

    if (!user || !token) {
        window.location.href = 'pages/login.html';
        return;
    }

    // Actualizar navbar profesional
    const userName = user.nombre || 'Admin';
    const userInitial = userName.charAt(0).toUpperCase();

    const userNameShort = document.getElementById('userNameShort');
    const userInitialEl = document.getElementById('userInitial');

    if (userNameShort) userNameShort.textContent = userName;
    if (userInitialEl) userInitialEl.textContent = userInitial;

    // Mostrar botón de configuración solo si es Admin (rol_id === 1)
    const settingsButton = document.getElementById('adminSettingsLink');
    if (settingsButton && user.rol_id === 1) {
        settingsButton.style.display = 'flex';
    }

    // Cargar datos del dashboard
    loadDashboardData();

    // Inicializar checkboxes de vencimiento cuando se abran los modales
    initializeVencimientoCheckboxes();
});

// Inicializar los checkboxes de vencimiento en los modales
function initializeVencimientoCheckboxes() {
    // Para crear producto
    const checkboxCreate = document.getElementById('tieneVencimiento');
    const fieldCreate = document.getElementById('fechaVencimientoField');
    const inputCreate = document.querySelector('#productModal input[name="fecha_vencimiento"]');

    if (checkboxCreate && fieldCreate && inputCreate) {
        checkboxCreate.addEventListener('change', function () {
            if (this.checked) {
                fieldCreate.classList.remove('hidden');
                inputCreate.required = true;
            } else {
                fieldCreate.classList.add('hidden');
                inputCreate.required = false;
                inputCreate.value = '';
            }
        });
    }

    // Para editar producto
    const checkboxEdit = document.getElementById('editTieneVencimiento');
    const fieldEdit = document.getElementById('editFechaVencimientoField');
    const inputEdit = document.getElementById('editFechaVencimiento');

    if (checkboxEdit && fieldEdit && inputEdit) {
        checkboxEdit.addEventListener('change', function () {
            if (this.checked) {
                fieldEdit.classList.remove('hidden');
                inputEdit.required = true;
            } else {
                fieldEdit.classList.add('hidden');
                inputEdit.required = false;
                inputEdit.value = '';
            }
        });
    }
}

// =====================================================
// DATOS MOCK - Fallback si API falla
// =====================================================

const MOCK_DATA = {
    stats: {
        totalProductos: 12,
        stockTotal: 255,
        totalCategorias: 5,
        totalMovimientos: 6
    },
    productos: [
        { id: 1, codigo: 'PROD-001', nombre: 'Rueda Camioneta', categoria_nombre: 'Repuestos', cantidad: 45, stock_minimo: 10, precio_venta: 9000, precio_compra: 5500, fecha_vencimiento: null },
        { id: 2, codigo: 'PROD-002', nombre: 'Pantalón', categoria_nombre: 'Ropa', cantidad: 120, stock_minimo: 20, precio_venta: 10000, precio_compra: 6000, fecha_vencimiento: null },
        { id: 3, codigo: 'PROD-003', nombre: 'Camisa', categoria_nombre: 'Ropa', cantidad: 85, stock_minimo: 15, precio_venta: 20000, precio_compra: 12000, fecha_vencimiento: null },
        { id: 4, codigo: 'PROD-004', nombre: 'Tornillo M8', categoria_nombre: 'Hardware', cantidad: 5, stock_minimo: 50, precio_venta: 500, precio_compra: 250, fecha_vencimiento: null },
        { id: 5, codigo: 'PROD-005', nombre: 'Batería 12V', categoria_nombre: 'Eléctrica', cantidad: 12, stock_minimo: 8, precio_venta: 45000, precio_compra: 28000, fecha_vencimiento: null }
    ],
    movimientos: [
        { id: 1, producto_nombre: 'Rueda Camioneta', codigo: 'PROD-001', tipo: 'entrada', cantidad: 10, usuario_nombre: 'Admin', fecha: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: 2, producto_nombre: 'Pantalón', codigo: 'PROD-002', tipo: 'salida', cantidad: 15, usuario_nombre: 'Vendedor', fecha: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        { id: 3, producto_nombre: 'Camisa', codigo: 'PROD-003', tipo: 'entrada', cantidad: 20, usuario_nombre: 'Admin', fecha: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
        { id: 4, producto_nombre: 'Tornillo M8', codigo: 'PROD-004', tipo: 'salida', cantidad: 30, usuario_nombre: 'Operario', fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 5, producto_nombre: 'Batería 12V', codigo: 'PROD-005', tipo: 'entrada', cantidad: 5, usuario_nombre: 'Admin', fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 6, producto_nombre: 'Rueda Camioneta', codigo: 'PROD-001', tipo: 'salida', cantidad: 3, usuario_nombre: 'Cliente', fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() }
    ]
};

// =====================================================
// CARGAR DATOS DEL DASHBOARD
// =====================================================
async function loadDashboardData() {
    try {
        await loadStats();
        await loadRecentProducts();
        await loadRecentMovements();
    } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
    }
}

// Cargar estadísticas
async function loadStats() {
    try {
        const token = getAuthToken();
        if (!token) throw new Error('No authentication token');

        const response = await fetch(`${API_BASE_URL}/api/stats`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            document.getElementById('totalProducts').textContent = data.data.totalProductos;
            document.getElementById('totalStock').textContent = data.data.stockTotal;
            document.getElementById('totalCategories').textContent = data.data.totalCategorias;
            document.getElementById('totalMovements').textContent = data.data.totalMovimientos;
        } else {
            throw new Error('API response not successful');
        }
    } catch (error) {
        console.warn('API no disponible, mostrando datos demo:', error.message);
        // Fallback a datos mock SIEMPRE
        document.getElementById('totalProducts').textContent = MOCK_DATA.stats.totalProductos;
        document.getElementById('totalStock').textContent = MOCK_DATA.stats.stockTotal;
        document.getElementById('totalCategories').textContent = MOCK_DATA.stats.totalCategorias;
        document.getElementById('totalMovements').textContent = MOCK_DATA.stats.totalMovimientos;
    }
}

// Cargar productos recientes
async function loadRecentProducts() {
    try {
        const token = getAuthToken();
        if (!token) throw new Error('No token');

        const response = await fetch(`${API_BASE_URL}/api/productos`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderProductosRecientes(data.data.slice(0, 5));
        } else {
            throw new Error('No data');
        }
    } catch (error) {
        // Fallback a datos mock en caso de error de conexión
        renderProductosRecientes(MOCK_DATA.productos.slice(0, 5));
    }
}

// Función auxiliar para renderizar productos (reutilizable para mock)
function renderProductosRecientes(productos) {
    if (!container) return;

    if (!productos || productos.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay productos</p>';
        return;
    }

    const html = productos.map(p => {
        const isVencido = p.fecha_vencimiento && new Date(p.fecha_vencimiento) < new Date().setHours(0, 0, 0, 0);
        const stockBajo = p.cantidad <= p.stock_minimo;
        const stockAgotado = p.cantidad === 0;

        let borderClass = 'border-green-500';
        let textClass = 'text-green-600';

        if (isVencido || stockAgotado) {
            borderClass = 'border-red-600';
            textClass = 'text-red-600';
        } else if (stockBajo) {
            borderClass = 'border-orange-500';
            textClass = 'text-orange-600';
        }

        return `
            <div class="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md transition duration-150 border-l-4 ${borderClass}">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <p class="font-semibold text-gray-900 dark:text-white">${p.nombre}</p>
                        ${isVencido ? '<span class="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">VENCIDO</span>' : ''}
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${p.codigo} • ${p.categoria_nombre || 'Sin categoría'}</p>
                </div>
                
                <div class="text-center mx-4">
                    <p class="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">Stock</p>
                    <p class="text-2xl font-bold ${textClass}">${p.cantidad}</p>
                    ${stockBajo && !isVencido ? `<p class="text-xs text-red-600 font-semibold mt-1">⚠️ Mín: ${p.stock_minimo}</p>` : ''}
                </div>
                
                <div class="text-right mr-3 min-w-fit">
                    <p class="text-sm text-gray-600 dark:text-gray-400">Venta</p>
                    <p class="font-bold text-blue-600">$${(p.precio_venta || 0).toLocaleString('es-CO')}</p>
                </div>
                
                <div class="flex gap-2">
                    <button onclick="editarProducto(${p.id})" class="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900 p-2 rounded transition" title="Editar">
                        <i class="bi bi-pencil-square text-lg"></i>
                    </button>
                    <button onclick="eliminarProducto(${p.id}, '${p.nombre.replace(/'/g, "\\'")}' )" class="text-red-600 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900 p-2 rounded transition" title="Eliminar">
                        <i class="bi bi-trash text-lg"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    console.log('✅ Productos rendered');
}

// Cargar movimientos recientes
async function loadRecentMovements() {
    try {
        const token = getAuthToken();
        if (!token) throw new Error('No token');

        const response = await fetch(`${API_BASE_URL}/api/movimientos`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
            renderMovimientosRecientes(data.data.slice(0, 6));
        } else {
            throw new Error('No data');
        }
    } catch (error) {
        // Fallback a datos mock en caso de error de conexión
        renderMovimientosRecientes(MOCK_DATA.movimientos.slice(0, 6));
    }
}

// Función auxiliar para renderizar movimientos (reutilizable para mock)
function renderMovimientosRecientes(movimientos) {
    if (!container) return;

    if (!movimientos || movimientos.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay movimientos</p>';
        return;
    }

    const html = movimientos.map(m => `
        <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150">
            <div class="flex-1">
                <p class="font-semibold text-gray-900 dark:text-white">${m.producto_nombre || 'Producto'}</p>
                <p class="text-sm text-gray-600 dark:text-gray-400">${m.codigo} - ${m.usuario_nombre || 'Usuario'}</p>
            </div>
            <div class="text-right mr-3">
                <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${m.tipo === 'entrada'
            ? 'bg-green-100 text-gray-900 dark:bg-green-900 dark:text-green-100'
            : 'bg-red-100 text-gray-900 dark:bg-red-900 dark:text-red-100'
        }">
                    ${m.tipo === 'entrada' ? '↓ Entrada' : '↑ Salida'} ${m.cantidad}
                </span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${formatDate(m.fecha)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="verDetallesMovimiento(${m.id})" class="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 transition" title="Ver detalles">
                    <i class="bi bi-eye text-lg"></i>
                </button>
                <button onclick="eliminarMovimiento(${m.id}, '${m.producto_nombre?.replace(/'/g, "\\'") || 'Producto'}')" class="text-red-600 hover:text-red-800 dark:hover:text-red-400 transition" title="Eliminar">
                    <i class="bi bi-trash text-lg"></i>
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
    console.log('✅ Movimientos rendered');
}

// =====================================================
// SISTEMA DE ALERTAS DE STOCK
// =====================================================

// Obtener alertas vistas desde localStorage
function getAlertasVistas() {
    const vistas = localStorage.getItem('alertasVistas');
    return vistas ? JSON.parse(vistas) : [];
}

// Marcar alerta como vista
function marcarAlertaVista(productoId) {
    const vistas = getAlertasVistas();
    if (!vistas.includes(productoId)) {
        vistas.push(productoId);
        localStorage.setItem('alertasVistas', JSON.stringify(vistas));
    }
    // Recargar alertas para actualizar la vista
    loadAlertas();
}

// Obtener alertas borradas/silenciadas desde localStorage
function getAlertasBorradas() {
    const borradas = localStorage.getItem('alertasBorradas');
    return borradas ? JSON.parse(borradas) : [];
}

// Limpiar todas las alertas vistas (Mostrar todas)
function limpiarAlertasVistas() {
    localStorage.removeItem('alertasVistas');
    loadAlertas();
}

// Borrar/Silenciar historial de alertas vistas
function borrarHistorialVistas() {
    const vistas = getAlertasVistas();
    const borradas = getAlertasBorradas();

    // Mover lo que está en 'vistas' a 'borradas'
    vistas.forEach(id => {
        if (!borradas.includes(id)) borradas.push(id);
    });

    localStorage.setItem('alertasBorradas', JSON.stringify(borradas));
    localStorage.removeItem('alertasVistas');
    loadAlertas();
}

// Marcar todas las alertas actuales como vistas
function marcarTodasVistas(ids) {
    const currentVistas = getAlertasVistas();
    ids.forEach(id => {
        if (!currentVistas.includes(id)) currentVistas.push(id);
    });
    localStorage.setItem('alertasVistas', JSON.stringify(currentVistas));
    loadAlertas();
}

// Cargar alertas de stock bajo
async function loadAlertas() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/alertas/stock-bajo`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            // Filtrar alertas (usando String() por seguridad)
            const alertasVistas = getAlertasVistas().map(String);
            const alertasBorradas = getAlertasBorradas().map(String);

            // Alertas que no han sido ni vistas ni borradas permanentemente
            const alertasActivas = data.data.filter(alerta =>
                !alertasVistas.includes(String(alerta.id)) &&
                !alertasBorradas.includes(String(alerta.id))
            );

            const totalAlertas = alertasActivas.length;
            const badge = document.getElementById('alertasBadge');
            const count = document.getElementById('alertasCount');
            const btnAlertas = document.querySelector('.nav-icon-button[title="Notificaciones"]');

            // Actualizar badge
            if (totalAlertas > 0) {
                badge.textContent = totalAlertas;
                badge.style.display = 'block';
                count.textContent = `${totalAlertas} ${totalAlertas === 1 ? 'alerta' : 'alertas'}`;

                // Agregar animación de shake si el botón existe
                if (btnAlertas) {
                    btnAlertas.classList.add('tiene-alertas');
                    setTimeout(() => btnAlertas.classList.remove('tiene-alertas'), 500);
                }
            } else {
                badge.style.display = 'none';
                count.textContent = '0 alertas';
            }

            // Renderizar lista de alertas
            // Pasamos las activas y el total de las que están en 'vistas' (las que no han sido borradas aún)
            const soloOcultasCount = data.data.filter(a =>
                alertasVistas.includes(String(a.id)) &&
                !alertasBorradas.includes(String(a.id))
            ).length;

            renderAlertas(alertasActivas, soloOcultasCount);
        }
    } catch (error) {
        console.error('Error cargando alertas:', error);
    }
}

// Renderizar lista de alertas
function renderAlertas(alertas, totalOcultas) {
    const container = document.getElementById('alertasLista');

    if (alertas && alertas.length > 0) {
        container.innerHTML = alertas.map(alerta => `
            ${(() => {
                const isVencido = alerta.fecha_vencimiento && new Date(alerta.fecha_vencimiento) < new Date().setHours(0, 0, 0, 0);
                const badgeVencido = isVencido ? '<span class="bg-red-100 text-red-800 dark:bg-red-200 dark:text-red-900 border border-red-200 dark:border-red-800 text-[10px] px-1.5 py-0.5 rounded ml-2 font-extrabold">VENCIDO</span>' : '';
                return `
            <div class="alerta-item ${alerta.nivel_alerta}">
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
                    <div style="flex: 1; cursor: pointer;" onclick="irAProducto(${alerta.id})">
                        <div class="alerta-nombre">${alerta.nombre}${badgeVencido}</div>
                        <div class="alerta-info">
                            <span>${alerta.codigo} • ${alerta.categoria_nombre || 'Sin categoría'}</span>
                            <span class="alerta-stock ${alerta.nivel_alerta}">
                                ${alerta.stock_actual === 0 ? '¡AGOTADO!' : `${alerta.stock_actual} / ${alerta.stock_minimo}`}
                            </span>
                        </div>
                    </div>
                    <button 
                        onclick="event.stopPropagation(); marcarAlertaVista(${alerta.id})" 
                        class="btn-marcar-vista"
                        title="Marcar como vista"
                        aria-label="Marcar alerta como vista"
                    >
                        <i class="bi bi-check-lg"></i>
                    </button>
                </div>
            </div>
                `;
            })()}
        `).join('');

        // Botón compacto para marcar lo que se está viendo
        container.innerHTML += `
            <div style="padding: 10px; border-top: 1px solid rgba(226, 232, 240, 0.5);">
                <button 
                    onclick="event.stopPropagation(); marcarTodasVistas([${alertas.map(a => a.id).join(',')}])" 
                    class="btn-marcar-vistas-todo"
                >
                    <i class="bi bi-eye-slash"></i> Marcar lo visible como visto
                </button>
            </div>
        `;
    } else {
        if (totalOcultas > 0) {
            container.innerHTML = `
                <div class="alertas-vacio">
                    <i class="bi bi-check2-all" style="font-size: 2rem; opacity: 0.2; margin-bottom: 8px;"></i>
                    <p style="font-weight: 500;">Alertas marcadas como vistas</p>
                    <p class="text-xs" style="opacity: 0.6;">${totalOcultas} alerta${totalOcultas > 1 ? 's' : ''} oculta${totalOcultas > 1 ? 's' : ''}</p>
                    
                    <button 
                        onclick="event.stopPropagation(); limpiarAlertasVistas()" 
                        class="btn-mostrar-todas"
                        style="margin-top: 12px;"
                    >
                        Volver a mostrar todas
                    </button>
                    
                    <button 
                        onclick="event.stopPropagation(); borrarHistorialVistas();" 
                        class="btn-eliminar-historial"
                    >
                        Eliminar historial de vistas
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="alertas-vacio">
                    <i class="bi bi-check-circle" style="font-size: 2rem; opacity: 0.2;"></i>
                    <p>No hay alertas de stock</p>
                    <p class="text-xs mt-1">Todo el inventario está en niveles óptimos</p>
                </div>
            `;
        }
    }
}

// Toggle dropdown de alertas
function toggleAlertas() {
    const dropdown = document.getElementById('alertasDropdown');

    if (!dropdown) {
        console.error('alertasDropdown element not found!');
        return;
    }

    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

// Ir a un producto específico (opcional: puedes implementar scroll o modal)
function irAProducto(id) {
    console.log(`Navegando al producto ID: ${id}`);
    // Aquí puedes agregar lógica para abrir el modal de edición
    // o hacer scroll al producto en la lista
    toggleAlertas(); // Cerrar dropdown

    // Ejemplo: abrir modal de edición
    editarProducto(id);
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    const alertasButton = document.querySelector('.nav-icon-button[title="Notificaciones"]');
    const dropdown = document.getElementById('alertasDropdown');

    if (dropdown && alertasButton && !alertasButton.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Cargar alertas al inicio y cada 30 segundos
window.addEventListener('load', () => {
    loadAlertas();

    // Polling cada 30 segundos
    setInterval(loadAlertas, 30000);
});
// Cargar categorías
let categoriasMap = new Map(); // Global para mapear nombre -> id
let categoriasData = []; // Array de categorías para el combobox

async function loadCategorias() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categorias`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            categoriasMap.clear();
            categoriasData = data.data;

            // Poblar el mapa
            data.data.forEach(c => {
                categoriasMap.set(c.nombre.toLowerCase(), c.id);
            });

            // Inicializar combobox
            initCombobox('categoriaInput', 'categoriaDropdown', 'categoriaCombobox', categoriasData);
        }
    } catch (error) {
        console.error('Error cargando categorías:', error);
    }
}

// Inicializar combobox personalizado
function initCombobox(inputId, dropdownId, wrapperId, categories) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const wrapper = document.getElementById(wrapperId);

    if (!input || !dropdown || !wrapper) return;

    // Renderizar todas las opciones
    function renderOptions(filter = '') {
        const filtered = filter
            ? categories.filter(c => c.nombre.toLowerCase().includes(filter.toLowerCase()))
            : categories;

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="combobox-no-results">No se encontraron categorías</div>';
        } else {
            dropdown.innerHTML = filtered.map(c =>
                `<div class="combobox-option" data-value="${c.nombre}" data-id="${c.id}">${c.nombre}</div>`
            ).join('');

            // Agregar event listeners a las opciones
            dropdown.querySelectorAll('.combobox-option').forEach(option => {
                option.addEventListener('click', () => {
                    input.value = option.dataset.value;
                    wrapper.classList.remove('open');
                });
            });
        }
    }

    // Mostrar dropdown al hacer clic en el input
    input.addEventListener('click', () => {
        wrapper.classList.add('open');
        renderOptions(input.value);
    });

    // Filtrar mientras se escribe
    input.addEventListener('input', () => {
        wrapper.classList.add('open');
        renderOptions(input.value);
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });

    // Renderizar opciones iniciales
    renderOptions();
}

// Cargar productos para los selects
async function loadProductosForSelects() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/productos`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            const selectEntrada = document.getElementById('productoEntradaSelect');
            selectEntrada.innerHTML = '<option value="">Seleccionar producto...</option>' +
                data.data.map(p =>
                    `<option value="${p.id}">${p.nombre} (${p.codigo}) - Stock: ${p.cantidad}</option>`
                ).join('');

            const selectSalida = document.getElementById('productoSalidaSelect');
            selectSalida.innerHTML = '<option value="">Seleccionar producto...</option>' +
                data.data.map(p =>
                    `<option value="${p.id}">${p.nombre} (${p.codigo}) - Stock: ${p.cantidad}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error cargando productos:', error);
    }
}

// Gestión de modales
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';

    // Verificar configuración de vencimientos dinámicamente
    if (modalId === 'productModal' || modalId === 'editProductModal') {
        checkVencimientoVisibility(modalId);
    }

    if (modalId === 'productModal') {
        loadCategorias();
        // Validación de fecha mínima (Hoy)
    } else if (modalId === 'entradaModal' || modalId === 'salidaModal') {
        loadProductosForSelects();

        // Si es modal de salida, agregar event listener al checkbox de factura
        if (modalId === 'salidaModal') {
            setTimeout(() => {
                const checkFactura = document.getElementById('generarFacturaSalida');
                const containerCliente = document.getElementById('clienteSalidaContainer');

                if (checkFactura && containerCliente) {
                    // Remover listeners anteriores
                    checkFactura.onchange = null;

                    // Agregar nuevo listener
                    checkFactura.onchange = function () {
                        if (this.checked) {
                            containerCliente.classList.remove('hidden');
                            document.getElementById('clienteSalidaNombre').focus();
                        } else {
                            containerCliente.classList.add('hidden');
                            document.getElementById('clienteSalidaNombre').value = '';
                        }
                    };

                    // Reset del checkbox al abrir
                    checkFactura.checked = false;
                    containerCliente.classList.add('hidden');
                    document.getElementById('clienteSalidaNombre').value = '';
                }
            }, 100);
        }
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';

    const alertIds = ['productAlert', 'entradaAlert', 'salidaAlert', 'editProductAlert'];
    alertIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Crear nuevo producto
async function handleNewProduct(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Creando...';

        // El backend ahora maneja la creación/búsqueda de categoría
        const producto = {
            codigo: formData.get('codigo'),
            nombre: formData.get('nombre'),
            descripcion: formData.get('descripcion') || null,
            precio_compra: parseCurrency(formData.get('precio_compra')),
            precio_venta: parseCurrency(formData.get('precio_venta')),
            cantidad: parseInt(formData.get('cantidad')),
            stock_minimo: parseInt(formData.get('stock_minimo')),
            ubicacion: formData.get('ubicacion') || null,
            categoria_nombre: formData.get('categoria_nombre'),
            fecha_vencimiento: formData.get('fecha_vencimiento') || null
        };

        const response = await fetch(`${API_BASE_URL}/api/productos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(producto)
        });

        const data = await response.json();

        if (data.success) {
            showAlert('productAlert', '✅ Producto creado exitosamente', 'success');
            form.reset();

            setTimeout(async () => {
                await loadDashboardData();
                closeModal('productModal');
            }, 2000);
        } else {
            showAlert('productAlert', `❌ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('productAlert', '❌ Error de conexión con la API', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-check-circle"></i> Crear Producto';
    }
}


// Registrar entrada
async function handleEntrada(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const user = getCurrentUser();

    const entrada = {
        id_producto: parseInt(formData.get('id_producto')),
        cantidad: parseInt(formData.get('cantidad')),
        motivo: formData.get('motivo') || 'Entrada de inventario',
        usuario_id: user.id
    };

    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Registrando...';

        const response = await fetch(`${API_BASE_URL}/api/movimientos/entrada`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(entrada)
        });

        const data = await response.json();

        if (data.success) {
            showAlert('entradaAlert', '✅ Entrada registrada exitosamente', 'success');
            form.reset();

            setTimeout(async () => {
                await loadDashboardData();
                closeModal('entradaModal');
            }, 2000);
        } else {
            showAlert('entradaAlert', `❌ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('entradaAlert', '❌ Error de conexión con la API', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-check-circle"></i> Registrar Entrada';
    }
}

// Registrar salida
async function handleSalida(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const user = getCurrentUser();

    const generarFactura = document.getElementById('generarFacturaSalida').checked;
    const clienteNombre = document.getElementById('clienteSalidaNombre').value.trim();

    // Validar cliente si se genera factura
    if (generarFactura && !clienteNombre) {
        showAlert('salidaAlert', '❌ Debes ingresar el nombre del cliente para generar factura', 'error');
        document.getElementById('clienteSalidaNombre').focus();
        return;
    }

    const salida = {
        id_producto: parseInt(formData.get('id_producto')),
        cantidad: parseInt(formData.get('cantidad')),
        motivo: formData.get('motivo') || 'Salida de inventario',
        usuario_id: user.id,
        generar_factura: generarFactura,
        cliente_nombre: clienteNombre || 'Cliente General',
        observaciones: formData.get('observaciones') || ''
    };

    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Registrando...';

        const response = await fetch(`${API_BASE_URL}/api/movimientos/salida`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(salida)
        });

        const data = await response.json();

        if (data.success) {
            let mensaje = '✅ Salida registrada exitosamente';
            if (data.factura) {
                mensaje += ` - Factura ${data.factura.numero} generada`;
                // Descargar PDF automáticamente
                setTimeout(() => {
                    window.location.href = `${API_BASE_URL}${data.factura.pdf_url}`;
                }, 500);
            }
            showAlert('salidaAlert', mensaje, 'success');

            form.reset();

            setTimeout(async () => {
                await loadDashboardData();
                closeModal('salidaModal');
            }, 2000);
        } else {
            showAlert('salidaAlert', `❌ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('salidaAlert', '❌ Error de conexión con la API', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-check-circle"></i> Registrar Salida';
    }
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    window.location.href = 'pages/login.html';
}

// =====================================================
// EDITAR PRODUCTO
// =====================================================
async function editarProducto(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/productos`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            const producto = data.data.find(p => p.id === id);
            if (!producto) {
                alert('Producto no encontrado');
                return;
            }

            document.getElementById('editProductId').value = producto.id;
            document.getElementById('editCodigo').value = producto.codigo;
            document.getElementById('editNombre').value = producto.nombre;
            document.getElementById('editDescripcion').value = producto.descripcion || '';

            // Cargar precios con formato de miles
            const nf = new Intl.NumberFormat('es-CO');
            document.getElementById('editPrecioCompra').value = nf.format(producto.precio_compra);
            document.getElementById('editPrecioVenta').value = nf.format(producto.precio_venta);

            document.getElementById('editCantidad').value = producto.cantidad;
            document.getElementById('editStockMinimo').value = producto.stock_minimo;
            document.getElementById('editUbicacion').value = producto.ubicacion || '';

            // Cargar fecha de vencimiento si existe
            const editFechaInput = document.getElementById('editFechaVencimiento');
            const editTieneVencimiento = document.getElementById('editTieneVencimiento');
            const editFechaVencimientoField = document.getElementById('editFechaVencimientoField');

            if (editFechaInput && editTieneVencimiento && editFechaVencimientoField) {
                if (producto.fecha_vencimiento) {
                    // La fecha de MySQL viene con zona horaria, necesitamos YYYY-MM-DD
                    const date = new Date(producto.fecha_vencimiento);
                    const formattedDate = date.toISOString().split('T')[0];
                    editFechaInput.value = formattedDate;
                    editTieneVencimiento.checked = true;
                    editFechaVencimientoField.classList.remove('hidden');
                    editFechaInput.required = true;
                } else {
                    editFechaInput.value = '';
                    editTieneVencimiento.checked = false;
                    editFechaVencimientoField.classList.add('hidden');
                    editFechaInput.required = false;
                }
            }

            await loadCategoriasForEdit(producto.id_categoria);
            openModal('editProductModal');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los datos del producto');
    }
}

async function loadCategoriasForEdit(selectedId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categorias`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();
        const input = document.getElementById('editCategoriaInput');

        if (data.success && data.data.length > 0) {
            categoriasMap.clear();
            categoriasData = data.data;

            // Poblar el mapa y establecer valor seleccionado
            data.data.forEach(c => {
                categoriasMap.set(c.nombre.toLowerCase(), c.id);
                if (c.id === selectedId) {
                    input.value = c.nombre;
                    document.getElementById('editCategoriaIdHidden').value = c.id;
                }
            });

            // Inicializar combobox para edición
            initCombobox('editCategoriaInput', 'editCategoriaDropdown', 'editCategoriaCombobox', categoriasData);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleEditProduct(event) {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const id = formData.get('id');

    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Actualizando...';

        // El backend ahora maneja la creación/búsqueda de categoría
        const producto = {
            codigo: formData.get('codigo'),
            nombre: formData.get('nombre'),
            descripcion: formData.get('descripcion') || null,
            precio_compra: parseCurrency(formData.get('precio_compra')),
            precio_venta: parseCurrency(formData.get('precio_venta')),
            cantidad: parseInt(formData.get('cantidad')),
            stock_minimo: parseInt(formData.get('stock_minimo')),
            ubicacion: formData.get('ubicacion') || null,
            categoria_nombre: formData.get('categoria_nombre'),
            fecha_vencimiento: formData.get('fecha_vencimiento') || null
        };

        const response = await fetch(`${API_BASE_URL}/api/productos/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(producto)
        });

        const data = await response.json();

        if (data.success) {
            showAlert('editProductAlert', '✅ Producto actualizado', 'success');
            setTimeout(async () => {
                await loadDashboardData();
                closeModal('editProductModal');
            }, 2000);
        } else {
            showAlert('editProductAlert', `❌ Error: ${data.message}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('editProductAlert', '❌ Error de conexión', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-check-circle"></i> Actualizar';
    }
}


async function eliminarProducto(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/productos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (data.success) {
            alert('✅ Producto eliminado');
            await loadDashboardData();
        } else {
            alert(`❌ Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión');
    }
}
// =====================================================
// VER DETALLES DE MOVIMIENTO
// =====================================================
async function verDetallesMovimiento(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/movimientos`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            const movimiento = data.data.find(m => m.id === id);
            if (!movimiento) {
                alert('Movimiento no encontrado');
                return;
            }

            // Llenar detalles
            document.getElementById('detalleProducto').textContent = movimiento.producto_nombre || 'N/A';
            document.getElementById('detalleCodigo').textContent = movimiento.codigo || 'N/A';
            document.getElementById('detalleTipo').textContent = movimiento.tipo.toUpperCase();
            document.getElementById('detalleTipo').className = `inline-block px-3 py-1 rounded-full text-sm font-bold ${movimiento.tipo === 'entrada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`;
            document.getElementById('detalleCantidad').textContent = movimiento.cantidad;
            document.getElementById('detalleMotivo').textContent = movimiento.motivo || 'Sin motivo';
            document.getElementById('detalleFecha').textContent = formatDate(movimiento.fecha);
            document.getElementById('detalleUsuario').textContent = movimiento.usuario_nombre || 'Desconocido';

            openModal('detalleMovimientoModal');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar los detalles del movimiento');
    }
}

// =====================================================
// ELIMINAR MOVIMIENTO
// =====================================================
async function eliminarMovimiento(id, nombreProducto) {
    if (!confirm(`¿Eliminar movimiento de "${nombreProducto}"?\n\n⚠️ ADVERTENCIA: Esto revertirá el stock del producto.\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/movimientos/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ Movimiento eliminado y stock revertido');
            await loadDashboardData();
        } else {
            alert(`❌ Error: ${data.message}`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error de conexión con la API');
    }
}
// =====================================================
// 🖨️ EXPORTACIÓN UNIVERSAL (PDF, EXCEL, SQL)
// =====================================================
function exportarTabla(modulo, formato) {
    // modulo: 'productos' | 'movimientos'
    // formato: 'pdf' | 'excel' | 'sql' | 'csv'
    const url = `${API_BASE_URL}/api/reportes/${modulo}/${formato}`;
    window.location.href = url;
}

// Exponer globalmente para usar en el HTML
window.exportarTabla = exportarTabla;

// =====================================================
// INICIALIZACIÓN AL CARGAR LA PÁGINA
// =====================================================
console.log('APP.JS LOADED - Starting initialization...');

// Ejecutar después de un pequeño delay para cargar dashboard data
setTimeout(async function () {
    console.log('Starting loadDashboardData...');

    try {
        await loadDashboardData();
        console.log('loadDashboardData completed successfully');
    } catch (error) {
        console.error('loadDashboardData failed:', error);
    }

    console.log('Dashboard inicializado correctamente');
}, 500);