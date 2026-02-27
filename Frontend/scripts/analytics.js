// Analytics - Animaciones fluidas y diseño mejorado

const API_BASE_URL = '';

function getAuthHeaders() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    return { 'Authorization': token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' };
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
}

let topProductsChart, gananciasChart, healthChart;

function getChartColors() {
    const isDark = document.body.classList.contains('dark-mode');
    return {
        text: isDark ? '#94a3b8' : '#475569',
        grid: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.06)',
        barColor: isDark ? '#60a5fa' : '#3b82f6',
        lineColor: isDark ? '#34d399' : '#10b981',
        barHover: isDark ? '#93c5fd' : '#2563eb',
        lineFill: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'
    };
}

function loadAnalyticsMetrics() {
    fetch(`${API_BASE_URL}/api/analytics/metricas-mes`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (res.success && res.data) {
                const d = res.data;
                animateValue('gananciaNeta', formatCurrency(0), formatCurrency(d.ganancia_neta), 1000);
                animateValue('ventasTotales', formatCurrency(0), formatCurrency(d.total_ventas), 1000);
                document.getElementById('ventasUnidades').textContent = d.ventas_unidades;
                animateValue('comprasTotales', formatCurrency(0), formatCurrency(d.total_compras), 1000);
            }
        })
        .catch(() => {});
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        obj.textContent = end;
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function loadTopProductsChart() {
    const canvas = document.getElementById('topProductsChart');
    if (!canvas) return;
    const container = canvas.parentElement.parentElement;

    fetch(`${API_BASE_URL}/api/analytics/productos-mas-vendidos`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data?.length) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8" style="font-size: 1rem;">Sin datos disponibles</p>';
                return;
            }
            const ctx = canvas.getContext('2d');
            if (topProductsChart) topProductsChart.destroy();

            const colors = getChartColors();

            topProductsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: res.data.map(p => p.nombre),
                    datasets: [{
                        data: res.data.map(p => p.unidades_vendidas),
                        backgroundColor: colors.barColor,
                        hoverBackgroundColor: colors.barHover,
                        borderRadius: 8,
                        barThickness: 40,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart',
                        delay: function(context) {
                            return context.dataIndex * 100;
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            borderWidth: 1,
                            cornerRadius: 10,
                            padding: 12,
                            titleFont: { size: 14, weight: '600' },
                            bodyFont: { size: 13 }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: colors.text, 
                                font: { size: 12, weight: '500' },
                                maxRotation: 45,
                                minRotation: 0
                            },
                            grid: { display: false }
                        },
                        y: {
                            ticks: { 
                                color: colors.text, 
                                font: { size: 12, weight: '500' }, 
                                stepSize: 1,
                                padding: 10
                            },
                            grid: { 
                                color: colors.grid,
                                drawBorder: false,
                                tickBorderDash: [5, 5]
                            },
                            beginAtZero: true
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        })
        .catch(() => {});
}

function loadGananciasChart() {
    const canvas = document.getElementById('gananciasChart');
    if (!canvas) return;
    const container = canvas.parentElement.parentElement;

    fetch(`${API_BASE_URL}/api/analytics/ganancias-por-mes`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data?.length) {
                container.innerHTML = '<p class="text-gray-500 text-center py-8" style="font-size: 1rem;">Sin datos disponibles</p>';
                return;
            }
            const ctx = canvas.getContext('2d');
            if (gananciasChart) gananciasChart.destroy();

            const colors = getChartColors();

            gananciasChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: res.data.map(g => g.mes),
                    datasets: [{
                        data: res.data.map(g => g.ganancia),
                        borderColor: colors.lineColor,
                        borderWidth: 3,
                        backgroundColor: colors.lineFill,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: colors.lineColor,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointHoverBackgroundColor: colors.lineColor,
                        pointHoverBorderColor: '#fff',
                        pointHoverBorderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 2000,
                        easing: 'easeOutQuart',
                        delay: function(context) {
                            return context.dataIndex * 150;
                        }
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            borderColor: 'rgba(16, 185, 129, 0.3)',
                            borderWidth: 1,
                            cornerRadius: 10,
                            padding: 12,
                            titleFont: { size: 14, weight: '600' },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: function(context) {
                                    return ' $' + context.parsed.y.toLocaleString('es-CO');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { 
                                color: colors.text, 
                                font: { size: 12, weight: '500' }
                            },
                            grid: { display: false }
                        },
                        y: {
                            ticks: { 
                                color: colors.text, 
                                font: { size: 12, weight: '500' }, 
                                callback: function(value) {
                                    return '$' + value.toLocaleString('es-CO');
                                },
                                padding: 10
                            },
                            grid: { 
                                color: colors.grid,
                                drawBorder: false,
                                tickBorderDash: [5, 5]
                            },
                            beginAtZero: true
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                }
            });
        })
        .catch(() => {});
}

function loadHealthChart() {
    const canvas = document.getElementById('healthChart');
    if (!canvas) return;

    fetch(`${API_BASE_URL}/api/analytics/salud-inventario`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (!res.success) return;
            const ctx = canvas.getContext('2d');
            if (healthChart) healthChart.destroy();

            const vigentes = parseInt(res.data.vigentes) || 0;
            const vencidos = parseInt(res.data.vencidos) || 0;
            const porcentaje = vigentes + vencidos > 0 ? Math.round((vigentes / (vigentes + vencidos)) * 100) : 0;

healthChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Vigente', 'Vencido'],
                    datasets: [{
                        data: [vigentes, vencidos],
                        backgroundColor: ['#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    animation: {
                        animateRotate: true,
                        animateScale: true,
                        duration: 1000,
                        easing: 'easeOutQuart'
                    },
                    plugins: { 
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fff',
                            bodyColor: '#cbd5e1',
                            cornerRadius: 8,
                            padding: 10
                        }
                    }
                },
                plugins: [{
                    id: 'textCenter',
                    beforeDraw: function(chart) {
                        const ctx = chart.ctx, width = chart.width, height = chart.height;
                        ctx.save();
                        ctx.font = 'bold 1.5em Inter, sans-serif';
                        ctx.textBaseline = 'middle';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#f1f5f9' : '#1e3a8a';
                        ctx.fillText(`${porcentaje}%`, width / 2, height / 2);
                        ctx.restore();
                    }
                }]
            });
        })
        .catch(() => {});
}

function loadBajoStock() {
    const container = document.getElementById('bajoStockList');
    if (!container) return;

    fetch(`${API_BASE_URL}/api/analytics/productos-bajo-stock`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data?.length) {
                container.innerHTML = '<div class="flex items-center justify-center gap-2 py-6 text-green-600" style="font-size: 1rem;"><i class="bi bi-check-circle-fill" style="font-size: 1.25rem;"></i><span>✓ Stock saludable</span></div>';
                return;
            }
            container.innerHTML = res.data.map((p, index) => `
                <div class="list-item" style="animation: slideIn 0.5s ease-out ${index * 0.1}s both;">
                    <div>
                        <p class="font-semibold" style="font-size: 1rem; color: #1e293b;">${p.nombre}</p>
                        <p class="text-sm" style="color: #64748b;">Stock: ${p.stock} / Mínimo: ${p.minimo}</p>
                    </div>
                    <span class="badge badge-warning">⚠️ Bajo</span>
                </div>
            `).join('');
        })
        .catch(() => { container.innerHTML = '<p class="badge badge-danger">Error al cargar</p>'; });
}

function loadMayorMargen() {
    const container = document.getElementById('mayorMargenList');
    if (!container) return;

    fetch(`${API_BASE_URL}/api/analytics/productos-mayor-margen`, { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data?.length) {
                container.innerHTML = '<p class="text-gray-500 text-center py-6" style="font-size: 1rem;">Sin datos disponibles</p>';
                return;
            }
            container.innerHTML = res.data.map((p, index) => `
                <div class="list-item" style="animation: slideIn 0.5s ease-out ${index * 0.1}s both;">
                    <div>
                        <p class="font-semibold" style="font-size: 1rem; color: #1e293b;">${p.nombre}</p>
                        <p class="text-sm" style="color: #64748b;">${formatCurrency(p.precio_compra)} → ${formatCurrency(p.precio_venta)}</p>
                    </div>
                    <span class="badge badge-success">${p.margen}%</span>
                </div>
            `).join('');
        })
        .catch(() => { container.innerHTML = '<p class="badge badge-danger">Error al cargar</p>'; });
}

function refreshAllCharts() {
    loadTopProductsChart();
    loadGananciasChart();
    loadHealthChart();
}
window.refreshAnalyticsCharts = refreshAllCharts;

function loadAllAnalytics() {
    loadAnalyticsMetrics();
    loadTopProductsChart();
    loadGananciasChart();
    loadHealthChart();
    loadBajoStock();
    loadMayorMargen();

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userEl = document.getElementById('userName');
    if (userEl) userEl.textContent = (user.nombre || 'Admin');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllAnalytics);
} else {
    loadAllAnalytics();
}
