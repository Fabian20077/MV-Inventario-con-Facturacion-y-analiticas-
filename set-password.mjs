import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'outside1234',
    database: 'inventario_ropa'
});

// Generar hash para admin123
const password = 'admin123';
const hash = await bcrypt.hash(password, 10);

console.log('🔐 Configurando contraseña para admin@mv.com');
console.log('📝 Contraseña:', password);

// Actualizar usuario admin
await connection.execute(
    'UPDATE usuario SET password = ? WHERE correo = ?',
    [hash, 'admin@mv.com']
);

console.log('✅ Contraseña configurada correctamente');
console.log('\n📧 Usuario: admin@mv.com');
console.log('🔑 Contraseña:', password);

await connection.end();
