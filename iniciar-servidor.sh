#!/bin/bash

echo "========================================"
echo "   INICIANDO SERVIDOR MV-INVENTARIO"
echo "========================================"
echo

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado"
    echo "Por favor, instala Node.js desde https://nodejs.org"
    exit 1
fi
echo "✅ Node.js encontrado: $(node --version)"

echo
echo "[2/3] Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Error al instalar dependencias"
        exit 1
    fi
    echo "✅ Dependencias instaladas"
else
    echo "✅ Dependencias ya instaladas"
fi

echo
echo "[3/3] Iniciando servidor..."
echo "🚀 Servidor iniciando en http://localhost:3000"
echo "🌐 Abre en tu navegador: http://localhost:3000/pages/login.html"
echo
echo "Para detener el servidor, presiona CTRL+C"
echo "========================================"
echo

node server.js