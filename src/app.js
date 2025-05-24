// src/app.js
// Este archivo es el punto de entrada de la aplicación Express.

const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./config/db'); // Import the database pool
const authRoutes = require('./routes/authRoutes');
const flash = require('connect-flash'); // For flash messages
const methodOverride = require('method-override'); // For PUT/DELETE from forms
const bcrypt = require('bcryptjs'); // For password hashing

const app = express();

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Configurar la carpeta de vistas
app.set('views', path.join(__dirname, '../views'));

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Opciones de conexión a la base de datos para el almacén de sesiones
const dbSessionStoreOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'parqueader_ssd', 
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
};

// Validate that DB_PASSWORD is set, as it's crucial for session store and general DB connections.
if (!dbSessionStoreOptions.password) {
  console.error(
    'FATAL ERROR: La variable de entorno DB_PASSWORD no está configurada en tu archivo .env. ' +
    'Esta variable es requerida para el almacén de sesiones de la base de datos y otras conexiones. ' +
    'Por favor, configúrala con la contraseña de tu usuario MySQL.'
  );
  process.exit(1); // Termina la aplicación si DB_PASSWORD no está configurada
}

const sessionStore = new MySQLStore(dbSessionStoreOptions);


// Validate SESSION_SECRET in production
if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'tu_secreto_muy_secreto_cambiar_en_produccion' || process.env.SESSION_SECRET === 'dev_secret_fallback_only_for_development')) {
  console.error('FATAL ERROR: SESSION_SECRET is not set or is insecure in production. Please set a strong, random secret in your environment variables.');
  process.exit(1); // Exit the application
}

// Configurar middleware de sesión
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_fallback_only_for_development', // Fallback for development only
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 día
  }
}));

// Middleware para connect-flash
app.use(flash());

// Middleware para method-override
app.use(methodOverride('_method'));

// Middleware para parsear JSON y datos de formularios URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to make flash messages and user available in all views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user || null;
  next();
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Middleware de autenticación y autorización (definidos aquí o importados)
function isAuthenticated(req, res, next) {
  if (!req.session.user) {
    req.flash('error_msg', 'Por favor, inicia sesión para ver esta página.');
    return res.redirect('/api/auth/login');
  }
  next();
}

function isAdmin(req, res, next) {
  // Assumes isAuthenticated has already run
  if (req.session.user && req.session.user.perfil_id === 1) { // Assuming 1 is admin profile_id
    return next();
  }
  req.flash('error_msg', 'No tienes permisos para acceder a esta página.');
  res.redirect('/dashboard'); // Or a more appropriate page like a non-admin dashboard or login
}

// Ruta para el Dashboard
app.get('/dashboard', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const capacidadesMaximasConfig = {
      carro: 20,
      moto: 30,
      institucional: 15
    };

    const [userRows] = await pool.query("SELECT COUNT(*) AS totalUsuarios FROM USUARIO WHERE estado = 'activo'");
    const totalUsuarios = userRows[0].totalUsuarios;

    const [celdaRows] = await pool.query("SELECT COUNT(*) AS totalCeldas FROM CELDA");
    const totalCeldas = celdaRows[0].totalCeldas;

    const [ocupadasRows] = await pool.query("SELECT COUNT(*) AS celdasOcupadas FROM CELDA WHERE estado = 'ocupada'");
    const celdasOcupadas = ocupadasRows[0].celdasOcupadas;
    const celdasLibres = totalCeldas - celdasOcupadas;
    const vehiculosDentro = celdasOcupadas;

    const today = new Date().toISOString().slice(0, 10);
    const [ingresosHoyRows] = await pool.query("SELECT COUNT(*) AS total FROM ACCESO_SALIDAS WHERE movimiento = 'acceso' AND DATE(fecha_hora) = ?", [today]);
    const vehiculosIngresadosHoy = ingresosHoyRows[0].total;

    const [salidasHoyRows] = await pool.query("SELECT COUNT(*) AS total FROM ACCESO_SALIDAS WHERE movimiento = 'salida' AND DATE(fecha_hora) = ?", [today]);
    const vehiculosSalidosHoy = salidasHoyRows[0].total;

    const [conIncidenciasRows] = await pool.query("SELECT COUNT(DISTINCT vehiculo_id) AS total FROM REPORTE_INCIDENCIA");
    const vehiculosConIncidencias = conIncidenciasRows[0].total;

    const [totalVehiculosRegistradosRows] = await pool.query("SELECT COUNT(*) AS total FROM VEHICULO");
    const totalVehiculosRegistrados = totalVehiculosRegistradosRows[0].total;
    const vehiculosSinIncidencias = totalVehiculosRegistrados - vehiculosConIncidencias;

    const [tiposVehiculoRows] = await pool.query("SELECT tipo, COUNT(*) as total FROM VEHICULO GROUP BY tipo");
    let totalCarros = 0;
    let totalMotos = 0;
    let totalInstitucionales = 0;
    tiposVehiculoRows.forEach(row => {
      if (row.tipo.toLowerCase() === 'carro') totalCarros = row.total;
      else if (row.tipo.toLowerCase() === 'moto') totalMotos = row.total;
      else if (row.tipo.toLowerCase() === 'institucional') totalInstitucionales = row.total;
    });

    const [celdasOcupadasPorTipoRows] = await pool.query(
      "SELECT tipo, COUNT(*) as ocupadas FROM CELDA WHERE estado = 'ocupada' GROUP BY tipo"
    );
    let celdasCarroOcupadas = 0;
    let celdasMotoOcupadas = 0;
    let celdasInstitucionalOcupadas = 0;
    celdasOcupadasPorTipoRows.forEach(row => {
        const tipoLower = row.tipo.toLowerCase();
        if (tipoLower === 'carro') celdasCarroOcupadas = row.ocupadas;
        else if (tipoLower === 'moto') celdasMotoOcupadas = row.ocupadas;
        else if (tipoLower === 'institucional') celdasInstitucionalOcupadas = row.ocupadas;
    });

    const celdasCarroCapacidadMax = capacidadesMaximasConfig.carro || 0;
    const celdasMotoCapacidadMax = capacidadesMaximasConfig.moto || 0;
    const celdasInstitucionalCapacidadMax = capacidadesMaximasConfig.institucional || 0;

    res.render('admin/dashboard', {
      title: 'Panel de Administrador',
      activeMenu: 'dashboard',
      stats: {
        totalUsuarios,
        totalCeldas,
        celdasOcupadas,
        celdasLibres,
        vehiculosDentro,
        vehiculosIngresadosHoy,
        vehiculosSalidosHoy,
        vehiculosConIncidencias,
        vehiculosSinIncidencias,
        totalCarros,
        totalMotos,
        totalInstitucionales,
        celdasCarroOcupadas, celdasCarroCapacidadMax,
        celdasMotoOcupadas, celdasMotoCapacidadMax,
        celdasInstitucionalOcupadas, celdasInstitucionalCapacidadMax
      }
     });
  } catch (error) {
    next(error);
  }
});

// --- RUTAS DE GESTIÓN DE USUARIOS ---
app.get('/admin/usuarios', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const [usuarios] = await pool.query(`
      SELECT 
        u.id_usuario, u.tipo_documento, u.numero_documento, u.primer_nombre, 
        u.segundo_nombre, u.primer_apellido, u.segundo_apellido, u.direccion_correo, 
        u.numero_celular, u.estado, p.perfil AS nombre_perfil,
        (SELECT COUNT(*) FROM VEHICULO v WHERE v.usuario_id = u.id_usuario) AS cantidad_vehiculos
      FROM USUARIO u
      JOIN PERFIL_USUARIO p ON u.perfil_id = p.id
      ORDER BY u.primer_apellido, u.primer_nombre
    `);
    const [perfiles] = await pool.query("SELECT id, perfil FROM PERFIL_USUARIO ORDER BY perfil");
    res.render('admin/usuarios', {
      title: 'Gestión de Usuarios',
      activeMenu: 'usuarios',
      usuarios: usuarios,
      perfiles: perfiles
    });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/usuarios', isAuthenticated, isAdmin, async (req, res, next) => {
  const {
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    tipo_documento, numero_documento, direccion_correo, numero_celular,
    clave, perfil_id,
    placa_vehiculo, marca_vehiculo, modelo_vehiculo, color_vehiculo, tipo_vehiculo
  } = req.body;

  if (!primer_nombre || !primer_apellido || !numero_documento || !direccion_correo || !clave || !perfil_id || !tipo_documento) {
    req.flash('error_msg', 'Por favor, completa todos los campos obligatorios del usuario.');
    return res.redirect('/admin/usuarios');
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const salt = await bcrypt.genSalt(10);
    const claveHasheada = await bcrypt.hash(clave, salt);

    const nuevoUsuario = {
      tipo_documento, numero_documento, primer_nombre,
      segundo_nombre: segundo_nombre || null,
      primer_apellido, segundo_apellido: segundo_apellido || null,
      direccion_correo, numero_celular, clave: claveHasheada,
      perfil_id: parseInt(perfil_id), estado: 'activo'
    };
    const [resultUsuario] = await connection.query('INSERT INTO USUARIO SET ?', nuevoUsuario);
    const nuevoUsuarioId = resultUsuario.insertId;

    if (placa_vehiculo && placa_vehiculo.trim() !== '') {
      const nuevoVehiculo = {
        placa: placa_vehiculo.toUpperCase(), marca: marca_vehiculo || null,
        modelo: modelo_vehiculo || null, color: color_vehiculo || null,
        tipo: tipo_vehiculo || null, usuario_id: nuevoUsuarioId
      };
      await connection.query('INSERT INTO VEHICULO SET ?', nuevoVehiculo);
    }
    await connection.commit();
    req.flash('success_msg', 'Usuario y vehículo (si se proporcionó) añadidos exitosamente.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error al crear usuario:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('numero_documento')) req.flash('error_msg', 'Error: El número de documento ya está registrado.');
      else if (error.sqlMessage.includes('direccion_correo')) req.flash('error_msg', 'Error: El correo electrónico ya está registrado.');
      else if (error.sqlMessage.includes('placa') && placa_vehiculo) req.flash('error_msg', 'Error: La placa del vehículo ya está registrada.');
      else req.flash('error_msg', 'Error al crear el usuario: Datos duplicados.');
    } else {
      req.flash('error_msg', 'Error al crear el usuario. Inténtalo de nuevo.');
    }
  } finally {
    if (connection) connection.release();
  }
  res.redirect('/admin/usuarios');
});

app.get('/admin/usuarios/datos-editar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [usuarios] = await pool.query('SELECT id_usuario, tipo_documento, numero_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, direccion_correo, numero_celular, estado, perfil_id FROM USUARIO WHERE id_usuario = ?', [id]);
    if (usuarios.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    const [perfiles] = await pool.query('SELECT id, perfil FROM PERFIL_USUARIO ORDER BY perfil');
    res.json({ usuario: usuarios[0], perfiles });
  } catch (error) {
    console.error("Error al obtener datos del usuario para editar:", error);
    res.status(500).json({ message: 'Error interno del servidor al obtener datos.' });
  }
});

app.put('/admin/usuarios/actualizar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  const { id } = req.params;
  // Asegúrate de que todos los campos que esperas del formulario de edición estén aquí
  const {
    primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
    tipo_documento, numero_documento, direccion_correo, numero_celular,
    clave, perfil_id, estado
  } = req.body;

  // Validación básica
  if (!primer_nombre || !primer_apellido || !numero_documento || !direccion_correo || !perfil_id || !tipo_documento || !estado) {
    req.flash('error_msg', 'Por favor, completa todos los campos obligatorios del usuario.');
    // Considera redirigir a una página de edición específica si la tienes, o pasar el ID de alguna manera
    return res.redirect('/admin/usuarios');
  }
  try {
    const camposActualizar = {
      tipo_documento,
      numero_documento,
      primer_nombre,
      segundo_nombre: segundo_nombre || null,
      primer_apellido,
      segundo_apellido: segundo_apellido || null,
      direccion_correo,
      numero_celular,
      perfil_id: parseInt(perfil_id),
      estado
    };

    // Solo actualiza la contraseña si se proporcionó una nueva
    if (clave && clave.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      camposActualizar.clave = await bcrypt.hash(clave, salt);
    }

    const [result] = await pool.query('UPDATE USUARIO SET ? WHERE id_usuario = ?', [camposActualizar, id]);

    if (result.affectedRows > 0) {
      req.flash('success_msg', 'Usuario actualizado exitosamente.');
    } else {
      req.flash('error_msg', 'No se encontró el usuario para actualizar o no hubo cambios.');
    }
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    if (error.code === 'ER_DUP_ENTRY') {
        if (error.sqlMessage.includes('numero_documento')) req.flash('error_msg', 'Error: El número de documento ya está en uso por otro usuario.');
        else if (error.sqlMessage.includes('direccion_correo')) req.flash('error_msg', 'Error: El correo electrónico ya está en uso por otro usuario.');
        else req.flash('error_msg', 'Error al actualizar el usuario: Datos duplicados.');
    } else {
        req.flash('error_msg', 'Error al actualizar el usuario. Inténtalo de nuevo.');
    }
  }
  res.redirect('/admin/usuarios');
});

app.delete('/admin/usuarios/eliminar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [vehiculos] = await connection.query('SELECT id FROM VEHICULO WHERE usuario_id = ?', [id]);
    if (vehiculos.length > 0) {
      await connection.rollback();
      req.flash('error_msg', 'No se puede eliminar el usuario porque tiene vehículos asociados. Elimine primero los vehículos.');
      return res.redirect('/admin/usuarios');
    }
    const [result] = await connection.query('DELETE FROM USUARIO WHERE id_usuario = ?', [id]);
    if (result.affectedRows > 0) {
      await connection.commit();
      req.flash('success_msg', 'Usuario eliminado exitosamente.');
    } else {
      await connection.rollback();
      req.flash('error_msg', 'No se encontró el usuario para eliminar.');
    }
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error al eliminar usuario:", error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        req.flash('error_msg', 'No se puede eliminar el usuario porque tiene registros asociados en otras tablas (ej. historial, accesos).');
    } else {
        req.flash('error_msg', 'Error al eliminar el usuario. Inténtalo de nuevo.');
    }
  } finally {
    if (connection) connection.release();
  }
  res.redirect('/admin/usuarios');
});

// --- RUTAS DE GESTIÓN DE VEHÍCULOS ---
app.get('/admin/vehiculos', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const [vehiculos] = await pool.query(`
      SELECT 
        v.id, v.placa, v.marca, v.modelo, v.color, v.tipo, 
        u.primer_nombre AS propietario_nombre, 
        u.primer_apellido AS propietario_apellido,
        u.numero_documento AS propietario_documento 
      FROM VEHICULO v
      JOIN USUARIO u ON v.usuario_id = u.id_usuario
      ORDER BY v.placa
    `);
    const [todosLosUsuarios] = await pool.query('SELECT id_usuario, primer_nombre, primer_apellido, numero_documento FROM USUARIO WHERE estado = "activo" ORDER BY primer_apellido, primer_nombre');
    res.render('admin/vehiculos', {
      title: 'Gestión de Vehículos',
      activeMenu: 'vehiculos',
      vehiculos: vehiculos,
      todosLosUsuarios: todosLosUsuarios
    });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/vehiculos', isAuthenticated, isAdmin, async (req, res, next) => {
  const { placa, marca, modelo, color, tipo, usuario_id } = req.body;
  if (!placa || !usuario_id) {
    req.flash('error_msg', 'La placa y el propietario son obligatorios.');
    return res.redirect('/admin/vehiculos');
  }
  try {
    const nuevoVehiculo = {
      placa: placa.toUpperCase(), marca: marca || null,
      modelo: modelo || null, color: color || null,
      tipo: tipo || null, usuario_id: parseInt(usuario_id)
    };
    await pool.query('INSERT INTO VEHICULO SET ?', nuevoVehiculo);
    req.flash('success_msg', 'Vehículo añadido exitosamente.');
  } catch (error) {
    console.error("Error al crear vehículo:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      req.flash('error_msg', 'Error: La placa del vehículo ya está registrada.');
    } else {
      req.flash('error_msg', 'Error al crear el vehículo. Inténtalo de nuevo.');
    }
  }
  res.redirect('/admin/vehiculos');
});

app.get('/admin/vehiculos/datos-editar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [vehiculosRows] = await pool.query('SELECT * FROM VEHICULO WHERE id = ?', [id]);
    if (vehiculosRows.length === 0) {
      return res.status(404).json({ message: 'Vehículo no encontrado.' });
    }
    const vehiculo = vehiculosRows[0];
    const [todosLosUsuarios] = await pool.query(
      'SELECT id_usuario, primer_nombre, primer_apellido, numero_documento FROM USUARIO WHERE estado = "activo" ORDER BY primer_apellido, primer_nombre'
    );
    res.json({
      vehiculo: vehiculo,
      todosLosUsuarios: todosLosUsuarios
    });
  } catch (error) {
    console.error("Error al obtener datos del vehículo para editar:", error);
    res.status(500).json({ message: 'Error interno del servidor al obtener datos del vehículo.' });
  }
});

app.put('/admin/vehiculos/actualizar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { placa, marca, modelo, color, tipo, usuario_id } = req.body;
  if (!placa || !usuario_id) {
    req.flash('error_msg', 'La placa y el propietario son obligatorios para actualizar el vehículo.');
    // Sería mejor redirigir a una página de edición específica del vehículo si la tienes
    return res.redirect('/admin/vehiculos');
  }
  try {
    // Convertir placa a mayúsculas para consistencia
    const camposActualizar = {
      placa: placa.toUpperCase(), marca: marca || null,
      modelo: modelo || null, color: color || null,
      tipo: tipo || null, usuario_id: parseInt(usuario_id)
    };
    const [result] = await pool.query('UPDATE VEHICULO SET ? WHERE id = ?', [camposActualizar, id]);
    if (result.affectedRows > 0) {
      req.flash('success_msg', 'Vehículo actualizado exitosamente.');
    } else {
      req.flash('error_msg', 'No se encontró el vehículo para actualizar o no hubo cambios.');
    }
  } catch (error) {
    console.error("Error al actualizar vehículo:", error);
    // Manejo de error si la placa ya existe para otro vehículo
    if (error.code === 'ER_DUP_ENTRY') {
        req.flash('error_msg', 'Error: La placa del vehículo ya está en uso.');
    } else {
        req.flash('error_msg', 'Error al actualizar el vehículo. Inténtalo de nuevo.');
    }
  }
  res.redirect('/admin/vehiculos');
});

app.delete('/admin/vehiculos/eliminar/:id', isAuthenticated, isAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM VEHICULO WHERE id = ?', [id]);
    if (result.affectedRows > 0) {
      req.flash('success_msg', 'Vehículo eliminado exitosamente.');
    } else {
      req.flash('error_msg', 'No se encontró el vehículo para eliminar.');
    }
  } catch (error) {
    console.error("Error al eliminar vehículo:", error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      req.flash('error_msg', 'No se puede eliminar el vehículo porque tiene registros asociados (ej. historial de acceso, incidencias).');
    } else {
      req.flash('error_msg', 'Error al eliminar el vehículo. Inténtalo de nuevo.');
    }
  }
  res.redirect('/admin/vehiculos');
});

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const error = new Error('Página No Encontrada');
  error.status = 404;
  next(error);
});

// Global error handler
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  console.error("Error global:", err.stack);
  if (!res.locals.error_msg && err.status !== 404) {
      req.flash('error_msg', err.message || 'Ocurrió un error inesperado.');
  }
  res.status(err.status || 500);
  res.render('error'); // You need an error.ejs view
});

module.exports = app;
