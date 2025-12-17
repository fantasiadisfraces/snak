// ========================================
// SISTEMA POS - Versión 2.1
// Base de Datos con Google Sheets - ESTADÍSTICAS CORREGIDAS
// ========================================

// ========================================
// GOOGLE CONFIG (desde config.js)
// ========================================
const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;

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
// DATOS DEL MENÚ (se cargan desde Google Sheets)
// ========================================
let CATEGORIES = {};
let PRODUCTS = {};
let SIDE_OPTIONS = [];
let dataLoaded = false;

// ========================================
// ESTADO DE LA APLICACIÓN
// ========================================
let cart = [];
let currentCategory = '';
let orderNumber = 1;
let salesHistory = [];
let pendingProduct = null;
let paymentInfo = { received: 0, change: 0 };
let salesChart = null;
let categoryChart = null;
let lastDetailId = 0;

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
        console.log('🍗 Sistema POS listo');
        const savedToken = localStorage.getItem('pos_google_token');
        if (savedToken) {
            gapi.client.setToken({ access_token: savedToken });
            verificarToken();
        } else {
            showEmptyState();
        }
    }
}

function showEmptyState() {
    var grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = '<div class="empty-products"><div class="empty-icon">🔌</div><p>Conecta con Google para cargar el menú</p></div>';
    }
    var nav = document.getElementById('categoryNav');
    if (nav) {
        nav.innerHTML = '<div class="connect-message">Presiona "Conectar" arriba para comenzar</div>';
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
    
    // CARGAR TODOS LOS DATOS
    loadAllDataFromSheets();
    
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
    
    CATEGORIES = {};
    PRODUCTS = {};
    SIDE_OPTIONS = [];
    dataLoaded = false;
    
    showEmptyState();
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
        
        loadAllDataFromSheets();
        
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado o inválido');
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
// CARGAR TODOS LOS DATOS DESDE GOOGLE SHEETS
// ========================================
async function loadAllDataFromSheets() {
    if (!usuarioGoogle) {
        showEmptyState();
        return;
    }

    try {
        showLoading('Cargando menú desde Google Sheets...');
        
        console.log('📊 Cargando datos de Google Sheets...');
        
        // 1. Cargar categorías
        await loadCategoriesFromSheet();
        console.log('✅ Categorías cargadas:', Object.keys(CATEGORIES).length);
        
        // 2. Cargar productos
        await loadProductsFromSheet();
        console.log('✅ Productos cargados');
        
        // 3. Cargar acompañamientos
        await loadSidesFromSheet();
        console.log('✅ Acompañamientos cargados:', SIDE_OPTIONS.length);
        
        // 4. Cargar ventas e historial
        await loadSalesFromSheet();
        console.log('✅ Ventas cargadas:', salesHistory.length);
        
        dataLoaded = true;
        
        // Establecer primera categoría como actual
        const categoryKeys = Object.keys(CATEGORIES);
        if (categoryKeys.length > 0) {
            currentCategory = categoryKeys[0];
        }
        
        // Renderizar UI
        renderCategories();
        renderProducts(currentCategory);
        updateStats();
        
        hideLoading();
        showToast('¡Datos cargados correctamente!', 'success');
        
    } catch (e) {
        console.error('❌ Error cargando datos:', e);
        hideLoading();
        showToast('Error: ' + (e.message || 'No se pudo cargar'), 'error');
    }
}

// ========================================
// CARGAR CATEGORÍAS
// ========================================
async function loadCategoriesFromSheet() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.CATEGORIAS + '!A2:E100'
    });
    
    const rows = response.result.values || [];
    CATEGORIES = {};
    
    if (rows.length === 0) {
        throw new Error('No hay categorías en la hoja. Agrega categorías primero.');
    }
    
    rows.forEach((row, index) => {
        const id = row[0];
        const nombre = row[1];
        const icono = row[2] || '📦';
        const orden = parseInt(row[3]) || (index + 1);
        const activo = (row[4] || 'TRUE').toString().toUpperCase();
        
        if (id && activo === 'TRUE') {
            CATEGORIES[id] = {
                name: nombre || id,
                icon: icono,
                order: orden
            };
        }
    });
    
    if (Object.keys(CATEGORIES).length === 0) {
        throw new Error('No hay categorías activas');
    }
}

// ========================================
// CARGAR PRODUCTOS
// ========================================
async function loadProductsFromSheet() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.PRODUCTOS + '!A2:F500'
    });
    
    const rows = response.result.values || [];
    PRODUCTS = {};
    
    Object.keys(CATEGORIES).forEach(cat => {
        PRODUCTS[cat] = [];
    });
    
    if (rows.length === 0) {
        throw new Error('No hay productos en la hoja.');
    }
    
    rows.forEach(row => {
        const id = parseInt(row[0]) || 0;
        const nombre = row[1];
        const precio = parseFloat(row[2]) || 0;
        const categoria = row[3];
        const tieneAcomp = (row[4] || 'FALSE').toString().toUpperCase() === 'TRUE';
        const activo = (row[5] || 'TRUE').toString().toUpperCase();
        
        if (id && nombre && activo === 'TRUE') {
            if (!PRODUCTS[categoria]) {
                PRODUCTS[categoria] = [];
            }
            
            PRODUCTS[categoria].push({
                id: id,
                name: nombre,
                price: precio,
                hasSide: tieneAcomp,
                category: categoria
            });
        }
    });
}

// ========================================
// CARGAR ACOMPAÑAMIENTOS
// ========================================
async function loadSidesFromSheet() {
    const response = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.ACOMPAÑAMIENTOS + '!A2:D50'
    });
    
    const rows = response.result.values || [];
    SIDE_OPTIONS = [];
    
    rows.forEach(row => {
        const id = parseInt(row[0]) || 0;
        const nombre = row[1];
        const orden = parseInt(row[2]) || 99;
        const activo = (row[3] || 'TRUE').toString().toUpperCase();
        
        if (id && nombre && activo === 'TRUE') {
            SIDE_OPTIONS.push({
                id: id,
                name: nombre,
                order: orden
            });
        }
    });
    
    SIDE_OPTIONS.sort((a, b) => a.order - b.order);
    
    if (SIDE_OPTIONS.length === 0) {
        SIDE_OPTIONS = [{ id: 1, name: 'Sin acompañamiento', order: 1 }];
    }
}

// ========================================
// CARGAR VENTAS DESDE GOOGLE SHEETS
// ========================================
async function loadSalesFromSheet() {
    try {
        // Cargar ventas
        const ventasResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.VENTAS + '!A2:H50000'
        });

        // Cargar detalles
        const detalleResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.DETALLE_VENTAS + '!A2:J100000'
        });

        const ventasRows = ventasResponse.result.values || [];
        const detalleRows = detalleResponse.result.values || [];

        console.log('📋 Filas de ventas encontradas:', ventasRows.length);
        console.log('📋 Filas de detalles encontradas:', detalleRows.length);

        if (ventasRows.length === 0) {
            salesHistory = [];
            orderNumber = 1;
            lastDetailId = 0;
            return;
        }

        // Crear mapa de detalles por ID_Venta
        const detallesPorVenta = {};
        detalleRows.forEach(row => {
            const idVenta = parseInt(row[1]) || 0;
            if (idVenta > 0) {
                if (!detallesPorVenta[idVenta]) {
                    detallesPorVenta[idVenta] = [];
                }
                detallesPorVenta[idVenta].push({
                    id: parseInt(row[2]) || 0,
                    name: row[3] || 'Producto',
                    sideId: row[4] ? parseInt(row[4]) : null,
                    side: row[5] || null,
                    quantity: parseInt(row[6]) || 1,
                    price: parseFloat(row[7]) || 0,
                    category: row[9] || 'otros'
                });
            }
        });

        // Construir historial de ventas
        salesHistory = [];
        
        ventasRows.forEach(row => {
            const idVenta = parseInt(row[0]) || 0;
            
            if (idVenta > 0) {
                // Parsear fecha y timestamp
                let timestamp = new Date();
                const fechaStr = row[1] || '';
                const horaStr = row[2] || '';
                
                if (row[7]) {
                    // Si hay timestamp ISO
                    timestamp = new Date(row[7]);
                } else if (fechaStr) {
                    // Parsear fecha DD/MM/YYYY
                    const parts = fechaStr.split('/');
                    if (parts.length === 3) {
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2];
                        timestamp = new Date(year + '-' + month + '-' + day + 'T' + (horaStr || '12:00:00'));
                    }
                }

                const items = detallesPorVenta[idVenta] || [];
                
                // Si no hay items en detalle, crear uno genérico con el total
                if (items.length === 0) {
                    const total = parseFloat(row[3]) || 0;
                    items.push({
                        id: 0,
                        name: 'Venta #' + idVenta,
                        quantity: 1,
                        price: total,
                        category: 'otros'
                    });
                }

                salesHistory.push({
                    orderNumber: idVenta,
                    date: fechaStr,
                    time: horaStr,
                    total: parseFloat(row[3]) || 0,
                    received: parseFloat(row[4]) || 0,
                    change: parseFloat(row[5]) || 0,
                    items: items,
                    timestamp: timestamp.toISOString()
                });
            }
        });

        // Actualizar número de orden
        if (salesHistory.length > 0) {
            const maxOrder = Math.max(...salesHistory.map(s => s.orderNumber));
            orderNumber = maxOrder + 1;
        } else {
            orderNumber = 1;
        }

        // Actualizar último ID de detalle
        if (detalleRows.length > 0) {
            const detailIds = detalleRows.map(r => parseInt(r[0]) || 0);
            lastDetailId = Math.max(...detailIds);
        } else {
            lastDetailId = 0;
        }

        updateOrderNumber();
        saveState();
        
        console.log('✅ Historial cargado:', salesHistory.length, 'ventas');
        
    } catch (e) {
        console.error('Error cargando ventas:', e);
        salesHistory = [];
    }
}

// ========================================
// SINCRONIZAR DESDE GOOGLE SHEETS
// ========================================
async function syncFromGoogleSheets() {
    if (!usuarioGoogle) {
        showToast('Conecta Google primero', 'warning');
        return;
    }

    try {
        showLoading('Sincronizando datos...');
        
        // Recargar todo
        await loadCategoriesFromSheet();
        await loadProductsFromSheet();
        await loadSidesFromSheet();
        await loadSalesFromSheet();
        
        // Actualizar UI
        renderCategories();
        renderProducts(currentCategory);
        updateStats();
        
        hideLoading();
        showToast('✅ Datos sincronizados: ' + salesHistory.length + ' ventas', 'success');

    } catch (error) {
        hideLoading();
        console.error('Error sincronizando:', error);
        showToast('Error: ' + (error.message || 'No se pudo sincronizar'), 'error');
    }
}

// ========================================
// CONFIGURAR HOJAS
// ========================================
async function setupGoogleSheet() {
    if (!usuarioGoogle) {
        showToast('Conecta Google primero', 'warning');
        return;
    }

    try {
        showLoading('Configurando base de datos...');
        
        const sheet = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        });

        const hojasExistentes = sheet.result.sheets.map(s => s.properties.title);
        const hojasRequeridas = Object.values(SHEETS);
        
        for (const nombreHoja of hojasRequeridas) {
            if (!hojasExistentes.includes(nombreHoja)) {
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: { properties: { title: nombreHoja } }
                        }]
                    }
                });
                console.log('✅ Hoja creada:', nombreHoja);
            }
        }

        const headers = {
            [SHEETS.CATEGORIAS]: ['ID_Categoria', 'Nombre', 'Icono', 'Orden', 'Activo'],
            [SHEETS.PRODUCTOS]: ['ID_Producto', 'Nombre', 'Precio', 'ID_Categoria', 'Tiene_Acompañamiento', 'Activo'],
            [SHEETS.ACOMPAÑAMIENTOS]: ['ID_Acompañamiento', 'Nombre', 'Orden', 'Activo'],
            [SHEETS.VENTAS]: ['ID_Venta', 'Fecha', 'Hora', 'Total', 'Pago_Recibido', 'Cambio', 'Usuario', 'Timestamp'],
            [SHEETS.DETALLE_VENTAS]: ['ID_Detalle', 'ID_Venta', 'ID_Producto', 'Nombre_Producto', 'ID_Acompañamiento', 'Nombre_Acompañamiento', 'Cantidad', 'Precio_Unitario', 'Subtotal', 'ID_Categoria']
        };

        for (const [hoja, cols] of Object.entries(headers)) {
            const colLetra = String.fromCharCode(64 + cols.length);
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: hoja + '!A1:' + colLetra + '1',
                valueInputOption: 'RAW',
                resource: { values: [cols] }
            });
        }

        hideLoading();
        showToast('¡Base de datos configurada!', 'success');
        
    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Error: ' + (e.result?.error?.message || e.message), 'error');
    }
}

// ========================================
// GUARDAR VENTA EN GOOGLE SHEETS
// ========================================
async function saveToGoogleSheets(sale) {
    if (!usuarioGoogle) return false;

    try {
        // 1. Guardar encabezado de venta
        const ventaRow = [[
            sale.orderNumber,
            sale.date,
            sale.time,
            sale.total.toFixed(2),
            sale.received.toFixed(2),
            sale.change.toFixed(2),
            emailUsuario || 'sistema',
            sale.timestamp
        ]];

        await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.VENTAS + '!A:H',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: ventaRow }
        });

        // 2. Guardar detalle de cada item
        const detalleRows = sale.items.map(item => {
            lastDetailId++;
            
            return [
                lastDetailId,
                sale.orderNumber,
                item.id,
                item.name,
                item.sideId || '',
                item.side || '',
                item.quantity,
                item.price.toFixed(2),
                (item.price * item.quantity).toFixed(2),
                item.category
            ];
        });

        if (detalleRows.length > 0) {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: SHEETS.DETALLE_VENTAS + '!A:J',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: detalleRows }
            });
        }

        console.log('✅ Venta #' + sale.orderNumber + ' guardada');
        return true;
        
    } catch (error) {
        console.error('❌ Error guardando:', error);
        return false;
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
        // Actualizar estadísticas al entrar
        updateStats();
    }
}

// ========================================
// CATEGORÍAS Y PRODUCTOS
// ========================================
function renderCategories() {
    var nav = document.getElementById('categoryNav');
    if (!nav) return;

    if (Object.keys(CATEGORIES).length === 0) {
        nav.innerHTML = '<div class="connect-message">No hay categorías. Conecta con Google.</div>';
        return;
    }

    const sortedCategories = Object.entries(CATEGORIES)
        .sort((a, b) => (a[1].order || 99) - (b[1].order || 99));

    var html = '';
    sortedCategories.forEach(([key, cat]) => {
        const isActive = key === currentCategory ? 'active' : '';
        html += '<button class="category-btn ' + isActive + '" onclick="changeCategory(\'' + key + '\')">' +
            '<span class="category-icon">' + cat.icon + '</span>' +
            '<span class="category-text">' + cat.name + '</span>' +
        '</button>';
    });
    
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

    var items = PRODUCTS[category] || [];
    
    if (items.length === 0) {
        grid.innerHTML = '<div class="empty-products"><div class="empty-icon">📦</div><p>No hay productos en esta categoría</p></div>';
        return;
    }

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
    var product = null;
    
    for (var cat in PRODUCTS) {
        for (var i = 0; i < PRODUCTS[cat].length; i++) {
            if (PRODUCTS[cat][i].id === productId) {
                product = PRODUCTS[cat][i];
                break;
            }
        }
        if (product) break;
    }

    if (!product) {
        console.error('Producto no encontrado:', productId);
        return;
    }

    if (product.hasSide && SIDE_OPTIONS.length > 0) {
        showSideModal(product);
    } else {
        addToCart(product, null, null);
    }
}

// ========================================
// MODAL ACOMPAÑAMIENTO
// ========================================
function showSideModal(product) {
    pendingProduct = product;

    var productEl = document.getElementById('sideModalProduct');
    if (productEl) productEl.textContent = product.name + ' - Bs. ' + product.price.toFixed(2);

    var optionsEl = document.getElementById('sideOptions');
    if (optionsEl) {
        var html = '';
        SIDE_OPTIONS.forEach(side => {
            html += '<div class="side-option" onclick="selectSide(' + side.id + ', \'' + side.name.replace(/'/g, "\\'") + '\')">' + 
                side.name + 
            '</div>';
        });
        optionsEl.innerHTML = html;
    }

    document.getElementById('sideModal').classList.add('active');
}

function closeSideModal() {
    document.getElementById('sideModal').classList.remove('active');
    pendingProduct = null;
}

function selectSide(sideId, sideName) {
    if (pendingProduct) {
        addToCart(pendingProduct, sideId, sideName);
        closeSideModal();
    }
}

// ========================================
// CARRITO
// ========================================
function addToCart(product, sideId, sideName) {
    var cartItemId = sideName ? product.id + '-' + sideId : product.id.toString();

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
            sideId: sideId,
            side: sideName,
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

    // Guardar en historial local
    salesHistory.push(sale);
    saveState();

    // Preparar ticket
    prepareTicket(sale);

    // Mostrar modal de éxito
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
    
    // Actualizar estadísticas
    updateStats();
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
// ESTADÍSTICAS - FUNCIONES MATEMÁTICAS
// ========================================
function initDateFilters() {
    var today = new Date();
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');

    if (dateFrom) dateFrom.value = today.toISOString().split('T')[0];
    if (dateTo) dateTo.value = today.toISOString().split('T')[0];
}

function setQuickFilter(filter) {
    var chips = document.querySelectorAll('.chip');
    chips.forEach(function(c) { c.classList.remove('active'); });

    var activeChip = document.querySelector('[data-filter="' + filter + '"]');
    if (activeChip) activeChip.classList.add('active');

    var today = new Date();
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');

    switch (filter) {
        case 'today':
            dateFrom.value = today.toISOString().split('T')[0];
            dateTo.value = today.toISOString().split('T')[0];
            break;
        case 'week':
            var weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFrom.value = weekAgo.toISOString().split('T')[0];
            dateTo.value = today.toISOString().split('T')[0];
            break;
        case 'month':
            var monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFrom.value = monthAgo.toISOString().split('T')[0];
            dateTo.value = today.toISOString().split('T')[0];
            break;
        case 'all':
            dateFrom.value = '2020-01-01';
            dateTo.value = today.toISOString().split('T')[0];
            break;
    }

    updateStats();
}

function applyFilters() {
    var chips = document.querySelectorAll('.chip');
    chips.forEach(function(c) { c.classList.remove('active'); });
    updateStats();
}

function getFilteredSales() {
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');

    if (!dateFrom || !dateTo || !dateFrom.value || !dateTo.value) {
        return salesHistory;
    }

    var from = new Date(dateFrom.value);
    from.setHours(0, 0, 0, 0);
    
    var to = new Date(dateTo.value);
    to.setHours(23, 59, 59, 999);

    return salesHistory.filter(function(sale) {
        var saleDate = new Date(sale.timestamp);
        return saleDate >= from && saleDate <= to;
    });
}

// ========================================
// ACTUALIZAR TODAS LAS ESTADÍSTICAS
// ========================================
function updateStats() {
    console.log('📊 Actualizando estadísticas...');
    console.log('📋 Total ventas en historial:', salesHistory.length);
    
    var filteredSales = getFilteredSales();
    console.log('📋 Ventas filtradas:', filteredSales.length);

    // ========== CALCULAR KPIs ==========
    var totalSales = 0;      // Total en Bs.
    var totalProducts = 0;   // Cantidad de productos vendidos
    var totalOrders = filteredSales.length;  // Número de pedidos

    for (var i = 0; i < filteredSales.length; i++) {
        var sale = filteredSales[i];
        totalSales += sale.total;
        
        // Contar productos
        if (sale.items && sale.items.length > 0) {
            for (var j = 0; j < sale.items.length; j++) {
                totalProducts += sale.items[j].quantity || 1;
            }
        }
    }

    // Ticket promedio
    var avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

    // ========== MOSTRAR KPIs ==========
    var kpiSales = document.getElementById('kpiSales');
    var kpiOrders = document.getElementById('kpiOrders');
    var kpiAvg = document.getElementById('kpiAvg');
    var kpiProducts = document.getElementById('kpiProducts');

    if (kpiSales) kpiSales.textContent = 'Bs. ' + totalSales.toFixed(2);
    if (kpiOrders) kpiOrders.textContent = totalOrders;
    if (kpiAvg) kpiAvg.textContent = 'Bs. ' + avgTicket.toFixed(2);
    if (kpiProducts) kpiProducts.textContent = totalProducts;

    console.log('💰 Ventas totales:', totalSales.toFixed(2));
    console.log('🧾 Pedidos:', totalOrders);
    console.log('📈 Ticket promedio:', avgTicket.toFixed(2));
    console.log('🍗 Productos:', totalProducts);

    // ========== ACTUALIZAR GRÁFICOS Y TABLAS ==========
    updateSalesChart(filteredSales);
    updateCategoryChart(filteredSales);
    updateTopProducts(filteredSales);
    updateSalesHistory(filteredSales);
}

// ========================================
// GRÁFICO DE VENTAS POR DÍA
// ========================================
function updateSalesChart(sales) {
    var canvas = document.getElementById('salesChart');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');

    // Agrupar ventas por día
    var salesByDay = {};
    for (var i = 0; i < sales.length; i++) {
        var date = sales[i].date || 'Sin fecha';
        if (!salesByDay[date]) salesByDay[date] = 0;
        salesByDay[date] += sales[i].total;
    }

    // Ordenar fechas
    var sortedDates = Object.keys(salesByDay).sort(function(a, b) {
        if (!a.includes('/') || !b.includes('/')) return 0;
        var partsA = a.split('/');
        var partsB = b.split('/');
        if (partsA.length === 3 && partsB.length === 3) {
            var dateA = new Date(partsA[2] + '-' + partsA[1].padStart(2,'0') + '-' + partsA[0].padStart(2,'0'));
            var dateB = new Date(partsB[2] + '-' + partsB[1].padStart(2,'0') + '-' + partsB[0].padStart(2,'0'));
            return dateA - dateB;
        }
        return 0;
    });

    var labels = sortedDates.slice(-14); // Últimos 14 días
    var data = labels.map(function(d) { return salesByDay[d] || 0; });

    // Destruir gráfico anterior
    if (salesChart) {
        salesChart.destroy();
        salesChart = null;
    }

    // Crear nuevo gráfico
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Sin datos'],
            datasets: [{
                label: 'Ventas (Bs.)',
                data: data.length > 0 ? data : [0],
                backgroundColor: 'rgba(255, 111, 0, 0.8)',
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        callback: function(value) {
                            return 'Bs. ' + value;
                        }
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ========================================
// GRÁFICO DE VENTAS POR CATEGORÍA
// ========================================
function updateCategoryChart(sales) {
    var canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');

    // Inicializar ventas por categoría
    var salesByCategory = {};
    
    // Usar categorías cargadas o por defecto
    var categoriasActivas = Object.keys(CATEGORIES);
    if (categoriasActivas.length === 0) {
        categoriasActivas = ['milanesas', 'pollos', 'extras', 'bebidas'];
    }
    
    categoriasActivas.forEach(function(cat) {
        salesByCategory[cat] = 0;
    });

    // Sumar ventas por categoría
    for (var i = 0; i < sales.length; i++) {
        var sale = sales[i];
        if (sale.items && sale.items.length > 0) {
            for (var j = 0; j < sale.items.length; j++) {
                var item = sale.items[j];
                var cat = item.category || 'otros';
                if (!salesByCategory[cat]) {
                    salesByCategory[cat] = 0;
                }
                salesByCategory[cat] += (item.price || 0) * (item.quantity || 1);
            }
        }
    }

    // Preparar datos para el gráfico
    var labels = [];
    var data = [];
    var colors = ['#ff6f00', '#ffc107', '#00c853', '#2979ff', '#9c27b0', '#e91e63', '#00bcd4', '#8bc34a'];
    
    Object.keys(salesByCategory).forEach(function(cat, index) {
        var catInfo = CATEGORIES[cat];
        var label = catInfo ? catInfo.icon + ' ' + catInfo.name : cat;
        labels.push(label);
        data.push(salesByCategory[cat]);
    });

    // Destruir gráfico anterior
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }

    // Crear nuevo gráfico
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['Sin datos'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: colors.slice(0, Math.max(labels.length, 1)),
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': Bs. ' + context.raw.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

// ========================================
// TABLA DE PRODUCTOS MÁS VENDIDOS
// ========================================
function updateTopProducts(sales) {
    var tbody = document.getElementById('topProductsBody');
    if (!tbody) return;

    // Agrupar ventas por producto
    var productSales = {};

    for (var i = 0; i < sales.length; i++) {
        var sale = sales[i];
        if (sale.items && sale.items.length > 0) {
            for (var j = 0; j < sale.items.length; j++) {
                var item = sale.items[j];
                var key = item.name || 'Producto';
                
                if (!productSales[key]) {
                    productSales[key] = { 
                        name: item.name || 'Producto', 
                        category: item.category || 'otros', 
                        quantity: 0, 
                        revenue: 0 
                    };
                }
                productSales[key].quantity += item.quantity || 1;
                productSales[key].revenue += (item.price || 0) * (item.quantity || 1);
            }
        }
    }

    // Ordenar por cantidad vendida
    var sorted = Object.values(productSales)
        .sort(function(a, b) { return b.quantity - a.quantity; })
        .slice(0, 10); // Top 10

    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">📊 No hay datos disponibles</td></tr>';
        return;
    }

    var html = '';
    for (var k = 0; k < sorted.length; k++) {
        var product = sorted[k];
        var cat = CATEGORIES[product.category];
        var catDisplay = cat ? cat.icon + ' ' + cat.name : (product.category || 'Otros');
        
        // Clase para ranking
        var rankClass = 'rank-default';
        if (k === 0) rankClass = 'rank-1';
        else if (k === 1) rankClass = 'rank-2';
        else if (k === 2) rankClass = 'rank-3';

        html += '<tr>' +
            '<td><span class="rank-badge ' + rankClass + '">' + (k + 1) + '</span></td>' +
            '<td><strong>' + product.name + '</strong></td>' +
            '<td>' + catDisplay + '</td>' +
            '<td><strong>' + product.quantity + '</strong></td>' +
            '<td><strong>Bs. ' + product.revenue.toFixed(2) + '</strong></td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
}

// ========================================
// TABLA DE HISTORIAL DE VENTAS
// ========================================
function updateSalesHistory(sales) {
    var tbody = document.getElementById('salesHistoryBody');
    if (!tbody) return;

    if (sales.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">🧾 No hay ventas registradas</td></tr>';
        return;
    }

    // Ordenar por fecha más reciente
    var sorted = sales.slice().sort(function(a, b) { 
        return new Date(b.timestamp) - new Date(a.timestamp); 
    });

    var html = '';
    var limit = Math.min(sorted.length, 50); // Máximo 50 registros
    
    for (var i = 0; i < limit; i++) {
        var sale = sorted[i];
        
        // Contar items
        var itemCount = 0;
        if (sale.items && sale.items.length > 0) {
            for (var j = 0; j < sale.items.length; j++) {
                itemCount += sale.items[j].quantity || 1;
            }
        }
        
        html += '<tr>' +
            '<td><strong>#' + (sale.orderNumber || 0).toString().padStart(4, '0') + '</strong></td>' +
            '<td>' + (sale.date || '-') + '</td>' +
            '<td>' + (sale.time || '-') + '</td>' +
            '<td>' + itemCount + ' items</td>' +
            '<td><strong>Bs. ' + (sale.total || 0).toFixed(2) + '</strong></td>' +
            '<td>Bs. ' + (sale.received || 0).toFixed(2) + '</td>' +
            '<td>Bs. ' + (sale.change || 0).toFixed(2) + '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
}

// ========================================
// EXPORTAR A CSV
// ========================================
function exportToCSV() {
    var filteredSales = getFilteredSales();

    if (filteredSales.length === 0) {
        showToast('No hay datos para exportar', 'warning');
        return;
    }

    var csv = 'Pedido,Fecha,Hora,Productos,Total,Recibido,Cambio\n';

    for (var i = 0; i < filteredSales.length; i++) {
        var sale = filteredSales[i];
        var items = '';
        
        if (sale.items && sale.items.length > 0) {
            items = sale.items.map(function(item) {
                return item.name + (item.side ? ' + ' + item.side : '') + ' x' + item.quantity;
            }).join('; ');
        }
        
        csv += sale.orderNumber + ',' + 
               sale.date + ',' + 
               sale.time + ',"' + 
               items + '",' + 
               sale.total.toFixed(2) + ',' + 
               (sale.received || 0).toFixed(2) + ',' + 
               (sale.change || 0).toFixed(2) + '\n';
    }

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ventas_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('CSV descargado con ' + filteredSales.length + ' ventas', 'success');
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
    
    var savedDetailId = localStorage.getItem('pos_lastDetailId');
    if (savedDetailId) lastDetailId = parseInt(savedDetailId);
}

function saveState() {
    localStorage.setItem('pos_orderNumber', orderNumber);
    localStorage.setItem('pos_salesHistory', JSON.stringify(salesHistory));
    localStorage.setItem('pos_lastDetailId', lastDetailId);
}

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🍗 Iniciando Sistema POS v2.1...');
    
    loadState();
    updateCart();
    updateOrderNumber();
    initDateFilters();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Actualizar estadísticas con datos locales
    updateStats();

    console.log('✅ Sistema POS inicializado');
    console.log('📋 Ventas en localStorage:', salesHistory.length);
});
