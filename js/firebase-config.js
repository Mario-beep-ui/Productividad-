// Configuración de Firebase
// Reemplaza estos valores con los de tu proyecto Firebase

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO_ID",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obtener instancias de los servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configuración de Firestore para usar timestamps nativos
db.settings({
    timestampsInSnapshots: true,
    merge: true
});

// Variables globales
let currentUser = null;
let currentUserData = null;

// Función para verificar si hay un usuario autenticado
function checkAuth() {
    return new Promise((resolve, reject) => {
        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUser = user;
                // Obtener datos adicionales del usuario desde Firestore
                db.collection('usuarios').doc(user.uid).get()
                    .then((doc) => {
                        if (doc.exists) {
                            currentUserData = doc.data();
                            resolve({ user, userData: doc.data() });
                        } else {
                            reject(new Error('No se encontraron datos del usuario'));
                        }
                    })
                    .catch(reject);
            } else {
                resolve(null);
            }
        });
    });
}

// Función para obtener la fecha actual en formato YYYY-MM-DD
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para obtener la hora actual en formato HH:00
function getCurrentHour() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, '0');
    return `${hour}:00`;
}

// Función para formatear timestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '--:--';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Función para generar ID de sucursal
function generateSucursalId(sucursalNumber) {
    return `sucursal_${sucursalNumber}`;
}

// Exportar funciones y variables
window.firebaseConfig = {
    auth,
    db,
    checkAuth,
    getCurrentDate,
    getCurrentHour,
    formatTimestamp,
    generateSucursalId,
    currentUser: () => currentUser,
    currentUserData: () => currentUserData
};

console.log('Firebase configurado correctamente');