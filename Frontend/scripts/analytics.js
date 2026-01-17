// =====================================================
// FUNCIONES DE ANÁLISIS Y GRÁFICOS
// =====================================================

const API_BASE_URL = ''; // Ruta relativa automática

function getAuthHeaders() {
    // Priorizar 'authToken' que es el que usa el sistema actual
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
    };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Variables globales para los gráficos
let topProductsChart = null;
let gananciasChart = null;
let healthChart = null;

// Cargar métricas del mes
async function loadAnalyticsMetrics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/metricas-mes`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;

            // Actualizar ganancia neta
            document.getElementById('gananciaNeta').textContent = formatCurrency(data.ganancia_neta);

            // Si hay pérdida por merma, mostrarla sutilmente debajo de la ganancia
            if (data.total_perdida_merma > 0) {
                const gananciaCard = document.getElementById('gananciaNeta').parentElement;
                // Buscar si ya existe el elemento para no duplicarlo
                let mermaEl = document.getElementById('mermaInfo');
                if (!mermaEl) {
                    mermaEl = document.createElement('p');
                    mermaEl.id = 'mermaInfo';
                    mermaEl.className = 'text-xs text-red-200 mt-1 font-medium';
                    gananciaCard.appendChild(mermaEl);
                }
                mermaEl.innerHTML = `<i class="bi bi-arrow-down-circle"></i> Incluye -${formatCurrency(data.total_perdida_merma)} por vencimientos`;
            }

            // Actualizar ventas totales
            document.getElementById('ventasTotales').textContent = formatCurrency(data.total_ventas);
            document.getElementById('ventasUnidades').textContent = data.ventas_unidades;

            // Actualizar compras
            document.getElementById('comprasTotales').textContent = formatCurrency(data.total_compras);
        }
    } catch (error) {
        console.error('Error cargando métricas:', error);
    }
}

// Cargar y renderizar gráfico de productos más vendidos
async function loadTopProductsChart() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/productos-mas-vendidos`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            if (typeof Chart === 'undefined') {
                console.error('Chart.js no está cargado');
                return;
            }

            const ctx = document.getElementById('topProductsChart').getContext('2d');

            // Destruir gráfico anterior si existe
            if (topProductsChart) {
                topProductsChart.destroy();
            }

            const labels = result.data.map(p => p.nombre);
            const data = result.data.map(p => p.unidades_vendidas);

            topProductsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Unidades Vendidas',
                        data: data,
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: 2, // Mejora nitidez en pantallas de alta resolución
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            titleFont: {
                                size: 16,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 14
                            },
                            padding: 12,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff'
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                font: {
                                    size: 14,
                                    weight: '600'
                                },
                                color: document.body.classList.contains('dark-mode') ? '#FFFFFF' : '#1e293b'
                            },
                            grid: {
                                color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                font: {
                                    size: 14,
                                    weight: '600'
                                },
                                color: document.body.classList.contains('dark-mode') ? '#FFFFFF' : '#1e293b'
                            },
                            grid: {
                                color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    }
                }
            });
        } else {
            // Mostrar mensaje si no hay datos
            const canvas = document.getElementById('topProductsChart');
            const parent = canvas.parentElement;
            parent.innerHTML = '<p class="text-gray-500 text-center py-8">No hay datos de ventas disponibles</p>';
        }
    } catch (error) {
        console.error('Error cargando gráfico de productos:', error);
    }
}

// Cargar y renderizar gráfico de ganancias por mes
async function loadGananciasChart() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/ganancias-por-mes`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            if (typeof Chart === 'undefined') {
                console.error('Chart.js no está cargado');
                return;
            }

            const ctx = document.getElementById('gananciasChart').getContext('2d');

            // Destruir gráfico anterior si existe
            if (gananciasChart) {
                gananciasChart.destroy();
            }

            const labels = result.data.map(g => g.mes);
            const data = result.data.map(g => g.ganancia);

            gananciasChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Ganancia Neta',
                        data: data,
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    devicePixelRatio: 2, // Mejora nitidez
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            titleFont: {
                                size: 16,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 14
                            },
                            padding: 12,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            callbacks: {
                                label: function (context) {
                                    return '$' + context.parsed.y.toLocaleString('es-CO');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                font: {
                                    size: 14,
                                    weight: '600'
                                },
                                color: document.body.classList.contains('dark-mode') ? '#FFFFFF' : '#1e293b'
                            },
                            grid: {
                                color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: 14,
                                    weight: '600'
                                },
                                color: document.body.classList.contains('dark-mode') ? '#FFFFFF' : '#1e293b',
                                callback: function (value) {
                                    return '$' + value.toLocaleString('es-CO');
                                }
                            },
                            grid: {
                                color: document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    }
                }
            });
        } else {
            // Mostrar mensaje si no hay datos
            const canvas = document.getElementById('gananciasChart');
            const parent = canvas.parentElement;
            parent.innerHTML = '<p class="text-gray-500 text-center py-8">No hay datos de ganancias disponibles</p>';
        }
    } catch (error) {
        console.error('Error cargando gráfico de ganancias:', error);
    }
}

// Cargar lista de productos con bajo stock
async function loadBajoStock() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/productos-bajo-stock`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();
        const container = document.getElementById('bajoStockList');

        if (result.success && result.data && result.data.length > 0) {
            container.innerHTML = result.data.map(p => {
                if (!p) return ''; // Null Safety: Ignorar registros nulos
                try {
                    // Detectar si es por vencimiento o por stock
                    // Validación robusta de fecha: asegurar que sea un objeto Date válido
                    const fechaVenc = p.fecha_vencimiento ? new Date(p.fecha_vencimiento) : null;
                    const isVencido = fechaVenc && !isNaN(fechaVenc) && fechaVenc < new Date();

                    const stockMsg = isVencido
                        ? '<span class="font-bold text-red-700 dark:text-red-300"><i class="bi bi-exclamation-triangle"></i> STOCK EN RIESGO (VENCIDO)</span>'
                        : `Stock: ${p.stock} / Mínimo: ${p.minimo}`;

                    return `
                    <div class="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/30">
                        <div>
                            <p class="font-semibold text-gray-900 dark:text-gray-100">${p.nombre || 'Producto sin nombre'}</p>
                            <p class="text-xs text-red-600 dark:text-red-400">${stockMsg}</p>
                        </div>
                        <i class="bi bi-exclamation-circle text-2xl text-red-500"></i>
                    </div>
                `;
                } catch (err) {
                    console.error('Error renderizando item de bajo stock:', err);
                    return '';
                }
            }).join('');
        } else {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">✓ Todos los productos tienen stock suficiente</p>';
        }
    } catch (error) {
        console.error('Error cargando bajo stock:', error);
        document.getElementById('bajoStockList').innerHTML =
            '<p class="text-red-500 text-center py-4">Error al cargar datos</p>';
    }
}

// Cargar lista de productos con mayor margen
async function loadMayorMargen() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/productos-mayor-margen`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();
        const container = document.getElementById('mayorMargenList');

        if (result.success && result.data && result.data.length > 0) {
            container.innerHTML = result.data.map(p => `
                <div class="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800/30">
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-gray-100">${p.nombre}</p>
                        <p class="text-xs text-gray-600 dark:text-gray-400">Compra: ${formatCurrency(p.precio_compra)} | Venta: ${formatCurrency(p.precio_venta)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${p.margen}%</p>
                        <p class="text-xs text-gray-500">margen</p>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">No hay datos disponibles</p>';
        }
    } catch (error) {
        console.error('Error cargando mayor margen:', error);
        document.getElementById('mayorMargenList').innerHTML =
            '<p class="text-red-500 text-center py-4">Error al cargar datos</p>';
    }
}

// Cargar gráfico de Salud del Inventario (Pie Chart)
async function loadHealthChart() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/salud-inventario`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success && result.data) {
            const ctx = document.getElementById('healthChart').getContext('2d');

            if (healthChart) healthChart.destroy();

            const vencidos = parseInt(result.data.vencidos) || 0;
            const vigentes = parseInt(result.data.vigentes) || 0;
            const total = vencidos + vigentes;
            const porcentajeSalud = total > 0 ? Math.round((vigentes / total) * 100) : 0;

            healthChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Vigente', 'Vencido'],
                    datasets: [{
                        data: [vigentes, vencidos],
                        backgroundColor: ['#10b981', '#ff4d4d'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return ` ${context.label}: ${context.raw}`;
                                }
                            }
                        }
                    }
                },
                plugins: [{
                    id: 'textCenter',
                    beforeDraw: function (chart) {
                        var width = chart.width,
                            height = chart.height,
                            ctx = chart.ctx;
                        ctx.restore();
                        var fontSize = (height / 114).toFixed(2);
                        ctx.font = "bold " + fontSize + "em sans-serif";
                        ctx.textBaseline = "middle";
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#fff' : '#333';
                        var text = porcentajeSalud + "%",
                            textX = Math.round((width - ctx.measureText(text).width) / 2),
                            textY = height / 2;
                        ctx.fillText(text, textX, textY);
                        ctx.save();
                    }
                }]
            });
        }
    } catch (error) {
        console.error('Error cargando gráfico de salud:', error);
    }
}

// Cargar todos los datos de analytics
async function loadAllAnalytics() {
    await loadAnalyticsMetrics();
    await loadTopProductsChart();
    await loadGananciasChart();
    await loadHealthChart(); // Nuevo gráfico
    await loadBajoStock();
    await loadMayorMargen();
}

// =====================================================
// EXPORTAR REPORTES
// =====================================================

async function downloadExcel() {
    window.location.href = `${API_BASE_URL}/api/reportes/analytics/excel`;
}

async function downloadPDF() {
    window.location.href = `${API_BASE_URL}/api/reportes/analytics/pdf`;
}

async function resetAnalytics() {
    // Verificar rol localmente antes de llamar (UX)
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        if (user.rol_id !== 1) {
            alert('⛔ Solo los administradores pueden realizar esta acción.');
            return;
        }
    }

    if (!confirm('⚠️ ¿Estás seguro de ELIMINAR todo el historial de movimientos?\n\nEsto reiniciará todas las gráficas y métricas a cero.\nLos productos y el stock actual NO se eliminarán.\n\nEsta acción no se puede deshacer.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/reset-movements`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (result.success) {
            alert('✅ Historial eliminado correctamente.');
            window.location.reload();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (e) {
        alert('❌ Error de conexión');
    }
}

// Exponer funciones globalmente para usarlas en el HTML
window.downloadExcel = downloadExcel;
window.downloadPDF = downloadPDF;
window.resetAnalytics = resetAnalytics;

// Inicializar carga de datos cuando el DOM esté listo
function initAnalytics() {
    // Verificar si estamos en una página con componentes de analítica
    // Comprobamos varios IDs por si la página no tiene todos los componentes
    if (document.getElementById('gananciaNeta') ||
        document.getElementById('bajoStockList') ||
        document.getElementById('mayorMargenList')) {

        loadAllAnalytics();

        // Configurar links de exportación
        const linkPdf = document.getElementById('exportPdf');
        const linkBackup = document.getElementById('exportBackup');

        if (linkPdf) linkPdf.href = `${API_BASE_URL}/api/reportes/analytics/pdf`;
        if (linkBackup) linkBackup.href = `${API_BASE_URL}/api/admin/backup`;

        // Cargar usuario en el navbar
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const userNameEl = document.getElementById('userName');
            if (userNameEl) userNameEl.textContent = user.nombre.toUpperCase();

            const settingsButton = document.getElementById('adminSettingsLink');
            const resetButton = document.getElementById('adminResetLink');

            if (user.rol_id === 1) {
                if (settingsButton) settingsButton.classList.remove('hidden');
                if (resetButton) resetButton.classList.remove('hidden');
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
    initAnalytics();
}
