# 📋 Estructura Completa del Proyecto: Inventario MV

## 📁 Árbol de Directorios

```
inventario-ropa/
├── Backend/
│   ├── server.js                 # Servidor principal (Node.js + HTTP nativo)
│   ├── database.js               # Conexión y consultas MySQL
│   ├── package.json              # Dependencias del proyecto
│   ├── .env                      # Variables de entorno (no commitear)
│   └── config/
│       └── db-config.js          # Configuración de base de datos
│
├── Frontend/
│   ├── dashboard.html            # Interfaz principal
│   ├── app.js                    # Lógica de la aplicación (AJAX)
│   ├── styles.css                # Estilos personalizados (opcional)
│   ├── logo.jpg                  # Logotipo
│   └── assets/
│       ├── images/               # Imágenes adicionales
│       └── fonts/                # Fuentes personalizadas
│
├── Database/
│   └── schema.sql                # Script de creación de tablas
│
├── Docker/
│   ├── Dockerfile                # Configuración del contenedor
│   ├── docker-compose.yml        # Orquestación de servicios
│   └── .dockerignore             # Archivos a ignorar en imagen
│
├── .gitignore                    # Archivos ignorados por Git
├── README.md                     # Documentación principal
└── ESTRUCTURA_PROYECTO.md        # Este archivo
```

---

## 🛠️ Stack Tecnológico Completo

### **Backend**
- **Node.js v18+** - Runtime JavaScript del lado del servidor
- **HTTP (módulo nativo)** - Servidor web sin frameworks externos
- **MySQL 8.0+** - Base de datos relacional
- **BCrypt 5.1.1+** - Encriptación de contraseñas
- **CORS** - Control de acceso entre dominios

### **Frontend**
- **HTML5** - Estructura semántica
- **Tailwind CSS (CDN)** - Framework CSS utility-first
- **Bootstrap Icons 1.11.1+** - Librería de iconos
- **Vanilla JavaScript (ES6+)** - Sin frameworks (React, Vue, Angular)
- **Google Fonts** - Tipografía (Inter, Poppins)

### **Base de Datos**
- **MySQL 8.0+** - RDBMS
- **phpMyAdmin (opcional)** - Gestión de BD

### **Contenedorización**
- **Docker** - Containerización de aplicación
- **Docker Compose** - Orquestación multi-contenedor

### **Herramientas de Desarrollo**
- **Visual Studio Code** - IDE principal
- **Git/GitHub** - Control de versiones
- **npm/yarn** - Gestor de dependencias
- **Nodemon** - Recarga automática en desarrollo
- **Postman** - Pruebas de API

---

## 📦 Dependencias del Proyecto

### package.json

```json
{
  "name": "inventario-ropa",
  "version": "1.0.0",
  "description": "Sistema de inventario para tienda de ropa MV",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": ["inventario", "ropa", "nodejs", "mysql"],
  "author": "Tu Nombre",
  "license": "MIT",
  "dependencies": {
    "mysql2": "^3.6.0",
    "bcrypt": "^5.1.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Instalación de dependencias
```bash
cd Backend
npm install
```

---

## 🐳 Configuración Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: inventario_mysql
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: inventario_db
      MYSQL_USER: inventario_user
      MYSQL_PASSWORD: user_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./Database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    networks:
      - inventario_network

  backend:
    build: ./Backend
    container_name: inventario_backend
    environment:
      DB_HOST: mysql
      DB_USER: inventario_user
      DB_PASSWORD: user_password
      DB_NAME: inventario_db
      DB_PORT: 3306
    ports:
      - "3000:3000"
    depends_on:
      - mysql
    volumes:
      - ./Backend:/app
    networks:
      - inventario_network

  frontend:
    image: nginx:alpine
    container_name: inventario_frontend
    volumes:
      - ./Frontend:/usr/share/nginx/html
    ports:
      - "80:80"
    networks:
      - inventario_network

volumes:
  mysql_data:

networks:
  inventario_network:
    driver: bridge
```

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
README.md
.vscode
```

---

## 🚀 Comandos Docker

```bash
# Construir y levantar todos los servicios
docker-compose up -d

# Ver logs del backend
docker-compose logs -f backend

# Detener servicios
docker-compose down

# Reconstruir imágenes
docker-compose up -d --build

# Ejecutar comando en contenedor
docker-compose exec backend npm install
```

---

## 🔌 API REST Endpoints

### Autenticación
```
POST   /api/auth/login              # Iniciar sesión
POST   /api/auth/register           # Registrar usuario
```

### Productos
```
GET    /api/productos               # Listar todos
POST   /api/productos               # Crear nuevo
PUT    /api/productos/:id           # Actualizar
DELETE /api/productos/:id           # Eliminar (soft delete)
```

### Categorías
```
GET    /api/categorias              # Listar categorías
```

### Movimientos
```
GET    /api/movimientos             # Listar movimientos
POST   /api/movimientos/entrada     # Registrar entrada
POST   /api/movimientos/salida      # Registrar salida
DELETE /api/movimientos/:id         # Eliminar movimiento
```

### Estadísticas
```
GET    /api/stats                   # Obtener estadísticas
```

### Reportes
```
GET    /api/reportes/productos/csv       # Exportar CSV
GET    /api/reportes/productos/excel     # Exportar Excel
GET    /api/reportes/movimientos/csv     # Exportar CSV
GET    /api/reportes/movimientos/excel   # Exportar Excel
```

### Health Check
```
GET    /api/health                  # Verificar estado
```

---

## 🗄️ Estructura de Base de Datos (MySQL)

### Tablas principales
- **users** - Usuarios del sistema
- **productos** - Catálogo de productos
- **categorias** - Categorías de ropa
- **movimientos** - Entradas y salidas
- **movimientos_detalles** - Detalles de movimientos

---

## 🔑 Variables de Entorno (.env)

```env
# Backend
PORT=3000
NODE_ENV=development

# MySQL
DB_HOST=localhost
DB_USER=inventario_user
DB_PASSWORD=user_password
DB_NAME=inventario_db
DB_PORT=3306

# Frontend
REACT_APP_API_URL=http://localhost:3000
```

---

## 📝 Flujo de Datos

```
Frontend (HTML/JS)
    ↓ AJAX Request
Backend (Node.js HTTP Server)
    ↓ Procesa solicitud
MySQL Database
    ↓ Consulta/Actualiza datos
Backend (Respuesta JSON)
    ↓ JSON Response
Frontend (Actualiza DOM)
```

---

## 🔒 Seguridad Implementada

- ✅ Autenticación con BCrypt
- ✅ Headers CORS configurados
- ✅ Validación de tokens
- ✅ Soft delete (no elimina físicamente)
- ✅ Variables de entorno protegidas

---

## 📈 Cómo Iniciar el Proyecto

### Opción 1: Sin Docker
```bash
# 1. Backend
cd Backend
npm install
npm start

# 2. Frontend (En otra terminal)
cd Frontend
# Abrir dashboard.html en el navegador
```

### Opción 2: Con Docker
```bash
docker-compose up -d
# Backend: http://localhost:3000
# Frontend: http://localhost
# MySQL: localhost:3306
```

---

## 📚 Documentación Adicional

- Node.js: https://nodejs.org
- MySQL: https://dev.mysql.com
- Docker: https://www.docker.com
- Tailwind CSS: https://tailwindcss.com
- BCrypt: https://www.npmjs.com/package/bcrypt

---

**Última actualización:** 17 de noviembre de 2025