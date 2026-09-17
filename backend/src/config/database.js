const mongoose = require('mongoose');

/**
 * Oculta cualquier connection string que pudiera venir dentro de un mensaje
 * de error, para no filtrar credenciales en la consola.
 */
function ocultarCredenciales(mensaje) {
  return String(mensaje).replace(/mongodb(\+srv)?:\/\/[^\s]+/g, 'mongodb://***');
}

/**
 * Establece la conexión con MongoDB usando la URI definida en el .env.
 * Si no hay URI o falla la conexión, lanza el error para que el llamador decida.
 */
async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI no está definida en el archivo .env');
    }

    await mongoose.connect(uri);
    console.log(`MongoDB conectado (base de datos: ${mongoose.connection.name})`);
  } catch (error) {
    console.error(`Error al conectar con MongoDB: ${ocultarCredenciales(error.message)}`);
    throw error;
  }
}

module.exports = connectDB;