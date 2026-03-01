# Correcciones de Factura: Impuesto, Hora Colombia, Logo

## Contexto

La factura se crea correctamente en la BD con datos de impuesto (subtotal, impuesto_monto, total). El problema es que el **PDF descargado** no muestra el impuesto correctamente, la hora usa UTC (no Colombia), y el logo no tiene restricción de tamaño.

Hay **dos flujos de PDF** en el sistema:
1. **Inline en [server.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/server.js)** (línea ~1590): Genera PDF desde salidas de inventario. Usa [generarFactura()](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/generador-factura-pdf-mejorado.js#42-156) (instancia). Funciona pero tiene los bugs de timezone/logo.
2. **Ruta [routes/facturas.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/routes/facturas.js)** (línea 264-301): PDF desde la página de facturación. **Está roto** — llama `GeneradorFacturaPDF.generarFacturaCoucher()` que no existe, y no importa [ConfiguracionDAO](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/dao/ConfiguracionDAO.js#7-152).

## Proposed Changes

### Fix 1 (CRÍTICO): Reparar endpoint PDF de facturas

#### [MODIFY] [facturas.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/routes/facturas.js)

- Agregar `import ConfiguracionDAO` (falta, causa `ReferenceError`)
- Cambiar `GeneradorFacturaPDF.generarFacturaCoucher(factura, config)` → instanciar `new GeneradorFacturaPDF()` y llamar [generarFactura(factura, config, tempPath)](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/generador-factura-pdf-mejorado.js#42-156) con un archivo temporal
- Leer el PDF generado y enviarlo como response, luego limpiarlo

---

### Fix 2 (CRÍTICO): Impuesto en el PDF

El template [factura.hbs](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/templates/factura.hbs) **ya tiene** el bloque condicional para mostrar impuesto:
```hbs
{{#if impuesto_monto}}
  {{impuesto_nombre}} ({{impuesto_porcentaje}}%): {{impuesto_monto_fmt}}
{{/if}}
```

El generador [generador-factura-pdf-mejorado.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/generador-factura-pdf-mejorado.js) **ya pasa** estos datos al template (líneas 92-95). Por lo tanto, una vez que el endpoint de [facturas.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/routes/facturas.js) funcione correctamente (Fix 1), el impuesto se mostrará automáticamente en el PDF, ya que los datos de impuesto se guardan en la tabla `factura`.

---

### Fix 3 (ALTA): Hora Colombia (UTC-5) en formato 12h

#### [MODIFY] [generador-factura-pdf-mejorado.js](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/generador-factura-pdf-mejorado.js)

Cambiar [_formatearFecha()](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/generador-factura-pdf-mejorado.js#24-41) para usar `timeZone: 'America/Bogota'` y formato 12h:

```js
return date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) + ', ' + 
       date.toLocaleTimeString('es-CO', { 
           hour: '2-digit', minute: '2-digit', 
           hour12: true, timeZone: 'America/Bogota' 
       });
```

---

### Fix 4 (MEDIA): Logo máximo 80x80px

#### [MODIFY] [factura.hbs](file:///c:/Users/USUARIO/OneDrive%20-%20SENA/Documentos/mv-inventario/utils/templates/factura.hbs)

Cambiar el CSS de `.logo-img` de:
```css
.logo-img { max-width: 60%; height: auto; }
```
A:
```css
.logo-img { max-width: 80px; max-height: 80px; width: auto; height: auto; object-fit: contain; }
```

---

## Verification Plan

### Manual Verification

> [!IMPORTANT]
> Después de implementar los cambios, se necesita reconstruir Docker y probar manualmente:

1. Reconstruir contenedores: `docker compose down && docker compose up -d --build`
2. Abrir `http://localhost:8080/pages/facturacion.html`
3. Crear una factura de prueba con al menos 1 producto
4. Al emitirse, se descarga el PDF automáticamente
5. Abrir el PDF y verificar:
   - ✅ Línea de impuesto visible (ej: "IVA General (19%): $24.700")
   - ✅ Total = subtotal + impuesto
   - ✅ Hora en formato 12h con AM/PM, zona horaria Colombia
   - ✅ Logo ≤ 80x80px, sin deformación
