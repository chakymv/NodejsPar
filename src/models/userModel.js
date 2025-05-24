const pool = require('../config/db');

const userModel = {
  async createUser(userData) {
    const {
      tipo_documento,
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      correo_electronico,
      numero_celular,
      clave_hash, // La contraseña ya debe venir hasheada
      perfil_id,
      estado = 'activo', // Valor por defecto
    } = userData;

    const sql = `
      INSERT INTO USUARIO 
        (tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, direccion_correo, numero_celular, clave, perfil_id, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    // Los valores pasados a pool.execute deben coincidir con el orden de los placeholders.
    // userData.correo_electronico se insertará en la columna direccion_correo.
    // userData.clave_hash se insertará en la columna clave.
    const [result] = await pool.execute(sql, [
      tipo_documento, 
      numero_documento, 
      primer_nombre, 
      segundo_nombre, 
      primer_apellido, 
      segundo_apellido, 
      correo_electronico, // Este es el valor para la columna direccion_correo
      numero_celular, 
      clave_hash, // Este es el valor para la columna clave
      perfil_id, 
      estado
    ]);
    return result.insertId;
  },

  async findUserByEmail(emailParam) { // Cambiado el nombre del parámetro para claridad
    // Selecciona las columnas con los nombres definidos en tu esquema SQL (USUARIO)
    // y filtra por la columna direccion_correo.
    const sql = 'SELECT id_usuario, direccion_correo, clave, perfil_id, estado, primer_nombre FROM USUARIO WHERE direccion_correo = ?';
    try {
      const [rows] = await pool.execute(sql, [emailParam]);
      return rows[0]; // Retorna el primer usuario encontrado o undefined
    } catch (error) {
      console.error('Error al buscar usuario por email:', error);
      throw error; // Lanza el error para que pueda ser manejado en el controlador
    }
  },
  // Puedes añadir más funciones según necesites (ej: findUserById, updateUser, etc.)
};

module.exports = userModel;
