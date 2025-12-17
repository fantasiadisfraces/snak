// ========================================
// CONFIGURACIÓN DE GOOGLE SHEETS API
// Lee desde config.js
// ========================================
const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEET_NAME = CONFIG.SHEET_NAME || 'Ventas';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email';

// Variables de autenticación
let tokenClient;
let gapiInited = false;
let gisInited = false;
let usuarioGoogle = null;
let emailUsuario = '';

// ==================== PRODUCTOS DEL MENÚ ====================
const PRODUCTS = {
    milanesas: [
        { id: 1, name: 'Milanesa de Pollo', price: 35, hasSide: true, category: 'milanesas' },
        { id: 2, name: 'Milanesa de Carne', price: 40, hasSide: true, category: 'milanesas' },
        { id: 3, name: 'Milanesa Napolitana', price: 45, hasSide: true, category: 'milanesas' },
        { id: 4, name: 'Milanesa con Queso', price: 42, hasSide: true, category: 'milanesas' },
        { id: 5, name: 'Milanesa Especial', price: 50, hasSide: true, category: 'milanesas' },
        { id: 6, name: 'Milanesa Simple', price: 30, hasSide: true, category: 'milanesas' }
    ],
    pollos: [
        { id: 7, name: 'Pollo BBQ 1/4', price: 30, hasSide: true, category: 'pollos' },
        { id: 8, name: 'Pollo BBQ 1/2', price: 55, hasSide: true, category: 'pollos' },
        { id: 9, name: 'Pollo BBQ Entero', price: 100, hasSide: true, category: 'pollos' },
        { id: 10, name: 'Alitas BBQ (6u)', price: 35, hasSide: true, category: 'pollos' },
        { id: 11, name: 'Alitas BBQ (12u)', price: 65, hasSide: true, category: 'pollos' },
        { id: 12, name: 'Pechuga Plancha', price: 40, hasSide: true, category: 'pollos' },
        { id: 13, name: 'Muslos BBQ (2u)', price: 38, hasSide: true, category: 'pollos' }
    ],
    extras: [
        { id: 14, name: 'Papas Fritas', price: 15, hasSide: false, category: 'extras' },
        { id: 15, name: 'Yuca Frita', price: 15, hasSide: false, category: 'extras' },
        { id: 16, name: 'Ensalada', price: 12, hasSide: false, category: 'extras' },
        { id: 17, name: 'Pan (unidad)', price: 3, hasSide: false, category: 'extras' },
        { id: 18, name: 'Arroz Extra', price: 10, hasSide: false, category: 'extras' }
    ],
    bebidas: [
        { id: 19, name: 'Coca Cola 500ml', price: 8, hasSide: false, category: 'bebidas' },
        { id: 20, name: 'Coca Cola 2L', price: 15, hasSide: false, category: 'bebidas' },
        { id: 21, name: 'Agua Mineral', price: 6, hasSide: false, category: 'bebidas' },
        { id: 22, name: 'Jugo Natural', price: 12, hasSide: false, category: 'bebidas' },
        { id: 23, name: 'Cerveza Paceña', price: 12, hasSide: false, category: 'bebidas' },
        { id: 24, name: 'Cerveza Huari', price: 10, hasSide: false, category: 'bebidas' }
    ]
};

const CATEGORIES = {
    milanesas: { name: 'Milanesas', icon: '🥩' },
    pollos: { name: 'Pollos', icon: '🍗' },
    extras: { name: 'Extras', icon: '🍟' },
    bebidas: { name: 'Bebidas', icon: '🥤' }
};

const SIDE_OPTIONS = ['Arroz Blanco', 'Fideo al Pesto', 'Puré de Papa', 'Ensalada Mixta'];

// ==================== ESTADO GLOBAL ====================
let cart = [];
let currentCategory = 'milanesas';
let orderNumber = 1;
let salesHistory = [];
let pendingProduct = null;
let paymentInfo = { received: 0, change: 0 };

let salesChart = null;
let categoryChart = null;

// ========================================
// INICIALIZACIÓN DE GOOGLE API
// ========================================
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        console.log('✅ Google API inicializada');
        checkReady();
    } catch (error) {
        console.error('❌ Error inicializando GAPI:', error);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse,
    });
    gisInited = true;
    console.log('✅ Google Identity Services cargado');
    checkReady();
}

function checkReady() {
    if (gapiInited && gisInited) {
        console.log('🍗 Sistema POS listo para autenticación');
        // Verificar si hay un token guardado
        const savedToken = localStorage.getItem('pos_googleToken');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verificarTokenGuardado();
        }
    }
}

async function verificarTokenGuardado() {
    try {
        // Intentar una operación simple para verificar el token
        await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        usuarioGoogle = true;
        updateGoogleStatus(true);
        obtenerEmailUsuario();
        console.log('✅ Token guardado válido');
    } catch (error) {
        console.log('⚠️ Token expirado, se requiere nueva autenticación');
        localStorage.removeItem('pos_googleToken');
        updateGoogleStatus(false);
    }
}

function handleTokenResponse(resp) {
    if (resp.error !== undefined) {
        console.error('❌ Error de autenticación:', resp);
        showToast('Error al iniciar sesión con Google: ' + resp.error, 'error');
        return;
    }
    
    // Guardar token
    localStorage.setItem('pos_googleToken', resp.access_token);
    usuarioGoogle = true;
    console.log('✅ Autenticado con Google');
    console.log('📊 Conectando a hoja ID:', SPREADSHEET_ID);
    
    updateGoogleStatus(true);
    obtenerEmailUsuario();
}

async function obtenerEmailUsuario() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': 'Bearer ' + gapi.client.getToken().access_token
            }
        });
        const userInfo = await response.json();
        emailUsuario = userInfo.email;
        console.log('👤 Usuario:', emailUsuario);
        
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) {
            userEmailEl.textContent = '👤 ' + emailUsuario;
        }
        
        // Verificar que la hoja existe
        verificarHojaVentas();
        
    } catch (error) {
        console.error('Error obteniendo email:', error);
        emailUsuario = 'desconocido';
    }
}

// ========================================
// VERIFICAR Y CREAR HOJA DE VENTAS
// ========================================
async function verificarHojaVentas() {
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        
        const hojas = response.result.sheets.map(s => s.properties.title);
        console.log('📋 Hojas existentes:', hojas);
        
        if (!hojas.includes(SHEET_NAME)) {
            console.log('⚠️ La hoja "' + SHEET_NAME + '" no existe. Usa "Configurar Hoja" para crearla.');
        } else {
            console.log('✅ Hoja "' + SHEET_NAME + '" encontrada');
            showToast('¡Conectado a Google Sheets!', 'success');
        }
        
    } catch (error) {
        console.error('Error verificando hojas:', error);
        showToast('Error accediendo a la hoja: ' + error.message, 'error');
    }
}

// ========================================
// AUTENTICACIÓN DE GOOGLE
// ========================================
function handleGoogleAuth() {
    if (!gapiInited || !gisInited) {
        showToast('Esperando que cargue Google API...', 'warning');
        return;
    }
    
    if (usuarioGoogle) {
        // Desconectar
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                console.log('🔓 Token revocado');
            });
            gapi.client.setToken('');
        }
        localStorage.removeItem('pos_googleToken');
        usuarioGoogle = null;
        emailUsuario = '';
        updateGoogleStatus(false);
        
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = '';
        
        showToast('Desconectado de Google', 'warning');
    } else {
        // Conectar - Solicitar token
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

function updateGoogleStatus(connected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('btnGoogle');
    const btnText = document.getElementById('btnGoogleText');

    if (connected) {
        if (dot) dot.classList.add('connected');
        if (text) text.textContent = 'Conectado';
        if (btnText) btnText.textContent = 'Desconectar';
        if (btn) btn.classList.add('connected');
    } else {
        if (dot) dot.classList.remove('connected');
        if (text) text.textContent = 'Desconectado';
        if (btnText) btnText.textContent = 'Conectar';
        if (btn) btn.classList.remove('connected');
    }
}

// ========================================
// CONFIGURAR HOJA DE GOOGLE SHEETS
// ========================================
async function setupGoogleSheet() {
    if (!usuarioGoogle) {
        showToast('Primero conecta tu cuenta de Google', 'warning');
        return;
    }

    try {
        showLoading('Configurando hoja de cálculo...');
        
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        
        const hojas = response.result.sheets.map(s => s.properties.title);
        
        // Crear hoja si no existe
        if (!hojas.includes(SHEET_NAME)) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: { title: SHEET_NAME }
                        }
                    }]
                }
            });
            console.log('✅ Hoja "' + SHEET_NAME + '" creada');
        }
        
        // Crear encabezados
        const headers = [[
            'ID_Pedido', 'Fecha', 'Hora', 'Productos', 'Acompañamientos', 
            'Cantidades', 'Categorias', 'Subtotales', 'Total', 'Pago_Recibido', 'Cambio', 'Registrado_Por'
        ]];
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A1:L1',
            valueInputOption: 'RAW',
            resource: { values: headers }
        });
        
        hideLoading();
        showToast('¡Hoja configurada correctamente!', 'success');
        
    } catch (error) {
        console.error('Error configurando hoja:', error);
        hideLoading();
        showToast('Error: ' + (error.result?.error?.message || error.message), 'error');
    }
}

// ========================================
// GUARDAR VENTA EN GOOGLE SHEETS
// ========================================
async function saveToGoogleSheets(sale) {
    if (!usuarioGoogle) return false;

    try {
        const row = [
            sale.orderNumber,
            sale.date,
            sale.time,
            sale.items.map(i => i.name).join(', '),
            sale.items.map(i => i.side || '-').join(', '),
            sale.items.map(i => i.quantity).join(', '),
            sale.items.map(i => i.category || 'otros').join(', '),
            sale.items.map(i => (i.price * i.quantity).toFixed(2)).join(', '),
            sale.total.toFixed(2),
            sale.received.toFixed(2),
            sale.change.toFixed(2),
            emailUsuario || 'sistema'
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A:L',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        console.log('✅ Venta guardada en Google Sheets');
        return true;
        
    } catch (error) {
        console.error('❌ Error guardando en Google Sheets:', error);
        return false;
    }
}

// ========================================
// SINCRONIZAR DESDE GOOGLE SHEETS
// ========================================
async function syncFromGoogleSheets() {
    if (!usuarioGoogle) {
        showToast('Conecta Google Sheets primero', 'warning');
        return;
    }

    try {
        showLoading('Sincronizando datos desde la nube...');

        // Verificar que la hoja existe
        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        const hojas = spreadsheet.result.sheets.map(s => s.properties.title);

        if (!hojas.includes(SHEET_NAME)) {
            hideLoading();
            showToast('No existe la hoja "' + SHEET_NAME + '". Configúrala primero.', 'warning');
            return;
        }

        // Obtener datos
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A2:L10000'
        });

        const rows = response.result.values || [];

        if (rows.length === 0) {
            hideLoading();
            showToast('La hoja está vacía. Realiza algunas ventas primero.', 'warning');
            updateStats();
            return;
        }

        // Procesar filas
        salesHistory = rows.map(row => {
            const productos = (row[3] || '').split(', ').filter(p => p);
            const acompañamientos = (row[4] || '').split(', ');
            const cantidades = (row[5] || '').split(', ').map(n => parseInt(n) || 1);
            const categorias = (row[6] || '').split(', ');
            const subtotales = (row[7] || '').split(', ').map(n => parseFloat(n) || 0);

            const items = productos.map((name, i) => ({
                name: name,
                side: acompañamientos[i] !== '-' ? acompañamientos[i] : null,
                quantity: cantidades[i] || 1,
                category: categorias[i] || 'otros',
                price: cantidades[i] ? subtotales[i] / cantidades[i] : 0
            }));

            let dateStr = row[1] || '';
            let timeStr = row[2] || '';
            let timestamp = new Date();
            
            try {
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        timestamp = new Date(parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0') + 'T' + (timeStr || '00:00:00'));
                    }
                }
                if (isNaN(timestamp.getTime())) timestamp = new Date();
            } catch (e) {
                timestamp = new Date();
            }

            return {
                orderNumber: parseInt(row[0]) || 0,
                date: dateStr,
                time: timeStr,
                items: items,
                total: parseFloat(row[8]) || 0,
                received: parseFloat(row[9]) || 0,
                change: parseFloat(row[10]) || 0,
                timestamp: timestamp.toISOString()
            };
        }).filter(sale => sale.orderNumber > 0);

        // Actualizar número de orden
        if (salesHistory.length > 0) {
            const maxOrder = Math.max(...salesHistory.map(s => s.orderNumber));
            orderNumber = maxOrder + 1;
            updateOrderNumber();
        }

        saveState();
        updateStats();
        hideLoading();
        showToast('✅ Sincronizado: ' + salesHistory.length + ' ventas cargadas', 'success');
        
    } catch (error) {
        console.error('Error sincronizando:', error);
        hideLoading();
        showToast('Error: ' + (error.result?.error?.message || error.message), 'error');
    }
}

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', function() {
    loadState();
    renderCategories();
    renderProducts(currentCategory);
    updateCart();
    updateOrderNumber();
    initDateFilters();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateStats();
    
    console.log('🍗 Sistema POS - Cargando APIs de Google...');
});

function loadState() {
    const savedOrder = localStorage.getItem('pos_orderNumber');
    if (savedOrder) orderNumber = parseInt(savedOrder);
    
    const savedHistory = localStorage.getItem('pos_salesHistory');
    if (savedHistory) {
        try {
            salesHistory = JSON.parse(savedHistory);
        } catch (e) {
            salesHistory = [];
        }
    }
}

function saveState() {
    localStorage.setItem('pos_orderNumber', orderNumber);
    localStorage.setItem('pos_salesHistory', JSON.stringify(salesHistory));
}

function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'short', 
        day: '2-digit', 
        month: 'short',
        hour: '2-digit', 
        minute: '2-digit' 
    };
    const datetimeEl = document.getElementById('datetime');
    if (datetimeEl) {
        datetimeEl.textContent = now.toLocaleDateString('es-BO', options);
    }
}

function updateOrderNumber() {
    const orderEl = document.getElementById('orderNumber');
    if (orderEl) {
        orderEl.textContent = '#' + orderNumber.toString().padStart(4, '0');
    }
}

// ==================== NAVEGACIÓN ====================
function showSection(section) {
    document.getElementById('tabPOS').classList.remove('active');
    document.getElementById('tabStats').classList.remove('active');
    document.getElementById('posSection').classList.remove('active');
    document.getElementById('statsSection').classList.remove('active');
    
    if (section === 'pos') {
        document.getElementById('tabPOS').classList.add('active');
        document.getElementById('posSection').classList.add('active');
    } else {
        document.getElementById('tabStats').classList.add('active');
        document.getElementById('statsSection').classList.add('active');
        updateStats();
    }
}

// ==================== CATEGORÍAS Y PRODUCTOS ====================
function renderCategories() {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    
    nav.innerHTML = Object.keys(CATEGORIES).map(function(key) {
        return '<button class="category-btn ' + (key === currentCategory ? 'active' : '') + '" onclick="changeCategory(\'' + key + '\')">' +
            '<span class="category-icon">' + CATEGORIES[key].icon + '</span>' +
            '<span class="category-text">' + CATEGORIES[key].name + '</span>' +
        '</button>';
    }).join('');
}

function changeCategory(category) {
    currentCategory = category;
    renderCategories();
    renderProducts(category);
}

function renderProducts(category) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    
    const items = PRODUCTS[category];

    grid.innerHTML = items.map(function(product) {
        return '<div class="product-card" onclick="handleProductClick(' + product.id + ')">' +
            '<div class="product-name">' + product.name + '</div>' +
            '<div class="product-price">Bs. ' + product.price.toFixed(2) + '</div>' +
        '</div>';
    }).join('');
}

function handleProductClick(productId) {
    const allProducts = Object.values(PRODUCTS).flat();
    const product = allProducts.find(function(p) { return p.id === productId; });
    
    if (!product) return;
    
    if (product.hasSide) {
        showSideModal(product);
    } else {
        addToCart(product, null);
    }
}

// ==================== MODAL ACOMPAÑAMIENTO ====================
function showSideModal(product) {
    pendingProduct = product;
    
    var productEl = document.getElementById('sideModalProduct');
    if (productEl) productEl.textContent = product.name;
    
    var optionsEl = document.getElementById('sideOptions');
    if (optionsEl) {
        optionsEl.innerHTML = SIDE_OPTIONS.map(function(side) {
            return '<div class="side-option" onclick="selectSide(\'' + side + '\')">' + side + '</div>';
        }).join('');
    }
    
    document.getElementById('sideModal').classList.add('active');
}

function closeSideModal() {
    document.getElementById('sideModal').classList.remove('active');
    pendingProduct = null;
}

function selectSide(side) {
    if (pendingProduct) {
        addToCart(pendingProduct, side);
        closeSideModal();
    }
}

// ==================== CARRITO ====================
function addToCart(product, side) {
    var cartItemId = side ? product.id + '-' + side : product.id.toString();
    var existingItem = cart.find(function(item) { return item.cartItemId === cartItemId; });
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            cartItemId: cartItemId,
            id: product.id,
            name: product.name,
            price: product.price,
            side: side,
            quantity: 1,
            category: product.category
        });
    }
    
    updateCart();
    showToast(product.name + ' agregado', 'success');
}

function updateQuantity(cartItemId, change) {
    var item = cart.find(function(item) { return item.cartItemId === cartItemId; });
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(cartItemId);
        } else {
            updateCart();
        }
    }
}

function removeFromCart(cartItemId) {
    cart = cart.filter(function(item) { return item.cartItemId !== cartItemId; });
    updateCart();
}

function clearCart() {
    if (cart.length > 0) {
        if (confirm('¿Limpiar el carrito?')) {
            cart = [];
            updateCart();
        }
    }
}

function updateCart() {
    var container = document.getElementById('cartItems');
    if (!container) return;
    
    var total = calculateTotal();
    
    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart"><div class="empty-icon">🛒</div><p>Agrega productos para comenzar</p></div>';
        document.getElementById('btnPay').disabled = true;
    } else {
        container.innerHTML = cart.map(function(item) {
            return '<div class="cart-item">' +
                '<div class="cart-item-info">' +
                    '<div class="cart-item-name">' + item.name + '</div>' +
                    (item.side ? '<div class="cart-item-side">+ ' + item.side + '</div>' : '') +
                    '<div class="cart-item-price">Bs. ' + item.price.toFixed(2) + ' c/u</div>' +
                '</div>' +
                '<div class="cart-item-controls">' +
                    '<button class="qty-btn" onclick="updateQuantity(\'' + item.cartItemId + '\', -1)">−</button>' +
                    '<span class="qty-display">' + item.quantity + '</span>' +
                    '<button class="qty-btn" onclick="updateQuantity(\'' + item.cartItemId + '\', 1)">+</button>' +
                    '<button class="btn-remove" onclick="removeFromCart(\'' + item.cartItemId + '\')">✕</button>' +
                '</div>' +
            '</div>';
        }).join('');
        document.getElementById('btnPay').disabled = false;
    }

    document.getElementById('subtotal').textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('total').textContent = 'Bs. ' + total.toFixed(2);
}

function calculateTotal() {
    return cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
}

// ==================== PAGO ====================
function showPaymentModal() {
    if (cart.length === 0) return;
    
    var total = calculateTotal();
    document.getElementById('paymentTotal').textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('amountReceived').value = '';
    document.getElementById('changeAmount').textContent = 'Bs. 0.00';
    document.getElementById('changeDisplay').classList.remove('insufficient');
    document.getElementById('btnConfirmPay').disabled = true;
    document.getElementById('paymentModal').classList.add('active');
    
    setTimeout(function() { document.getElementById('amountReceived').focus(); }, 100);
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function setQuickAmount(amount) {
    var total = calculateTotal();
    var input = document.getElementById('amountReceived');
    input.value = amount === 'exact' ? total.toFixed(2) : amount;
    calculateChange();
}

function calculateChange() {
    var total = calculateTotal();
    var received = parseFloat(document.getElementById('amountReceived').value) || 0;
    var change = received - total;

    var changeDisplay = document.getElementById('changeDisplay');
    var changeAmount = document.getElementById('changeAmount');
    var btnConfirm = document.getElementById('btnConfirmPay');

    if (received < total) {
        changeDisplay.classList.add('insufficient');
        changeAmount.textContent = 'Falta: Bs. ' + Math.abs(change).toFixed(2);
        btnConfirm.disabled = true;
    } else {
        changeDisplay.classList.remove('insufficient');
        changeAmount.textContent = 'Bs. ' + change.toFixed(2);
        btnConfirm.disabled = false;
    }

    paymentInfo = { received: received, change: change };
}

async function confirmPayment() {
    closePaymentModal();
    
    var total = calculateTotal();
    var now = new Date();
    
    // Crear objeto de venta con copia del carrito
    var sale = {
        orderNumber: orderNumber,
        items: cart.slice(),
        total: total,
        received: paymentInfo.received,
        change: paymentInfo.change,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('es-BO'),
        time: now.toLocaleTimeString('es-BO')
    };
    
    // Guardar en historial local
    salesHistory.push(sale);
    saveState();
    
    // Preparar ticket
    prepareTicket(sale);
    
    // Mostrar modal de éxito
    document.getElementById('successTotal').textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('successReceived').textContent = 'Bs. ' + paymentInfo.received.toFixed(2);
    document.getElementById('successChange').textContent = 'Bs. ' + paymentInfo.change.toFixed(2);
    
    // Guardar en Google Sheets
    var syncStatus = document.getElementById('syncStatus');
    if (usuarioGoogle) {
        syncStatus.innerHTML = '⏳ Guardando en Google Sheets...';
        syncStatus.style.color = '#64748b';
        
        var saved = await saveToGoogleSheets(sale);
        
        if (saved) {
            syncStatus.innerHTML = '✅ Guardado en la nube';
            syncStatus.style.color = '#00c853';
        } else {
            syncStatus.innerHTML = '⚠️ Error en nube (guardado local OK)';
            syncStatus.style.color = '#ff9100';
        }
    } else {
        syncStatus.innerHTML = '💾 Guardado localmente';
        syncStatus.style.color = '#64748b';
    }
    
    document.getElementById('successModal').classList.add('active');
    
    // Incrementar número de orden
    orderNumber++;
    updateOrderNumber();
    saveState();
}

function prepareTicket(sale) {
    document.getElementById('ticketDate').textContent = 'Fecha: ' + sale.date;
    document.getElementById('ticketTime').textContent = 'Hora: ' + sale.time;
    document.getElementById('ticketNumber').textContent = '#' + sale.orderNumber.toString().padStart(4, '0');
    
    document.getElementById('ticketItems').innerHTML = sale.items.map(function(item) {
        return '<div class="ticket-item">' +
            '<div class="ticket-item-row">' +
                '<span>' + item.quantity + 'x ' + item.name + '</span>' +
                '<span>Bs. ' + (item.price * item.quantity).toFixed(2) + '</span>' +
            '</div>' +
            (item.side ? '<div class="ticket-item-side">+ ' + item.side + '</div>' : '') +
        '</div>';
    }).join('');
    
    document.getElementById('ticketTotal').textContent = 'Bs. ' + sale.total.toFixed(2);
    document.getElementById('ticketReceived').textContent = 'Bs. ' + sale.received.toFixed(2);
    document.getElementById('ticketChange').textContent = 'Bs. ' + sale.change.toFixed(2);
}

function printTicket() {
    window.print();
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
    cart = [];
    paymentInfo = { received: 0, change: 0 };
    updateCart();
}

// ==================== ESTADÍSTICAS ====================
function initDateFilters() {
    var today = new Date().toISOString().split('T')[0];
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');
    
    if (dateFrom) dateFrom.value = today;
    if (dateTo) dateTo.value = today;
}

function setQuickFilter(period) {
    document.querySelectorAll('.chip').forEach(function(btn) { btn.classList.remove('active'); });
    var activeBtn = document.querySelector('[data-filter="' + period + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    var today = new Date();
    var dateTo = document.getElementById('dateTo');
    var dateFrom = document.getElementById('dateFrom');

    if (dateTo) dateTo.value = today.toISOString().split('T')[0];

    var fromDate = new Date(today);
    
    switch(period) {
        case 'today':
            break;
        case 'week':
            fromDate.setDate(fromDate.getDate() - 7);
            break;
        case 'month':
            fromDate.setMonth(fromDate.getMonth() - 1);
            break;
        case 'all':
            fromDate = new Date('2020-01-01');
            break;
    }
    
    if (dateFrom) dateFrom.value = fromDate.toISOString().split('T')[0];
    
    updateStats();
}

function applyFilters() {
    updateStats();
}

function getFilteredSales() {
    var dateFromEl = document.getElementById('dateFrom');
    var dateToEl = document.getElementById('dateTo');
    
    if (!dateFromEl || !dateToEl) return salesHistory;
    
    var dateFrom = new Date(dateFromEl.value);
    var dateTo = new Date(dateToEl.value);
    dateTo.setHours(23, 59, 59, 999);

    return salesHistory.filter(function(sale) {
        var saleDate = new Date(sale.timestamp);
        return saleDate >= dateFrom && saleDate <= dateTo;
    });
}

function updateStats() {
    var filteredSales = getFilteredSales();
    
    // Calcular KPIs
    var totalSales = filteredSales.reduce(function(sum, sale) { return sum + sale.total; }, 0);
    var orderCount = filteredSales.length;
    var avgTicket = orderCount > 0 ? totalSales / orderCount : 0;
    var productsSold = filteredSales.reduce(function(sum, sale) {
        return sum + sale.items.reduce(function(itemSum, item) { return itemSum + item.quantity; }, 0);
    }, 0);

    // Actualizar KPIs
    var kpiSales = document.getElementById('kpiSales');
    var kpiOrders = document.getElementById('kpiOrders');
    var kpiAvg = document.getElementById('kpiAvg');
    var kpiProducts = document.getElementById('kpiProducts');
    
    if (kpiSales) kpiSales.textContent = 'Bs. ' + totalSales.toFixed(2);
    if (kpiOrders) kpiOrders.textContent = orderCount;
    if (kpiAvg) kpiAvg.textContent = 'Bs. ' + avgTicket.toFixed(2);
    if (kpiProducts) kpiProducts.textContent = productsSold;

    // Actualizar gráficos
    updateSalesChart(filteredSales);
    updateCategoryChart(filteredSales);
    
    // Actualizar tablas
    updateTopProducts(filteredSales);
    updateSalesHistory(filteredSales);
}

function updateSalesChart(sales) {
    var canvas = document.getElementById('salesChart');
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    
    // Agrupar ventas por día
    var salesByDay = {};
    sales.forEach(function(sale) {
        var date = sale.date;
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += sale.total;
    });

    var labels = Object.keys(salesByDay).sort();
    var data = labels.map(function(date) { return salesByDay[date]; });

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['Sin datos'],
            datasets: [{
                label: 'Ventas (Bs.)',
                data: data.length > 0 ? data : [0],
                borderColor: '#ff6f00',
                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 6,
                pointBackgroundColor: '#ff6f00',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(ctx) { return 'Ventas: Bs. ' + ctx.raw.toFixed(2); }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { callback: function(v) { return 'Bs. ' + v; } }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateCategoryChart(sales) {
    var canvas = document.getElementById('categoryChart');
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    
    var salesByCategory = { milanesas: 0, pollos: 0, extras: 0, bebidas: 0 };

    sales.forEach(function(sale) {
        sale.items.forEach(function(item) {
            if (salesByCategory.hasOwnProperty(item.category)) {
                salesByCategory[item.category] += item.price * item.quantity;
            }
        });
    });

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['🥩 Milanesas', '🍗 Pollos', '🍟 Extras', '🥤 Bebidas'],
            datasets: [{
                data: Object.values(salesByCategory),
                backgroundColor: ['#ff6f00', '#ffc107', '#00c853', '#2979ff'],
                borderWidth: 4,
                borderColor: '#ffffff',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 20, usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    padding: 12,
                    callbacks: {
                        label: function(ctx) { return ' Bs. ' + ctx.raw.toFixed(2); }
                    }
                }
            }
        }
    });
}

function updateTopProducts(sales) {
    var tbody = document.getElementById('topProductsBody');
    if (!tbody) return;
    
    var productSales = {};

    sales.forEach(function(sale) {
        sale.items.forEach(function(item) {
            if (!productSales[item.name]) {
                productSales[item.name] = { name: item.name, category: item.category || 'otros', quantity: 0, revenue: 0 };
            }
            productSales[item.name].quantity += item.quantity;
            productSales[item.name].revenue += item.price * item.quantity;
        });
    });

    var sorted = Object.values(productSales).sort(function(a, b) { return b.quantity - a.quantity; }).slice(0, 10);
    
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data"><span class="no-data-icon">📊</span><p>No hay datos disponibles</p></td></tr>';
        return;
    }

    tbody.innerHTML = sorted.map(function(product, i) {
        var cat = CATEGORIES[product.category];
        var catDisplay = cat ? cat.icon + ' ' + cat.name : product.category;
        var rankClass = i < 3 ? 'rank-' + (i + 1) : 'rank-default';
        
        return '<tr><td><span class="rank-badge ' + rankClass + '">' + (i + 1) + '</span></td><td><strong>' + product.name + '</strong></td><td>' + catDisplay + '</td><td>' + product.quantity + '</td><td><strong>Bs. ' + product.revenue.toFixed(2) + '</strong></td></tr>';
    }).join('');
}

function updateSalesHistory(sales) {
    var tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;
    
    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data"><span class="no-data-icon">🧾</span><p>No hay ventas registradas</p></td></tr>';
        return;
    }

    var sorted = sales.slice().sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    tbody.innerHTML = sorted.slice(0, 100).map(function(sale) {
        var itemCount = sale.items.reduce(function(sum, item) { return sum + item.quantity; }, 0);
        return '<tr><td><strong>#' + sale.orderNumber.toString().padStart(4, '0') + '</strong></td><td>' + sale.date + '</td><td>' + sale.time + '</td><td>' + itemCount + ' items</td><td><strong>Bs. ' + sale.total.toFixed(2) + '</strong></td><td>Bs. ' + (sale.received ? sale.received.toFixed(2) : '-') + '</td><td>Bs. ' + (sale.change ? sale.change.toFixed(2) : '-') + '</td></tr>';
    }).join('');
}

function exportToCSV() {
    var filteredSales = getFilteredSales();
    
    if (filteredSales.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    var csv = 'Pedido,Fecha,Hora,Productos,Total,Pago Recibido,Cambio\n';
    
    filteredSales.forEach(function(sale) {
        var items = sale.items.map(function(i) { return i.name + (i.side ? ' + ' + i.side : '') + ' x' + i.quantity; }).join('; ');
        csv += sale.orderNumber + ',' + sale.date + ',' + sale.time + ',"' + items + '",' + sale.total.toFixed(2) + ',' + (sale.received ? sale.received.toFixed(2) : '') + ',' + (sale.change ? sale.change.toFixed(2) : '') + '\n';
    });

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ventas_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Archivo CSV descargado', 'success');
}

// ==================== UTILIDADES ====================
function showToast(message, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    var icon = document.getElementById('toastIcon');
    var text = document.getElementById('toastMessage');

    if (!toast || !icon || !text) return;

    toast.className = 'toast show';
    
    if (type === 'error') {
        toast.classList.add('error');
        icon.textContent = '❌';
    } else if (type === 'warning') {
        toast.classList.add('warning');
        icon.textContent = '⚠️';
    } else {
        icon.textContent = '✅';
    }
    
    text.textContent = message;

    setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

function showLoading(text) {
    text = text || 'Cargando...';
    var loadingText = document.getElementById('loadingText');
    var loadingOverlay = document.getElementById('loadingOverlay');
    
    if (loadingText) loadingText.textContent = text;
    if (loadingOverlay) loadingOverlay.classList.add('active');
}

function hideLoading() {
    var loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.remove('active');
}
