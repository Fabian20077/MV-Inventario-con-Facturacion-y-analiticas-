# MV Inventario Pro

Sistema de Gestión de Inventario y Facturación Electrónica.

**Versión:** 1.0.0 | **Última actualización:** Marzo 2026 | **Estado:** ✅ Producción

---

## 🚀 Características Principales

- **Gestión de Inventario:** Productos, categorías, movimientos de entrada/salida, historial de precios.
- **Facturación Electrónica:** Generación de facturas con cálculo automático de impuestos (IVA configurable) y exportación a PDF.
- **Reportes y Analíticas:** Dashboard visual con gráficos de ventas, inventario y rendimiento.
- **Seguridad:** Autenticación JWT, roles de usuario (Admin, Gerente, Cajero), y control de acceso.
- **Tecnología:** Node.js (Backend), MySQL (Base de Datos), Docker (Containerización), Nginx (Servidor Web).

---

## 📦 Requisitos Previos

Para ejecutar el proyecto localmente o en producción, necesitas:

- [Docker](https://www.docker.com/) y Docker Compose
- Git (para clonar el repositorio)
- Puerto 8080 (Frontend) y 3000 (Backend API) disponibles

---

## 🏗️ Estructura del Proyecto

```
.
├── Frontend/              # Aplicación web (HTML, CSS, JS)
├── config/                # Configuración de Nginx y base de datos
├── dao/                   # Data Access Objects (acceso a BD)
├── routes/                # Endpoints de la API
├── middleware/            # Autenticación y validación
├── sql/                   # Scripts de inicialización y reparación de BD
├── utils/                 # Utilidades (PDF, email, etc.)
├── docker-compose.yml     # Orchestación Docker
├── server.js              # Servidor principal
└── README.md              # Este archivo
```

---

## ⚙️ Instalación y Configuración

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Fabian20077/MV-Inventario-con-Facturacion-y-analiticas-.git
cd MV-Inventario-con-Facturacion-y-analiticas-
```

### 2. Configurar Variables de Entorno (Opcional)

Crea un archivo `.env` en la raíz del proyecto. Si no lo creas, se usarán los valores por defecto de `docker-compose.yml`.

```env
# Base de datos
DB_HOST=db
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=inventario_ropa

# JWT
JWT_SECRET=tu_clave_secreta_super_segura_2026_inventario_mv
JWT_EXPIRES_IN=24h

# Aplicación
APP_TIMEZONE=America/Colombia
NODE_ENV=production
```

### 3. Levantar el Proyecto con Docker

```bash
# Construir y levantar todos los servicios
docker compose up -d --build

# Ver los logs en tiempo real
docker compose logs -f
```

> **Nota:** La primera vez que se ejecuta, Docker creará la base de datos automáticamente usando el script `sql/init-db-complete.sql`.

---

## 🔑 Credenciales por Defecto

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | `admin@mv.com` | `admin123` |
| Gerente | `gerente@mv.com` | `gerente123` |

---

## 📊 Acceso a la Aplicación

Una vez levantados los servicios, accede desde tu navegador:

- **Frontend (Dashboard):** http://localhost:8080
- **Backend API:** http://localhost:3000/api
- **Base de Datos (MySQL):** `localhost:3307` (usuario: `root`)

---

## 🛠️ Comandos Útiles Docker

| Comando | Descripción |
|---------|-------------|
| `docker compose down -v` | Detener servicios y eliminar volúmenes (¡cuidado! borra datos) |
| `docker compose up -d --build` | Reconstruir y reiniciar servicios |
| `docker compose logs -f app` | Ver logs del backend |
| `docker compose exec db bash` | Entrar al contenedor de la base de datos |

---

## 🗄️ Base de Datos

### Inicialización

El script `sql/init-db-complete.sql` se ejecuta automáticamente al crear el contenedor de MySQL por primera vez. Contiene:

- Creación de todas las tablas (usuarios, productos, facturas, etc.)
- Datos iniciales (usuarios, categorías, impuestos)
- Configuración de secuencias de facturación

### Reparación

Si encuentras errores de tablas faltantes, ejecuta el script de reparación:

```bash
docker compose exec db mysql -u root -poutside1234 inventario_ropa < /var/lib/mysql/repair_db.sql
```

---

## 🐛 Solución de Problemas Comunes

### Error: "Contraseña incorrecta" en Login

**Causa:** Los hashes de contraseña no coinciden.

**Solución:**
1. Asegúrate de usar las credenciales por defecto (`admin@mv.com` / `admin123`).
2. Si persiste, reconstruye Docker: `docker compose down -v && docker compose up -d --build`

### Error: "Table doesn't exist"

**Causa:** La base de datos no se inicializó correctamente.

**Solución:**
```bash
docker compose down -v
docker compose up -d --build
```

### Error 404 en APIs

**Causa:** El backend no está reachable o Nginx no redirige correctamente.

**Solución:**
1. Verifica que el backend esté corriendo: `docker compose ps`
2. Verifica los logs: `docker compose logs -f app`
3. Asegúrate de que el puerto 3000 esté mapeado en `docker-compose.yml`

---

## 📚 Documentación Técnica

- **Migraciones:** Ver `migrations/README.md` para detalles sobre la consolidación de tablas.
- **Facturación:** Ver `Documentacion-repair-db/` para guías específicas de facturación.
- **API:** Los endpoints están listados en la consola del servidor al iniciar.

---

## 🤝 Contribución

1. Clona el repositorio
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commitea tus cambios
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crea un Pull Request

---

## 📄 Licencia

Propietaria - MV Team 2026
