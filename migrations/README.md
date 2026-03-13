# Carpeta de Migraciones (Historial)

> **Estado:** Esta carpeta ha sido consolidada. Todas las definiciones de tablas se encuentran en [`sql/init-db-complete.sql`](../sql/init-db-complete.sql).

## ¿Cómo funciona la base de datos?

| Archivo | Propósito |
|---------|-----------|
| `sql/init-db-complete.sql` | **Fuente de verdad.** Se ejecuta automáticamente al crear el contenedor Docker por primera vez. Contiene TODAS las tablas, índices, datos iniciales y configuraciones. |
| `sql/repair_db.sql` | Script de reparación para las tablas de facturación. Úsalo si las tablas de facturación se corrompen o faltan. |

## ¿Para qué servía esta carpeta?

Originalmente almacenaba scripts SQL incrementales (migraciones) para modificar la estructura de la BD. Sin embargo:

1. **No había un migration runner** — los archivos se ejecutaban manualmente
2. **Se acumularon 15 archivos** con esquemas redundantes y contradictorios
3. **Todo se consolidó** en `init-db-complete.sql` en Marzo 2026

## ¿Necesito crear migraciones nuevas?

Si necesitas agregar tablas o columnas al sistema:

1. **Modifica directamente** `sql/init-db-complete.sql`
2. Si es un cambio en tablas de facturación, **actualiza también** `sql/repair_db.sql`
3. Para aplicar cambios en una BD existente sin perder datos, ejecuta el ALTER/INSERT manualmente

## Archivos eliminados (referencia)

Los siguientes archivos fueron eliminados por ser redundantes o estar ya absorbidos en `init-db-complete.sql`:

- `001_crear_tablas_facturacion.sql` — Esquema antiguo de facturación
- `002_agregar_configuracion_timezone.sql` — Configuraciones absorbidas
- `003_crear_facturacion.sql` — Duplicado de 001
- `003_saneamiento_y_configuracion.sql` — Encoding fix (referenciaba tabla inexistente)
- `004_agregar_cliente_factura.sql` — Archivo vacío
- `005_facturacion_electronica.sql` — Sistema de facturación diferente (no usado)
- `006_agregar_rol_cajero.sql` — Rol no utilizado
- `006_agregar_tabla_impuestos.sql` — Tabla `impuestos` (plural, no usada por el código)
- `007_configuracion_smtp.sql` — Absorbido en init-db-complete.sql
- `008_crear_tabla_impuestos.sql` — Esquema incompleto, absorbido
- `009_configuracion_impuestos.sql` — Absorbido en init-db-complete.sql
- `009_update_impuestos_tipo.sql` — ALTER absorbido
- `010_factura_add_tipo.sql` — ALTER absorbido
- `011_impuestos_two_fields.sql` — ALTER absorbido
- `fix_encoding.sql` — Script de encoding duplicado
