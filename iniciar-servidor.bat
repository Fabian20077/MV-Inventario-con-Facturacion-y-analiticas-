@echo off
echo ========================================
echo   INICIANDO SERVIDOR MV-INVENTARIO
echo ========================================
echo.

echo [1/3] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado
    echo Por favor, instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js encontrado

echo.
echo [2/3] Verificando dependencias...
cd /d "%~dp0"
if not exist node_modules (
    echo 📦 Instalando dependencias...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Error al instalar dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
) else (
    echo ✅ Dependencias ya instaladas
)

echo.
echo [3/3] Iniciando servidor...
echo 🚀 Servidor iniciando en http://localhost:3000
echo 🌐 Abre en tu navegador: http://localhost:3000/pages/login.html
echo.
echo Para detener el servidor, presiona CTRL+C
echo ========================================
echo.

node server.js