// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    PANTALLA DE COCINA - kitchen.js                          ║
// ║                         Mindy's Fast Food                                   ║
// ║                                                                             ║
// ║  Sistema de visualización de pedidos para chefs                             ║
// ║  - Conexión a Google Sheets para sincronización en tiempo real              ║
// ║  - Visualización tipo post-it de los pedidos                                ║
// ║  - Control de estados: PENDIENTE → PREPARANDO → ENTREGADO                  ║
// ╚════════════════════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE GOOGLE API
// ═══════════════════════════════════════════════════════════════════════════════

const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// Variables de estado
let tokenClient;
let gapiInited = false;
let gisInited = false;
let isConnected = false;
let currentOrders = [];
let previousOrderCount = 0;
let refreshInterval = null;

// Colores para los post-its (se asignan cíclicamente)
const POSTIT_COLORS = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-5'];


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
        
        // Intentar restaurar sesión
        const savedToken = localStorage.getItem('kitchen_google_token');
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
    localStorage.setItem('kitchen_google_token', resp.access_token);
    isConnected = true;
    
    updateConnectionStatus(true);
    hideEmptyState();
    
    // Cargar pedidos inmediatamente
    refreshOrders();
    
    // Iniciar actualización automática cada 5 segundos
    startAutoRefresh();
    
    showToast('¡Conectado! Cargando pedidos...', 'success');
}

function logoutGoogle() {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token);
    }
    
    gapi.client.setToken('');
    localStorage.removeItem('kitchen_google_token');
    
    isConnected = false;
    currentOrders = [];
    previousOrderCount = 0;
    
    stopAutoRefresh();
    updateConnectionStatus(false);
    showEmptyState();
    renderOrders([]);
    
    showToast('Desconectado', 'warning');
}

async function verificarToken() {
    try {
        await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        isConnected = true;
        updateConnectionStatus(true);
        hideEmptyState();
        refreshOrders();
        startAutoRefresh();
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado');
        logoutGoogle();
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Obtiene los pedidos pendientes de la cocina
 */
async function getKitchenOrders() {
    if (!isConnected) return [];
    
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PEDIDOS_COCINA + '!A2:G500'
        });
        
        const rows = response.result.values || [];
        const orders = [];
        
        rows.forEach((row, index) => {
            const estado = (row[4] || 'PENDIENTE').toString().trim().toUpperCase();
            
            // Solo mostrar pedidos que NO estén entregados
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
                    user: row[6] || ''
                });
            }
        });
        
        // Ordenar por timestamp (más antiguos primero = FIFO)
        orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return orders;
        
    } catch (error) {
        console.error('Error obteniendo pedidos:', error);
        return [];
    }
}

/**
 * Actualiza el estado de un pedido
 */
async function updateOrderStatus(orderNumber, newStatus, rowIndex) {
    if (!isConnected) return false;
    
    try {
        showLoading('Actualizando...');
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PEDIDOS_COCINA + '!E' + rowIndex,
            valueInputOption: 'RAW',
            resource: {
                values: [[newStatus]]
            }
        });
        
        hideLoading();
        console.log(`🍳 Pedido #${orderNumber} → ${newStatus}`);
        
        // Si es entregado, animar salida antes de refrescar
        if (newStatus === 'ENTREGADO') {
            const card = document.querySelector(`[data-order="${orderNumber}"]`);
            if (card) {
                card.classList.add('delivered');
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            showToast(`Pedido #${orderNumber.toString().padStart(4, '0')} entregado ✅`, 'success');
        } else if (newStatus === 'PREPARANDO') {
            showToast(`Preparando pedido #${orderNumber.toString().padStart(4, '0')} 🔥`, 'warning');
        }
        
        // Refrescar lista de pedidos
        await refreshOrders();
        
        return true;
        
    } catch (error) {
        hideLoading();
        console.error('Error actualizando estado:', error);
        showToast('Error al actualizar pedido', 'error');
        return false;
    }
}

/**
 * Refresca la lista de pedidos
 */
async function refreshOrders() {
    if (!isConnected) {
        showEmptyState();
        return;
    }
    
    try {
        const orders = await getKitchenOrders();
        
        // Detectar nuevos pedidos para notificación
        if (orders.length > previousOrderCount && previousOrderCount > 0) {
            playNotificationSound();
            showToast('🔔 ¡Nuevo pedido!', 'warning');
        }
        
        previousOrderCount = orders.length;
        currentOrders = orders;
        
        // Actualizar contador
        updatePendingCount(orders.length);
        
        // Renderizar pedidos
        renderOrders(orders);
        
    } catch (error) {
        console.error('Error refrescando pedidos:', error);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// RENDERIZADO DE PEDIDOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Renderiza los pedidos como post-its
 */
function renderOrders(orders) {
    const grid = document.getElementById('ordersGrid');
    if (!grid) return;
    
    if (orders.length === 0) {
        grid.innerHTML = `
            <div class="no-orders">
                <div class="no-icon">✨</div>
                <h3>¡Todo al día!</h3>
                <p>No hay pedidos pendientes en este momento</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    orders.forEach((order, index) => {
        const colorClass = POSTIT_COLORS[index % POSTIT_COLORS.length];
        const statusClass = order.status === 'PREPARANDO' ? 'preparing' : '';
        const elapsedTime = getElapsedTime(order.timestamp);
        const isUrgent = elapsedTime.minutes >= 10;
        
        html += `
            <div class="order-postit ${colorClass} ${statusClass}" data-order="${order.orderNumber}">
                <div class="postit-header">
                    <div class="order-number">#${order.orderNumber.toString().padStart(4, '0')}</div>
                    <div class="order-time">
                        <span class="time">${order.time}</span>
                        <span class="elapsed ${isUrgent ? 'urgent' : ''}">${elapsedTime.text}</span>
                    </div>
                </div>
                
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
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

/**
 * Calcula el tiempo transcurrido desde que se hizo el pedido
 */
function getElapsedTime(timestamp) {
    if (!timestamp) return { minutes: 0, text: '' };
    
    const orderTime = new Date(timestamp);
    const now = new Date();
    const diffMs = now - orderTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        return { minutes: 0, text: 'Ahora' };
    } else if (diffMins < 60) {
        return { minutes: diffMins, text: `Hace ${diffMins} min` };
    } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        return { minutes: diffMins, text: `Hace ${hours}h ${mins}m` };
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ACTUALIZACIÓN AUTOMÁTICA
// ═══════════════════════════════════════════════════════════════════════════════

function startAutoRefresh() {
    stopAutoRefresh();
    refreshInterval = setInterval(refreshOrders, 5000); // Cada 5 segundos
    console.log('🔄 Auto-refresh activado (5s)');
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
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
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    toast.className = 'toast ' + type;
    if (icon) icon.textContent = icons[type] || '✅';
    if (msg) msg.textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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

function playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio blocked:', e));
    }
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
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    console.log('🍳 Iniciando Pantalla de Cocina...');
    
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // También refrescar tiempos transcurridos cada minuto
    setInterval(() => {
        if (currentOrders.length > 0) {
            renderOrders(currentOrders);
        }
    }, 60000);
    
    console.log('✅ Pantalla de Cocina lista');
});
