// Requerir ./app carga las variables de entorno (.env) vía dotenv.
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.error('No se pudo iniciar el servidor: falló la conexión con MongoDB.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
