# 📦 MV Inventario

Sistema de gestión de inventario para tiendas de ropa con análisis en tiempo real, exportación de reportes y diseño responsive.

## 🚀 Tecnologías

### Backend
- **Node.js** v18.0.0+
- **MySQL** 8.0+
- **Docker & Docker Compose**

### Frontend
- **HTML5, CSS3, JavaScript Vanilla**
- **Tailwind CSS** (CDN)
- **Chart.js** - Gráficas
- **Bootstrap Icons**

### Librerías Backend

| Librería | Versión | Uso |
|----------|---------|-----|
| `exceljs` | ^4.4.0 | Exportación Excel |
| `pdfkit` | ^0.17.2 | Exportación PDF |
| `@json2csv/plainjs` | ^7.0.0 | Exportación CSV |
| `jsonwebtoken` | ^9.0.2 | Autenticación JWT |
| `bcryptjs` | ^3.0.3 | Encriptación de contraseñas |
| `mysql2` | ^3.15.0 | Driver MySQL |
| `zod` | ^3.22.4 | Validación de datos |

## 📁 Estructura

```
inventario-ropa/
├── Frontend/           # Páginas web
│   ├── dashboard.html
│   ├── analytics.html
│   ├── productos.html
│   ├── movimientos.html
│   └── login.html
├── routes/            # Servicios API
│   └── reportes.js
├── dao/               # Acceso a datos
├── config/            # Configuración
├── middleware/        # Middlewares
├── auth/              # Autenticación
├── Database/          # Scripts SQL
└── server.js          # Servidor principal
```

## ⚙️ Variables de Entorno

Definidas en `docker-compose.yml`:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `MYSQL_ROOT_PASSWORD` | `root_password` | Contraseña root MySQL |
| `MYSQL_DATABASE` | `inventario_ropa` | Base de datos |
| `MYSQL_USER` | `inventario_user` | Usuario aplicación |
| `MYSQL_PASSWORD` | `inventario_pass` | Contraseña usuario |
| `TZ` | `America/Bogota` | Zona horaria (UTC-5) |

## 📥 Instalación

### Prerrequisitos

- ✅ Docker Desktop instalado
- ✅ Puertos libres: 3000, 8081, 3306

### Pasos

```bash
# 1. Clonar repositorio
git clone <url-repositorio>
cd inventario-ropa

# 2. Iniciar contenedores
docker-compose up -d

# 3. Verificar estado
docker-compose ps

# 4. Configurar contraseña admin (IMPORTANTE - solo primera vez)
node set-password.mjs

# 5. Acceder a la aplicación
http://localhost:8081/login.html
```

### 🔑 Credenciales de Acceso

Después de ejecutar `node set-password.mjs`, usa estas credenciales para iniciar sesión:

| Campo | Valor |
|-------|-------|
| **Email** | `admin@mv.com` |
| **Contraseña** | `admin123` |

> **⚠️ IMPORTANTE:** Debes ejecutar `node set-password.mjs` después del primer inicio de Docker para que las credenciales funcionen correctamente.

## 🎯 Funcionalidades

1. **Dashboard** - Métricas en tiempo real
2. **Análisis** - Gráficas y reportes
   - Exportar a Excel (4 hojas)
   - Exportar a PDF
3. **Productos** - Gestión de inventario
4. **Movimientos** - Historial de entradas/salidas

## 🔌 API Endpoints

### Autenticación
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Productos
```
GET    /api/productos
POST   /api/productos
PUT    /api/productos/:id
DELETE /api/productos/:id
```

### Movimientos
```
GET    /api/movimientos
POST   /api/movimientos/entrada
POST   /api/movimientos/salida
DELETE /api/movimientos/:id
```

### Reportes
```
GET /api/reportes/productos/csv
GET /api/reportes/productos/excel
GET /api/reportes/movimientos/csv
GET /api/reportes/movimientos/excel
GET /api/reportes/analytics/excel
GET /api/reportes/analytics/pdf
```

### Estadísticas
```
GET /api/stats
GET /api/analytics/metricas
GET /api/analytics/top-productos
GET /api/analytics/ganancias
GET /api/analytics/bajo-stock
GET /api/analytics/mayor-margen
```

## 🛠️ Comandos Útiles

### Gestión Docker
```bash
# Iniciar
docker-compose up -d

# Detener
docker-compose down

# Ver logs
docker logs mv-inventario-api

# Reiniciar servicio
docker-compose restart app

# Reconstruir
docker-compose up -d --build app

# MySQL
docker exec -it inventario-db mysql -u inventario_user -p
```

### Desarrollo Local
```bash
npm install
npm run dev    # Con nodemon
npm start      # Producción
```

## 🐛 Solución de Problemas

### Puerto 3000 ocupado
```bash
docker-compose down
docker-compose up -d
```

### Error de conexión a BD
```bash
# Verificar estado
docker-compose ps

# Reiniciar MySQL
docker-compose restart db

# Si persiste
docker-compose down -v
docker-compose up -d
```

### Módulos no encontrados
```bash
docker-compose up -d --build app
```

### CORS bloqueado
- Acceder desde `http://localhost:8081`
- No usar `file://`

### Cambios no se reflejan

**Frontend:**
```bash
# Limpiar caché (Ctrl + Shift + R)
docker-compose restart frontend
```

**Backend:**
```bash
docker-compose up -d --build app
```

## 📊 Datos de Prueba

La BD incluye:
- 1 usuario admin
- 5 categorías
- 10 productos
- Movimientos de ejemplo

### Cambiar Contraseña del Admin

Si necesitas cambiar la contraseña del usuario admin:

```bash
# 1. Generar nuevo hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('tu_nueva_contraseña', 10));"

# 2. Actualizar en la BD
docker exec inventario-db sh -c "mysql -u root -p<ROOT_PASSWORD> inventario_ropa -e \"UPDATE usuario SET password = 'HASH_GENERADO' WHERE correo = 'admin@mv.com';\""

# 3. Reiniciar Docker
docker-compose restart
```

**Nota:** Reemplaza `tu_nueva_contraseña` con tu contraseña deseada y `HASH_GENERADO` con el hash que te devuelve el primer comando.

## 🔒 Seguridad

- ✅ Contraseñas con bcrypt (10 rounds)
- ✅ JWT con expiración 24h
- ✅ Validación con Zod
- ✅ Prepared statements (anti SQL injection)

## 📱 Responsive

Funciona en:
- 📱 Móviles (320px+)
- 📱 Tablets (768px+)
- 💻 Laptops (1024px+)
- 🖥️ Desktop (1440px+)
- 🖥️ 4K (1920px+)

## 📝 Licencia

MIT License - Ver archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Desarrolladores

### **Fabián Enrique Pilonieta Pilonieta**
- 🔧 Desarrollo completo del backend (Node.js, Express, MySQL)
- 🏗️ Arquitectura del sistema y base de datos
- 🔌 Implementación de APIs RESTful
- 🔐 Sistema de autenticación JWT
- ✅ Lógica de negocio y validaciones
- 📦 Sistema de categorías con combobox editable
- 🐳 Integración Docker

### **Johan Sebastian Galvis Barajas**
- 🎨 Diseño de interfaz de usuario (UI/UX)
- 🖼️ Desarrollo del diseño del login
- 🎯 Creación del logo del proyecto
- 🌈 Diseño visual completo del sistema
- 🎨 Paleta de colores y estilos
- 🌙 Modo oscuro y diseño responsive

---

**Institución:** SENA (Servicio Nacional de Aprendizaje)  
**Año:** 2024

---

**¿Necesitas ayuda?** Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
