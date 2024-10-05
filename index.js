const express = require('express');
const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Configurar dotenv para manejar variables de entorno
dotenv.config();

// Inicializar Firebase Admin SDK usando las credenciales del archivo JSON
const serviceAccount = require('./firebaseConfig.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://<tu-firebase-project-id>.firebaseio.com',
});

const db = admin.firestore();
const app = express();

// Middleware para recibir JSON en las peticiones
app.use(express.json());

// Ruta de prueba para asegurarnos de que el servidor funciona
app.get('/', (req, res) => {
  res.send('¡Backend funcionando!');
});

// Ruta para registrar usuarios con Firebase Authentication
app.post('/auth/register', async (req, res) => {
  const { email, password, nombre, fechaNacimiento, redesSociales } = req.body;

  try {
    // Crear usuario en Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });

    // Guardar información adicional en Firestore
    await db.collection('usuarios').doc(userRecord.uid).set({
      nombre,
      fechaNacimiento,
      redesSociales,
      creadoEn: admin.firestore.Timestamp.now(),
    });

    res.status(201).send({ message: 'Usuario registrado exitosamente', uid: userRecord.uid });
  } catch (error) {
    res.status(500).send({ message: 'Error registrando usuario', error });
  }
});

// Ruta para iniciar sesión y obtener el token del usuario
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Autenticar al usuario usando Firebase Authentication
    const user = await admin.auth().getUserByEmail(email);

    if (user) {
      // Generar token personalizado para el usuario autenticado
      const customToken = await admin.auth().createCustomToken(user.uid);
      res.status(200).send({ message: 'Login exitoso', token: customToken });
    } else {
      res.status(400).send({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).send({ message: 'Error en el inicio de sesión', error });
  }
});

// Middleware para verificar el token de autenticación
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).send({ message: 'Token no proporcionado' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Guardamos la información del usuario en la petición
    next(); // Continuamos con la siguiente función de middleware
  } catch (error) {
    return res.status(401).send({ message: 'Token inválido', error });
  }
};

// Ruta protegida para obtener la información del usuario
app.get('/auth/user', authenticate, async (req, res) => {
  try {
    const userDoc = await db.collection('usuarios').doc(req.user.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).send({ message: 'Usuario no encontrado' });
    }

    res.status(200).send({ uid: req.user.uid, ...userDoc.data() });
  } catch (error) {
    res.status(500).send({ message: 'Error obteniendo usuario', error });
  }
});

// Iniciar el servidor en el puerto 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});
