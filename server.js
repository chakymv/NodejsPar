require('dotenv').config();
const app = require('./src/app');

// Es recomendable usar variables de entorno para el puerto
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log('Presiona CTRL-C para detener el servidor.');
  console.log('-----------------------------------------');
  console.log(`Endpoints de autenticación disponibles en:`);
  console.log(`  POST /api/auth/register`);
  console.log(`  POST /api/auth/login`);
});