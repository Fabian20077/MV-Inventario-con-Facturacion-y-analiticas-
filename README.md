# MV Inventario Pro

Sistema Integral de Gestión de Inventario, Facturación Electrónica y Analíticas.

**Versión:** 1.0.0 | **Última actualización:** Marzo 2026 | **Estado:** ✅ Producción

---

## Tabla de Contenidos

1. [Características Principales](#características-principales)
2. [Requisitos Previos](#requisitos-previos)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Instalación Paso a Paso](#instalación-paso-a-paso)
5. [Credenciales por Defecto](#credenciales-por-defecto)
6. [Acceso a la Aplicación](#acceso-a-la-aplicación)
7. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
8. [Comandos Docker](#comandos-docker)
9. [Base de Datos](#base-de-datos)
10. [Solución de Problemas](#solución-de-problemas)
11. [Contribución](#contribución)
12. [Licencia](#licencia)

---

## Características Principales

### Gestión de Inventario
- **Productos:** Registro completo con código, nombre, categoría, precio, stock, proveedor.
- **Categorías:** Organización jerárquica de productos.
- **Movimientos:** Control de entradas y salidas de inventario con historial.
- **Historial de Precios:** Seguimiento de cambios de precios por producto.

### Facturación Electrónica
- Generación de facturas con numeración automática.
- Cálculo automático de impuestos (IVA configurable por categoría).
- Exportación a PDF profesional.
- Secuenciales de facturación configurables.

### Reportes y Analíticas
- Dashboard visual con gráficos de ventas.
- Indicadores de rendimiento de inventario.
- Estadísticas de productos más vendidos.
- Control de stock y alertas de inventario bajo.

### Seguridad
- Autenticación JWT (JSON Web Tokens).
- Roles de usuario: Administrador, Gerente, Cajero.
- Control de acceso granular por módulo.
- Sesiones seguras con expiración configurable.

---

## Requisitos Previos

| Requisito | Versión Mínima | Descripción |
|-----------|----------------|-------------|
| **Docker** | 20.10+ | Motor de contenedores |
| **Docker Compose** | 2.0+ | Orquestación de servicios |
| **Git** | 2.30+ | Control de versiones |
| **Memoria RAM** | 4 GB | Recomendado para Docker |
| **Puerto 8080** | Libre | Frontend web |
| **Puerto 3000** | Libre | Backend API |
| **Puerto 3307** | Libre | MySQL (opcional acceso externo) |

### Instalación de Docker

#### Windows
1. Descarga [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Ejecuta el instalador
3. Inicia Docker Desktop desde el menú Inicio
4. Verifica con: `docker --version`

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

#### macOS
```bash
brew install --cask docker
open -a Docker
```

---

## Estructura del Proyecto

```
MV-Inventario-con-Facturacion-y-analiticas-
├── Frontend/                  # Interfaz de usuario (HTML, CSS, JS)
│   ├── pages/                # Páginas HTML
│   ├── scripts/              # Lógica JavaScript
│   ├── styles/               # Estilos CSS
│   └── assets/               # Imágenes e iconos
├── config/                   # Configuraciones
│   ├── nginx.conf            # Configuración Nginx
│   └── default.conf          # Virtual host
├── dao/                      # Data Access Objects
├── routes/                   # Endpoints de API
├── middleware/               # Autenticación y validación
├── sql/                      # Scripts de base de datos
│   └── init-db-complete.sql  # Esquema y datos iniciales
├── utils/                    # Utilidades
│   └── templates/            # Plantillas (PDF, emails)
├── logs/                     # Archivos de log
├── uploads/                  # Archivos subidos
├── docker-compose.yml        # Orquestación Docker
├── Dockerfile                # Imagen del backend
├── package.json              # Dependencias Node.js
└── README.md                 # Este archivo
```

---

## Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/Fabian20077/MV-Inventario-con-Facturacion-y-analiticas-.git
cd MV-Inventario-con-Facturacion-y-analiticas-
```

### Paso 2: Verificar Docker

```bash
# Verificar que Docker esté instalado
docker --version

# Verificar Docker Compose
docker compose version

# Verificar que Docker esté corriendo
docker ps
```

### Paso 3: (Opcional) Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# ============================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================
DB_HOST=db
DB_USER=inventario_user
DB_PASSWORD=tu_password_seguro_2026
DB_NAME=inventario_ropa
DB_PORT=3306

# ============================================
# CONFIGURACIÓN DE JWT (SEGURIDAD)
# ============================================
JWT_SECRET=tu_clave_secreta_muy_segura_aqui_2026
JWT_EXPIRES_IN=24h

# ============================================
# CONFIGURACIÓN DE LA APLICACIÓN
# ============================================
NODE_ENV=production
PORT=3000
APP_NAME=MV Inventario
APP_VERSION=1.0.0
APP_TIMEZONE=America/Colombia

# ============================================
# CORS Y PUERTOS
# ==========================================
CORS_ORIGIN=http://localhost:8080
```

> **Nota:** Si no creas el archivo `.env`, se usarán los valores por defecto del `docker-compose.yml`.

### Paso 4: Levantar los Servicios

```bash
# Construir y levantar todos los servicios en modo demonio
docker compose up -d --build

# Ver el estado de los servicios
docker compose ps

# Ver logs en tiempo real (opcional)
docker compose logs -f
```

### Paso 5: Esperar a que los Servicios Inicien

El primer inicio puede tomar 2-3 minutos mientras:
- Se descarga la imagen de MySQL
- Se inicializa la base de datos
- Se instalan las dependencias de Node.js
- Se configuran los servicios

```bash
# Verificar que todos los servicios estén healthy
docker compose ps
```

**Estado esperado:**
| Servicio | Estado | Puerto |
|----------|--------|--------|
| db | healthy (Up) | 3307 |
| app | running (Up) | 3000 |
| frontend | running (Up) | 8080 |

### Paso 6: Acceder a la Aplicación

Abre tu navegador y visita: **http://localhost:8080**

---

## Credenciales por Defecto

| Rol | Email | Contraseña | Permisos |
|-----|-------|------------|----------|
| **Administrador** | admin@mv.com | admin123 | Acceso total |
| **Gerente** | gerente@mv.com | gerente123 | Gestión de inventario y reportes |
| **Cajero** | cajero@mv.com | cajero123 | Solo facturación y ventas |

### Cambiar Contraseñas en Producción

Se recomienda cambiar las contraseñas por defecto después del primer ingreso:

1. Inicia sesión como Administrador
2. Ve a **Configuración > Usuarios**
3. Edita el usuario y cambia la contraseña

---

## Acceso a la Aplicación

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:8080 | Dashboard principal |
| **Backend API** | http://localhost:3000/api | Endpoints de la API |
| **phpMyAdmin** | (no instalado) | Administración de BD |
| **MySQL** | localhost:3307 | Puerto externo MySQL |

### Puertos Externos

| Puerto | Servicio | Credenciales |
|--------|----------|--------------|
| 8080 | Frontend (Nginx) | N/A |
| 3000 | Backend (Node.js) | N/A |
| 3307 | MySQL | root / outside1234 |

---

## Configuración de Variables de Entorno

### Variables del Backend

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `NODE_ENV` | Entorno de ejecución | production |
| `PORT` | Puerto del servidor | 3000 |
| `DB_HOST` | Host de la base de datos | db |
| `DB_USER` | Usuario de MySQL | inventario_user |
| `DB_PASSWORD` | Contraseña de MySQL | inventario_pass_change_me |
| `DB_NAME` | Nombre de la base de datos | inventario_ropa |
| `JWT_SECRET` | Clave para tokens JWT | (valor seguro) |
| `JWT_EXPIRES_IN` | Expiración del token | 24h |
| `APP_TIMEZONE` | Zona horaria | America/Colombia |

### Variables de MySQL

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `MYSQL_ROOT_PASSWORD` | Contraseña root | outside1234 |
| `MYSQL_DATABASE` | Nombre de BD | inventario_ropa |
| `MYSQL_USER` | Usuario de la app | inventario_user |
| `MYSQL_PASSWORD` | Contraseña del usuario | inventario_pass_change_me |

---

## Comandos Docker

### Comandos Básicos

```bash
# Iniciar todos los servicios
docker compose up -d

# Detener todos los servicios
docker compose down

# Reiniciar servicios
docker compose restart

# Ver estado de servicios
docker compose ps
```

### Comandos de Desarrollo

```bash
# Reconstruir servicios ( после cambios en código)
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f app
docker compose logs -f db
docker compose logs -f frontend
```

### Comandos de Mantenimiento

```bash
# Eliminar volúmenes (⚠️ PIERDE TODOS LOS DATOS)
docker compose down -v

# Entrar al contenedor de la base de datos
docker compose exec db bash

# Entrar al contenedor del backend
docker compose exec app sh

# Ver uso de recursos
docker stats

# Ver espacio en disco
docker system df
```

### Comandos de Base de Datos

```bash
# Conectar a MySQL desde el host
mysql -h localhost -P 3307 -u root -p

# Conectar a MySQL desde el contenedor
docker compose exec db mysql -u root -poutside1234 inventario_ropa

# Ejecutar script SQL
docker compose exec db mysql -u root -poutside1234 inventario_ropa < archivo.sql

# Respaldar base de datos
docker compose exec db mysqldump -u root -poutside1234 inventario_ropa > backup.sql
```

---

## Base de Datos

### Esquema

La base de datos `inventario_ropa` contiene las siguientes tablas principales:

| Tabla | Descripción |
|-------|-------------|
| `usuarios` | Usuarios del sistema |
| `roles` | Roles (Admin, Gerente, Cajero) |
| `categorias` | Categorías de productos |
| `productos` | Inventario de productos |
| `proveedores` | Proveedores |
| `facturas` | Encabezados de facturas |
| `detalle_factura` | Items de facturas |
| `movimientos` | Entradas/salidas de inventario |
| `historial_precios` | Historial de precios |
| `configuracion` | Configuraciones del sistema |

### Inicialización

El script `sql/init-db-complete.sql` se ejecuta automáticamente:
1. La primera vez que se crea el contenedor de MySQL
2. Al ejecutar `docker compose up -d` con volúmenes nuevos

Este script crea:
- Todas las tablas del sistema
- Datos iniciales (usuarios, categorías, impuestos)
- Secuencias de facturación

### Respaldo y Restauración

#### Crear Respaldo
```bash
docker compose exec db mysqldump -u root -poutside1234 inventario_ropa > backup_$(date +%Y%m%d).sql
```

#### Restaurar Respaldo
```bash
docker compose exec -T db mysql -u root -poutside1234 inventario_ropa < backup_20260316.sql
```

---

## Solución de Problemas

### Error: "Connection refused" al conectar a la base de datos

**Causa:** El contenedor de MySQL no ha terminado de iniciar.

**Solución:**
```bash
# Verificar estado de MySQL
docker compose logs db

# Esperar a que esté healthy
docker compose ps
```

### Error: "Table 'inventario_ropa.xxx' doesn't exist"

**Causa:** La base de datos no se inicializó correctamente.

**Solución:**
```bash
# Reconstruir desde cero (pierde datos)
docker compose down -v
docker compose up -d --build
```

### Error: "Invalid username or password"

**Causa:** Credenciales incorrectas o tabla de usuarios vacía.

**Solución:**
1. Verifica las credenciales por defecto
2. Si persistе, reconstruye:
```bash
docker compose down -v
docker compose up -d --build
```

### Error: "Port 8080 is already in use"

**Causa:** Otro servicio está usando el puerto 8080.

**Solución:**
```bash
# Cambiar puerto en docker-compose.yml (frontend > ports)
# O detener el servicio que usa el puerto
```

### Error: "Cannot create container"

**Causa:** Sin espacio en disco o Docker no está corriendo.

**Solución:**
```bash
# Verificar espacio
docker system df

# Limpiar recursos no usados
docker system prune -a
```

### Ver Logs de Errores

```bash
# Todos los servicios
docker compose logs

# Solo backend
docker compose logs app

# Solo base de datos
docker compose logs db

# Solo frontend
docker compose logs frontend
```

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                      USUARIO                                │
│                   (Navegador Web)                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ http://localhost:8080
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   NGINX (Frontend)                          │
│              Puerto 8080 → Puerto 80                        │
│          (Sirve archivos estáticos)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │ Proxy /api/*
                      ▼
┌─────────────────────────────────────────────────────────────┐
│               NODE.JS (Backend API)                         │
│                   Puerto 3000                               │
│    ┌──────────────┬──────────────┬──────────────┐          │
│    │   Routes     │    DAO       │   Middleware │          │
│    │  (Endpoints) │   (Datos)    │  (Auth/JWT)  │          │
│    └──────────────┴──────────────┴──────────────┘          │
└─────────────────────┬───────────────────────────────────────┘
                      │ MySQL Protocol
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   MYSQL 8.0                                  │
│                 Puerto 3306 (interno)                       │
│               Puerto 3307 (externo)                         │
│              Volumen: mysql_data                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Contribución

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/Fabian20077/MV-Inventario-con-Facturacion-y-analiticas-.git
   ```

2. **Crea una rama para tu feature:**
   ```bash
   git checkout -b feature/nueva-funcionalidad
   ```

3. **Realiza tus cambios y commitea:**
   ```bash
   git add .
   git commit -m "feat: Descripción del cambio"
   ```

4. **Push a tu rama:**
   ```bash
   git push origin feature/nueva-funcionalidad
   ```

5. **Crea un Pull Request en GitHub**

---

## Licencia

**Propietaria** - MV Team 2026

Todos los derechos reservados. Este software no puede ser distribuido, modificado o usado con fines comerciales sin autorización expresa.

---

## Soporte

¿Necesitas ayuda?
- **Email:** fabianenriquepilonieta@gmail.com
- **GitHub Issues:** Reporta errores en el repositorio

---

**© 2026 MV Team - Sistema de Gestión Integral**
