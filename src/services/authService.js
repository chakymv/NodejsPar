const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

const saltRounds = 10; // Número de rondas de sal para bcrypt

const authService = {
  async hashPassword(password) {
    return bcrypt.hash(password, saltRounds);
  },

  async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  // Aquí podrías añadir lógica para generar tokens JWT en el futuro
};

module.exports = authService;