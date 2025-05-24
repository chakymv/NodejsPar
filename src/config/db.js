const mysql = require('mysql2/promise');

// Es buena práctica cargar las variables de entorno al inicio de tu aplicación principal (ej. server.js)
// usando require('dotenv').config(); si utilizas un archivo .env

// Es recomendable usar variables de entorno para esta configuración
// Por ejemplo, process.env.DB_HOST, process.env.DB_USER, etc.
// Ahora usaremos variables de entorno.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Ch2917892', // Considera eliminar el fallback de la contraseña en producción
  database: process.env.DB_NAME || 'parqueadeR_ssd',
  port: process.env.DB_PORT || 3306, // Añadido para el puerto
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(connection => {
    console.log('Conectado a la base de datos MySQL!');
    connection.release();
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos:', err.stack);
  });

module.exports = pool;