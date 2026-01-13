/**
 * Módulo de Historial de Precios
 * Responsable de visualizar la trazabilidad de costos y márgenes
 */
const HistorialPrecios = {
    modalId: 'modalHistorialPrecios',

    /**
     * Abre el modal con el historial del producto seleccionado
     * @param {number} productoId 
     */
    async abrir(productoId) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                console.error("No hay token de autenticación");
                return;
            }

            // Mostrar indicador de carga si existe el modal, si no, crearlo primero
            if (!document.getElementById(this.modalId)) {
                this.crearModalEnDOM();
            }
            
            const tbody = document.querySelector(`#${this.modalId} tbody`);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando datos...</td></tr>';

            // Abrir modal (Bootstrap 5)
            const modalEl = document.getElementById(this.modalId);
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

            // Fetch datos (Ruta relativa correcta)
            const response = await fetch(`/api/productos/${productoId}/historial-precio`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al obtener datos del servidor');

            const historial = await response.json();
            this.renderizarTabla(historial);

        } catch (error) {
            console.error('Error en HistorialPrecios:', error);
            const tbody = document.querySelector(`#${this.modalId} tbody`);
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error: ${error.message}</td></tr>`;
        }
    },

    crearModalEnDOM() {
        const modalHTML = `
        <div class="modal fade" id="${this.modalId}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title"><i class="bi bi-graph-up-arrow me-2"></i>Historial de Precios</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="table-responsive">
                            <table class="table table-striped table-hover mb-0 align-middle">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Usuario</th>
                                        <th class="text-end">Costo Compra</th>
                                        <th class="text-end">Precio Venta</th>
                                        <th class="text-center">Margen</th>
                                        <th>Motivo</th>
                                    </tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <small class="text-muted me-auto">* Los precios están en moneda local (Q)</small>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    renderizarTabla(historial) {
        const tbody = document.querySelector(`#${this.modalId} tbody`);
        
        if (!historial || historial.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No hay registros históricos para este producto.</td></tr>';
            return;
        }

        tbody.innerHTML = historial.map(item => {
            const fecha = new Date(item.fecha_cambio).toLocaleString('es-GT');
            
            // Calcular tendencia (subió o bajó)
            const tendenciaCompra = this.getTendencia(item.precio_compra_nuevo, item.precio_compra_anterior);
            const tendenciaVenta = this.getTendencia(item.precio_venta_nuevo, item.precio_venta_anterior);
            
            // Calcular margen real en ese momento
            const margen = item.precio_venta_nuevo > 0 
                ? ((item.precio_venta_nuevo - item.precio_compra_nuevo) / item.precio_venta_nuevo * 100).toFixed(1)
                : 0;

            return `
                <tr>
                    <td class="small">${fecha}</td>
                    <td class="small text-muted">${item.usuario || 'Sistema'}</td>
                    <td class="text-end">
                        <div>Q${parseFloat(item.precio_compra_nuevo).toFixed(2)}</div>
                        ${tendenciaCompra}
                    </td>
                    <td class="text-end">
                        <div class="fw-bold">Q${parseFloat(item.precio_venta_nuevo).toFixed(2)}</div>
                        ${tendenciaVenta}
                    </td>
                    <td class="text-center">
                        <span class="badge ${margen < 20 ? 'bg-warning text-dark' : 'bg-success'}">${margen}%</span>
                    </td>
                    <td class="small text-truncate" style="max-width: 150px;" title="${item.razon}">${item.razon}</td>
                </tr>
            `;
        }).join('');
    },

    getTendencia(nuevo, anterior) {
        if (!anterior) return '<small class="text-muted">Inicio</small>';
        const diff = nuevo - anterior;
        if (diff > 0) return `<small class="text-danger"><i class="bi bi-caret-up-fill"></i> +Q${diff.toFixed(2)}</small>`;
        if (diff < 0) return `<small class="text-success"><i class="bi bi-caret-down-fill"></i> Q${diff.toFixed(2)}</small>`;
        return '<small class="text-muted">-</small>';
    }
};

// Exportar globalmente para usar en HTML
window.HistorialPrecios = HistorialPrecios;