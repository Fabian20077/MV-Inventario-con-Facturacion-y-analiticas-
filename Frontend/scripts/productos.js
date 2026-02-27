(function () {
  // Helpers
  function getToken() {
    return localStorage.getItem('authToken') || localStorage.getItem('token');
  }
  function getAuthHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  }

  // Render tabla de productos
  function renderTabla(productos) {
    const cont = document.getElementById('productosTable');
    if (!cont) return;
    if (!Array.isArray(productos) || productos.length === 0) {
      cont.innerHTML = `<tr><td colspan="9" class="text-center py-8">No hay productos registrados</td></tr>`;
      document.getElementById('totalRegistros').textContent = '0';
      return;
    }

    document.getElementById('totalRegistros').textContent = productos.length;

    // Calcular estadísticas
    let stockBajo = 0;
    let valorTotal = 0;
    let margenPromedio = 0;
    let productosConMargen = 0;

    cont.innerHTML = productos.map(p => {
      const cat = p.categoria_nombre || p.categoria || '';
      const precioCompra = Number(p.precio_compra) || 0;
      const precioVenta = Number(p.precio_venta) || 0;
      const cantidad = Number(p.cantidad) || 0;
      const stockMinimo = Number(p.stock_minimo) || 0;
      const margen = precioCompra > 0 ? ((precioVenta - precioCompra) / precioCompra * 100) : 0;

      // Estadísticas
      if (cantidad <= stockMinimo) stockBajo++;
      valorTotal += precioCompra * cantidad;
      if (precioVenta > 0) {
        margenPromedio += margen;
        productosConMargen++;
      }

      // Verificar vencimiento
      let estado = '<span class="badge badge-vigente">VIGENTE</span>';
      if (p.fecha_vencimiento) {
        try {
          const fechaVenc = new Date(p.fecha_vencimiento);
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          if (!isNaN(fechaVenc.getTime()) && fechaVenc < hoy) {
            estado = '<span class="badge badge-vencido">VENCIDO</span>';
          }
        } catch (e) {}
      }

      return `<tr>
        <td><strong>${p.codigo}</strong></td>
        <td>${p.nombre}</td>
        <td>${cat || '<span class="text-gray-400">-</span>'}</td>
        <td>$${precioCompra.toLocaleString('es-CO', {minimumFractionDigits: 0})}</td>
        <td>$${precioVenta.toLocaleString('es-CO', {minimumFractionDigits: 0})}</td>
        <td><strong class="${cantidad <= stockMinimo ? 'text-danger' : ''}">${cantidad}</strong></td>
        <td>${stockMinimo}</td>
        <td>${estado}</td>
        <td>
          <button class="btn btn-sm btn-primary" title="Editar" onclick="editarProducto(${p.id})"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-danger" title="Eliminar" onclick="eliminarProducto(${p.id})"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
    }).join('');

    // Actualizar KPIs
    document.getElementById('totalProductos').textContent = productos.length;
    document.getElementById('stockBajo').textContent = stockBajo;
    document.getElementById('valorInventario').textContent = '$' + valorTotal.toLocaleString('es-CO', {minimumFractionDigits: 0});
    const margenAvg = productosConMargen > 0 ? (margenPromedio / productosConMargen).toFixed(1) : 0;
    document.getElementById('margenPromedio').textContent = margenAvg + '%';
  }

  // Cargar productos desde API
  async function cargarProductos() {
    try {
      const resp = await fetch('/api/productos', { headers: getAuthHeaders() });
      if (!resp.ok) throw new Error('Error al cargar productos: ' + resp.status);
      const data = await resp.json();
      const productos = data.data || data;
      renderTabla(productos);
    } catch (err) {
      console.error(err);
      const cont = document.getElementById('productosTable');
      if (cont) cont.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-danger">Error al cargar productos</td></tr>`;
    }
  }

  // Funciones globales para editar y eliminar
  window.editarProducto = function(id) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'info', title: 'Editar producto', text: 'Función en desarrollo para ID: ' + id });
    } else {
      alert('Editar producto ID: ' + id);
    }
  };

  window.eliminarProducto = function(id) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: '¿Eliminar producto?',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          fetch('/api/productos/' + id, {
            method: 'DELETE',
            headers: getAuthHeaders()
          }).then(r => r.json()).then(res => {
            if (res.success) cargarProductos();
            Swal.fire({ icon: res.success ? 'success' : 'error', title: res.success ? 'Eliminado' : 'Error', text: res.message });
          });
        }
      });
    } else {
      if (confirm('¿Eliminar producto ID: ' + id + '?')) {
        fetch('/api/productos/' + id, {
          method: 'DELETE',
          headers: getAuthHeaders()
        }).then(r => r.json()).then(res => {
          if (res.success) cargarProductos();
          alert(res.message);
        });
      }
    }
  };

  // Inicialización
  document.addEventListener('DOMContentLoaded', function(){
    cargarProductos();

    // Filtros
    const filtroNombre = document.getElementById('filtroNombre');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const filtroEstado = document.getElementById('filtroEstado');

    function filtrar() {
      const nombre = (filtroNombre?.value || '').toLowerCase();
      const categoria = filtroCategoria?.value || '';
      const estado = filtroEstado?.value || '';

      fetch('/api/productos', { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
          let productos = data.data || data;
          if (nombre) productos = productos.filter(p =>
            (p.nombre?.toLowerCase().includes(nombre)) || (p.codigo?.toLowerCase().includes(nombre)));
          if (categoria) productos = productos.filter(p => p.id_categoria == categoria);
          if (estado) {
            productos = productos.filter(p => {
              if (estado === 'VIGENTE') {
                if (!p.fecha_vencimiento) return true;
                try { const f = new Date(p.fecha_vencimiento); const hoy = new Date(); hoy.setHours(0,0,0,0); return !isNaN(f.getTime()) && f >= hoy; } catch(e) { return true; }
              } else if (estado === 'VENCIDO') {
                if (!p.fecha_vencimiento) return false;
                try { const f = new Date(p.fecha_vencimiento); const hoy = new Date(); hoy.setHours(0,0,0,0); return !isNaN(f.getTime()) && f < hoy; } catch(e) { return false; }
              }
              return true;
            });
          }
          renderTabla(productos);
        });
    }

    if (filtroNombre) filtroNombre.addEventListener('input', filtrar);
    if (filtroCategoria) filtroCategoria.addEventListener('change', filtrar);
    if (filtroEstado) filtroEstado.addEventListener('change', filtrar);
  });
})();
