# Usar imagen base Debian (bookworm) para facilitar dependencias de Puppeteer
FROM node:18-bookworm-slim

# Instalar dependencias necesarias para Chromium/Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Instalar dependencias de Node
RUN npm ci --only=production && npm cache clean --force

COPY . .

# Crear directorio de logs
RUN mkdir -p /app/logs && chmod 777 /app/logs

EXPOSE 3000

# Script para arrancar la app
CMD ["node", "--max-old-space-size=2048", "server.js"]