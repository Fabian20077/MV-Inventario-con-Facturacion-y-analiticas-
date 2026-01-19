import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 8080;

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'Frontend')));

// Ruta principal para el dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'pages', 'dashboard.html'));
});

// Rutas para páginas
app.get('/pages/:page', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'pages', req.params.page));
});

// Ruta para scripts
app.get('/scripts/:script', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'scripts', req.params.script));
});

// Ruta para estilos
app.get('/styles/:style', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'styles', req.params.style));
});

// Ruta para uploads
app.get('/uploads/:path/:file', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'uploads', req.params.path, req.params.file));
});

// Manejar rutas de API (simulación simple)
app.all('/api/*', (req, res) => {
    res.status(501).json({ 
        success: false, 
        message: 'API no disponible en modo estático. Por favor inicia el servidor completo.' 
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor frontend corriendo en http://localhost:${PORT}`);
    console.log(`📁 Sirviendo archivos desde: ${path.join(__dirname, 'Frontend')}`);
    console.log(`\n📄 Páginas disponibles:`);
    console.log(`   • http://localhost:${PORT}/pages/login.html`);
    console.log(`   • http://localhost:${PORT}/pages/dashboard.html`);
    console.log(`   • http://localhost:${PORT}/pages/productos.html`);
    console.log(`   • http://localhost:${PORT}/pages/movimientos.html`);
    console.log(`   • http://localhost:${PORT}/pages/facturacion.html`);
    console.log(`   • http://localhost:${PORT}/pages/analytics.html`);
    console.log(`\n⚠️  Nota: Esta es solo una vista previa del frontend. La API no está disponible.`);
});