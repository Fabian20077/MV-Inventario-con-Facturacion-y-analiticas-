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

  // Render tabla de productos
  function renderTabla(productos) {
    const cont = document.getElementById('tablaContenedor');
    if (!cont) return;
    if (!Array.isArray(productos) || productos.length === 0) {
      cont.innerHTML = `<div class=\"alert alert-info text-center\" role=\"alert\"><i class=\"bi bi-inbox\"></i> No hay productos registrados</div>`;
      return;
    }
    let html = `
      <table class=\"table table-hover mb-0\">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Precio Compra</th>
            <th>Precio Venta</th>
            <th>Stock</th>
            <th>Stock Mín</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    productos.forEach(p => {
      const cat = p.categoria_nombre || p.categoria || '';
      const precioCompra = Number(p.precio_compra) || 0;
      const precioVenta  = Number(p.precio_venta) || 0;
      html += `
        <tr>
          <td>${p.codigo}</td>
          <td>${p.nombre}</td>
          <td>${cat}</td>
          <td>$${precioCompra.toLocaleString('es-CO', {minimumFractionDigits: 0})}</td>
          <td>$${precioVenta.toLocaleString('es-CO', {minimumFractionDigits: 0})}</td>
          <td>${p.cantidad ?? 0}</td>
          <td>${p.stock_minimo ?? 0}</td>
          <td>
            <button class=\"btn btn-sm btn-primary\" title=\"Editar\">Editar</button>
            <button class=\"btn btn-sm btn-danger\" title=\"Eliminar\">Eliminar</button>
          </td>
        </tr>`;
    });
    html += `
        </tbody>
      </table>`;
    cont.innerHTML = html;
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
      const cont = document.getElementById('tablaContenedor');
      if (cont) cont.innerHTML = `<div class=\"alert alert-danger text-center\">Error al cargar productos</div>`;
    }
  }

  // Inicialización simple
  document.addEventListener('DOMContentLoaded', function(){
    cargarProductos();
  });
})();
