
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

console.log('🔍 Iniciando diagnóstico de Puppeteer...');
console.log(`📂 Directorio actual: ${process.cwd()}`);

async function run() {
    try {
        console.log('📦 Verificando módulo puppeteer...');
        console.log(`   Versión: ${JSON.stringify(puppeteer.version || 'desconocida')}`);

        console.log('🚀 Intentando lanzar navegador...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox']
        });

        console.log('✅ Navegador lanzado correctamente.');
        const version = await browser.version();
        console.log(`   Browser Version: ${version}`);

        await browser.close();
        console.log('✅ Diagnóstico finalizado con ÉXITO.');
        process.exit(0);

    } catch (error) {
        console.error('❌ FALLÓ EL DIAGNÓSTICO:');
        console.error(error);

        if (error.message.includes('Could not find Chrome')) {
            console.error('\nSUGERENCIA: Puppeteer no encontró Chromium. Intenta correr: npm install puppeteer');
        }
        process.exit(1);
    }
}

run();
