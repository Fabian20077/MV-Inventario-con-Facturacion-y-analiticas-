// =====================================================
// FUNCIONES DE ANÁLISIS Y GRÁFICOS
// =====================================================

// Variables globales para los gráficos
let topProductsChart = null;
let gananciasChart = null;

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
                                color: '#FFFFFF'
                            },
                            grid: {
                                display: false
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
                                color: '#FFFFFF'
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
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
                                color: '#FFFFFF'
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                font: {
                                    size: 14,
                                    weight: '600'
                                },
                                color: '#FFFFFF',
                                callback: function (value) {
                                    return '$' + value.toLocaleString('es-CO');
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
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
            container.innerHTML = result.data.map(p => `
                <div class="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/30">
                    <div>
                        <p class="font-semibold text-gray-900 dark:text-gray-100">${p.nombre}</p>
                        <p class="text-xs text-red-600 dark:text-red-400">Stock: ${p.stock} / Mínimo: ${p.minimo}</p>
                    </div>
                    <i class="bi bi-exclamation-circle text-2xl text-red-500"></i>
                </div>
            `).join('');
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

// Cargar todos los datos de analytics
async function loadAllAnalytics() {
    await loadAnalyticsMetrics();
    await loadTopProductsChart();
    await loadGananciasChart();
    await loadBajoStock();
    await loadMayorMargen();
}

