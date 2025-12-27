// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    PANTALLA DE COCINA - kitchen.js                          ║
// ║                         Mindy's Fast Food                                   ║
// ║                         Versión 2.5 MEJORADA                                ║
// ║                                                                             ║
// ║  Sistema de visualización de pedidos para chefs                             ║
// ║  - Conexión a Google Sheets para sincronización en tiempo real              ║
// ║  - Visualización tipo post-it de los pedidos                                ║
// ║  - Control de estados: PENDIENTE → PREPARANDO → ENTREGADO                  ║
// ║  - NUEVO: Ficha y nombre del cliente                                        ║
// ║  - NUEVO: Animaciones suaves sin parpadeo                                   ║
// ║  - NUEVO: Sonido de alarma fuerte                                           ║
// ╚════════════════════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE GOOGLE API
// ═══════════════════════════════════════════════════════════════════════════════

const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

const SCOPES =
    'https://www.googleapis.com/auth/spreadsheets ' +
    'https://www.googleapis.com/auth/userinfo.profile ' +
    'https://www.googleapis.com/auth/userinfo.email';

// Variables de estado
let tokenClient;
let gapiInited = false;
let gisInited = false;
let isConnected = false;
let currentOrders = [];
let previousOrderIds = new Set();
let refreshInterval = null;
let hasLoadedOnce = false;  // Bandera para saber si ya cargó al menos una vez
let lastKnownOrderIds = []; // Respaldo de IDs conocidos

// Variables de usuario
let emailUsuario = '';
let usuarioAutorizado = false;
let nombreUsuario = '';

// Colores para los post-its
const POSTIT_COLORS = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-5'];

// Clave de sesión compartida
const TOKEN_STORAGE_KEY = 'pos_google_token';


// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE GOOGLE API
// ═══════════════════════════════════════════════════════════════════════════════

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC]
        });
        gapiInited = true;
        console.log('✅ Google API inicializada');
        checkReady();
    } catch (e) {
        console.error('❌ Error GAPI:', e);
        showToast('Error al inicializar Google API', 'error');
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse
    });
    gisInited = true;
    console.log('✅ Google Identity Services cargado');
    checkReady();
}

function checkReady() {
    if (gapiInited && gisInited) {
        console.log('🍳 Pantalla de Cocina lista');
        const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verificarToken();
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN CON GOOGLE
// ═══════════════════════════════════════════════════════════════════════════════

function handleGoogleAuth() {
    if (!gapiInited || !gisInited) {
        showToast('Esperando Google API...', 'warning');
        return;
    }
    
    if (isConnected) {
        logoutGoogle();
    } else {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

function handleTokenResponse(resp) {
    if (resp.error) {
        console.error('❌ Error auth:', resp);
        showToast('Error de autenticación', 'error');
        return;
    }
    
    gapi.client.setToken(resp);
    localStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);
    validarYCargarDatos();
}

function logoutGoogle() {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token);
    }
    
    gapi.client.setToken('');
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    
    isConnected = false;
    currentOrders = [];
    previousOrderIds = new Set();
    hasLoadedOnce = false;  // Reiniciar bandera
    emailUsuario = '';
    usuarioAutorizado = false;
    nombreUsuario = '';
    
    stopAutoRefresh();
    updateConnectionStatus(false);
    showEmptyState();
    clearOrdersGrid();
    
    showToast('Desconectado', 'warning');
}

async function verificarToken() {
    try {
        await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        validarYCargarDatos();
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado');
        logoutGoogle();
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE USUARIOS AUTORIZADOS
// ═══════════════════════════════════════════════════════════════════════════════

async function validarYCargarDatos() {
    try {
        showLoading('Verificando acceso...');
        
        const email = await obtenerEmailUsuario();
        
        if (!email) {
            hideLoading();
            showAccessDenied('No se pudo obtener el email de la cuenta');
            return;
        }
        
        const autorizado = await verificarUsuarioAutorizado(email);
        
        if (!autorizado) {
            hideLoading();
            showAccessDenied(`La cuenta ${email} no está autorizada`);
            return;
        }
        
        isConnected = true;
        updateConnectionStatus(true);
        hideEmptyState();
        
        showToast(`¡Bienvenido ${nombreUsuario || email}!`, 'success');
        
        await refreshOrders(true);
        startAutoRefresh();
        
        hideLoading();
        
    } catch (e) {
        console.error('Error validando usuario:', e);
        hideLoading();
        showAccessDenied('Error al verificar el acceso');
    }
}

async function obtenerEmailUsuario() {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: 'Bearer ' + gapi.client.getToken().access_token }
        });
        const data = await res.json();
        emailUsuario = data.email || '';
        return emailUsuario;
    } catch (e) {
        console.error('Error obteniendo email:', e);
        return '';
    }
}

async function verificarUsuarioAutorizado(email) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.USUARIOS_AUTORIZADOS + '!A2:D100'
        });
        
        const rows = response.result.values || [];
        
        if (rows.length === 0) {
            usuarioAutorizado = true;
            nombreUsuario = email.split('@')[0];
            return true;
        }
        
        const emailLower = email.toLowerCase().trim();
        
        for (const row of rows) {
            const emailFila = (row[0] || '').toLowerCase().trim();
            const nombre = row[1] || '';
            const activo = (row[3] || 'TRUE').toString().toUpperCase();
            
            if (emailFila === emailLower) {
                if (activo === 'TRUE' || activo === 'SI' || activo === '1') {
                    usuarioAutorizado = true;
                    nombreUsuario = nombre || email.split('@')[0];
                    return true;
                }
                return false;
            }
        }
        
        return false;
        
    } catch (e) {
        console.error('Error verificando usuario:', e);
        return false;
    }
}

function showAccessDenied(mensaje) {
    const grid = document.getElementById('ordersGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="no-orders" style="color: #ff5252;">
                <div class="no-icon">🚫</div>
                <h3>Acceso Denegado</h3>
                <p>${mensaje}</p>
            </div>
        `;
    }
    isConnected = false;
    updateConnectionStatus(false);
    stopAutoRefresh();
}


// ═══════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

async function getKitchenOrders() {
    if (!isConnected) return [];
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PEDIDOS_COCINA + '!A2:J500'
        });
        
        const rows = response.result.values || [];
        const orders = [];
        
        rows.forEach((row, index) => {
            const estado = (row[4] || 'PENDIENTE').toString().trim().toUpperCase();
            
            if (estado !== 'ENTREGADO') {
                let items = [];
                try {
                    items = JSON.parse(row[3] || '[]');
                } catch (e) {
                    items = [];
                }
                
                orders.push({
                    rowIndex: index + 2,
                    orderNumber: parseInt(row[0]) || 0,
                    date: row[1] || '',
                    time: row[2] || '',
                    items: items,
                    status: estado,
                    timestamp: row[5] || '',
                    user: row[6] || '',
                    ficha: row[7] || '',
                    cliente: row[8] || '',
                    tipo: (row[9] || 'LOCAL').toString().trim().toUpperCase()
                });
            }
        });
        
        orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return orders;
        
    } catch (error) {
        console.error('Error obteniendo pedidos:', error);
        return [];
    }
}

async function updateOrderStatus(orderNumber, newStatus, rowIndex) {
    if (!isConnected) return false;
    
    const card = document.querySelector(`[data-order="${orderNumber}"]`);
    
    try {
        // Actualización visual INMEDIATA (sin esperar al servidor)
        if (card) {
            if (newStatus === 'PREPARANDO') {
                card.classList.add('preparing');
                // Actualizar botones inmediatamente
                const actionsEl = card.querySelector('.postit-actions');
                if (actionsEl) {
                    actionsEl.innerHTML = `
                        <button class="btn-status btn-delivered" onclick="updateOrderStatus(${orderNumber}, 'ENTREGADO', ${rowIndex})">
                            ✅ Entregado
                        </button>
                    `;
                }
            } else if (newStatus === 'ENTREGADO') {
                card.classList.add('delivered');
            }
        }
        
        // Guardar en Google Sheets (en segundo plano)
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PEDIDOS_COCINA + '!E' + rowIndex,
            valueInputOption: 'RAW',
            resource: { values: [[newStatus]] }
        });
        
        // Toast de confirmación
        if (newStatus === 'ENTREGADO') {
            showToast(`Pedido #${orderNumber.toString().padStart(4, '0')} entregado ✅`, 'success');
            // Remover la tarjeta después de la animación
            setTimeout(() => {
                if (card) card.remove();
                // Actualizar contador
                const remaining = document.querySelectorAll('.order-postit:not(.delivered)').length;
                updatePendingCount(remaining);
            }, 500);
        } else if (newStatus === 'PREPARANDO') {
            showToast(`Preparando #${orderNumber.toString().padStart(4, '0')} 🔥`, 'warning');
        }
        
        // Actualizar estado local
        const orderIndex = currentOrders.findIndex(o => o.orderNumber === orderNumber);
        if (orderIndex !== -1) {
            currentOrders[orderIndex].status = newStatus;
            if (newStatus === 'ENTREGADO') {
                currentOrders.splice(orderIndex, 1);
            }
        }
        
        // Actualizar panel de resumen (solo si cambió a PREPARANDO)
        if (newStatus === 'PREPARANDO') {
            updateSummaryPanel(currentOrders);
        } else if (newStatus === 'ENTREGADO') {
            updateSummaryPanel(currentOrders);
        }
        
        return true;
        
    } catch (error) {
        console.error('Error actualizando estado:', error);
        showToast('Error al actualizar pedido', 'error');
        // Revertir cambios visuales si hay error
        if (card) {
            card.classList.remove('preparing', 'delivered');
        }
        return false;
    }
}

async function refreshOrders(isFirstLoad = false) {
    if (!isConnected) {
        showEmptyState();
        return;
    }
    
    try {
        const orders = await getKitchenOrders();
        
        // Si no hay órdenes o la consulta falló, no hacer nada con el sonido
        if (!orders || orders.length === 0) {
            currentOrders = [];
            updatePendingCount(0);
            updateSummaryPanel([]);  // Actualizar panel de resumen
            renderOrdersSmooth([], []);
            return;
        }
        
        const currentIds = new Set(orders.map(o => o.orderNumber));
        
        // Detectar pedidos REALMENTE nuevos
        let newOrders = [];
        
        // Solo buscar nuevos pedidos si:
        // 1. Ya cargamos al menos una vez antes
        // 2. No es la primera carga
        // 3. Tenemos IDs previos para comparar
        if (hasLoadedOnce && !isFirstLoad && previousOrderIds.size > 0) {
            // Filtrar pedidos que NO existían antes
            newOrders = orders.filter(o => {
                const isNew = !previousOrderIds.has(o.orderNumber);
                
                // Verificar que el pedido sea reciente (menos de 60 segundos)
                if (isNew && o.timestamp) {
                    const orderTime = new Date(o.timestamp);
                    const now = new Date();
                    const diffSeconds = (now - orderTime) / 1000;
                    
                    // Solo considerar "nuevo" si tiene menos de 60 segundos
                    return diffSeconds < 60;
                }
                
                return false;
            });
            
            // Solo sonar si hay pedidos genuinamente nuevos
            if (newOrders.length > 0) {
                console.log('🔔 Nuevos pedidos detectados:', newOrders.map(o => o.orderNumber));
                playAlarmSound();
                showToast(`🔔 ¡${newOrders.length} nuevo${newOrders.length > 1 ? 's' : ''} pedido${newOrders.length > 1 ? 's' : ''}!`, 'warning');
            }
        }
        
        // Actualizar estado
        previousOrderIds = currentIds;
        currentOrders = orders;
        hasLoadedOnce = true;
        
        updatePendingCount(orders.length);
        updateSummaryPanel(orders);  // Actualizar panel de resumen
        renderOrdersSmooth(orders, newOrders.map(o => o.orderNumber));
        
    } catch (error) {
        console.error('Error refrescando pedidos:', error);
        // No modificar previousOrderIds si hay error para evitar falsos positivos
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// RENDERIZADO SUAVE (SIN PARPADEO)
// ═══════════════════════════════════════════════════════════════════════════════

function renderOrdersSmooth(orders, newOrderNumbers = []) {
    const grid = document.getElementById('ordersGrid');
    if (!grid) return;
    
    if (orders.length === 0) {
        grid.innerHTML = `
            <div class="no-orders">
                <div class="no-icon">✨</div>
                <h3>¡Todo al día!</h3>
                <p>No hay pedidos pendientes</p>
            </div>
        `;
        return;
    }
    
    const existingCards = new Map();
    grid.querySelectorAll('.order-postit').forEach(card => {
        existingCards.set(parseInt(card.dataset.order), card);
    });
    
    const currentOrderNumbers = new Set(orders.map(o => o.orderNumber));
    
    // Remover pedidos que ya no existen
    existingCards.forEach((card, orderNum) => {
        if (!currentOrderNumbers.has(orderNum)) {
            card.classList.add('removing');
            setTimeout(() => card.remove(), 500);
        }
    });
    
    // Actualizar o crear pedidos
    orders.forEach((order) => {
        const colorClass = POSTIT_COLORS[order.orderNumber % POSTIT_COLORS.length];
        const existingCard = existingCards.get(order.orderNumber);
        
        if (existingCard) {
            updateExistingCard(existingCard, order, colorClass);
        } else {
            const newCard = createOrderCard(order, colorClass, newOrderNumbers.includes(order.orderNumber));
            grid.appendChild(newCard);
        }
    });
}

function createOrderCard(order, colorClass, isNew = false) {
    const card = document.createElement('div');
    
    // Determinar color basado en tipo: LOCAL = cálido (naranja), LLEVAR = frío (azul)
    const tipoClass = order.tipo === 'LLEVAR' ? 'tipo-llevar' : 'tipo-local';
    
    card.className = `order-postit ${tipoClass} ${order.status === 'PREPARANDO' ? 'preparing' : ''} ${isNew ? 'new-order' : ''}`;
    card.dataset.order = order.orderNumber;
    card.dataset.tipo = order.tipo || 'LOCAL';
    
    const elapsedTime = getElapsedTime(order.timestamp);
    const isUrgent = elapsedTime.minutes >= 10;
    
    const fichaDisplay = order.ficha ? `
        <div class="ficha-badge">
            <span class="ficha-icon">🔔</span>
            <span class="ficha-number">${order.ficha}</span>
        </div>
    ` : '';
    
    const clienteDisplay = order.cliente ? `
        <div class="cliente-name">
            <span class="cliente-icon">👤</span>
            <span class="cliente-text">${order.cliente}</span>
        </div>
    ` : '';
    
    // Badge de tipo (LOCAL/LLEVAR)
    const tipoIcon = order.tipo === 'LLEVAR' ? '🛍️' : '🍽️';
    const tipoText = order.tipo === 'LLEVAR' ? 'LLEVAR' : 'LOCAL';
    const tipoBadge = `
        <div class="tipo-badge ${order.tipo === 'LLEVAR' ? 'llevar' : 'local'}">
            <span>${tipoIcon}</span>
            <span>${tipoText}</span>
        </div>
    `;
    
    card.innerHTML = `
        ${fichaDisplay}
        <div class="postit-header">
            <div class="order-number">#${order.orderNumber.toString().padStart(4, '0')}</div>
            <div class="order-time">
                <span class="time">${order.time}</span>
                <span class="elapsed ${isUrgent ? 'urgent' : ''}">${elapsedTime.text}</span>
            </div>
        </div>
        ${tipoBadge}
        ${clienteDisplay}
        <div class="postit-items">
            ${order.items.map(item => `
                <div class="order-item">
                    <span class="item-quantity">${item.cantidad}</span>
                    <div class="item-details">
                        <div class="item-name">${item.nombre}</div>
                        ${item.acompañamiento ? `<div class="item-side">${item.acompañamiento}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="postit-actions">
            ${order.status === 'PENDIENTE' ? `
                <button class="btn-status btn-preparing" onclick="updateOrderStatus(${order.orderNumber}, 'PREPARANDO', ${order.rowIndex})">
                    🔥 Preparando
                </button>
            ` : ''}
            <button class="btn-status btn-delivered" onclick="updateOrderStatus(${order.orderNumber}, 'ENTREGADO', ${order.rowIndex})">
                ✅ Entregado
            </button>
        </div>
    `;
    
    return card;
}

function updateExistingCard(card, order, colorClass) {
    // Solo actualizar clases, no recrear
    const wasPrepaing = card.classList.contains('preparing');
    const isNowPreparing = order.status === 'PREPARANDO';
    
    if (wasPrepaing !== isNowPreparing) {
        card.classList.toggle('preparing', isNowPreparing);
    }
    
    // Actualizar tiempo
    const elapsedTime = getElapsedTime(order.timestamp);
    const elapsedEl = card.querySelector('.elapsed');
    if (elapsedEl) {
        elapsedEl.textContent = elapsedTime.text;
        elapsedEl.classList.toggle('urgent', elapsedTime.minutes >= 10);
    }
    
    // Actualizar botones si cambió el estado
    const actionsEl = card.querySelector('.postit-actions');
    if (actionsEl) {
        const hasPreparingBtn = actionsEl.querySelector('.btn-preparing');
        if (order.status === 'PENDIENTE' && !hasPreparingBtn) {
            actionsEl.innerHTML = `
                <button class="btn-status btn-preparing" onclick="updateOrderStatus(${order.orderNumber}, 'PREPARANDO', ${order.rowIndex})">
                    🔥 Preparando
                </button>
                <button class="btn-status btn-delivered" onclick="updateOrderStatus(${order.orderNumber}, 'ENTREGADO', ${order.rowIndex})">
                    ✅ Entregado
                </button>
            `;
        } else if (order.status === 'PREPARANDO' && hasPreparingBtn) {
            actionsEl.innerHTML = `
                <button class="btn-status btn-delivered" onclick="updateOrderStatus(${order.orderNumber}, 'ENTREGADO', ${order.rowIndex})">
                    ✅ Entregado
                </button>
            `;
        }
    }
}

function clearOrdersGrid() {
    const grid = document.getElementById('ordersGrid');
    if (grid) grid.innerHTML = '';
}

function getElapsedTime(timestamp) {
    if (!timestamp) return { minutes: 0, text: '' };
    
    const orderTime = new Date(timestamp);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return { minutes: 0, text: 'Ahora' };
    if (diffMins < 60) return { minutes: diffMins, text: `Hace ${diffMins} min` };
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return { minutes: diffMins, text: `Hace ${hours}h ${mins}m` };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ACTUALIZACIÓN AUTOMÁTICA
// ═══════════════════════════════════════════════════════════════════════════════

function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(() => refreshOrders(), 5000);
    console.log('🔄 Auto-refresh activado (5s)');
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SONIDO DE ALARMA FUERTE
// ═══════════════════════════════════════════════════════════════════════════════

function playAlarmSound() {
    const audio = document.getElementById('alarmSound');
    if (audio) {
        audio.currentTime = 0;
        audio.volume = 1.0;
        audio.play().catch(e => console.log('Audio blocked:', e));
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// INTERFAZ DE USUARIO
// ═══════════════════════════════════════════════════════════════════════════════

function updateConnectionStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btnText = document.getElementById('btnGoogleText');
    const btn = document.getElementById('btnGoogle');
    
    if (dot) dot.classList.toggle('connected', connected);
    if (text) text.textContent = connected ? 'Conectado' : 'Desconectado';
    if (btnText) btnText.textContent = connected ? 'Desconectar' : 'Conectar';
    if (btn) btn.classList.toggle('connected', connected);
}

function updatePendingCount(count) {
    const el = document.getElementById('pendingCount');
    if (el) el.textContent = count;
}

function showEmptyState() {
    const state = document.getElementById('emptyState');
    const grid = document.getElementById('ordersGrid');
    if (state) state.style.display = 'flex';
    if (grid) grid.innerHTML = '';
}

function hideEmptyState() {
    const state = document.getElementById('emptyState');
    if (state) state.style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    if (!toast) return;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️' };
    
    toast.className = 'toast ' + type;
    if (icon) icon.textContent = icons[type] || '✅';
    if (msg) msg.textContent = message;
    
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(text = 'Cargando...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    if (overlay) overlay.classList.add('show');
    if (loadingText) loadingText.textContent = text;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('show');
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    };
    const el = document.getElementById('datetime');
    if (el) el.textContent = now.toLocaleDateString('es-BO', options);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PANEL DE RESUMEN DE PREPARACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

let summaryCollapsed = false;

/**
 * Alterna el panel de resumen (colapsar/expandir)
 */
function toggleSummaryPanel() {
    const content = document.getElementById('summaryContent');
    const toggle = document.getElementById('summaryToggle');
    summaryCollapsed = !summaryCollapsed;
    
    if (summaryCollapsed) {
        content.style.display = 'none';
        toggle.textContent = '▶';
    } else {
        content.style.display = 'block';
        toggle.textContent = '▼';
    }
}

/**
 * Actualiza el panel de resumen con el total de items a preparar
 * SOLO muestra items de pedidos en estado "PREPARANDO"
 * @param {Array} orders - Lista de pedidos activos
 */
function updateSummaryPanel(orders) {
    const panel = document.getElementById('summaryPanel');
    const itemsContainer = document.getElementById('summaryItems');
    
    if (!panel || !itemsContainer) return;
    
    // Filtrar SOLO pedidos en estado PREPARANDO
    const preparingOrders = orders ? orders.filter(o => o.status === 'PREPARANDO') : [];
    
    // Si no hay pedidos preparándose, ocultar panel
    if (preparingOrders.length === 0) {
        panel.style.display = 'none';
        return;
    }
    
    panel.style.display = 'block';
    
    // Sumar todos los items de pedidos EN PREPARACIÓN
    const itemsSummary = {};
    
    preparingOrders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const key = item.nombre + (item.acompañamiento ? ` (${item.acompañamiento})` : '');
                if (!itemsSummary[key]) {
                    itemsSummary[key] = {
                        nombre: item.nombre,
                        acompañamiento: item.acompañamiento || null,
                        cantidad: 0
                    };
                }
                itemsSummary[key].cantidad += item.cantidad;
            });
        }
    });
    
    // Convertir a array y ordenar por cantidad (mayor a menor)
    const sortedItems = Object.values(itemsSummary).sort((a, b) => b.cantidad - a.cantidad);
    
    // Generar HTML
    if (sortedItems.length === 0) {
        itemsContainer.innerHTML = '<div class="summary-empty">No hay items</div>';
        return;
    }
    
    itemsContainer.innerHTML = sortedItems.map(item => `
        <div class="summary-item">
            <span class="summary-qty">${item.cantidad}x</span>
            <div class="summary-info">
                <span class="summary-name">${item.nombre}</span>
                ${item.acompañamiento ? `<span class="summary-side">con ${item.acompañamiento}</span>` : ''}
            </div>
        </div>
    `).join('');
}


// ═══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    console.log('🍳 Iniciando Pantalla de Cocina v2.5...');
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Actualizar tiempos cada 30 segundos sin recrear
    setInterval(() => {
        if (currentOrders.length > 0) {
            currentOrders.forEach(order => {
                const card = document.querySelector(`[data-order="${order.orderNumber}"]`);
                if (card) {
                    const elapsedEl = card.querySelector('.elapsed');
                    if (elapsedEl) {
                        const elapsedTime = getElapsedTime(order.timestamp);
                        elapsedEl.textContent = elapsedTime.text;
                        elapsedEl.classList.toggle('urgent', elapsedTime.minutes >= 10);
                    }
                }
            });
        }
    }, 30000);
    
    console.log('✅ Pantalla de Cocina lista');
});
