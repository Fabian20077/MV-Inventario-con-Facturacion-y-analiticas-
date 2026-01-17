import mysql from 'mysql2/promise';

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'outside1234',
    database: process.env.DB_NAME || 'inventario_ropa',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

/**
 * Ejecutar una consulta SQL
 */
export async function query(sql, params = []) {
    try {
        const [rows] = await pool.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Error ejecutando consulta:', error);
        throw error;
    }
}

/**
 * Probar conexión a la base de datos
 */
export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión exitosa a MySQL');
        console.log(`   Base de datos: ${dbConfig.database}`);
        console.log(`   Host: ${dbConfig.host}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error al conectar con MySQL:', error.message);
        return false;
    }
}

export default pool;