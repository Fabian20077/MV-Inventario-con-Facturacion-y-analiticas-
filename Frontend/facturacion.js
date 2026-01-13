/**
 * facturacion.js
 * Lógica del módulo de facturación
 * 
 * Responsabilidades:
 * - Búsqueda y selección de productos
 * - Cálculo automático de totales e impuestos
 * - Envío de factura a API
 * - Descarga de PDF
 * - Historial de facturas recientes
 */

const API_BASE = '/api';
let productosFacura = [];
let ivaConfigurable = 19;
let tokenActual = localStorage.getItem('authToken');

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', async () => {
    verificarAutenticacion();
    
    // Cargar categorías
    await cargarCategorias();
    
    // Cargar configuración de IVA
    await cargarConfiguracionIVA();
    
    // Cargar historial de facturas
    await cargarHistorialFacturas();
    
    // Event listeners
    document.getElementById('buscar-producto').addEventListener('input', buscarProductos);
    document.getElementById('filtro-categoria').addEventListener('change', buscarProductos);
});

// ==================== BÚSQUEDA Y SELECCIÓN ====================

async function buscarProductos() {
    const termino = document.getElementById('buscar-producto').value.trim();
    const categoriaId = document.getElementById('filtro-categoria').value;
    const contenedorResultados = document.getElementById('resultados-productos');
    const sinResultados = document.getElementById('sin-resultados');

    if (termino.length < 2) {
        contenedorResultados.style.display = 'none';
        sinResultados.style.display = 'block';
        return;
    }

    try {
        let url = `${API_BASE}/productos?buscar=${encodeURIComponent(termino)}`;
        if (categoriaId) {
            url += `&categoria=${categoriaId}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${tokenActual}` }
        });

        if (!response.ok) throw new Error('Error al buscar productos');

        const data = await response.json();
        const productos = data.productos || [];

        contenedorResultados.innerHTML = '';

        if (productos.length === 0) {
            sinResultados.style.display = 'block';
            contenedorResultados.style.display = 'none';
            return;
        }

        sinResultados.style.display = 'none';
        contenedorResultados.style.display = 'block';

        for (const producto of productos) {
            if (productosFacura.some(p => p.id === producto.id)) {
                continue; // No mostrar productos ya agregados
            }

            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action text-start';
            item.type = 'button';
            
            const stock = producto.cantidad > 0 ? 
                `<span class="badge bg-success">${producto.cantidad} disponibles</span>` :
                '<span class="badge bg-danger">Sin stock</span>';

            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${producto.nombre}</strong><br>
                        <small class="text-muted">${producto.codigo}</small>
                    </div>
                    <div class="text-end">
                        <div><strong>$${producto.precio_venta.toLocaleString('es-CO')}</strong></div>
                        ${stock}
                    </div>
                </div>
            `;

            item.onclick = () => agregarProductoAFactura(producto);
            
            if (producto.cantidad === 0) {
                item.disabled = true;
                item.style.opacity = '0.5';
            }

            contenedorResultados.appendChild(item);
        }

    } catch (error) {
        mostrarAlerta('Error al buscar productos', 'error');
        console.error(error);
    }
}

function agregarProductoAFactura(producto) {
    // Verificar si ya está
    const existente = productosFacura.find(p => p.id === producto.id);
    if (existente) {
        existente.cantidad++;
    } else {
        productosFacura.push({
            id: producto.id,
            nombre: producto.nombre,
            codigo: producto.codigo,
            precio_venta: producto.precio_venta,
            cantidad: 1
        });
    }

    limpiarBusqueda();
    actualizarTablaFactura();
    calcularTotales();
}

function limpiarBusqueda() {
    document.getElementById('buscar-producto').value = '';
    document.getElementById('resultados-productos').style.display = 'none';
    document.getElementById('sin-resultados').style.display = 'block';
}

// ==================== TABLA DE FACTURA ====================

function actualizarTablaFactura() {
    const tbody = document.getElementById('tbody-factura');
    const filaVacia = document.getElementById('fila-vacia');

    tbody.innerHTML = '';

    if (productosFacura.length === 0) {
        filaVacia.style.display = 'table-row';
        tbody.appendChild(filaVacia);
        return;
    }

    filaVacia.style.display = 'none';

    for (let i = 0; i < productosFacura.length; i++) {
        const producto = productosFacura[i];
        const subtotal = producto.precio_venta * producto.cantidad;

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${producto.nombre}</td>
            <td>
                <input 
                    type="number" 
                    class="form-control form-control-sm" 
                    value="${producto.cantidad}"
                    min="1"
                    max="999"
                    onchange="actualizarCantidad(${i}, this.value)"
                    style="width: 80px;"
                >
            </td>
            <td>$${producto.precio_venta.toLocaleString('es-CO')}</td>
            <td>$${subtotal.toLocaleString('es-CO')}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${i})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    }
}

function actualizarCantidad(indice, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    if (cantidad > 0) {
        productosFacura[indice].cantidad = cantidad;
        actualizarTablaFactura();
        calcularTotales();
    }
}

function eliminarProducto(indice) {
    productosFacura.splice(indice, 1);
    actualizarTablaFactura();
    calcularTotales();
}

// ==================== CÁLCULOS ====================

function calcularTotales() {
    const subtotal = productosFacura.reduce((sum, p) => sum + (p.precio_venta * p.cantidad), 0);
    const iva = Math.round(subtotal * (ivaConfigurable / 100));
    const total = subtotal + iva;

    document.getElementById('subtotal-valor').textContent = `$${subtotal.toLocaleString('es-CO')}`;
    document.getElementById('iva-valor').textContent = `$${iva.toLocaleString('es-CO')}`;
    document.getElementById('total-valor').textContent = `$${total.toLocaleString('es-CO')}`;
}

// ==================== CREAR FACTURA ====================

async function emitirFactura() {
    if (productosFacura.length === 0) {
        mostrarAlerta('Agrega al menos un producto a la factura', 'error');
        return;
    }

    const detalles = productosFacura.map(p => ({
        producto_id: p.id,
        cantidad: p.cantidad
    }));

    const payload = {
        detalles,
        iva_porcentaje: ivaConfigurable,
        observaciones: document.getElementById('observaciones').value
    };

    const btnEmitir = event.target;
    btnEmitir.disabled = true;
    btnEmitir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Emitiendo...';

    try {
        const response = await fetch(`${API_BASE}/facturas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenActual}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al emitir factura');
        }

        const data = await response.json();
        const factura = data.factura;

        // Mostrar modal
        document.getElementById('modal-numero-factura').textContent = factura.numero_factura;
        document.getElementById('modal-total-factura').textContent = 
            `$${factura.total.toLocaleString('es-CO')}`;

        const modal = new bootstrap.Modal(document.getElementById('modalFacturaEmitida'));
        modal.show();

        // Guardar ID para descargar
        window.facturaActual = factura;

        // Limpiar y recargar
        limpiarFactura();
        await cargarHistorialFacturas();

        mostrarAlerta('✅ Factura emitida correctamente', 'exito');

    } catch (error) {
        mostrarAlerta(error.message, 'error');
        console.error(error);
    } finally {
        btnEmitir.disabled = false;
        btnEmitir.innerHTML = '<i class="fas fa-check"></i> Emitir Factura';
    }
}

function limpiarFactura() {
    productosFacura = [];
    document.getElementById('observaciones').value = '';
    actualizarTablaFactura();
    calcularTotales();
    mostrarAlerta('Factura limpiada', 'exito');
}

// ==================== DESCARGAR PDF ====================

function descargarFacturaPDF() {
    if (!window.facturaActual) {
        mostrarAlerta('No hay factura para descargar', 'error');
        return;
    }

    try {
        const facturaId = window.facturaActual.id;
        const url = `/api/facturas/${facturaId}/pdf?token=${tokenActual}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Factura-${window.facturaActual.numero_factura}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        mostrarAlerta('✅ Descarga iniciada', 'exito');
    } catch (error) {
        mostrarAlerta('Error al descargar PDF: ' + error.message, 'error');
        console.error(error);
    }
}

function imprimirFactura() {
    if (!window.facturaActual) {
        mostrarAlerta('No hay factura para imprimir', 'error');
        return;
    }

    try {
        const facturaId = window.facturaActual.id;
        const url = `/api/facturas/${facturaId}/pdf?token=${tokenActual}`;
        
        // Crear iframe para impresión
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        
        iframe.onload = function() {
            try {
                setTimeout(() => {
                    iframe.contentWindow.print();
                    mostrarAlerta('✅ Abriendo diálogo de impresión', 'exito');
                }, 500);
            } catch (error) {
                console.error('Error al imprimir:', error);
                mostrarAlerta('Error al imprimir: ' + error.message, 'error');
            }
        };
        
        iframe.onerror = function() {
            mostrarAlerta('Error al cargar el PDF para imprimir', 'error');
        };
        
        document.body.appendChild(iframe);
        
    } catch (error) {
        mostrarAlerta('Error al preparar impresión: ' + error.message, 'error');
        console.error(error);
    }
}

// ==================== CONFIGURACIÓN ====================

async function cargarConfiguracionIVA() {
    try {
        const response = await fetch(`${API_BASE}/configuracion/finanzas.impuestos.iva_porcentaje`, {
            headers: { 'Authorization': `Bearer ${tokenActual}` }
        });

        if (response.ok) {
            const data = await response.json();
            ivaConfigurable = parseFloat(data.valor) || 19;
            document.getElementById('iva-porcentaje').textContent = ivaConfigurable;
        }
    } catch (error) {
        console.warn('No se pudo cargar IVA, usando default 19%');
    }
}

async function cargarCategorias() {
    try {
        const response = await fetch(`${API_BASE}/categorias`, {
            headers: { 'Authorization': `Bearer ${tokenActual}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        const select = document.getElementById('filtro-categoria');
        
        for (const categoria of data.categorias || []) {
            const option = document.createElement('option');
            option.value = categoria.id;
            option.textContent = categoria.nombre;
            select.appendChild(option);
        }
    } catch (error) {
        console.error('Error al cargar categorías:', error);
    }
}

async function cargarHistorialFacturas() {
    try {
        const response = await fetch(`${API_BASE}/facturas?limite=5&estado=emitida`, {
            headers: { 'Authorization': `Bearer ${tokenActual}` }
        });

        if (!response.ok) return;

        const data = await response.json();
        const container = document.getElementById('historial-facturas');

        if (!data.facturas || data.facturas.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No hay facturas recientes</p>';
            return;
        }

        container.innerHTML = data.facturas.map(f => {
            const fecha = new Date(f.fecha_emision).toLocaleDateString('es-CO');
            return `
                <div class="mb-2 pb-2 border-bottom">
                    <small class="d-block"><strong>${f.numero_factura}</strong></small>
                    <small class="d-block text-muted">${fecha}</small>
                    <small class="d-block">$${f.total.toLocaleString('es-CO')}</small>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar historial:', error);
    }
}

// ==================== UTILIDADES ====================

function verificarAutenticacion() {
    if (!tokenActual) {
        window.location.href = 'login.html';
    }
}

function mostrarAlerta(mensaje, tipo = 'info') {
    const container = document.getElementById('alertas-container');
    const claseAlerta = tipo === 'exito' ? 'alerta-exito' : 
                       tipo === 'error' ? 'alerta-error' : 'alerta';
    
    const alerta = document.createElement('div');
    alerta.className = `alerta ${claseAlerta}`;
    alerta.innerHTML = `
        <strong>${mensaje}</strong>
        <button type="button" onclick="this.parentElement.remove()" style="background: none; border: none; float: right; cursor: pointer;">
            ×
        </button>
    `;
    
    container.appendChild(alerta);
    
    // Auto-desaparecer en 5 segundos
    setTimeout(() => alerta.remove(), 5000);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Cargar tema guardado
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}
