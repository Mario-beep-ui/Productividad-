// Sistema de Autenticación para Farmacia Guadalajara

// Obtener referencias a Firebase
const { auth, db, generateSucursalId } = window.firebaseConfig;

// Estado global de autenticación
let authState = {
    isAuthenticated: false,
    user: null,
    userData: null
};

// Elementos del DOM
let loginForm, notification;

// Inicializar sistema de autenticación
function initAuth() {
    loginForm = document.getElementById('loginForm');
    notification = document.getElementById('notification');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Verificar si hay una sesión activa
    checkExistingSession();
}

// Verificar sesión existente
async function checkExistingSession() {
    try {
        const result = await window.firebaseConfig.checkAuth();
        if (result) {
            authState = {
                isAuthenticated: true,
                user: result.user,
                userData: result.userData
            };
            
            // Redirigir según el rol
            redirectByRole(result.userData.rol);
        }
    } catch (error) {
        console.log('No hay sesión activa:', error.message);
    }
}

// Manejar inicio de sesión
async function handleLogin(e) {
    e.preventDefault();
    
    const sucursal = document.getElementById('sucursal').value.trim();
    const empleado = document.getElementById('empleado').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    
    if (!sucursal || !empleado || !password || !role) {
        showNotification('Por favor, completa todos los campos', 'error');
        return;
    }
    
    try {
        // Para DEMO: Credenciales predefinidas
        if (await checkDemoCredentials(sucursal, empleado, password, role)) {
            return;
        }
        
        // Para PRODUCCIÓN: Autenticación con Firebase
        await loginWithFirebase(sucursal, empleado, password, role);
        
    } catch (error) {
        console.error('Error en login:', error);
        showNotification('Error en el sistema. Intenta nuevamente.', 'error');
    }
}

// Verificar credenciales de demo
async function checkDemoCredentials(sucursal, empleado, password, role) {
    // Credenciales de demo para cajero
    if (sucursal === 'sucursal_1' && empleado === 'empleado_001' && password === 'password123' && role === 'cajero') {
        showNotification('¡Bienvenido Cajero!', 'success');
        
        // Simular usuario de demo
        authState = {
            isAuthenticated: true,
            userData: {
                rol: 'cajero',
                sucursalId: 'sucursal_1',
                empleado: 'empleado_001',
                nombre: 'Cajero Demo'
            }
        };
        
        setTimeout(() => {
            window.location.href = 'cajero.html';
        }, 1000);
        
        return true;
    }
    
    // Credenciales de demo para admin
    if (sucursal === 'admin' && empleado === 'admin' && password === 'admin123' && role === 'admin') {
        showNotification('¡Bienvenido Administrador!', 'success');
        
        // Simular usuario de demo
        authState = {
            isAuthenticated: true,
            userData: {
                rol: 'admin',
                sucursalId: 'admin',
                empleado: 'admin',
                nombre: 'Administrador Demo'
            }
        };
        
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
        
        return true;
    }
    
    return false;
}

// Autenticación con Firebase (para producción)
async function loginWithFirebase(sucursal, empleado, password, role) {
    // Generar email basado en sucursal y empleado
    const email = `${sucursal}_${empleado}@farmaciaguadalajara.com`;
    
    try {
        // Intentar autenticación
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Obtener datos del usuario desde Firestore
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        
        if (!userDoc.exists) {
            throw new Error('Usuario no registrado en el sistema');
        }
        
        const userData = userDoc.data();
        
        // Verificar que el rol coincida
        if (userData.rol !== role) {
            await auth.signOut();
            throw new Error('Rol incorrecto para este usuario');
        }
        
        // Verificar que la sucursal coincida (para cajeros)
        if (role === 'cajero' && userData.sucursalId !== generateSucursalId(sucursal)) {
            await auth.signOut();
            throw new Error('Sucursal incorrecta');
        }
        
        showNotification('¡Inicio de sesión exitoso!', 'success');
        
        authState = {
            isAuthenticated: true,
            user: user,
            userData: userData
        };
        
        // Redirigir según el rol
        setTimeout(() => {
            window.location.href = role === 'cajero' ? 'cajero.html' : 'admin.html';
        }, 1000);
        
    } catch (error) {
        console.error('Error en autenticación Firebase:', error);
        
        // Mensajes de error amigables
        let errorMessage = 'Error en la autenticación';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Usuario no encontrado';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Email inválido';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Demasiados intentos. Intenta más tarde';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
        throw error;
    }
}

// Función para login desde otras páginas
async function loginUser(sucursal, empleado, password, role) {
    return await checkDemoCredentials(sucursal, empleado, password, role);
}

// Cerrar sesión
async function logout() {
    try {
        if (auth.currentUser) {
            await auth.signOut();
        }
        
        authState = {
            isAuthenticated: false,
            user: null,
            userData: null
        };
        
        // Limpiar localStorage
        localStorage.removeItem('authState');
        
        // Redirigir al login
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
}

// Redirigir según el rol
function redirectByRole(role) {
    if (!role) return;
    
    const currentPage = window.location.pathname.split('/').pop();
    
    // Si ya está en la página correcta, no redirigir
    if ((role === 'cajero' && currentPage === 'cajero.html') ||
        (role === 'admin' && currentPage === 'admin.html')) {
        return;
    }
    
    // Redirigir a la página correspondiente
    if (role === 'cajero' && currentPage !== 'cajero.html') {
        window.location.href = 'cajero.html';
    } else if (role === 'admin' && currentPage !== 'admin.html') {
        window.location.href = 'admin.html';
    }
}

// Verificar autenticación en páginas protegidas
async function requireAuth(requiredRole = null) {
    try {
        const result = await window.firebaseConfig.checkAuth();
        
        if (!result) {
            // No autenticado, redirigir al login
            window.location.href = 'index.html';
            return false;
        }
        
        authState = {
            isAuthenticated: true,
            user: result.user,
            userData: result.userData
        };
        
        // Verificar rol si se especifica
        if (requiredRole && result.userData.rol !== requiredRole) {
            showNotification('No tienes permisos para acceder a esta página', 'error');
            setTimeout(() => {
                window.location.href = requiredRole === 'cajero' ? 'cajero.html' : 'admin.html';
            }, 2000);
            return false;
        }
        
        return true;
        
    } catch (error) {
        console.error('Error en verificación de autenticación:', error);
        window.location.href = 'index.html';
        return false;
    }
}

// Obtener datos del usuario actual
function getCurrentUser() {
    return authState.userData;
}

// Mostrar notificación
function showNotification(message, type = 'success') {
    if (!notification) {
        notification = document.getElementById('notification');
        if (!notification) return;
    }
    
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initAuth);

// Exportar funciones para uso global
window.authSystem = {
    loginUser,
    logout,
    requireAuth,
    getCurrentUser,
    showNotification,
    isAuthenticated: () => authState.isAuthenticated,
    getUserData: () => authState.userData
};