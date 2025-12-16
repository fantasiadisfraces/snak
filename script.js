// ==================== CONFIGURACIÓN ====================
const CONFIG = {
    GOOGLE_SHEET_ID: '1AmFocVwvywXz6LOwggkFscXjEhx_FZvZCVmb-1ihm5I',
    CLIENT_ID: '488089624210-ns62tr4g9rqov3k2b85965c4p4fto028.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDsIk-N9hDAzZN7vc9b2rUIhcA7D8ViOFk',
    SCOPES: 'https://www.googleapis.com/auth/spreadsheets'
};

// ==================== PRODUCTOS ====================
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
let state = {
    cart: [],
    currentCategory: 'milanesas',
    orderNumber: 1,
    salesHistory: [],
    pendingProduct: null,
    paymentInfo: { received: 0, change: 0 },
    isGoogleConnected: false,
    gapiInited: false,
    gisInited: false
};

let tokenClient;
let salesChart = null;
let categoryChart = null;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadState();
    renderCategories();
    renderProducts(state.currentCategory);
    updateCart();
    updateOrderNumber();
    initDateFilters();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Cargar estadísticas iniciales
    updateStats();
}

function loadState() {
    const savedOrder = localStorage.getItem('orderNumber');
    if (savedOrder) state.orderNumber = parseInt(savedOrder);
    
    const savedHistory = localStorage.getItem('salesHistory');
    if (savedHistory) {
        try {
            state.salesHistory = JSON.parse(savedHistory);
        } catch (e) {
            state.salesHistory = [];
        }
    }
}

function saveState() {
    localStorage.setItem('orderNumber', state.orderNumber);
    localStorage.setItem('salesHistory', JSON.stringify(state.salesHistory));
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
    document.getElementById('datetime').textContent = now.toLocaleDateString('es-BO', options);
}

function updateOrderNumber() {
    document.getElementById('orderNumber').textContent = `#${state.orderNumber.toString().padStart(4, '0')}`;
}

// ==================== GOOGLE API ====================
function gapiLoaded() {
    gapi.load('client', initGapiClient);
}

async function initGapiClient() {
    try {
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
        });
        state.gapiInited = true;
        checkSavedToken();
    } catch (err) {
        console.error('Error GAPI:', err);
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: ''
    });
    state.gisInited = true;
    checkSavedToken();
}

function checkSavedToken() {
    if (state.gapiInited && state.gisInited) {
        const savedToken = localStorage.getItem('googleAccessToken');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verifyToken();
        }
    }
}

async function verifyToken() {
    try {
        await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID
        });
        updateGoogleStatus(true);
    } catch (error) {
        localStorage.removeItem('googleAccessToken');
        updateGoogleStatus(false);
    }
}

function handleGoogleAuth() {
    if (state.isGoogleConnected) {
        // Desconectar
        const token = gapi.client.getToken();
        if (token) {
            google.accounts.oauth2.revoke(token.access_token);
            gapi.client.setToken('');
            localStorage.removeItem('googleAccessToken');
        }
        updateGoogleStatus(false);
        showToast('Desconectado de Google', 'warning');
    } else {
        // Conectar
        tokenClient.callback = async (resp) => {
            if (resp.error) {
                showToast('Error: ' + resp.error, 'error');
                return;
            }
            localStorage.setItem('googleAccessToken', resp.access_token);
            updateGoogleStatus(true);
            showToast('¡Conectado a Google Sheets!', 'success');
        };

        if (gapi.client.getToken() === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

function updateGoogleStatus(connected) {
    state.isGoogleConnected = connected;
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('btnGoogle');
    const btnText = document.getElementById('btnGoogleText');

    if (connected) {
        dot.classList.add('connected');
        text.textContent = 'Conectado';
        btnText.textContent = 'Desconectar';
        btn.classList.add('connected');
    } else {
        dot.classList.remove('connected');
        text.textContent = 'Desconectado';
        btnText.textContent = 'Conectar';
        btn.classList.remove('connected');
    }
}

async function setupGoogleSheet() {
    if (!state.isGoogleConnected) {
        showToast('Primero conecta tu cuenta de Google', 'warning');
        return;
    }

    try {
        showLoading('Configurando hoja...');
        
        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID
        });

        const sheets = spreadsheet.result.sheets || [];
        let ventasSheet = sheets.find(s => s.properties.title === 'Ventas');

        if (!ventasSheet) {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
                resource: {
                    requests: [{ addSheet: { properties: { title: 'Ventas' } } }]
                }
            });
        }

        const headers = [[
            'ID_Pedido', 'Fecha', 'Hora', 'Productos', 'Acompañamientos', 
            'Cantidades', 'Categorias', 'Subtotales', 'Total', 'Pago_Recibido', 'Cambio'
        ]];

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
            range: 'Ventas!A1:K1',
            valueInputOption: 'RAW',
            resource: { values: headers }
        });

        hideLoading();
        showToast('¡Hoja configurada correctamente!', 'success');
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        showToast('Error: ' + (error.result?.error?.message || error.message), 'error');
    }
}

async function saveToGoogleSheets(sale) {
    if (!state.isGoogleConnected) return false;

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
            sale.change.toFixed(2)
        ];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
            range: 'Ventas!A:K',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [row] }
        });

        return true;
    } catch (error) {
        console.error('Error guardando:', error);
        return false;
    }
}

async function syncFromGoogleSheets() {
    if (!state.isGoogleConnected) {
        showToast('Conecta Google Sheets primero', 'warning');
        return;
    }

    try {
        showLoading('Sincronizando datos...');

        const spreadsheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID
        });

        const sheets = spreadsheet.result.sheets || [];
        const ventasSheet = sheets.find(s => s.properties.title === 'Ventas');

        if (!ventasSheet) {
            hideLoading();
            showToast('No existe la hoja "Ventas". Configúrala primero.', 'warning');
            return;
        }

        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
            range: 'Ventas!A2:K10000'
        });

        const rows = response.result.values || [];

        if (rows.length === 0) {
            hideLoading();
            showToast('La hoja está vacía', 'warning');
            updateStats();
            return;
        }

        state.salesHistory = rows.map(row => {
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
                        timestamp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T${timeStr || '00:00:00'}`);
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

        if (state.salesHistory.length > 0) {
            const maxOrder = Math.max(...state.salesHistory.map(s => s.orderNumber));
            state.orderNumber = maxOrder + 1;
            updateOrderNumber();
        }

        saveState();
        updateStats();
        hideLoading();
        showToast(`✅ Sincronizado: ${state.salesHistory.length} ventas`, 'success');
    } catch (error) {
        console.error('Error:', error);
        hideLoading();
        showToast('Error: ' + (error.result?.error?.message || error.message), 'error');
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
    nav.innerHTML = Object.keys(CATEGORIES).map(key => `
        <button class="category-btn ${key === state.currentCategory ? 'active' : ''}" 
                onclick="changeCategory('${key}')">
            <span class="category-icon">${CATEGORIES[key].icon}</span>
            <span class="category-text">${CATEGORIES[key].name}</span>
        </button>
    `).join('');
}

function changeCategory(category) {
    state.currentCategory = category;
    renderCategories();
    renderProducts(category);
}

function renderProducts(category) {
    const grid = document.getElementById('productsGrid');
    const items = PRODUCTS[category];

    grid.innerHTML = items.map(product => `
        <div class="product-card" onclick="handleProductClick(${product.id})">
            <div class="product-name">${product.name}</div>
            <div class="product-price">Bs. ${product.price.toFixed(2)}</div>
        </div>
    `).join('');
}

function handleProductClick(productId) {
    const allProducts = Object.values(PRODUCTS).flat();
    const product = allProducts.find(p => p.id === productId);
    
    if (product.hasSide) {
        showSideModal(product);
    } else {
        addToCart(product, null);
    }
}

// ==================== MODAL ACOMPAÑAMIENTO ====================
function showSideModal(product) {
    state.pendingProduct = product;
    document.getElementById('sideModalProduct').textContent = product.name;
    
    document.getElementById('sideOptions').innerHTML = SIDE_OPTIONS.map(side => `
        <div class="side-option" onclick="selectSide('${side}')">${side}</div>
    `).join('');
    
    document.getElementById('sideModal').classList.add('active');
}

function closeSideModal() {
    document.getElementById('sideModal').classList.remove('active');
    state.pendingProduct = null;
}

function selectSide(side) {
    if (state.pendingProduct) {
        addToCart(state.pendingProduct, side);
        closeSideModal();
    }
}

// ==================== CARRITO ====================
function addToCart(product, side) {
    const cartItemId = side ? `${product.id}-${side}` : product.id.toString();
    const existingItem = state.cart.find(item => item.cartItemId === cartItemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            cartItemId,
            id: product.id,
            name: product.name,
            price: product.price,
            side,
            quantity: 1,
            category: product.category
        });
    }
    
    updateCart();
    showToast(`${product.name} agregado`, 'success');
}

function updateQuantity(cartItemId, change) {
    const item = state.cart.find(item => item.cartItemId === cartItemId);
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
    state.cart = state.cart.filter(item => item.cartItemId !== cartItemId);
    updateCart();
}

function clearCart() {
    if (state.cart.length > 0 && confirm('¿Limpiar el carrito?')) {
        state.cart = [];
        updateCart();
    }
}

function updateCart() {
    const container = document.getElementById('cartItems');
    const total = calculateTotal();
    
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">🛒</div>
                <p>Agrega productos para comenzar</p>
            </div>
        `;
        document.getElementById('btnPay').disabled = true;
    } else {
        container.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    ${item.side ? `<div class="cart-item-side">+ ${item.side}</div>` : ''}
                    <div class="cart-item-price">Bs. ${item.price.toFixed(2)} c/u</div>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', -1)">−</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity('${item.cartItemId}', 1)">+</button>
                    <button class="btn-remove" onclick="removeFromCart('${item.cartItemId}')">✕</button>
                </div>
            </div>
        `).join('');
        document.getElementById('btnPay').disabled = false;
    }

    document.getElementById('subtotal').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('total').textContent = `Bs. ${total.toFixed(2)}`;
}

function calculateTotal() {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// ==================== PAGO ====================
function showPaymentModal() {
    const total = calculateTotal();
    document.getElementById('paymentTotal').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('amountReceived').value = '';
    document.getElementById('changeAmount').textContent = 'Bs. 0.00';
    document.getElementById('changeDisplay').classList.remove('insufficient');
    document.getElementById('btnConfirmPay').disabled = true;
    document.getElementById('paymentModal').classList.add('active');
    
    setTimeout(() => document.getElementById('amountReceived').focus(), 100);
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function setQuickAmount(amount) {
    const total = calculateTotal();
    document.getElementById('amountReceived').value = amount === 'exact' ? total.toFixed(2) : amount;
    calculateChange();
}

function calculateChange() {
    const total = calculateTotal();
    const received = parseFloat(document.getElementById('amountReceived').value) || 0;
    const change = received - total;

    const changeDisplay = document.getElementById('changeDisplay');
    const changeAmount = document.getElementById('changeAmount');
    const btnConfirm = document.getElementById('btnConfirmPay');

    if (received < total) {
        changeDisplay.classList.add('insufficient');
        changeAmount.textContent = `Falta: Bs. ${Math.abs(change).toFixed(2)}`;
        btnConfirm.disabled = true;
    } else {
        changeDisplay.classList.remove('insufficient');
        changeAmount.textContent = `Bs. ${change.toFixed(2)}`;
        btnConfirm.disabled = false;
    }

    state.paymentInfo = { received, change };
}

async function confirmPayment() {
    closePaymentModal();
    
    const total = calculateTotal();
    const now = new Date();
    
    const sale = {
        orderNumber: state.orderNumber,
        items: [...state.cart],
        total: total,
        received: state.paymentInfo.received,
        change: state.paymentInfo.change,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('es-BO'),
        time: now.toLocaleTimeString('es-BO')
    };
    
    // Guardar en historial local
    state.salesHistory.push(sale);
    saveState();
    
    // Preparar ticket
    prepareTicket(sale);
    
    // Mostrar modal de éxito
    document.getElementById('successTotal').textContent = `Bs. ${total.toFixed(2)}`;
    document.getElementById('successReceived').textContent = `Bs. ${state.paymentInfo.received.toFixed(2)}`;
    document.getElementById('successChange').textContent = `Bs. ${state.paymentInfo.change.toFixed(2)}`;
    
    // Guardar en Google Sheets
    const syncStatus = document.getElementById('syncStatus');
    if (state.isGoogleConnected) {
        syncStatus.innerHTML = '⏳ Guardando en Google Sheets...';
        syncStatus.style.color = '#64748b';
        const saved = await saveToGoogleSheets(sale);
        syncStatus.innerHTML = saved ? '✅ Guardado en la nube' : '⚠️ Error en nube (guardado local OK)';
        syncStatus.style.color = saved ? '#00c853' : '#ff9100';
    } else {
        syncStatus.innerHTML = '💾 Guardado localmente';
        syncStatus.style.color = '#64748b';
    }
    
    document.getElementById('successModal').classList.add('active');
    
    // Incrementar número de orden
    state.orderNumber++;
    updateOrderNumber();
    saveState();
}

function prepareTicket(sale) {
    document.getElementById('ticketDate').textContent = `Fecha: ${sale.date}`;
    document.getElementById('ticketTime').textContent = `Hora: ${sale.time}`;
    document.getElementById('ticketNumber').textContent = `#${sale.orderNumber.toString().padStart(4, '0')}`;
    
    document.getElementById('ticketItems').innerHTML = sale.items.map(item => `
        <div class="ticket-item">
            <div class="ticket-item-row">
                <span>${item.quantity}x ${item.name}</span>
                <span>Bs. ${(item.price * item.quantity).toFixed(2)}</span>
            </div>
            ${item.side ? `<div class="ticket-item-side">+ ${item.side}</div>` : ''}
        </div>
    `).join('');
    
    document.getElementById('ticketTotal').textContent = `Bs. ${sale.total.toFixed(2)}`;
    document.getElementById('ticketReceived').textContent = `Bs. ${sale.received.toFixed(2)}`;
    document.getElementById('ticketChange').textContent = `Bs. ${sale.change.toFixed(2)}`;
}

function printTicket() {
    window.print();
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
    state.cart = [];
    state.paymentInfo = { received: 0, change: 0 };
    updateCart();
}

// ==================== ESTADÍSTICAS ====================
function initDateFilters() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateFrom').value = today;
    document.getElementById('dateTo').value = today;
}

function setQuickFilter(period) {
    document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${period}"]`).classList.add('active');

    const today = new Date();
    const dateTo = document.getElementById('dateTo');
    const dateFrom = document.getElementById('dateFrom');

    dateTo.value = today.toISOString().split('T')[0];

    switch(period) {
        case 'today':
            dateFrom.value = today.toISOString().split('T')[0];
            break;
        case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFrom.value = weekAgo.toISOString().split('T')[0];
            break;
        case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFrom.value = monthAgo.toISOString().split('T')[0];
            break;
        case 'all':
            dateFrom.value = '2020-01-01';
            break;
    }

    updateStats();
}

function applyFilters() {
    updateStats();
}

function getFilteredSales() {
    const dateFrom = new Date(document.getElementById('dateFrom').value);
    const dateTo = new Date(document.getElementById('dateTo').value);
    dateTo.setHours(23, 59, 59, 999);

    return state.salesHistory.filter(sale => {
        const saleDate = new Date(sale.timestamp);
        return saleDate >= dateFrom && saleDate <= dateTo;
    });
}

function updateStats() {
    const filteredSales = getFilteredSales();
    
    // KPIs
    const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const orderCount = filteredSales.length;
    const avgTicket = orderCount > 0 ? totalSales / orderCount : 0;
    const productsSold = filteredSales.reduce((sum, sale) => {
        return sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Animar valores
    animateValue('kpiSales', totalSales, 'Bs. ');
    animateValue('kpiOrders', orderCount);
    animateValue('kpiAvg', avgTicket, 'Bs. ');
    animateValue('kpiProducts', productsSold);

    // Actualizar gráficos
    updateSalesChart(filteredSales);
    updateCategoryChart(filteredSales);
    
    // Actualizar tablas
    updateTopProducts(filteredSales);
    updateSalesHistory(filteredSales);
}

function animateValue(elementId, value, prefix = '') {
    const element = document.getElementById(elementId);
    const isDecimal = value % 1 !== 0;
    element.textContent = prefix + (isDecimal ? value.toFixed(2) : value);
}

function updateSalesChart(sales) {
    const salesByDay = {};
    sales.forEach(sale => {
        const date = sale.date;
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += sale.total;
    });

    const labels = Object.keys(salesByDay).sort();
    const data = labels.map(date => salesByDay[date]);

    const ctx = document.getElementById('salesChart').getContext('2d');
    
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
                pointRadius: 5,
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
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => `Bs. ${ctx.raw.toFixed(2)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { callback: v => `Bs. ${v}` }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updateCategoryChart(sales) {
    const salesByCategory = { milanesas: 0, pollos: 0, extras: 0, bebidas: 0 };

    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (salesByCategory.hasOwnProperty(item.category)) {
                salesByCategory[item.category] += item.price * item.quantity;
            }
        });
    });

    const ctx = document.getElementById('categoryChart').getContext('2d');
    
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
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: { size: 12, family: 'Poppins' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` Bs. ${ctx.raw.toFixed(2)}`
                    }
                }
            }
        }
    });
}

function updateTopProducts(sales) {
    const productSales = {};

    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!productSales[item.name]) {
                productSales[item.name] = { 
                    name: item.name, 
                    category: item.category || 'otros', 
                    quantity: 0, 
                    revenue: 0 
                };
            }
            productSales[item.name].quantity += item.quantity;
            productSales[item.name].revenue += item.price * item.quantity;
        });
    });

    const sorted = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    
    const tbody = document.getElementById('topProductsBody');
    
    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">
                    <div class="no-data-icon">📊</div>
                    <p>No hay datos disponibles</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = sorted.map((product, i) => `
        <tr>
            <td><span class="rank-badge ${i < 3 ? `rank-${i+1}` : 'rank-default'}">${i+1}</span></td>
            <td><strong>${product.name}</strong></td>
            <td>${CATEGORIES[product.category]?.icon || '📦'} ${CATEGORIES[product.category]?.name || product.category}</td>
            <td>${product.quantity}</td>
            <td><strong>Bs. ${product.revenue.toFixed(2)}</strong></td>
        </tr>
    `).join('');
}

function updateSalesHistory(sales) {
    const tbody = document.getElementById('salesHistoryBody');
    
    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">
                    <div class="no-data-icon">🧾</div>
                    <p>No hay ventas registradas</p>
                </td>
            </tr>
        `;
        return;
    }

    const sorted = [...sales].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    tbody.innerHTML = sorted.slice(0, 50).map(sale => {
        const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        return `
            <tr>
                <td><strong>#${sale.orderNumber.toString().padStart(4, '0')}</strong></td>
                <td>${sale.date}</td>
                <td>${sale.time}</td>
                <td>${itemCount} items</td>
                <td><strong>Bs. ${sale.total.toFixed(2)}</strong></td>
                <td>Bs. ${sale.received?.toFixed(2) || '-'}</td>
                <td>Bs. ${sale.change?.toFixed(2) || '-'}</td>
            </tr>
        `;
    }).join('');
}

function exportToCSV() {
    const filteredSales = getFilteredSales();
    
    if (filteredSales.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    let csv = 'Pedido,Fecha,Hora,Productos,Total,Pago,Cambio\n';
    
    filteredSales.forEach(sale => {
        const items = sale.items.map(i => `${i.name}${i.side ? ' + ' + i.side : ''} x${i.quantity}`).join('; ');
        csv += `${sale.orderNumber},${sale.date},${sale.time},"${items}",${sale.total.toFixed(2)},${sale.received?.toFixed(2) || ''},${sale.change?.toFixed(2) || ''}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('Archivo CSV descargado', 'success');
}

// ==================== UTILIDADES ====================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const text = document.getElementById('toastMessage');

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

    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(text = 'Cargando...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
}
