const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Rutas GET para mostrar los formularios
router.get('/register', authController.showRegisterForm);
router.get('/login', authController.showLoginForm);

// Rutas POST para procesar los formularios
router.post('/register', authController.register);
router.post('/login', authController.login);
module.exports = router;
