// ========================================
// GOOGLE CONFIG (desde config.js)
// ========================================
const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEET_NAME = CONFIG.SHEET_NAME || 'Ventas';

const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

const SCOPES =
  'https://www.googleapis.com/auth/spreadsheets ' +
  'https://www.googleapis.com/auth/userinfo.profile ' +
  'https://www.googleapis.com/auth/userinfo.email';

// ========================================
// GOOGLE AUTH STATE
// ========================================
let tokenClient;
let gapiInited = false;
let gisInited = false;
let usuarioGoogle = false;
let emailUsuario = '';

// ========================================
// MENÚ DEL RESTAURANTE
// ========================================
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
        { id: 18, name: 'Arroz Extra', price: 10, hasSide: false, category: 'extras' },
        { id: 19, name: 'Porción Fideo', price: 12, hasSide: false, category: 'extras' }
    ],
    bebidas: [
        { id: 20, name: 'Coca Cola 500ml', price: 8, hasSide: false, category: 'bebidas' },
        { id: 21, name: 'Coca Cola 2L', price: 15, hasSide: false, category: 'bebidas' },
        { id: 22, name: 'Sprite 500ml', price: 8, hasSide: false, category: 'bebidas' },
        { id: 23, name: 'Fanta 500ml', price: 8, hasSide: false, category: 'bebidas' },
        { id: 24, name: 'Agua Mineral', price: 6, hasSide: false, category: 'bebidas' },
        { id: 25, name: 'Jugo Natural', price: 12, hasSide: false, category: 'bebidas' },
        { id: 26, name: 'Cerveza Paceña', price: 15, hasSide: false, category: 'bebidas' },
        { id: 27, name: 'Cerveza Huari', price: 12, hasSide: false, category: 'bebidas' }
    ]
};

const CATEGORIES = {
    milanesas: { name: 'Milanesas', icon: '🥩' },
    pollos: { name: 'Pollos', icon: '🍗' },
    extras: { name: 'Extras', icon: '🍟' },
    bebidas: { name: 'Bebidas', icon: '🥤' }
};

const SIDE_OPTIONS = ['Arroz Blanco', 'Fideo al Pesto', 'Puré de Papa', 'Ensalada Mixta'];

// ========================================
// ESTADO DE LA APLICACIÓN
// ========================================
let cart = [];
let currentCategory = 'milanesas';
let orderNumber = 1;
let salesHistory = [];
let pendingProduct = null;
let paymentInfo = { received: 0, change: 0 };
let salesChart = null;
let categoryChart = null;

// ========================================
// GOOGLE API INIT
// ========================================
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
        console.log('🍗 Sistema POS listo');
        const savedToken = localStorage.getItem('pos_google_token');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verificarToken();
        }
    }
}

// ========================================
// AUTH
// ========================================
function handleGoogleAuth() {
    if (!gapiInited || !gisInited) {
        showToast('Esperando Google API...', 'warning');
        return;
    }

    if (usuarioGoogle) {
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
    localStorage.setItem('pos_google_token', resp.access_token);
    usuarioGoogle = true;

    updateGoogleStatus(true);
    obtenerEmailUsuario();
    showToast('¡Conectado a Google!', 'success');
}

function logoutGoogle() {
    const token = gapi.client.getToken();
    if (token) {
        google.accounts.oauth2.revoke(token.access_token);
    }
    gapi.client.setToken('');
    localStorage.removeItem('pos_google_token');
    usuarioGoogle = false;
    emailUsuario = '';
    updateGoogleStatus(false);
    document.getElementById('userEmail').textContent = '';
    showToast('Desconectado de Google', 'warning');
}

// ========================================
// USER INFO
// ========================================
async function verificarToken() {
    try {
        await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });
        usuarioGoogle = true;
        updateGoogleStatus(true);
        obtenerEmailUsuario();
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado');
        logoutGoogle();
    }
}

async function obtenerEmailUsuario() {
    try {
        const res = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: {
                    Authorization: 'Bearer ' + gapi.client.getToken().access_token
                }
            }
        );
        const data = await res.json();
        emailUsuario = data.email || '';
        const emailEl = document.getElementById('userEmail');
        if (emailEl) {
            emailEl.textContent = emailUsuario ? '👤 ' + emailUsuario : '';
        }
    } catch (e) {
        console.error('Error obteniendo email:', e);
    }
}

// ========================================
// GOOGLE SHEETS
// ========================================
async function setupGoogleSheet() {
    if (!usuarioGoogle) {
        showToast('Conecta Google primero', 'warning');
        return;
    }

    try {
        showLoading('Configurando hoja...');
        
        const sheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        const hojas = sheet.result.sheets.map(s => s.properties.title);

        if (!hojas.includes(SHEET_NAME)) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        addSheet: { properties: { title: SHEET_NAME } }
                    }]
                }
            });
        }

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A1:L1',
            valueInputOption: 'RAW',
            resource: {
                values: [[
                    'Pedido', 'Fecha', 'Hora', 'Productos', 'Acompañamientos',
                    'Cantidades', 'Categorias', 'Subtotales',
                    'Total', 'Recibido', 'Cambio', 'Usuario'
                ]]
            }
        });

        hideLoading();
        showToast('¡Hoja configurada!', 'success');
    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Error: ' + (e.result?.error?.message || e.message), 'error');
    }
}

async function saveToGoogleSheets(sale) {
    if (!usuarioGoogle) return false;

    try {
        const row = [[
            sale.orderNumber,
            sale.date,
            sale.time,
            sale.items.map(i => i.name).join(', '),
            sale.items.map(i => i.side || '-').join(', '),
            sale.items.map(i => i.quantity).join(', '),
            sale.items.map(i => i.category).join(', '),
            sale.items.map(i => (i.price * i.quantity).toFixed(2)).join(', '),
            sale.total.toFixed(2),
            sale.received.toFixed(2),
            sale.change.toFixed(2),
            emailUsuario || 'sistema'
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A:L',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: row }
        });

        console.log('✅ Guardado en Google Sheets');
        return true;
    } catch (error) {
        console.error('❌ Error guardando:', error);
        return false;
    }
}

async function syncFromGoogleSheets() {
    if (!usuarioGoogle) {
        showToast('Conecta Google primero', 'warning');
        return;
    }

    try {
        showLoading('Sincronizando datos...');

        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEET_NAME + '!A2:L10000'
        });

        const rows = response.result.values || [];

        if (rows.length === 0) {
            hideLoading();
            showToast('No hay datos en la hoja', 'warning');
            return;
        }

        salesHistory = rows.map(function(row) {
            const productos = (row[3] || '').split(', ').filter(function(p) { return p; });
            const acompañamientos = (row[4] || '').split(', ');
            const cantidades = (row[5] || '').split(', ').map(function(n) { return parseInt(n) || 1; });
            const categorias = (row[6] || '').split(', ');
            const subtotales = (row[7] || '').split(', ').map(function(n) { return parseFloat(n) || 0; });

            const items = productos.map(function(name, i) {
                return {
                    name: name,
                    side: acompañamientos[i] !== '-' ? acompañamientos[i] : null,
                    quantity: cantidades[i] || 1,
                    category: categorias[i] || 'otros',
                    price: cantidades[i] ? subtotales[i] / cantidades[i] : 0
                };
            });

            var dateStr = row[1] || '';
            var timeStr = row[2] || '';
            var timestamp = new Date();

            if (dateStr.includes('/')) {
                var parts = dateStr.split('/');
                if (parts.length === 3) {
                    timestamp = new Date(parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0') + 'T' + (timeStr || '00:00:00'));
                }
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
        }).filter(function(sale) { return sale.orderNumber > 0; });

        if (salesHistory.length > 0) {
            var maxOrder = Math.max.apply(null, salesHistory.map(function(s) { return s.orderNumber; }));
            orderNumber = maxOrder + 1;
            updateOrderNumber();
        }

        saveState();
        updateStats();
        hideLoading();
        showToast('✅ ' + salesHistory.length + ' ventas sincronizadas', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error sincronizando:', error);
        showToast('Error: ' + (error.result?.error?.message || error.message), 'error');
    }
}

// ========================================
// UI STATUS
// ========================================
function updateGoogleStatus(ok) {
    var dot = document.getElementById('statusDot');
    var text = document.getElementById('statusText');
    var btnText = document.getElementById('btnGoogleText');
    var btn = document.getElementById('btnGoogle');

    if (dot) dot.classList.toggle('connected', ok);
    if (text) text.textContent = ok ? 'Conectado' : 'Desconectado';
    if (btnText) btnText.textContent = ok ? 'Desconectar' : 'Conectar';
    if (btn) btn.classList.toggle('connected', ok);
}

// ========================================
// NAVEGACIÓN
// ========================================
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

// ========================================
// CATEGORÍAS Y PRODUCTOS
// ========================================
function renderCategories() {
    var nav = document.getElementById('categoryNav');
    if (!nav) return;

    var html = '';
    for (var key in CATEGORIES) {
        html += '<button class="category-btn ' + (key === currentCategory ? 'active' : '') + '" onclick="changeCategory(\'' + key + '\')">' +
            '<span class="category-icon">' + CATEGORIES[key].icon + '</span>' +
            '<span class="category-text">' + CATEGORIES[key].name + '</span>' +
        '</button>';
    }
    nav.innerHTML = html;
}

function changeCategory(category) {
    currentCategory = category;
    renderCategories();
    renderProducts(category);
}

function renderProducts(category) {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;

    var items = PRODUCTS[category];
    var html = '';

    for (var i = 0; i < items.length; i++) {
        var product = items[i];
        html += '<div class="product-card" onclick="handleProductClick(' + product.id + ')">' +
            '<div class="product-name">' + product.name + '</div>' +
            '<div class="product-price">Bs. ' + product.price.toFixed(2) + '</div>' +
        '</div>';
    }

    grid.innerHTML = html;
}

function handleProductClick(productId) {
    var allProducts = [];
    for (var cat in PRODUCTS) {
        allProducts = allProducts.concat(PRODUCTS[cat]);
    }

    var product = null;
    for (var i = 0; i < allProducts.length; i++) {
        if (allProducts[i].id === productId) {
            product = allProducts[i];
            break;
        }
    }

    if (!product) return;

    if (product.hasSide) {
        showSideModal(product);
    } else {
        addToCart(product, null);
    }
}

// ========================================
// MODAL ACOMPAÑAMIENTO
// ========================================
function showSideModal(product) {
    pendingProduct = product;

    var productEl = document.getElementById('sideModalProduct');
    if (productEl) productEl.textContent = product.name;

    var optionsEl = document.getElementById('sideOptions');
    if (optionsEl) {
        var html = '';
        for (var i = 0; i < SIDE_OPTIONS.length; i++) {
            html += '<div class="side-option" onclick="selectSide(\'' + SIDE_OPTIONS[i] + '\')">' + SIDE_OPTIONS[i] + '</div>';
        }
        optionsEl.innerHTML = html;
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

// ========================================
// CARRITO
// ========================================
function addToCart(product, side) {
    var cartItemId = side ? product.id + '-' + side : product.id.toString();

    var existingItem = null;
    for (var i = 0; i < cart.length; i++) {
        if (cart[i].cartItemId === cartItemId) {
            existingItem = cart[i];
            break;
        }
    }

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
    for (var i = 0; i < cart.length; i++) {
        if (cart[i].cartItemId === cartItemId) {
            cart[i].quantity += change;
            if (cart[i].quantity <= 0) {
                removeFromCart(cartItemId);
            } else {
                updateCart();
            }
            break;
        }
    }
}

function removeFromCart(cartItemId) {
    cart = cart.filter(function(item) { return item.cartItemId !== cartItemId; });
    updateCart();
}

function clearCart() {
    if (cart.length > 0 && confirm('¿Limpiar el carrito?')) {
        cart = [];
        updateCart();
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
        var html = '';
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            html += '<div class="cart-item">' +
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
        }
        container.innerHTML = html;
        document.getElementById('btnPay').disabled = false;
    }

    document.getElementById('subtotal').textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('total').textContent = 'Bs. ' + total.toFixed(2);
}

function calculateTotal() {
    var total = 0;
    for (var i = 0; i < cart.length; i++) {
        total += cart[i].price * cart[i].quantity;
    }
    return total;
}

// ========================================
// PAGO
// ========================================
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

    salesHistory.push(sale);
    saveState();

    prepareTicket(sale);

    document.getElementById('successTotal').textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('successReceived').textContent = 'Bs. ' + paymentInfo.received.toFixed(2);
    document.getElementById('successChange').textContent = 'Bs. ' + paymentInfo.change.toFixed(2);

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

    orderNumber++;
    updateOrderNumber();
    saveState();
}

function prepareTicket(sale) {
    document.getElementById('ticketDate').textContent = 'Fecha: ' + sale.date;
    document.getElementById('ticketTime').textContent = 'Hora: ' + sale.time;
    document.getElementById('ticketNumber').textContent = '#' + sale.orderNumber.toString().padStart(4, '0');

    var html = '';
    for (var i = 0; i < sale.items.length; i++) {
        var item = sale.items[i];
        html += '<div class="ticket-item">' +
            '<div class="ticket-item-row">' +
                '<span>' + item.quantity + 'x ' + item.name + '</span>' +
                '<span>Bs. ' + (item.price * item.quantity).toFixed(2) + '</span>' +
            '</div>' +
            (item.side ? '<div class="ticket-item-side">+ ' + item.side + '</div>' : '') +
        '</div>';
    }
    document.getElementById('ticketItems').innerHTML = html;

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

// ========================================
// ESTADÍSTICAS
// ========================================
function initDateFilters() {
    var today = new Date().toISOString().split('T')[0];
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');

    if (dateFrom) dateFrom.value = today;
    if (dateTo) dateTo.value = today;
}

function setQuickFilter(period) {
    var chips = document.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
        chips[i].classList.remove('active');
    }
    var activeBtn = document.querySelector('[data-filter="' + period + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    var today = new Date();
    var dateTo = document.getElementById('dateTo');
    var dateFrom = document.getElementById('dateFrom');

    if (dateTo) dateTo.value = today.toISOString().split('T')[0];

    var fromDate = new Date(today);

    switch(period) {
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

    var totalSales = 0;
    var productsSold = 0;

    for (var i = 0; i < filteredSales.length; i++) {
        totalSales += filteredSales[i].total;
        for (var j = 0; j < filteredSales[i].items.length; j++) {
            productsSold += filteredSales[i].items[j].quantity;
        }
    }

    var orderCount = filteredSales.length;
    var avgTicket = orderCount > 0 ? totalSales / orderCount : 0;

    var kpiSales = document.getElementById('kpiSales');
    var kpiOrders = document.getElementById('kpiOrders');
    var kpiAvg = document.getElementById('kpiAvg');
    var kpiProducts = document.getElementById('kpiProducts');

    if (kpiSales) kpiSales.textContent = 'Bs. ' + totalSales.toFixed(2);
    if (kpiOrders) kpiOrders.textContent = orderCount;
    if (kpiAvg) kpiAvg.textContent = 'Bs. ' + avgTicket.toFixed(2);
    if (kpiProducts) kpiProducts.textContent = productsSold;

    updateSalesChart(filteredSales);
    updateCategoryChart(filteredSales);
    updateTopProducts(filteredSales);
    updateSalesHistory(filteredSales);
}

function updateSalesChart(sales) {
    var canvas = document.getElementById('salesChart');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');

    var salesByDay = {};
    for (var i = 0; i < sales.length; i++) {
        var date = sales[i].date;
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += sales[i].total;
    }

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
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true },
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

    for (var i = 0; i < sales.length; i++) {
        for (var j = 0; j < sales[i].items.length; j++) {
            var item = sales[i].items[j];
            if (salesByCategory.hasOwnProperty(item.category)) {
                salesByCategory[item.category] += item.price * item.quantity;
            }
        }
    }

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['🥩 Milanesas', '🍗 Pollos', '🍟 Extras', '🥤 Bebidas'],
            datasets: [{
                data: [salesByCategory.milanesas, salesByCategory.pollos, salesByCategory.extras, salesByCategory.bebidas],
                backgroundColor: ['#ff6f00', '#ffc107', '#00c853', '#2979ff'],
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateTopProducts(sales) {
    var tbody = document.getElementById('topProductsBody');
    if (!tbody) return;

    var productSales = {};

    for (var i = 0; i < sales.length; i++) {
        for (var j = 0; j < sales[i].items.length; j++) {
            var item = sales[i].items[j];
            if (!productSales[item.name]) {
                productSales[item.name] = { name: item.name, category: item.category, quantity: 0, revenue: 0 };
            }
            productSales[item.name].quantity += item.quantity;
            productSales[item.name].revenue += item.price * item.quantity;
        }
    }

    var sorted = Object.values(productSales).sort(function(a, b) { return b.quantity - a.quantity; }).slice(0, 10);

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">📊 No hay datos disponibles</td></tr>';
        return;
    }

    var html = '';
    for (var k = 0; k < sorted.length; k++) {
        var product = sorted[k];
        var cat = CATEGORIES[product.category];
        var catDisplay = cat ? cat.icon + ' ' + cat.name : product.category;
        var rankClass = k < 3 ? 'rank-' + (k + 1) : 'rank-default';

        html += '<tr><td><span class="rank-badge ' + rankClass + '">' + (k + 1) + '</span></td><td><strong>' + product.name + '</strong></td><td>' + catDisplay + '</td><td>' + product.quantity + '</td><td><strong>Bs. ' + product.revenue.toFixed(2) + '</strong></td></tr>';
    }

    tbody.innerHTML = html;
}

function updateSalesHistory(sales) {
    var tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">🧾 No hay ventas registradas</td></tr>';
        return;
    }

    var sorted = sales.slice().sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });

    var html = '';
    var limit = Math.min(sorted.length, 50);
    for (var i = 0; i < limit; i++) {
        var sale = sorted[i];
        var itemCount = 0;
        for (var j = 0; j < sale.items.length; j++) {
            itemCount += sale.items[j].quantity;
        }
        html += '<tr><td><strong>#' + sale.orderNumber.toString().padStart(4, '0') + '</strong></td><td>' + sale.date + '</td><td>' + sale.time + '</td><td>' + itemCount + ' items</td><td><strong>Bs. ' + sale.total.toFixed(2) + '</strong></td><td>Bs. ' + (sale.received || 0).toFixed(2) + '</td><td>Bs. ' + (sale.change || 0).toFixed(2) + '</td></tr>';
    }

    tbody.innerHTML = html;
}

function exportToCSV() {
    var filteredSales = getFilteredSales();

    if (filteredSales.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    var csv = 'Pedido,Fecha,Hora,Productos,Total,Recibido,Cambio\n';

    for (var i = 0; i < filteredSales.length; i++) {
        var sale = filteredSales[i];
        var items = sale.items.map(function(item) {
            return item.name + (item.side ? ' + ' + item.side : '') + ' x' + item.quantity;
        }).join('; ');
        csv += sale.orderNumber + ',' + sale.date + ',' + sale.time + ',"' + items + '",' + sale.total.toFixed(2) + ',' + (sale.received || 0).toFixed(2) + ',' + (sale.change || 0).toFixed(2) + '\n';
    }

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ventas_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('CSV descargado', 'success');
}

// ========================================
// UTILIDADES
// ========================================
function showToast(message, type) {
    type = type || 'success';
    var toast = document.getElementById('toast');
    var icon = document.getElementById('toastIcon');
    var text = document.getElementById('toastMessage');

    if (!toast || !icon || !text) {
        console.log('[' + type.toUpperCase() + '] ' + message);
        return;
    }

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

    setTimeout(function() { toast.classList.remove('show'); }, 3000);
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

function updateDateTime() {
    var now = new Date();
    var options = { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
    var datetimeEl = document.getElementById('datetime');
    if (datetimeEl) {
        datetimeEl.textContent = now.toLocaleDateString('es-BO', options);
    }
}

function updateOrderNumber() {
    var orderEl = document.getElementById('orderNumber');
    if (orderEl) {
        orderEl.textContent = '#' + orderNumber.toString().padStart(4, '0');
    }
}

function loadState() {
    var savedOrder = localStorage.getItem('pos_orderNumber');
    if (savedOrder) orderNumber = parseInt(savedOrder);

    var savedHistory = localStorage.getItem('pos_salesHistory');
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

// ========================================
// INICIALIZACIÓN
// ========================================
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

    console.log('🍗 Sistema POS inicializado');
});
