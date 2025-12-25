// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                    PANTALLA DE COCINA - kitchen.js                          ║
// ║                         Mindy's Fast Food                                   ║
// ║                         Versión 2.4 CORREGIDA                               ║
// ║                                                                             ║
// ║  Sistema de visualización de pedidos para chefs                             ║
// ║  - Conexión a Google Sheets para sincronización en tiempo real              ║
// ║  - Visualización tipo post-it de los pedidos                                ║
// ║  - Control de estados: PENDIENTE → PREPARANDO → ENTREGADO                  ║
// ║  - AHORA comparte sesión con la caja principal                              ║
// ╚════════════════════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE GOOGLE API
// ═══════════════════════════════════════════════════════════════════════════════

const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// ═══════════════════════════════════════════════════════════════════════════════
// SCOPES - CORREGIDO: Ahora incluye userinfo para obtener email
// ═══════════════════════════════════════════════════════════════════════════════
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
let previousOrderCount = 0;
let refreshInterval = null;

// Variables de usuario - NUEVO
let emailUsuario = '';
let usuarioAutorizado = false;
let nombreUsuario = '';

// Colores para los post-its (se asignan cíclicamente)
const POSTIT_COLORS = ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-5'];

// ═══════════════════════════════════════════════════════════════════════════════
// CLAVE DE SESIÓN COMPARTIDA - CORREGIDO
// ═══════════════════════════════════════════════════════════════════════════════
// Usar la MISMA clave que el sistema principal para compartir sesión
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
        
        // Intentar restaurar sesión usando la MISMA clave que el POS principal
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
    // Guardar con la MISMA clave que el sistema principal
    localStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);
    
    // Validar usuario antes de conectar
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
    previousOrderCount = 0;
    emailUsuario = '';
    usuarioAutorizado = false;
    nombreUsuario = '';
    
    stopAutoRefresh();
    updateConnectionStatus(false);
    hideAccessDenied();
    showEmptyState();
    renderOrders([]);
    
    showToast('Desconectado', 'warning');
}

async function verificarToken() {
    try {
        await gapi.client.sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        // Token válido - ahora validar usuario
        validarYCargarDatos();
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado');
        logoutGoogle();
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE USUARIOS AUTORIZADOS - NUEVO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Función principal que valida el usuario y carga los datos si está autorizado
 */
async function validarYCargarDatos() {
    try {
        showLoading('Verificando acceso...');
        
        // Primero obtener el email del usuario
        const email = await obtenerEmailUsuario();
        
        if (!email) {
            hideLoading();
            showAccessDenied('No se pudo obtener el email de la cuenta');
            return;
        }
        
        // Verificar si el usuario está autorizado
        const autorizado = await verificarUsuarioAutorizado(email);
        
        if (!autorizado) {
            hideLoading();
            showAccessDenied(`La cuenta ${email} no está autorizada para usar este sistema`);
            return;
        }
        
        // Usuario autorizado - conectar y cargar pedidos
        hideAccessDenied();
        isConnected = true;
        updateConnectionStatus(true);
        hideEmptyState();
        
        showToast(`¡Bienvenido ${nombreUsuario || email}!`, 'success');
        
        // Cargar pedidos inmediatamente
        refreshOrders();
        
        // Iniciar actualización automática cada 5 segundos
        startAutoRefresh();
        
        hideLoading();
        
    } catch (e) {
        console.error('Error validando usuario:', e);
        hideLoading();
        showAccessDenied('Error al verificar el acceso');
    }
}

/**
 * Obtiene el email del usuario conectado desde la API de Google
 */
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

/**
 * Verifica si el email está en la hoja de usuarios autorizados
 */
async function verificarUsuarioAutorizado(email) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.USUARIOS_AUTORIZADOS + '!A2:D100'
        });
        
        const rows = response.result.values || [];
        
        // Si la hoja está vacía, permitir acceso (primera configuración)
        if (rows.length === 0) {
            console.log('⚠️ Hoja de usuarios vacía - permitiendo acceso');
            usuarioAutorizado = true;
            nombreUsuario = email.split('@')[0];
            return true;
        }
        
        // Buscar el email en la lista
        const emailLower = email.toLowerCase().trim();
        
        for (const row of rows) {
            const emailFila = (row[0] || '').toLowerCase().trim();
            const nombre = row[1] || '';
            const rol = row[2] || '';
            const activo = (row[3] || 'TRUE').toString().toUpperCase();
            
            if (emailFila === emailLower) {
                // Verificar si está activo
                if (activo === 'TRUE' || activo === 'SI' || activo === '1') {
                    usuarioAutorizado = true;
                    nombreUsuario = nombre || email.split('@')[0];
                    console.log(`✅ Usuario autorizado: ${nombreUsuario} (${rol})`);
                    return true;
                } else {
                    console.log('❌ Usuario desactivado');
                    return false;
                }
            }
        }
        
        console.log('❌ Email no encontrado en la lista de autorizados');
        return false;
        
    } catch (e) {
        console.error('Error verificando usuario:', e);
        // En caso de error, denegar acceso por seguridad
        return false;
    }
}

/**
 * Muestra el mensaje de acceso denegado
 */
function showAccessDenied(mensaje) {
    const grid = document.getElementById('ordersGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="no-orders" style="color: #ff5252;">
                <div class="no-icon">🚫</div>
                <h3>Acceso Denegado</h3>
                <p>${mensaje}</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.7;">
                    Contacta al administrador para solicitar acceso
                </p>
            </div>
        `;
    }
    
    // Desconectar
    isConnected = false;
    updateConnectionStatus(false);
    stopAutoRefresh();
}

/**
 * Oculta el mensaje de acceso denegado
 */
function hideAccessDenied() {
    // Se limpiará cuando se rendericen los pedidos
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
