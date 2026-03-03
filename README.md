# MV Inventario Pro - Sistema de Gestión de Inventario con Facturación

**Versión:** 1.0.0  
**Última actualización:** Marzo 2026  
**Estado:** ✅ Producción (con soporte local Docker dev)

---

## 📋 Tabla de Contenidos

- [Visión General](#visión-general)
- [⚠️ Información Crítica sobre Archivos del Sistema](#información-crítica-sobre-archivos-del-sistema)
- [Requisitos Previos](#requisitos-previos)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Configuración](#instalación-y-configuración)
- [Cómo Ejecutar](#cómo-ejecutar)
- [Módulos del Sistema](#módulos-del-sistema)
- [Base de Datos](#base-de-datos)
- [Documentación Técnica](#documentación-técnica)
- [Solución de Problemas](#solución-de-problemas)

---

## Visión General

**MV Inventario Pro** es una aplicación web completa para la gestión de inventario de ropa con soporte integrado para:

- ✅ Gestión de productos y categorías
- ✅ Control de movimientos de inventario (entradas/salidas)
- ✅ Facturación electrónica con IVA configurable
- ✅ Generación de PDFs de facturas con Puppeteer/Chrome
- ✅ Reportes analíticos avanzados
- ✅ Historial de precios
- ✅ Sistema de autenticación JWT
- ✅ Control de acceso basado en roles (RBAC)

**Stack Tecnológico:**
- **Frontend:** HTML5, Tailwind CSS, Bootstrap Icons, Chart.js
- **Backend:** Node.js 18, HTTP nativo (sin Express)
- **Base de Datos:** MySQL 8.0
- **Containerización:** Docker + Docker Compose
- **Servidor Web:** Nginx Alpine

---

## ⚠️ Información Crítica sobre Archivos del Sistema

### 🔴 CARPETA LOGS - ARCHIVOS IMPRESCINDIBLES

La carpeta `/logs` contiene **dos archivos HTML críticos que deben existir siempre**:

#### **¿Qué contiene logs/?**

```
logs/
├── index.html         (CRÍTICO)
├── error.html         (CRÍTICO)
└── [archivos temporales de PDFs]
```

#### **¿Qué pasa si faltan estos archivos?**

| Archivo | Sin él... | Consecuencia |
|---------|-----------|--------------|
| `index.html` | ❌ Sistema no carga | 404 Not Found cuando accedes al dashboard|
| `error.html` | ❌ PDFs no se generan | Error 500 en facturación (Puppeteer falla) |

#### **¿De dónde vienen?**

Estos archivos se generan **automáticamente** la **primera vez que se ejecuta el sistema**:

1. El backend ([server.js](server.js)) detecta que faltan
2. Los crea dinámicamente si no existen
3. Los sirve desde la carpeta `/logs`

#### **¿Por qué el PDFs falla sin error.html?**

El generador de PDFs ([generador-factura-pdf-mejorado.js](utils/generador-factura-pdf-mejorado.js)) utiliza Puppeteer + Chrome para convertir HTML a PDF. El archivo `error.html` es un **fallback HTML vacío** que Chrome necesita como punto de referencia durante la renderización.

#### **⚡ SOLUCIÓN SI LOS BORRASTE ACCIDENTALMENTE:**

```bash
# Opción 1: Reconstruir contenedores Docker
docker compose down
docker compose up -d --build

# Opción 2: Crear los archivos manualmente
mkdir -p logs
touch logs/index.html
touch logs/error.html

# Opción 3: Simplemente acceder a http://localhost:8080
# El sistema los recreará automáticamente en el primer acceso
```

---

## Requisitos Previos

### Local (Desarrollo con Docker)
- ✅ Docker 20.10+
- ✅ Docker Compose 2.0+
- ✅ Git (para clonar el repo)
- ✅ Mínimo 2GB de espacio en disco

### Producción
- ✅ Servidor con Docker + Docker Compose
- ✅ Acceso a puertos 3000 (API), 8080 (Frontend), 3307 (MySQL)
- ✅ Certificado SSL/TLS para HTTPS

---

## Estructura del Proyecto

```
.
├── 📁 Frontend/                          # Aplicación web (HTML, CSS, JS)
│   ├── index.html                       # Dashboard principal
│   ├── favicon.ico                      # Ícono del sitio
│   ├── assets/
│   │   └── img/                         # Imágenes y logotipos
│   ├── pages/                           # Páginas HTML
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── facturacion.html            # ⭐ Módulo de facturación
│   │   ├── productos.html
│   │   ├── movimientos.html
│   │   ├── historial-precios.html
│   │   ├── analytics.html
│   │   └── settings.html
│   ├── scripts/                         # JavaScript (módulos de negocio)
│   │   ├── app.js                      # Lógica principal
│   │   ├── facturacion.js              # ⭐ Generador de facturas (cliente)
│   │   ├── productos.js
│   │   ├── navbar.js
│   │   ├── theme-manager.js
│   │   └── [otros scripts]
│   └── styles/                          # Hojas de estilos
│       ├── unified-theme.css           # Tema unificado
│       ├── theme-variables.css         # Variables CSS
│       ├── components.css              # Componentes reutilizables
│       ├── overrides.css               # Sobrescrituras Bootstrap
│       └── [otros estilos]
│
├── 📁 config/                           # Configuración de servicios
│   ├── nginx.conf                      # Configuración Nginx
│   └── default.conf                    # Virtual host Nginx
│
├── 📁 sql/                              # Scripts de base de datos
│   ├── init-db-complete.sql            # Inicialización BD completa
│   └── repair_db.sql                   # Script de reparación
│
├── 📁 dao/                              # Data Access Objects
│   ├── UsuarioDAO.js
│   ├── ProductoDAO.js
│   ├── FacturaDAO.js                   # ⭐ Operaciones con facturas
│   ├── ImpuestoDAO.js                  # ⭐ Gestión de impuestos
│   ├── HistorialPrecioDAO.js
│   └── [otros DAOs]
│
├── 📁 utils/                            # Utilidades y helpers
│   ├── generador-factura-pdf-mejorado.js  # ⭐ Generador PDF (Puppeteer)
│   ├── email-service.js                # Envío de correos
│   ├── pdf-chart-helper.js             # Gráficos en PDFs
│   └── templates/
│       └── factura.hbs                 # ⭐ Template HTML del PDF
│
├── 📁 routes/                           # Rutas y endpoints API
│   ├── facturacion.js                  # ⭐ Endpoints de facturas
│   ├── impuestos.js                    # ⭐ Endpoints de impuestos
│   ├── reportes.js
│   └── [otras rutas]
│
├── 📁 middleware/                       # Middlewares de autenticación
│   ├── auth.js                         # JWT authentication
│   ├── rbac.js                         # Control de roles
│   └── validate.js                     # Validación de schemas
│
├── 📁 auth/                             # Autenticación
│   └── jwt.js                          # Generación/verificación JWT
│
├── 📁 validators/                       # Validación de datos
│   ├── schemas.js
│   └── passwordSchemas.js
│
├── 📁 migrations/                       # Historial de cambios BD
│   ├── 001_crear_tablas_facturacion.sql
│   ├── 006_agregar_rol_cajero.sql
│   └── [otros migrations]
│
├── 📁 logs/                             # 🔴 CRÍTICO: Archivos temporales
│   ├── index.html                      # ⭐ GENERADO AUTOMÁTICAMENTE
│   ├── error.html                      # ⭐ GENERADO AUTOMÁTICAMENTE
│   └── [temp_factura_*.pdf]           # PDFs temporales
│
├── 📁 uploads/                          # Archivo cargados
│   └── logo/                           # Logos de empresa
│
├── 📁 Documentacion-repair-db/          # 📚 Documentación técnica
│   ├── guia_tablas_facturacion.md.resolved
│   └── implementation_plan_Facturacion.md
│
├── server.js                            # 🚀 SERVIDOR PRINCIPAL
├── package.json                         # Dependencias NPM
├── docker-compose.yml                   # Orquestación Docker
├── Dockerfile                           # Imagen Docker del app
└── README.md                            # 📖 Este archivo
```

---

## Instalación y Configuración

### 1️⃣ Clonar el repositorio

```bash
git clone <url-del-repo>
cd MV-Inventario-con-Facturacion-y-analiticas-
```

### 2️⃣ Configurar variables de entorno

Crear archivo `.env` en la raíz (opcional, usa defaults de docker-compose.yml):

```env
NODE_ENV=production
PORT=3000
DB_HOST=db
DB_USER=root
DB_PASSWORD=[TU_PASSWORD_MYSQL]
DB_NAME=inventario_ropa
JWT_SECRET=tu_clave_secreta_super_segura_2026_inventario_mv
APP_TIMEZONE=America/Colombia
```

### 3️⃣ Asegurar que existen archivos críticos

```bash
# Crear carpeta logs si no existe
mkdir -p logs
touch logs/index.html
touch logs/error.html
```

### 4️⃣ Levantar contenedores Docker

```bash
# Construir imágenes y levantar servicios
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f app

# Esperar ~30 segundos a que BD esté lista
```

### 5️⃣ Verificar instalación

```bash
# ✅ Si ves esta respuesta, el servidor funciona
curl http://localhost:3000/api/health

# Respuesta esperada:
# {"status":"ok","database":"connected"}
```

---

## Cómo Ejecutar

### Desarrollo Local (con Docker)

```bash
# Iniciar todos los servicios
docker compose up -d

# Ver logs
docker compose logs -f

# Acceder a la aplicación
# - Dashboard: http://localhost:8080
# - API: http://localhost:3000/api
# - MySQL: localhost:3307
```

### Comandos útiles Docker

```bash
# Detener servicios
docker compose down

# Reconstruir después de cambios
docker compose up -d --build

# Ejecutar comandos en contenedor
docker compose exec app node script.js

# Ver logs de MySQL
docker compose logs -f db

# Reiniciar solo la app
docker compose restart app
```

### Sin Docker (desarrollo local)

```bash
# Installar Node.js 18+ y MySQL 8.0

# Instalar dependencias
npm install

# Configurar variables de entorno
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=tu_password

# Ejecutar servidor
node server.js

# Fronted: abrir Frontend/index.html en navegador
```

---

## Módulos del Sistema

### 🔐 Autenticación y Seguridad

**Archivos clave:** `auth/jwt.js`, `middleware/auth.js`, `middleware/rbac.js`

- JWT con expiración de 24 horas
- Contraseñas hasheadas con bcryptjs
- Control de acceso basado en roles (Admin, Gerente, Cajero, Usuario)
- Protección CORS

### 📦 Gestión de Inventario

**Archivos clave:** `dao/ProductoDAO.js`, `scripts/productos.js`

- Crear/editar/eliminar productos
- Categorización de productos
- Control de stock
- Historial de precios

### 💼 Facturación (⭐ MÓDULO PRINCIPAL)

**Archivos clave:**
- `dao/FacturaDAO.js` — Operaciones BD
- `dao/ImpuestoDAO.js` — Gestión de impuestos
- `routes/facturacion.js` — Endpoints API
- `scripts/facturacion.js` — Lógica frontend
- `utils/generador-factura-pdf-mejorado.js` — Generador PDF
- `utils/templates/factura.hbs` — Template del PDF

#### Flujo de Facturación:

```
1. Usuario completa formulario (facturacion.html)
   ↓
2. Frontend guarda en BD vía /api/facturas (POST)
   ↓
3. Backend genera número único (FAC2026000001)
   ↓
4. Backend calcula subtotal, IVA, total
   ↓
5. Usuario descarga PDF → GET /api/facturas/:id/pdf
   ↓
6. Backend usa Puppeteer para convertir template HTML → PDF
   ↓
7. Chrome renderiza template con datos y genera bytes PDF
   ↓
8. Navegador descarga archivo
```

#### Generación de PDFs:

1. **Sin conexión remota** - Todo ocurre en el servidor
2. **Usa Puppeteer + Chrome** - Instalado en Dockerfile
3. **Genera en temp** - `/logs/temp_factura_TIMESTAMP.pdf`
4. **Se limpia automáticamente** - Después de 10 segundos

### 📊 Reportes y Análisis

**Archivos clave:** `routes/reportes.js`, `scripts/analytics.js`

- Gráficos de ventas por mes
- Inventario disponible por categoría
- Reportes en PDF con logos y gráficos incrustados

---

## Base de Datos

### Tablas Principales

#### ⭐ Tablas de Facturación (CRÍTICAS)

| Tabla | Propósito | Filas típicas |
|-------|----------|--------------|
| `impuesto` | Catálogo de impuestos (IVA, Exento, etc.) | 3-5 |
| `secuencia_documento` | Numeración automática de facturas | 1 |
| `factura` | Registro de facturas emitidas | 100+ |
| `detalle_factura` | Líneas de cada factura | 500+ |

#### Tablas Base

| Tabla | Propósito |
|-------|----------|
| `usuario` | Cuentas de usuario + hashs |
| `rol` | Roles del sistema |
| `categoria` | Categorías de productos |
| `producto` | Catálogo de inventario |
| `movimientos_inventario` | Historial de entradas/salidas |
| `historial_precio` | Cambios de precio |
| `configuracion` | Ajustes del sistema |

### Inicialización de Datos

El archivo `sql/init-db-complete.sql` contiene:

✅ Creación de todas las tablas  
✅ Inserción de datos iniciales:
- 1 usuario admin (email: `admin@mv.com`, password: `admin123`)
- 3 impuestos (IVA 19%, Exento, Impoconsumo)
- Secuencia de numeración para facturas
- Datos de configuración

### Reparación de BD

Si hay inconsistencias, ejecutar:

```bash
# Dentro del contenedor
docker compose exec db bash -c "mysql -u root -p[TU_PASSWORD_AQUI] inventario_ropa < /var/lib/mysql/repair_db.sql"

# O manualmente
mysql -h localhost -P 3307 -u root -p[TU_PASSWORD_AQUI] inventario_ropa < sql/repair_db.sql
```

---

## Documentación Técnica

### 📚 Documentación Incluida

La carpeta `Documentacion-repair-db/` contiene análisis detallado:

#### 1. **guia_tablas_facturacion.md.resolved**

Guía completa de las 4 tablas de facturación:

**Tabla 1: `impuesto`**
- Campos: id, nombre, tipo, porcentaje, valor_fijo, seleccionado
- Propósito: Catálogo de impuestos configurables
- Datos iniciales: IVA (19%), Exento (0%), Impoconsumo (8%)

**Tabla 2: `secuencia_documento`**
- Campos: id, tipo_documento, proximo_numero, prefijo, prefijo_year
- Propósito: Numeración automática FAC2026000001, FAC2026000002...
- Datos iniciales: 1 registro para FACTURA

**Tabla 3: `factura`**
- Campos: id, numero_factura, fecha_emision, cliente_*, subtotal, impuesto_monto, total
- Propósito: Registro de todos los documentos fiscales emitidos

**Tabla 4: `detalle_factura`**
- Campos: id, factura_id, producto_id, cantidad, precio_unitario, subtotal_linea
- Propósito: Líneas detalladas de cada factura

#### 2. **implementation_plan_Facturacion.md**

Plan de correcciones implementadas:

**Fix 1:** Integración de `FacturaDAO` en server.js ✅  
**Fix 2:** Cálculo correcto de impuestos en PDFs ✅  
**Fix 3:** Timezone Colombia (UTC-5) en formato 12h ✅  
**Fix 4:** Restricción de tamaño de logo (80x80px) ✅  

---

## Solución de Problemas

### ❌ Error: `Table 'inventario_ropa.factura' doesn't exist`

**Causa:** Base de datos no inicializada correctamente

**Solución:**

```bash
# Opción 1: Reconstruir todo
docker compose down -v
docker compose up -d --build

# Opción 2: Ejecutar init script manualmente
docker compose exec db mysql -u root -p[TU_PASSWORD_AQUI] inventario_ropa \
  < sql/init-db-complete.sql
```

### ❌ Error: `Error al generar PDF: ENOENT`

**Causa:** Carpeta `/logs` no existe o no tiene permisos

**Solución:**

```bash
# Crear carpeta y archivos críticos
docker compose exec app bash -c "mkdir -p /app/logs && chmod 777 /app/logs"
touch logs/index.html logs/error.html
```

### ❌ Error 404: `GET /styles/global-polish.css`

**Causa:** Referencia a archivo CSS que no existe ✅ REPARADO

**Estado:** Este error ha sido eliminado (v1.0.0)

### ❌ Error 404: `GET /api/admin/configuracion/finanzas.impuestos.habilitado`

**Causa:** Endpoint no implementado ✅ REPARADO

**Estado:** La función ahora obtiene impuestos directamente de `/api/impuestos`

### ❌ Error 500: Generación de PDF falla

**Causa más común:** Chrome/Puppeteer no tiene acceso a `/usr/bin/google-chrome-stable`

**Solución:**

```bash
# Verificar que Chrome está instalado en contenedor
docker compose exec app which google-chrome-stable

# Si responde: /usr/bin/google-chrome-stable ✅
# Si no responde: reconstruir
docker compose build --no-cache app
docker compose up -d
```

### ❌ Nginx devuelve 502 Bad Gateway

**Causa:** Servidor Node.js no disponible

**Verificar:**

```bash
# Ver estado de contenedor app
docker compose ps

# Ver logs
docker compose logs app

# Reiniciar
docker compose restart app
```

### ❌ Puerto 8080 o 3000 ya en uso

**Solución:**

```bash
# Ver qué está usando el puerto
lsof -i :8080
lsof -i :3000

# O cambiar puertos en docker-compose.yml y hacer rebuild
```

---

## Configuración Avanzada

### Cambiar Timezone

Editar `docker-compose.yml`:

```yaml
environment:
  APP_TIMEZONE: America/Colombia  # o tu zona horaria
```

### Cambiar Credenciales BD

Editar `docker-compose.yml`:

```yaml
environment:
  MYSQL_ROOT_PASSWORD: tu_nueva_password
  MYSQL_USER: nuevo_usuario
  MYSQL_PASSWORD: nueva_password
```

### Cambiar Prefijo de Facturas

En BD, tabla `secuencia_documento`:

```sql
UPDATE secuencia_documento SET prefijo = 'INV' WHERE tipo_documento = 'FACTURA';
-- Ahora las facturas serán: INV2026000001, INV2026000002...
```

### Agregar Nuevo Impuesto

```sql
INSERT INTO impuesto (nombre, tipo, porcentaje, valor_fijo, seleccionado)
VALUES ('Impuesto Local (5%)', 'porcentaje', 5.00, 0, FALSE);
```

---

## Credenciales por Defecto

### Acceso a la Aplicación

| Campo | Valor |
|-------|-------|
| Email | `admin@mv.com` |
| Contraseña | `admin123` |
| Rol | Administrador (acceso total) |

### Acceso a MySQL

| Parámetro | Valor |
|-----------|-------|
| Host | `localhost:3307` |
| Usuario | `root` |
| Contraseña | `[Cambiar antes de producción]` |
| Base de datos | `inventario_ropa` |

**Herramientas recomendadas:** MySQL Workbench, DBeaver, phpMyAdmin

---

## Notas Importantes

### ⚠️ Seguridad en Producción

Antes de deployar a producción:

- [ ] Cambiar `JWT_SECRET` a una cadena aleatoria larga
- [ ] Cambiar contraseña admin y del BD
- [ ] Habilitar HTTPS (certificados SSL/TLS)
- [ ] Configurar firewall para bloquear puerto 3307
- [ ] Hacer backups automáticos de BD
- [ ] Monitorear logs de errores
- [ ] Revisar permisos de archivos

### 📊 Monitoreo

```bash
# Ver uso de disco en contenedores
docker system df

# Ver logs persisentes
docker logs <container-id>

# Monitorear recursos en tiempo real
docker stats
```

---

## Soporte y Contacto

- **Autor:** MV Team
- **Versión:** 1.0.0
- **Última actualización:** Marzo 2026
- **Licencia:** Propietaria

Para reportar bugs o solicitar features, contactar al equipo de desarrollo.

---

## Changelog

### v1.0.0 (Marzo 2026) ✅

- ✅ Módulo de facturación completo
- ✅ Generación de PDFs con Puppeteer
- ✅ Control de impuestos configurables
- ✅ Reportes analíticos
- ✅ Limpieza de código (removidas referencias a global-polish.css)
- ✅ Reparación de endpoints de API
- ✅ Documentación técnica completa
- ✅ Containerización completa Docker

