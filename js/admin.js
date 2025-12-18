// Sistema de Administración - Farmacia Guadalajara

// Obtener referencias a Firebase
const { db, getCurrentDate, formatTimestamp } = window.firebaseConfig;

// Estado de la aplicación
const appState = {
    sucursales: [],
    selectedSucursal: null,
    currentArea: 'medicina',
    chartInstances: {},
    realTimeListeners: [],
    lastUpdate: null,
    autoRefreshInterval: null,
    alertas: []
};

// Referencias a elementos del DOM
let elements = {};

// Inicializar aplicación
async function initAdminApp() {
    // Verificar autenticación
    const isAuthenticated = await window.authSystem.requireAuth('admin');
    if (!isAuthenticated) return;
    
    // Obtener datos del usuario
    const userData = window.authSystem.getUserData();
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    
    // Inicializar elementos del DOM
    initElements();
    
    // Configurar event listeners
    setupEventListeners();
    
    // Configurar tema
    setupTheme();
    
    // Cargar datos iniciales
    await loadInitialData();
    
    // Inicializar gráficas
    initCharts();
    
    // Iniciar actualizaciones en tiempo real
    startRealTimeUpdates();
    
    // Iniciar auto-refresh
    startAutoRefresh();
    
    console.log('Panel de administración inicializado');
}

// Inicializar referencias a elementos del DOM
function initElements() {
    elements = {
        // Información general
        lastUpdate: document.getElementById('lastUpdate'),
        totalClientsAll: document.getElementById('totalClientsAll'),
        activeSucursales: document.getElementById('activeSucursales'),
        peakHour: document.getElementById('peakHour'),
        connectionCount: document.getElementById('connectionCount'),
        
        // Selectores
        sucursalSelector: document.getElementById('sucursalSelector'),
        timeRange: document.getElementById('timeRange'),
        medicineAreaBtn: document.getElementById('medicineAreaBtn'),
        selfServiceAreaBtn: document.getElementById('selfServiceAreaBtn'),
        
        // Alertas
        alertsList: document.getElementById('alertsList'),
        
        // Gráficas
        areaChart: document.getElementById('areaChart'),
        totalAreaClients: document.getElementById('totalAreaClients'),
        averagePerCaja: document.getElementById('averagePerCaja'),
        areaStatus: document.getElementById('areaStatus'),
        
        // Grid de sucursales
        sucursalesGrid: document.getElementById('sucursalesGrid'),
        
        // Tabla en vivo
        liveLogTable: document.getElementById('liveLogTable'),
        
        // Botones de acción
        refreshData: document.getElementById('refreshData'),
        refreshTimer: document.getElementById('refreshTimer'),
        logoutBtn: document.getElementById('logoutBtn'),
        themeToggle: document.getElementById('themeToggle'),
        
        // Modal de detalle
        sucursalDetailModal: document.getElementById('sucursalDetailModal'),
        closeDetailModal: document.getElementById('closeDetailModal'),
        modalSucursalTitle: document.getElementById('modalSucursalTitle'),
        modalTotalClients: document.getElementById('modalTotalClients'),
        modalLastUpdate: document.getElementById('modalLastUpdate'),
        modalActiveCajeros: document.getElementById('modalActiveCajeros'),
        modalAreaChart: document.getElementById('modalAreaChart'),
        modalHourChart: document.getElementById('modalHourChart'),
        modalCajasTable: document.getElementById('modalCajasTable'),
        exportSucursalData: document.getElementById('exportSucursalData'),
        
        // Notificaciones
        notification: document.getElementById('notification')
    };
}

// Configurar event listeners
function setupEventListeners() {
    // Selectores
    elements.sucursalSelector.addEventListener('change', handleSucursalChange);
    elements.timeRange.addEventListener('change', handleTimeRangeChange);
    
    // Botones de área
    elements.medicineAreaBtn.addEventListener('click', () => setArea('medicina'));
    elements.selfServiceAreaBtn.addEventListener('click', () => setArea('autoservicio'));
    
    // Botones de acción
    elements.refreshData.addEventListener('click', refreshAllData);
    elements.logoutBtn.addEventListener('click', window.authSystem.logout);
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Modal de detalle
    elements.closeDetailModal.addEventListener('click', hideSucursalDetailModal);
    elements.exportSucursalData.addEventListener('click', exportSucursalData);
    elements.sucursalDetailModal.addEventListener('click', (e) => {
        if (e.target === elements.sucursalDetailModal) {
            hideSucursalDetailModal();
        }
    });
    
    // Tecla Escape para cerrar modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.sucursalDetailModal.classList.contains('active')) {
            hideSucursalDetailModal();
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
    
    // Actualizar gráficas con nuevo tema
    updateChartsTheme();
}

// Cargar datos iniciales
async function loadInitialData() {
    try {
        // Cargar lista de sucursales
        await loadSucursales();
        
        // Cargar estadísticas generales
        await loadGeneralStats();
        
        // Cargar datos de la gráfica principal
        await loadAreaChartData();
        
        // Cargar grid de sucursales
        await loadSucursalesGrid();
        
        // Actualizar timestamp
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        showNotification('Error al cargar datos iniciales', 'error');
    }
}

// Cargar lista de sucursales
async function loadSucursales() {
    try {
        const snapshot = await db.collection('sucursales').get();
        
        appState.sucursales = [];
        elements.sucursalSelector.innerHTML = '<option value="">Todas las sucursales</option>';
        
        snapshot.forEach(doc => {
            const sucursalData = {
                id: doc.id,
                ...doc.data()
            };
            
            appState.sucursales.push(sucursalData);
            
            // Agregar al selector
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `Sucursal ${doc.id.replace('sucursal_', '')}`;
            elements.sucursalSelector.appendChild(option);
        });
        
        // Actualizar contador de sucursales activas
        elements.activeSucursales.textContent = appState.sucursales.length;
        
    } catch (error) {
        console.error('Error cargando sucursales:', error);
    }
}

// Cargar estadísticas generales
async function loadGeneralStats() {
    const today = getCurrentDate();
    let totalClients = 0;
    let peakHour = '';
    let peakCount = 0;
    
    try {
        // Para cada sucursal, obtener datos del día
        for (const sucursal of appState.sucursales) {
            const diaRef = db.collection('sucursales').doc(sucursal.id)
                .collection('dias').doc(today);
            
            const diaDoc = await diaRef.get();
            
            if (diaDoc.exists) {
                const data = diaDoc.data();
                
                // Calcular totales y hora pico
                Object.keys(data).forEach(hour => {
                    if (data[hour]) {
                        let hourTotal = 0;
                        
                        Object.keys(data[hour]).forEach(caja => {
                            if (data[hour][caja]) {
                                hourTotal += data[hour][caja].total || 0;
                            }
                        });
                        
                        totalClients += hourTotal;
                        
                        if (hourTotal > peakCount) {
                            peakCount = hourTotal;
                            peakHour = hour;
                        }
                    }
                });
            }
        }
        
        // Actualizar UI
        elements.totalClientsAll.textContent = totalClients;
        elements.peakHour.textContent = peakCount > 0 ? `${peakHour} (${peakCount})` : '--:--';
        
    } catch (error) {
        console.error('Error cargando estadísticas generales:', error);
    }
}

// Cargar datos para gráfica de área
async function loadAreaChartData() {
    const today = getCurrentDate();
    const selectedSucursal = elements.sucursalSelector.value;
    
    try {
        let areaData = {
            medicina: { caja1: 0, caja2: 0, caja3: 0 },
            autoservicio: { caja4: 0, caja5: 0, caja6: 0 }
        };
        
        // Determinar qué sucursales incluir
        const sucursalesToProcess = selectedSucursal ? 
            appState.sucursales.filter(s => s.id === selectedSucursal) : 
            appState.sucursales;
        
        // Procesar datos de cada sucursal
        for (const sucursal of sucursalesToProcess) {
            const diaRef = db.collection('sucursales').doc(sucursal.id)
                .collection('dias').doc(today);
            
            const diaDoc = await diaRef.get();
            
            if (diaDoc.exists) {
                const data = diaDoc.data();
                
                // Sumar datos por área y caja
                Object.keys(data).forEach(hour => {
                    if (data[hour]) {
                        Object.keys(data[hour]).forEach(caja => {
                            if (data[hour][caja]) {
                                const cajaData = data[hour][caja];
                                const cajaId = caja;
                                
                                if (cajaId.startsWith('caja1') || cajaId.startsWith('caja2') || cajaId.startsWith('caja3')) {
                                    areaData.medicina[cajaId] += cajaData.total || 0;
                                } else if (cajaId.startsWith('caja4') || cajaId.startsWith('caja5') || cajaId.startsWith('caja6')) {
                                    areaData.autoservicio[cajaId] += cajaData.total || 0;
                                }
                            }
                        });
                    }
                });
            }
        }
        
        // Actualizar gráfica
        updateAreaChart(areaData[appState.currentArea]);
        
        // Calcular y actualizar estadísticas del área
        updateAreaStats(areaData[appState.currentArea]);
        
    } catch (error) {
        console.error('Error cargando datos de área:', error);
    }
}

// Inicializar gráficas
function initCharts() {
    // Gráfica de área principal
    if (elements.areaChart) {
        const ctx = elements.areaChart.getContext('2d');
        
        appState.chartInstances.areaChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Caja 5', 'Caja 6'],
                datasets: [{
                    label: 'Clientes',
                    data: [0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(76, 201, 240, 0.8)',
                        'rgba(247, 37, 133, 0.8)',
                        'rgba(114, 9, 183, 0.8)',
                        'rgba(255, 158, 0, 0.8)',
                        'rgba(0, 180, 216, 0.8)',
                        'rgba(157, 78, 221, 0.8)'
                    ],
                    borderColor: [
                        'rgb(76, 201, 240)',
                        'rgb(247, 37, 133)',
                        'rgb(114, 9, 183)',
                        'rgb(255, 158, 0)',
                        'rgb(0, 180, 216)',
                        'rgb(157, 78, 221)'
                    ],
                    borderWidth: 2,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Clientes: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
    
    // Gráficas modales (se inicializarán cuando se necesiten)
}

// Actualizar gráfica de área
function updateAreaChart(data) {
    if (!appState.chartInstances.areaChart) return;
    
    const chart = appState.chartInstances.areaChart;
    
    // Determinar qué datos mostrar basado en el área actual
    let labels = [];
    let chartData = [];
    let backgroundColor = [];
    
    if (appState.currentArea === 'medicina') {
        labels = ['Caja 1', 'Caja 2', 'Caja 3'];
        chartData = [data.caja1 || 0, data.caja2 || 0, data.caja3 || 0];
        backgroundColor = [
            'rgba(76, 201, 240, 0.8)',
            'rgba(247, 37, 133, 0.8)',
            'rgba(114, 9, 183, 0.8)'
        ];
    } else {
        labels = ['Caja 4', 'Caja 5', 'Caja 6'];
        chartData = [data.caja4 || 0, data.caja5 || 0, data.caja6 || 0];
        backgroundColor = [
            'rgba(255, 158, 0, 0.8)',
            'rgba(0, 180, 216, 0.8)',
            'rgba(157, 78, 221, 0.8)'
        ];
    }
    
    // Actualizar gráfica
    chart.data.labels = labels;
    chart.data.datasets[0].data = chartData;
    chart.data.datasets[0].backgroundColor = backgroundColor;
    chart.update();
    
    // Verificar desbalance
    checkBalance(chartData);
}

// Verificar balance entre cajas
function checkBalance(data) {
    if (data.length < 2) return;
    
    // Encontrar máximo y mínimo
    const max = Math.max(...data);
    const min = Math.min(...data);
    const difference = max - min;
    
    // Si la diferencia es mayor a 2, mostrar alerta
    if (difference > 2) {
        elements.areaStatus.textContent = 'Desbalanceado';
        elements.areaStatus.className = 'status unbalanced';
        
        // Agregar alerta si no existe
        const alertId = `${appState.currentArea}_desbalance`;
        if (!appState.alertas.some(a => a.id === alertId)) {
            const alerta = {
                id: alertId,
                tipo: 'desbalance',
                area: appState.currentArea,
                diferencia: difference,
                timestamp: new Date()
            };
            
            appState.alertas.push(alerta);
            updateAlertsList();
        }
    } else {
        elements.areaStatus.textContent = 'Balanceado';
        elements.areaStatus.className = 'status balanced';
        
        // Remover alerta si existe
        const alertId = `${appState.currentArea}_desbalance`;
        appState.alertas = appState.alertas.filter(a => a.id !== alertId);
        updateAlertsList();
    }
}

// Actualizar estadísticas del área
function updateAreaStats(data) {
    let total = 0;
    let count = 0;
    
    // Calcular total y promedio
    Object.keys(data).forEach(key => {
        total += data[key] || 0;
        if (data[key] > 0) count++;
    });
    
    const average = count > 0 ? (total / count).toFixed(1) : 0;
    
    // Actualizar UI
    elements.totalAreaClients.textContent = total;
    elements.averagePerCaja.textContent = average;
}

// Cargar grid de sucursales
async function loadSucursalesGrid() {
    const today = getCurrentDate();
    
    if (!elements.sucursalesGrid) return;
    
    // Mostrar estado de carga
    elements.sucursalesGrid.innerHTML = `
        <div class="loading-sucursales">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando datos de sucursales...</p>
        </div>
    `;
    
    try {
        let html = '';
        
        // Para cada sucursal, obtener datos del día
        for (const sucursal of appState.sucursales) {
            const sucursalRef = db.collection('sucursales').doc(sucursal.id);
            const diaRef = sucursalRef.collection('dias').doc(today);
            
            const [sucursalDoc, diaDoc] = await Promise.all([
                sucursalRef.get(),
                diaRef.get()
            ]);
            
            const sucursalData = sucursalDoc.exists ? sucursalDoc.data() : {};
            const diaData = diaDoc.exists ? diaDoc.data() : {};
            
            // Calcular estadísticas
            let totalClientes = 0;
            let medicinaTotal = 0;
            let autoservicioTotal = 0;
            let ultimaActualizacion = sucursalData.ultimaActualizacion || null;
            
            // Procesar datos del día
            Object.keys(diaData).forEach(hour => {
                if (diaData[hour]) {
                    Object.keys(diaData[hour]).forEach(caja => {
                        if (diaData[hour][caja]) {
                            const cajaTotal = diaData[hour][caja].total || 0;
                            totalClientes += cajaTotal;
                            
                            if (caja.startsWith('caja1') || caja.startsWith('caja2') || caja.startsWith('caja3')) {
                                medicinaTotal += cajaTotal;
                            } else if (caja.startsWith('caja4') || caja.startsWith('caja5') || caja.startsWith('caja6')) {
                                autoservicioTotal += cajaTotal;
                            }
                        }
                    });
                }
            });
            
            // Verificar desbalance
            const cajasMedicina = [
                diaData[getCurrentHour()]?.caja1?.total || 0,
                diaData[getCurrentHour()]?.caja2?.total || 0,
                diaData[getCurrentHour()]?.caja3?.total || 0
            ];
            
            const cajasAutoservicio = [
                diaData[getCurrentHour()]?.caja4?.total || 0,
                diaData[getCurrentHour()]?.caja5?.total || 0,
                diaData[getCurrentHour()]?.caja6?.total || 0
            ];
            
            const maxMedicina = Math.max(...cajasMedicina);
            const minMedicina = Math.min(...cajasMedicina);
            const maxAutoservicio = Math.max(...cajasAutoservicio);
            const minAutoservicio = Math.min(...cajasAutoservicio);
            
            const isUnbalanced = (maxMedicina - minMedicina > 2) || (maxAutoservicio - minAutoservicio > 2);
            
            // Generar HTML de la tarjeta
            html += `
                <div class="sucursal-card ${isUnbalanced ? 'unbalanced' : ''}" 
                     data-sucursal-id="${sucursal.id}"
                     onclick="showSucursalDetail('${sucursal.id}')">
                    <div class="sucursal-header">
                        <div class="sucursal-name">
                            <i class="fas fa-store"></i>
                            ${sucursal.id.replace('sucursal_', 'Sucursal ')}
                        </div>
                        <div class="sucursal-status ${isUnbalanced ? 'unbalanced' : 'balanced'}">
                            ${isUnbalanced ? '⚠️ Desbalance' : '✓ Balanceado'}
                        </div>
                    </div>
                    
                    <div class="sucursal-stats">
                        <div class="sucursal-stat">
                            <div class="value">${totalClientes}</div>
                            <div class="label">Clientes</div>
                        </div>
                        <div class="sucursal-stat">
                            <div class="value">${medicinaTotal}</div>
                            <div class="label">Medicina</div>
                        </div>
                        <div class="sucursal-stat">
                            <div class="value">${autoservicioTotal}</div>
                            <div class="label">Autoservicio</div>
                        </div>
                        <div class="sucursal-stat">
                            <div class="value">${ultimaActualizacion ? formatTimestamp(ultimaActualizacion) : '--:--'}</div>
                            <div class="label">Última act.</div>
                        </div>
                    </div>
                    
                    <div class="sucursal-cajas">
                        <div class="caja-mini caja1">
                            <div class="value">${cajasMedicina[0]}</div>
                            <div class="label">C1</div>
                        </div>
                        <div class="caja-mini caja2">
                            <div class="value">${cajasMedicina[1]}</div>
                            <div class="label">C2</div>
                        </div>
                        <div class="caja-mini caja3">
                            <div class="value">${cajasMedicina[2]}</div>
                            <div class="label">C3</div>
                        </div>
                        <div class="caja-mini caja4">
                            <div class="value">${cajasAutoservicio[0]}</div>
                            <div class="label">C4</div>
                        </div>
                        <div class="caja-mini caja5">
                            <div class="value">${cajasAutoservicio[1]}</div>
                            <div class="label">C5</div>
                        </div>
                        <div class="caja-mini caja6">
                            <div class="value">${cajasAutoservicio[2]}</div>
                            <div class="label">C6</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Actualizar grid
        elements.sucursalesGrid.innerHTML = html || `
            <div class="loading-sucursales">
                <i class="fas fa-database"></i>
                <p>No hay sucursales registradas</p>
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando grid de sucursales:', error);
        elements.sucursalesGrid.innerHTML = `
            <div class="loading-sucursales">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar datos</p>
            </div>
        `;
    }
}

// Manejar cambio de sucursal
function handleSucursalChange() {
    const selectedSucursal = elements.sucursalSelector.value;
    appState.selectedSucursal = selectedSucursal;
    
    // Recargar datos basados en la selección
    loadAreaChartData();
    loadSucursalesGrid();
    startRealTimeUpdates();
}

// Manejar cambio de rango de tiempo
function handleTimeRangeChange() {
    // Actualizar datos basados en el rango de tiempo seleccionado
    loadGeneralStats();
    loadAreaChartData();
}

// Establecer área (Medicina/Autoservicio)
function setArea(area) {
    if (appState.currentArea === area) return;
    
    appState.currentArea = area;
    
    // Actualizar botones activos
    elements.medicineAreaBtn.classList.toggle('active', area === 'medicina');
    elements.selfServiceAreaBtn.classList.toggle('active', area === 'autoservicio');
    
    // Recargar datos del área
    loadAreaChartData();
}

// Actualizar lista de alertas
function updateAlertsList() {
    if (!elements.alertsList) return;
    
    if (appState.alertas.length === 0) {
        elements.alertsList.innerHTML = `
            <div class="no-alerts">
                <i class="fas fa-check-circle"></i>
                <p>No hay alertas activas</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    appState.alertas.forEach(alerta => {
        const timeStr = formatTimestamp(alerta.timestamp);
        
        let message = '';
        if (alerta.tipo === 'desbalance') {
            message = `Desbalance en área ${alerta.area}: diferencia de ${alerta.diferencia} clientes`;
        }
        
        html += `
            <div class="alert-item">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="alert-content">
                    <div class="alert-message">${message}</div>
                    <div class="alert-time">${timeStr}</div>
                </div>
            </div>
        `;
    });
    
    elements.alertsList.innerHTML = html;
}

// Iniciar actualizaciones en tiempo real
function startRealTimeUpdates() {
    // Limpiar listeners anteriores
    appState.realTimeListeners.forEach(unsubscribe => unsubscribe());
    appState.realTimeListeners = [];
    
    const today = getCurrentDate();
    const selectedSucursal = elements.sucursalSelector.value;
    
    // Determinar qué sucursales monitorear
    const sucursalesToMonitor = selectedSucursal ? 
        appState.sucursales.filter(s => s.id === selectedSucursal) : 
        appState.sucursales;
    
    // Configurar listeners para cada sucursal
    sucursalesToMonitor.forEach(sucursal => {
        // Listener para última actualización de la sucursal
        const sucursalRef = db.collection('sucursales').doc(sucursal.id);
        const unsubscribe1 = sucursalRef.onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                appState.lastUpdate = new Date();
                updateLastUpdateTime();
                
                // Actualizar log en vivo
                if (data.ultimaActualizacion && data.ultimaCaja && data.ultimoEmpleado) {
                    addLiveLogEntry({
                        sucursalId: sucursal.id,
                        cajaId: data.ultimaCaja,
                        empleadoId: data.ultimoEmpleado,
                        timestamp: data.ultimaActualizacion,
                        tipo: 'registro'
                    });
                }
            }
        });
        
        // Listener para datos del día
        const diaRef = sucursalRef.collection('dias').doc(today);
        const unsubscribe2 = diaRef.onSnapshot((doc) => {
            if (doc.exists) {
                // Actualizar estadísticas generales
                loadGeneralStats();
                
                // Actualizar grid de sucursales
                updateSucursalCard(sucursal.id, doc.data());
            }
        });
        
        appState.realTimeListeners.push(unsubscribe1, unsubscribe2);
    });
    
    // Actualizar contador de conexiones
    elements.connectionCount.textContent = sucursalesToMonitor.length;
}

// Actualizar tarjeta de sucursal específica
function updateSucursalCard(sucursalId, data) {
    const card = document.querySelector(`.sucursal-card[data-sucursal-id="${sucursalId}"]`);
    if (!card) return;
    
    // Recalcular estadísticas
    let totalClientes = 0;
    let medicinaTotal = 0;
    let autoservicioTotal = 0;
    
    Object.keys(data).forEach(hour => {
        if (data[hour]) {
            Object.keys(data[hour]).forEach(caja => {
                if (data[hour][caja]) {
                    const cajaTotal = data[hour][caja].total || 0;
                    totalClientes += cajaTotal;
                    
                    if (caja.startsWith('caja1') || caja.startsWith('caja2') || caja.startsWith('caja3')) {
                        medicinaTotal += cajaTotal;
                    } else if (caja.startsWith('caja4') || caja.startsWith('caja5') || caja.startsWith('caja6')) {
                        autoservicioTotal += cajaTotal;
                    }
                }
            });
        }
    });
    
    // Actualizar valores en la tarjeta
    const totalElement = card.querySelector('.sucursal-stat .value');
    if (totalElement) {
        totalElement.textContent = totalClientes;
    }
    
    // Agregar animación de actualización
    card.classList.add('fade-in');
    setTimeout(() => {
        card.classList.remove('fade-in');
    }, 500);
}

// Agregar entrada al log en vivo
function addLiveLogEntry(entry) {
    if (!elements.liveLogTable) return;
    
    const timeStr = formatTimestamp(entry.timestamp);
    const sucursalName = entry.sucursalId.replace('sucursal_', 'Sucursal ');
    const area = getAreaFromCaja(entry.cajaId);
    
    // Crear nueva fila
    const row = document.createElement('tr');
    row.className = 'fade-in';
    row.innerHTML = `
        <td>${sucursalName}</td>
        <td>${timeStr}</td>
        <td>${area === 'medicina' ? 'Medicina' : 'Autoservicio'}</td>
        <td class="count-cell ${entry.cajaId}-cell">${entry.cajaId.toUpperCase()}</td>
        <td>${entry.empleadoId}</td>
        <td><span class="status high">Registro</span></td>
        <td>${timeStr}</td>
    `;
    
    // Insertar al inicio de la tabla
    const tbody = elements.liveLogTable;
    if (tbody.firstChild) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }
    
    // Limitar a 50 entradas
    while (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }
    
    // Remover animación después de un tiempo
    setTimeout(() => {
        row.classList.remove('fade-in');
    }, 1000);
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

// Actualizar timestamp de última actualización
function updateLastUpdateTime() {
    if (!elements.lastUpdate) return;
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    elements.lastUpdate.textContent = `${hours}:${minutes}:${seconds}`;
}

// Iniciar auto-refresh
function startAutoRefresh() {
    let seconds = 30;
    
    appState.autoRefreshInterval = setInterval(() => {
        seconds--;
        elements.refreshTimer.textContent = `${seconds}s`;
        
        if (seconds <= 0) {
            refreshAllData();
            seconds = 30;
        }
    }, 1000);
}

// Refrescar todos los datos
async function refreshAllData() {
    try {
        await loadGeneralStats();
        await loadAreaChartData();
        await loadSucursalesGrid();
        
        updateLastUpdateTime();
        showNotification('Datos actualizados', 'success');
        
        // Resetear timer
        elements.refreshTimer.textContent = '30s';
        
    } catch (error) {
        console.error('Error refrescando datos:', error);
        showNotification('Error al actualizar datos', 'error');
    }
}

// Mostrar modal de detalle de sucursal
async function showSucursalDetail(sucursalId) {
    const today = getCurrentDate();
    const sucursal = appState.sucursales.find(s => s.id === sucursalId);
    
    if (!sucursal) return;
    
    try {
        // Obtener datos de la sucursal
        const sucursalRef = db.collection('sucursales').doc(sucursalId);
        const diaRef = sucursalRef.collection('dias').doc(today);
        
        const [sucursalDoc, diaDoc] = await Promise.all([
            sucursalRef.get(),
            diaRef.get()
        ]);
        
        const sucursalData = sucursalDoc.exists ? sucursalDoc.data() : {};
        const diaData = diaDoc.exists ? diaDoc.data() : {};
        
        // Actualizar título del modal
        elements.modalSucursalTitle.textContent = 
            `Sucursal ${sucursalId.replace('sucursal_', '')}`;
        
        // Calcular estadísticas
        let totalClientes = 0;
        let ultimaActualizacion = sucursalData.ultimaActualizacion || null;
        let activeCajeros = new Set();
        
        Object.keys(diaData).forEach(hour => {
            if (diaData[hour]) {
                Object.keys(diaData[hour]).forEach(caja => {
                    if (diaData[hour][caja]) {
                        totalClientes += diaData[hour][caja].total || 0;
                        
                        // Contar cajeros activos
                        if (diaData[hour][caja].empleados) {
                            Object.keys(diaData[hour][caja].empleados).forEach(empleado => {
                                activeCajeros.add(empleado);
                            });
                        }
                    }
                });
            }
        });
        
        // Actualizar estadísticas en el modal
        elements.modalTotalClients.textContent = totalClientes;
        elements.modalLastUpdate.textContent = ultimaActualizacion ? 
            formatTimestamp(ultimaActualizacion) : '--:--';
        elements.modalActiveCajeros.textContent = activeCajeros.size;
        
        // Actualizar tabla de cajas
        updateModalCajasTable(diaData);
        
        // Inicializar/actualizar gráficas modales
        initModalCharts(sucursalId, diaData);
        
        // Mostrar modal
        elements.sucursalDetailModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error mostrando detalle de sucursal:', error);
        showNotification('Error al cargar detalles', 'error');
    }
}

// Actualizar tabla de cajas en el modal
function updateModalCajasTable(data) {
    if (!elements.modalCajasTable) return;
    
    const cajas = ['caja1', 'caja2', 'caja3', 'caja4', 'caja5', 'caja6'];
    let html = '';
    
    cajas.forEach(caja => {
        let medicinaCount = 0;
        let autoservicioCount = 0;
        let total = 0;
        
        Object.keys(data).forEach(hour => {
            if (data[hour] && data[hour][caja]) {
                const cajaData = data[hour][caja];
                const count = cajaData.total || 0;
                total += count;
                
                if (caja.startsWith('caja1') || caja.startsWith('caja2') || caja.startsWith('caja3')) {
                    medicinaCount += count;
                } else {
                    autoservicioCount += count;
                }
            }
        });
        
        const area = caja.startsWith('caja1') || caja.startsWith('caja2') || caja.startsWith('caja3') ? 
            'Medicina' : 'Autoservicio';
        
        let status = 'inactive';
        if (total > 10) status = 'high';
        else if (total > 5) status = 'medium';
        else if (total > 0) status = 'low';
        
        html += `
            <tr>
                <td class="count-cell ${caja}-cell">${caja.toUpperCase()}</td>
                <td>${medicinaCount}</td>
                <td>${autoservicioCount}</td>
                <td class="count-cell">${total}</td>
                <td><span class="status ${status}">${area}</span></td>
            </tr>
        `;
    });
    
    elements.modalCajasTable.innerHTML = html || `
        <tr>
            <td colspan="5" style="text-align: center; padding: 20px;">
                No hay datos para esta sucursal
            </td>
        </tr>
    `;
}

// Inicializar gráficas modales
function initModalCharts(sucursalId, data) {
    // Gráfica de distribución por área
    if (elements.modalAreaChart) {
        const ctx = elements.modalAreaChart.getContext('2d');
        
        // Calcular datos
        let medicinaTotal = 0;
        let autoservicioTotal = 0;
        
        Object.keys(data).forEach(hour => {
            if (data[hour]) {
                Object.keys(data[hour]).forEach(caja => {
                    if (data[hour][caja]) {
                        const count = data[hour][caja].total || 0;
                        
                        if (caja.startsWith('caja1') || caja.startsWith('caja2') || caja.startsWith('caja3')) {
                            medicinaTotal += count;
                        } else if (caja.startsWith('caja4') || caja.startsWith('caja5') || caja.startsWith('caja6')) {
                            autoservicioTotal += count;
                        }
                    }
                });
            }
        });
        
        // Destruir gráfica anterior si existe
        if (appState.chartInstances.modalAreaChart) {
            appState.chartInstances.modalAreaChart.destroy();
        }
        
        // Crear nueva gráfica
        appState.chartInstances.modalAreaChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Medicina', 'Autoservicio'],
                datasets: [{
                    data: [medicinaTotal, autoservicioTotal],
                    backgroundColor: [
                        'rgba(76, 201, 240, 0.8)',
                        'rgba(255, 158, 0, 0.8)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // Gráfica de distribución por hora
    if (elements.modalHourChart) {
        const ctx = elements.modalHourChart.getContext('2d');
        
        // Calcular datos por hora
        const hours = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);
        const hourData = hours.map(hour => {
            let total = 0;
            if (data[hour]) {
                Object.keys(data[hour]).forEach(caja => {
                    if (data[hour][caja]) {
                        total += data[hour][caja].total || 0;
                    }
                });
            }
            return total;
        });
        
        // Destruir gráfica anterior si existe
        if (appState.chartInstances.modalHourChart) {
            appState.chartInstances.modalHourChart.destroy();
        }
        
        // Crear nueva gráfica
        appState.chartInstances.modalHourChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Clientes por Hora',
                    data: hourData,
                    borderColor: 'rgb(76, 201, 240)',
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
}

// Ocultar modal de detalle de sucursal
function hideSucursalDetailModal() {
    elements.sucursalDetailModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Exportar datos de sucursal
function exportSucursalData() {
    // Implementar exportación a CSV o PDF
    showNotification('Función de exportación en desarrollo', 'info');
}

// Actualizar tema de gráficas
function updateChartsTheme() {
    const isDarkTheme = !document.body.classList.contains('light-theme');
    
    // Actualizar todas las gráficas
    Object.keys(appState.chartInstances).forEach(key => {
        const chart = appState.chartInstances[key];
        if (chart) {
            // Actualizar colores según el tema
            chart.options.scales.x.ticks.color = isDarkTheme ? '#e6e6e6' : '#1e293b';
            chart.options.scales.y.ticks.color = isDarkTheme ? '#e6e6e6' : '#1e293b';
            chart.update();
        }
    });
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

// Helper: Obtener hora actual
function getCurrentHour() {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, '0');
    return `${hour}:00`;
}

// Exportar funciones globales
window.showSucursalDetail = showSucursalDetail;

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initAdminApp);