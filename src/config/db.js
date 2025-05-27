const mysql = require('mysql2/promise');


const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'contrasena',
  database: process.env.DB_NAME || 'parqueadeR_ssd',
  port: process.env.DB_PORT || 3306,
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
