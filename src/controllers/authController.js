const userModel = require('../models/userModel');
const authService = require('../services/authService');

const authController = {
  // Muestra el formulario de registro
  showRegisterForm(req, res) {
    res.render('auth/register', { // Asumiendo que register.ejs está en views/auth/
      errors: [], // Para pasar errores de validación si los hubiera
      oldInput: {}  // Para repoblar el formulario si hay errores
    });
  },

  // Muestra el formulario de inicio de sesión
  showLoginForm(req, res) {
    res.render('auth/login', { // Asumiendo que login.ejs está en views/auth/
      errors: [],
      oldInput: {} // Para repoblar el campo de correo si hay error
    });
  },

  async register(req, res) {
    try {
      const {
        tipo_documento,
        numero_documento,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        correo_electronico,
        numero_celular,
        clave, // Contraseña en texto plano
        perfil_id,
      } = req.body;

      // Validaciones básicas (puedes expandirlas con librerías como express-validator)
      const validationErrors = [];
      if (!tipo_documento) validationErrors.push({ msg: 'El tipo de documento es requerido.' });
      if (!numero_documento) validationErrors.push({ msg: 'El número de documento es requerido.' });
      if (!primer_nombre) validationErrors.push({ msg: 'El primer nombre es requerido.' });
      if (!primer_apellido) validationErrors.push({ msg: 'El primer apellido es requerido.' });
      if (!correo_electronico) validationErrors.push({ msg: 'El correo electrónico es requerido.' });
      if (!numero_celular) validationErrors.push({ msg: 'El número de celular es requerido.' });
      if (!clave) validationErrors.push({ msg: 'La contraseña es requerida.' });
      if (!perfil_id) validationErrors.push({ msg: 'El perfil de usuario es requerido.' });

      if (validationErrors.length > 0) {
        return res.status(400).render('auth/register', {
          errors: validationErrors,
          oldInput: req.body
        });
      }

      const existingUser = await userModel.findUserByEmail(correo_electronico);
      if (existingUser) {
        return res.status(409).render('auth/register', {
          errors: [{ msg: 'El correo electrónico ya está registrado. Intenta con otro.' }],
          oldInput: req.body
        });
      }

      const clave_hash = await authService.hashPassword(clave);

      await userModel.createUser({
        tipo_documento,
        numero_documento,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        correo_electronico,
        numero_celular,
        clave_hash,
        perfil_id,
        estado: 'activo' // Aseguramos que el estado se pase
      });

      // Opcional: Usar connect-flash para mensajes de éxito tras redirección
      // req.flash('success_msg', '¡Te has registrado exitosamente! Ahora puedes iniciar sesión.');
      res.redirect('/api/auth/login');

    } catch (error) {
      console.error('Error en el registro:', error);
      res.status(500).render('auth/register', {
        errors: [{ msg: 'Error interno del servidor al intentar registrar el usuario. Por favor, inténtalo más tarde.' }],
        oldInput: req.body
      });
    }
  },

  async login(req, res) {
    try {
      const { correo_electronico, clave } = req.body;

      if (!correo_electronico || !clave) {
        return res.status(400).render('auth/login', {
          errors: [{ msg: 'Correo electrónico y contraseña son requeridos.' }],
          oldInput: req.body // Para repoblar el correo
        });
      }

      const user = await userModel.findUserByEmail(correo_electronico);
      if (!user) {
        return res.status(401).render('auth/login', {
          errors: [{ msg: 'Credenciales inválidas. Verifica tu correo y contraseña.' }],
          oldInput: req.body // Para repoblar el correo
        });
      }
      
      // >>> INICIO: Verificación crucial antes de comparar contraseñas
      // Asegurarse de que el usuario recuperado de la BD tenga una contraseña hash almacenada.
      if (!user.clave) { // user.clave es el hash de la BD según tu userModel
        console.error(`Intento de login para ${correo_electronico}: El usuario no tiene una contraseña hash almacenada en la base de datos.`);
        return res.status(401).render('auth/login', { // Usa la vista de login para mostrar el error
          errors: [{ msg: 'Credenciales inválidas o problema con la cuenta. Contacte al administrador.' }],
          oldInput: { correo_electronico } // Repoblar el correo
        });
      }
      // <<< FIN: Verificación crucial

      // Comparar la contraseña proporcionada con la almacenada
      // req.body.clave es la contraseña en texto plano, user.clave es el hash de la BD
      const isMatch = await authService.comparePassword(clave, user.clave);
      if (!isMatch) {
        return res.status(401).render('auth/login', {
          errors: [{ msg: 'Credenciales inválidas. Verifica tu correo y contraseña.' }],
          oldInput: req.body // Para repoblar el correo
        });
      }
      
      if (user.estado !== 'activo') {
        return res.status(403).render('auth/login', {
            errors: [{ msg: 'Tu cuenta no está activa. Por favor, contacta al administrador.' }],
            oldInput: req.body
        });
      }

      // Inicio de sesión exitoso
      // Establecer la sesión del usuario
      req.session.user = {
        id_usuario: user.id_usuario,
        primer_nombre: user.primer_nombre,
        correo_electronico: user.correo_electronico,
        perfil_id: user.perfil_id
        // Puedes añadir más datos del usuario que necesites en la sesión,
        // pero evita guardar información sensible o muy grande.
      };

      // Guardar la sesión explícitamente antes de redirigir puede ser una buena práctica
      // para asegurar que la sesión se escriba antes de que el navegador haga la siguiente solicitud.
      req.session.save(err => {
        if (err) {
          console.error('Error al guardar la sesión:', err);
          // Aunque la sesión no se guarde, el login fue exitoso.
          // Podrías intentar renderizar un error o simplemente proceder con la redirección
          // y esperar que la sesión se guarde automáticamente al final del ciclo req/res.
          // Para ser conservador, podrías mostrar un error genérico de login.
          return res.status(500).render('auth/login', {
            errors: [{ msg: 'Error al procesar el inicio de sesión. Inténtalo de nuevo.' }],
            oldInput: req.body
          });
        }

        // Redirigir según el perfil del usuario
        if (user.perfil_id === 1) { // Asumiendo que 1 es el perfil de administrador
          // Opcional: req.flash('success_msg', '¡Bienvenido Administrador!');
          return res.redirect('/dashboard');
        } else {
          // Para otros perfiles, redirigir a su respectivo dashboard o página principal
          // Opcional: req.flash('success_msg', '¡Has iniciado sesión exitosamente!');
          // Ejemplo: return res.redirect('/user/home');
          return res.send(`¡Bienvenido ${user.primer_nombre}! Has iniciado sesión. (Perfil: ${user.perfil_id}) <a href="/api/auth/logout">Cerrar Sesión</a>`); // Añade un enlace de logout
        }
      });

    } catch (error) {
      console.error('Error en el inicio de sesión:', error);
      res.status(500).render('auth/login', {
        errors: [{ msg: 'Error interno del servidor al intentar iniciar sesión. Por favor, inténtalo más tarde.' }],
        oldInput: req.body // Para repoblar el correo
      });
    }
  },
};

module.exports = authController;
