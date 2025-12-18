// Sistema para Cajeros - Farmacia Guadalajara

// Obtener referencias a Firebase
const { db, getCurrentDate, getCurrentHour, formatTimestamp } = window.firebaseConfig;

// Estado de la aplicación
const appState = {
    sucursalId: null,
    empleadoId: null,
    currentMode: 'medicina',
    selectedHours: [],
    lastClientTime: null,
    isOnline: true,
    pendingUpdates: []
};

// Referencias a elementos del DOM
let elements = {};

// Inicializar aplicación
async function initCajeroApp() {
    // Verificar autenticación
    const isAuthenticated = await window.authSystem.requireAuth('cajero');
    if (!isAuthenticated) return;
    
    // Obtener datos del usuario
    const userData = window.authSystem.getUserData();
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    // Configurar estado
    appState.sucursalId = userData.sucursalId;
    appState.empleadoId = userData.empleado;
    
    // Inicializar elementos del DOM
    initElements();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Configurar tema
    setupTheme();
    
    // Cargar datos iniciales
    loadInitialData();
    
    // Iniciar actualizaciones en tiempo real
    startRealTimeUpdates();
    
    // Iniciar reloj
    startClock();
    
    console.log('Aplicación de cajero inicializada para:', userData);
}

// Inicializar referencias a elementos del DOM
function initElements() {
    elements = {
        // Información del usuario
        userInfo: document.getElementById('userInfo'),
        currentSucursal: document.getElementById('currentSucursal'),
        
        // Estadísticas
        totalClients: document.getElementById('totalClients'),
        currentHourClients: document.getElementById('currentHourClients'),
        myClients: document.getElementById('myClients'),
        
        // Botones de caja
        caja1Btn: document.getElementById('caja1Btn'),
        caja2Btn: document.getElementById('caja2Btn'),
        caja3Btn: document.getElementById('caja3Btn'),
        caja4Btn: document.getElementById('caja4Btn'),
        caja5Btn: document.getElementById('caja5Btn'),
        caja6Btn: document.getElementById('caja6Btn'),
        
        // Contadores de caja
        caja1Counter: document.getElementById('caja1Counter'),
        caja2Counter: document.getElementById('caja2Counter'),
        caja3Counter: document.getElementById('caja3Counter'),
        caja4Counter: document.getElementById('caja4Counter'),
        caja5Counter: document.getElementById('caja5Counter'),
        caja6Counter: document.getElementById('caja6Counter'),
        
        // Modos
        medicineModeBtn: document.getElementById('medicineModeBtn'),
        selfServiceModeBtn: document.getElementById('selfServiceModeBtn'),
        medicineCajas: document.getElementById('medicineCajas'),
        selfServiceCajas: document.getElementById('selfServiceCajas'),
        
        // Horas
        hourTags: document.getElementById('hourTags'),
        currentTime: document.getElementById('currentTime'),
        lastClientTime: document.getElementById('lastClientTime'),
        
        // Tabla
        productivityTable: document.getElementById('productivityTable'),
        
        // Botones de acción
        syncStatus: document.getElementById('syncStatus'),
        helpBtn: document.getElementById('helpBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        themeToggle: document.getElementById('themeToggle'),
        
        // Modales
        helpModal: document.getElementById('helpModal'),
        closeHelpModal: document.getElementById('closeHelpModal'),
        
        // Notificaciones
        notification: document.getElementById('notification')
    };
    
    // Actualizar información del usuario
    if (elements.userInfo) {
        const userData = window.authSystem.getUserData();
        elements.userInfo.textContent = `${userData.nombre || userData.empleado} • ${appState.sucursalId}`;
    }
    
    if (elements.currentSucursal) {
        elements.currentSucursal.textContent = appState.sucursalId;
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Botones de caja
    elements.caja1Btn.addEventListener('click', () => registerClient('caja1'));
    elements.caja2Btn.addEventListener('click', () => registerClient('caja2'));
    elements.caja3Btn.addEventListener('click', () => registerClient('caja3'));
    elements.caja4Btn.addEventListener('click', () => registerClient('caja4'));
    elements.caja5Btn.addEventListener('click', () => registerClient('caja5'));
    elements.caja6Btn.addEventListener('click', () => registerClient('caja6'));
    
    // Cambio de modo
    elements.medicineModeBtn.addEventListener('click', () => setMode('medicina'));
    elements.selfServiceModeBtn.addEventListener('click', () => setMode('autoservicio'));
    
    // Botones de acción
    elements.helpBtn.addEventListener('click', showHelpModal);
    elements.closeHelpModal.addEventListener('click', hideHelpModal);
    elements.logoutBtn.addEventListener('click', window.authSystem.logout);
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Cerrar modal al hacer click fuera
    elements.helpModal.addEventListener('click', (e) => {
        if (e.target === elements.helpModal) {
            hideHelpModal();
        }
    });
    
    // Tecla Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.helpModal.classList.contains('active')) {
            hideHelpModal();
        }
    });
}

// Configurar tema
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const isDarkTheme = savedTheme === 'dark';
    
    if (!isDarkTheme) {
        document.body.classList.add('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    elements.themeToggle.addEventListener('click', toggleTheme);
}

// Cambiar tema
function toggleTheme() {
    const isDarkTheme = !document.body.classList.contains('light-theme');
    
    if (isDarkTheme) {
        document.body.classList.add('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'dark');
    }
}

// Cargar datos iniciales
async function loadInitialData() {
    try {
        // Obtener horas activas del día
        await loadActiveHours();
        
        // Cargar estadísticas del día
        await loadDailyStats();
        
        // Cargar productividad personal
        await loadMyProductivity();
        
        // Actualizar interfaz
        updateUI();
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        showNotification('Error al cargar datos iniciales', 'error');
    }
}

// Cargar horas activas
async function loadActiveHours() {
    const currentHour = getCurrentHour();
    const hours = [];
    
    // Generar horas del turno (últimas 8 horas)
    const currentHourNum = parseInt(currentHour.split(':')[0]);
    for (let i = 7; i >= 0; i--) {
        const hour = (currentHourNum - i + 24) % 24;
        const hourStr = `${String(hour).padStart(2, '0')}:00`;
        hours.push(hourStr);
    }
    
    appState.selectedHours = hours;
    renderHourTags();
}

// Renderizar etiquetas de horas
function renderHourTags() {
    if (!elements.hourTags) return;
    
    const currentHour = getCurrentHour();
    elements.hourTags.innerHTML = '';
    
    appState.selectedHours.forEach(hour => {
        const isActive = hour === currentHour;
        const tag = document.createElement('div');
        tag.className = `hour-tag ${isActive ? 'active' : ''}`;
        tag.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>${hour}</span>
            ${isActive ? '<span class="live-indicator"></span>' : ''}
        `;
        elements.hourTags.appendChild(tag);
    });
}

// Cargar estadísticas del día
async function loadDailyStats() {
    const today = getCurrentDate();
    const currentHour = getCurrentHour();
    
    try {
        // Obtener referencia al documento del día
        const sucursalRef = db.collection('sucursales').doc(appState.sucursalId);
        const diaRef = sucursalRef.collection('dias').doc(today);
        
        const doc = await diaRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            
            // Calcular totales
            let total = 0;
            let currentHourTotal = 0;
            let myTotal = 0;
            
            // Recorrer todas las horas
            Object.keys(data).forEach(hour => {
                if (data[hour]) {
                    const hourData = data[hour];
                    
                    // Sumar todos los clientes de esta hora
                    Object.keys(hourData).forEach(caja => {
                        if (hourData[caja]) {
                            total += hourData[caja].total || 0;
                            
                            // Sumar clientes de la hora actual
                            if (hour === currentHour) {
                                currentHourTotal += hourData[caja].total || 0;
                            }
                            
                            // Sumar clientes atendidos por este empleado
                            if (hourData[caja].empleados && hourData[caja].empleados[appState.empleadoId]) {
                                myTotal += hourData[caja].empleados[appState.empleadoId] || 0;
                            }
                        }
                    });
                }
            });
            
            // Actualizar UI
            elements.totalClients.textContent = total;
            elements.currentHourClients.textContent = currentHourTotal;
            elements.myClients.textContent = myTotal;
            
            // Actualizar contadores de caja
            updateCajaCounters(data[currentHour] || {});
            
        } else {
            // No hay datos para hoy
            resetCounters();
        }
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        resetCounters();
    }
}

// Actualizar contadores de caja
function updateCajaCounters(hourData) {
    const cajas = ['caja1', 'caja2', 'caja3', 'caja4', 'caja5', 'caja6'];
    
    cajas.forEach(caja => {
        const counterElement = elements[`${caja}Counter`];
        if (counterElement && hourData[caja]) {
            counterElement.textContent = hourData[caja].total || 0;
        } else if (counterElement) {
            counterElement.textContent = '0';
        }
    });
}

// Resetear contadores
function resetCounters() {
    elements.totalClients.textContent = '0';
    elements.currentHourClients.textContent = '0';
    elements.myClients.textContent = '0';
    
    const cajas = ['caja1', 'caja2', 'caja3', 'caja4', 'caja5', 'caja6'];
    cajas.forEach(caja => {
        const counterElement = elements[`${caja}Counter`];
        if (counterElement) {
            counterElement.textContent = '0';
        }
    });
}

// Cargar productividad personal
async function loadMyProductivity() {
    const today = getCurrentDate();
    
    try {
        const sucursalRef = db.collection('sucursales').doc(appState.sucursalId);
        const diaRef = sucursalRef.collection('dias').doc(today);
        
        const doc = await diaRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            renderProductivityTable(data);
        } else {
            renderEmptyProductivityTable();
        }
        
    } catch (error) {
        console.error('Error cargando productividad:', error);
        renderEmptyProductivityTable();
    }
}

// Renderizar tabla de productividad
function renderProductivityTable(data) {
    if (!elements.productivityTable) return;
    
    let html = '';
    const cajas = ['caja1', 'caja2', 'caja3', 'caja4', 'caja5', 'caja6'];
    
    // Ordenar horas de más reciente a más antigua
    const hours = Object.keys(data).sort((a, b) => b.localeCompare(a));
    
    hours.forEach(hour => {
        const hourData = data[hour];
        let rowTotal = 0;
        const cajaCounts = {};
        
        // Inicializar contadores
        cajas.forEach(caja => {
            cajaCounts[caja] = 0;
        });
        
        // Sumar conteos por caja
        Object.keys(hourData).forEach(caja => {
            if (hourData[caja]) {
                const cajaData = hourData[caja];
                cajaCounts[caja] = cajaData.total || 0;
                
                // Sumar clientes atendidos por este empleado
                if (cajaData.empleados && cajaData.empleados[appState.empleadoId]) {
                    cajaCounts[caja] = cajaData.empleados[appState.empleadoId];
                }
                
                rowTotal += cajaCounts[caja];
            }
        });
        
        if (rowTotal > 0) {
            html += `
                <tr>
                    <td class="hour-cell">${hour}</td>
                    <td class="count-cell caja1-cell">${cajaCounts.caja1}</td>
                    <td class="count-cell caja2-cell">${cajaCounts.caja2}</td>
                    <td class="count-cell caja3-cell">${cajaCounts.caja3}</td>
                    <td class="count-cell caja4-cell">${cajaCounts.caja4}</td>
                    <td class="count-cell caja5-cell">${cajaCounts.caja5}</td>
                    <td class="count-cell caja6-cell">${cajaCounts.caja6}</td>
                    <td class="count-cell total-cell">${rowTotal}</td>
                </tr>
            `;
        }
    });
    
    if (html === '') {
        renderEmptyProductivityTable();
    } else {
        elements.productivityTable.innerHTML = html;
    }
}

// Renderizar tabla de productividad vacía
function renderEmptyProductivityTable() {
    if (!elements.productivityTable) return;
    
    elements.productivityTable.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 30px;">
                <i class="fas fa-clipboard-list" style="font-size: 2rem; margin-bottom: 10px; color: var(--text-secondary);"></i>
                <p>Registra clientes para ver tu productividad</p>
            </td>
        </tr>
    `;
}

// Establecer modo (Medicina/Autoservicio)
function setMode(mode) {
    if (appState.currentMode === mode) return;
    
    appState.currentMode = mode;
    
    // Actualizar botones activos
    elements.medicineModeBtn.classList.toggle('active', mode === 'medicina');
    elements.selfServiceModeBtn.classList.toggle('active', mode === 'autoservicio');
    
    // Mostrar/ocultar cajas correspondientes
    elements.medicineCajas.style.display = mode === 'medicina' ? 'grid' : 'none';
    elements.selfServiceCajas.style.display = mode === 'autoservicio' ? 'grid' : 'none';
    
    // Animación de transición
    document.getElementById('appContainer').classList.add('fade-in');
    setTimeout(() => {
        document.getElementById('appContainer').classList.remove('fade-in');
    }, 500);
}

// Registrar cliente
async function registerClient(cajaId) {
    const currentHour = getCurrentHour();
    const timestamp = new Date();
    
    // Verificar que la hora actual esté seleccionada
    if (!appState.selectedHours.includes(currentHour)) {
        showNotification('No se pueden registrar clientes en esta hora', 'error');
        return;
    }
    
    // Determinar área basada en la caja
    const area = getAreaFromCaja(cajaId);
    
    // Actualizar UI inmediatamente
    updateLocalUI(cajaId);
    
    try {
        // Registrar en Firestore
        await registerClientInFirestore(cajaId, area, currentHour, timestamp);
        
        // Actualizar última hora de cliente
        appState.lastClientTime = timestamp;
        updateLastClientTime();
        
        // Mostrar confirmación
        showNotification(`Cliente registrado en ${cajaId.toUpperCase()}`, 'success');
        
        // Actualizar estadísticas
        await loadDailyStats();
        await loadMyProductivity();
        
    } catch (error) {
        console.error('Error registrando cliente:', error);
        showNotification('Error al registrar cliente', 'error');
        
        // Revertir cambios en UI
        revertLocalUI(cajaId);
    }
}

// Obtener área basada en ID de caja
function getAreaFromCaja(cajaId) {
    switch(cajaId) {
        case 'caja1':
        case 'caja2':
        case 'caja3':
            return 'medicina';
        case 'caja4':
        case 'caja5':
        case 'caja6':
            return 'autoservicio';
        default:
            return 'medicina';
    }
}

// Actualizar UI localmente
function updateLocalUI(cajaId) {
    // Animación en el botón
    const button = elements[`${cajaId}Btn`];
    button.classList.add('pulse');
    
    // Incrementar contador local
    const counter = elements[`${cajaId}Counter`];
    const currentCount = parseInt(counter.textContent) || 0;
    counter.textContent = currentCount + 1;
    
    // Incrementar contadores totales
    elements.totalClients.textContent = parseInt(elements.totalClients.textContent) + 1;
    elements.currentHourClients.textContent = parseInt(elements.currentHourClients.textContent) + 1;
    elements.myClients.textContent = parseInt(elements.myClients.textContent) + 1;
    
    // Remover animación después de un tiempo
    setTimeout(() => {
        button.classList.remove('pulse');
    }, 400);
}

// Revertir cambios en UI
function revertLocalUI(cajaId) {
    const counter = elements[`${cajaId}Counter`];
    const currentCount = parseInt(counter.textContent) || 0;
    if (currentCount > 0) {
        counter.textContent = currentCount - 1;
    }
    
    // Decrementar contadores totales
    elements.totalClients.textContent = Math.max(0, parseInt(elements.totalClients.textContent) - 1);
    elements.currentHourClients.textContent = Math.max(0, parseInt(elements.currentHourClients.textContent) - 1);
    elements.myClients.textContent = Math.max(0, parseInt(elements.myClients.textContent) - 1);
}

// Registrar cliente en Firestore
async function registerClientInFirestore(cajaId, area, hour, timestamp) {
    const today = getCurrentDate();
    
    // Referencias a Firestore
    const sucursalRef = db.collection('sucursales').doc(appState.sucursalId);
    const diaRef = sucursalRef.collection('dias').doc(today);
    const horaRef = diaRef.collection('horas').doc(hour);
    
    // Transacción para asegurar consistencia
    await db.runTransaction(async (transaction) => {
        // Obtener documento del día
        const diaDoc = await transaction.get(diaRef);
        
        // Preparar datos para actualizar
        const updateData = {};
        const path = `${hour}.${cajaId}`;
        
        if (diaDoc.exists) {
            const data = diaDoc.data();
            const currentCount = data[hour]?.[cajaId]?.total || 0;
            const currentEmpleados = data[hour]?.[cajaId]?.empleados || {};
            const empleadoCount = currentEmpleados[appState.empleadoId] || 0;
            
            updateData[`${path}.total`] = currentCount + 1;
            updateData[`${path}.empleados.${appState.empleadoId}`] = empleadoCount + 1;
            updateData[`${path}.ultimaActualizacion`] = timestamp;
            updateData[`${path}.area`] = area;
        } else {
            updateData[`${path}.total`] = 1;
            updateData[`${path}.empleados.${appState.empleadoId}`] = 1;
            updateData[`${path}.ultimaActualizacion`] = timestamp;
            updateData[`${path}.area`] = area;
        }
        
        // Actualizar documento del día
        transaction.set(diaRef, updateData, { merge: true });
        
        // También actualizar documento de hora para consultas más rápidas
        const horaData = {
            sucursalId: appState.sucursalId,
            cajaId: cajaId,
            area: area,
            empleadoId: appState.empleadoId,
            timestamp: timestamp,
            tipo: 'registro'
        };
        
        transaction.set(horaRef.collection('registros').doc(), horaData);
    });
    
    // Actualizar timestamp de última actualización de la sucursal
    await sucursalRef.update({
        ultimaActualizacion: timestamp,
        ultimaCaja: cajaId,
        ultimoEmpleado: appState.empleadoId
    });
}

// Actualizar hora del último cliente
function updateLastClientTime() {
    if (!elements.lastClientTime || !appState.lastClientTime) return;
    
    const timeStr = formatTimestamp(appState.lastClientTime);
    elements.lastClientTime.textContent = timeStr;
}

// Iniciar actualizaciones en tiempo real
function startRealTimeUpdates() {
    const today = getCurrentDate();
    const currentHour = getCurrentHour();
    
    // Escuchar cambios en el documento del día
    const sucursalRef = db.collection('sucursales').doc(appState.sucursalId);
    const diaRef = sucursalRef.collection('dias').doc(today);
    
    diaRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            
            // Actualizar contadores de la hora actual
            if (data[currentHour]) {
                updateCajaCounters(data[currentHour]);
                
                // Calcular totales
                let total = 0;
                let currentHourTotal = 0;
                
                Object.keys(data[currentHour]).forEach(caja => {
                    if (data[currentHour][caja]) {
                        currentHourTotal += data[currentHour][caja].total || 0;
                    }
                });
                
                // Actualizar total general
                Object.keys(data).forEach(hour => {
                    if (data[hour]) {
                        Object.keys(data[hour]).forEach(caja => {
                            if (data[hour][caja]) {
                                total += data[hour][caja].total || 0;
                            }
                        });
                    }
                });
                
                elements.totalClients.textContent = total;
                elements.currentHourClients.textContent = currentHourTotal;
            }
            
            // Actualizar tabla de productividad
            renderProductivityTable(data);
        }
    }, (error) => {
        console.error('Error en listener de tiempo real:', error);
        elements.syncStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Error de conexión</span>';
        elements.syncStatus.classList.add('error');
    });
    
    // Actualizar estado de sincronización
    elements.syncStatus.innerHTML = '<i class="fas fa-sync"></i><span>Sincronizado</span>';
    elements.syncStatus.classList.remove('error');
}

// Iniciar reloj
function startClock() {
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        if (elements.currentTime) {
            elements.currentTime.textContent = `${hours}:${minutes}:${seconds}`;
        }
        
        // Actualizar hora actual cada minuto
        const currentHour = getCurrentHour();
        if (!appState.selectedHours.includes(currentHour)) {
            appState.selectedHours.push(currentHour);
            renderHourTags();
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

// Mostrar modal de ayuda
function showHelpModal() {
    elements.helpModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Ocultar modal de ayuda
function hideHelpModal() {
    elements.helpModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Actualizar UI
function updateUI() {
    // Actualizar tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Actualizar última hora de cliente
    updateLastClientTime();
}

// Mostrar notificación
function showNotification(message, type = 'success') {
    if (!elements.notification) return;
    
    elements.notification.textContent = message;
    elements.notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 3000);
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initCajeroApp);