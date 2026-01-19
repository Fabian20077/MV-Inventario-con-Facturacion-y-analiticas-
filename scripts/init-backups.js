#!/usr/bin/env node

/**
 * Script de inicialización del sistema de backups
 * Crea directorios y configura el sistema
 */

const fs = require('fs').promises;
const path = require('path');

async function initBackupSystem() {
    console.log('🔄 Inicializando Sistema de Backups MV Inventario...');
    
    try {
        // 1. Crear directorios necesarios
        const directories = [
            './backups',
            './logs',
            './temp'
        ];
        
        for (const dir of directories) {
            try {
                await fs.mkdir(dir, { recursive: true });
                console.log(`✅ Directorio creado: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.warn(`⚠️ No se pudo crear directorio ${dir}:`, error.message);
                }
            }
        }
        
        // 2. Crear archivo de configuración de backups si no existe
        const configPath = './config/backup-config.json';
        const defaultConfig = {
            enabled: true,
            maxBackups: 10,
            compression: true,
            includeFiles: true,
            includeDatabase: true,
            autoBackup: true,
            cooldownTime: 5 * 60 * 1000, // 5 minutos
            excludePatterns: [
                'node_modules',
                '.git',
                'logs',
                'temp',
                '*.tmp'
            ]
        };
        
        try {
            await fs.mkdir('./config', { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log(`✅ Configuración de backups creada: ${configPath}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                console.warn(`⚠️ No se pudo crear configuración:`, error.message);
            }
        }
        
        // 3. Crear README para backups
        const readmePath = './backups/README.md';
        const readmeContent = `# Sistema de Backups - MV Inventario

Este directorio contiene los respaldos automáticos y manuales del sistema.

## 📁 Estructura

- \`auto_backup_*\`: Backups automáticos generados por cambios en el sistema
- \`manual_backup_*\`: Backups creados manualmente por usuarios

## 🔍 Nomenclatura

\`\`\`
auto_backup_YYYY-MM-DDTHH-MM-SS-MSZ_TIPOCAMBIO
manual_backup_YYYY-MM-DDTHH-MM-SS-MSZ_MOTIVO
\`\`\`

## 📦 Contenido

Cada backup incluye:
- **metadata**: Información del backup (usuario, fecha, tipo de cambio)
- **database**: Respaldo de la base de datos
- **files**: Archivos importantes del sistema
- **config**: Configuración actual del sistema

## ⚠️ Advertencias

- No elimine manualmente archivos de backup
- El sistema mantiene automáticamente los últimos 10 backups
- Los archivos comprimidos (.gz) pueden ser restaurados

## 🔄 Automatización

El sistema crea backups automáticamente cuando:
- Se crea, actualiza o elimina un producto
- Se modifican precios
- Se realizan movimientos de inventario
- Se actualiza la configuración del sistema

---

**Generado por MV Inventario Backup Manager**
**Fecha:** ${new Date().toISOString()}
        `;
        
        await fs.writeFile(readmePath, readmeContent);
        console.log(`✅ README creado: ${readmePath}`);
        
        // 4. Verificar integración con el servidor
        const serverPath = './server.js';
        try {
            const serverContent = await fs.readFile(serverPath, 'utf8');
            
            if (serverContent.includes('backup-middleware.js') && serverContent.includes('backup-manager.js')) {
                console.log('✅ Sistema de backups integrado en server.js');
            } else {
                console.warn('⚠️ El sistema de backups podría no estar completamente integrado');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo verificar integración con server.js');
        }
        
        console.log('\n🎉 Sistema de Backups inicializado exitosamente!');
        console.log('\n📋 Próximos pasos:');
        console.log('1. Reinicia el servidor: node server.js');
        console.log('2. Verifica el estado: GET /api/backups/status');
        console.log('3. Crea un backup manual: POST /api/backups/create');
        console.log('\n📖 Documentación: ./backups/README.md');
        
    } catch (error) {
        console.error('❌ Error inicializando sistema de backups:', error);
        process.exit(1);
    }
}

// Ejecutar inicialización
if (require.main === module) {
    initBackupSystem();
}

module.exports = { initBackupSystem };