# Dockerfile - MV Inventario Backend API
# Imagen base: Node.js Alpine (ligera y rápida)
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json
COPY package.json ./

# Instalar dependencias
RUN npm install --production

# Instalar cliente de MySQL (mariadb-client) para backups
RUN apk add --no-cache mariadb-client

# Copiar archivos de configuración y DAOs
COPY config ./config
COPY dao ./dao
COPY routes ./routes
COPY auth ./auth
COPY middleware ./middleware
COPY validators ./validators
COPY utils ./utils

# Copiar código de la aplicación
COPY server.js ./
COPY init-db-complete.sql ./db_schema.sql

# Crear directorio de logs
RUN mkdir -p /app/logs

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["node", "server.js"]
