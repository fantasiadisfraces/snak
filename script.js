// ========================================
// SISTEMA POS - Versión 2.0
// Base de Datos Normalizada con Google Sheets
// ========================================

// ========================================
// GOOGLE CONFIG (desde config.js)
// ========================================
const CLIENT_ID = CONFIG.CLIENT_ID;
const API_KEY = CONFIG.API_KEY;
const SPREADSHEET_ID = CONFIG.GOOGLE_SHEET_ID;
const SHEETS = CONFIG.SHEETS;
const COLUMNS = CONFIG.COLUMNS;

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

// Datos por defecto (usados si no hay conexión a Google)
const DEFAULT_CATEGORIES = {
    milanesas: { name: 'Milanesas', icon: '🥩', order: 1 },
    pollos: { name: 'Pollos', icon: '🍗', order: 2 },
    extras: { name: 'Extras', icon: '🍟', order: 3 },
    bebidas: { name: 'Bebidas', icon: '🥤', order: 4 }
};

const DEFAULT_PRODUCTS = {
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

const DEFAULT_SIDES = ['Arroz Blanco', 'Fideo al Pesto', 'Puré de Papa', 'Ensalada Mixta'];

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
        loadDefaultData();
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
            loadDefaultData();
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
    loadDataFromSheets();
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
        loadDataFromSheets();
        console.log('✅ Token válido');
    } catch (e) {
        console.log('⚠️ Token expirado');
        logoutGoogle();
        loadDefaultData();
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
// CARGAR DATOS POR DEFECTO
// ========================================
function loadDefaultData() {
    CATEGORIES = DEFAULT_CATEGORIES;
    PRODUCTS = DEFAULT_PRODUCTS;
    SIDE_OPTIONS = DEFAULT_SIDES;
    dataLoaded = true;
    
    currentCategory = Object.keys(CATEGORIES)[0] || 'milanesas';
    renderCategories();
    renderProducts(currentCategory);
    console.log('📦 Datos por defecto cargados');
}

// ========================================
// CARGAR DATOS DESDE GOOGLE SHEETS
// ========================================
async function loadDataFromSheets() {
    if (!usuarioGoogle) {
        loadDefaultData();
        return;
    }

    try {
        showLoading('Cargando menú...');
        
        // Cargar categorías
        await loadCategoriesFromSheet();
        
        // Cargar productos
        await loadProductsFromSheet();
        
        // Cargar acompañamientos
        await loadSidesFromSheet();
        
        // Cargar último número de pedido
        await loadLastOrderNumber();
        
        dataLoaded = true;
        currentCategory = Object.keys(CATEGORIES)[0] || 'milanesas';
        
        renderCategories();
        renderProducts(currentCategory);
        
        hideLoading();
        console.log('✅ Datos cargados desde Google Sheets');
        
    } catch (e) {
        console.error('Error cargando datos:', e);
        hideLoading();
        loadDefaultData();
        showToast('Usando datos locales', 'warning');
    }
}

async function loadCategoriesFromSheet() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.CATEGORIAS + '!A2:E100'
        });
        
        const rows = response.result.values || [];
        CATEGORIES = {};
        
        rows.forEach(row => {
            const activo = (row[4] || 'TRUE').toString().toUpperCase() === 'TRUE';
            if (activo && row[0]) {
                CATEGORIES[row[0]] = {
                    name: row[1] || row[0],
                    icon: row[2] || '📦',
                    order: parseInt(row[3]) || 99
                };
            }
        });
        
        // Si no hay categorías, usar las por defecto
        if (Object.keys(CATEGORIES).length === 0) {
            CATEGORIES = DEFAULT_CATEGORIES;
        }
        
    } catch (e) {
        console.log('Usando categorías por defecto');
        CATEGORIES = DEFAULT_CATEGORIES;
    }
}

async function loadProductsFromSheet() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PRODUCTOS + '!A2:F200'
        });
        
        const rows = response.result.values || [];
        PRODUCTS = {};
        
        // Inicializar categorías vacías
        Object.keys(CATEGORIES).forEach(cat => {
            PRODUCTS[cat] = [];
        });
        
        rows.forEach(row => {
            const activo = (row[5] || 'TRUE').toString().toUpperCase() === 'TRUE';
            if (activo && row[0] && row[1]) {
                const category = row[3] || 'extras';
                const hasSide = (row[4] || 'FALSE').toString().toUpperCase() === 'TRUE';
                
                if (!PRODUCTS[category]) {
                    PRODUCTS[category] = [];
                }
                
                PRODUCTS[category].push({
                    id: parseInt(row[0]) || 0,
                    name: row[1],
                    price: parseFloat(row[2]) || 0,
                    hasSide: hasSide,
                    category: category
                });
            }
        });
        
        // Si no hay productos, usar los por defecto
        let hasProducts = false;
        Object.values(PRODUCTS).forEach(arr => {
            if (arr.length > 0) hasProducts = true;
        });
        
        if (!hasProducts) {
            PRODUCTS = DEFAULT_PRODUCTS;
        }
        
    } catch (e) {
        console.log('Usando productos por defecto');
        PRODUCTS = DEFAULT_PRODUCTS;
    }
}

async function loadSidesFromSheet() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.ACOMPAÑAMIENTOS + '!A2:D50'
        });
        
        const rows = response.result.values || [];
        SIDE_OPTIONS = [];
        
        rows.forEach(row => {
            const activo = (row[3] || 'TRUE').toString().toUpperCase() === 'TRUE';
            if (activo && row[1]) {
                SIDE_OPTIONS.push({
                    id: parseInt(row[0]) || 0,
                    name: row[1],
                    order: parseInt(row[2]) || 99
                });
            }
        });
        
        // Ordenar por orden
        SIDE_OPTIONS.sort((a, b) => a.order - b.order);
        
        // Si no hay acompañamientos, usar los por defecto
        if (SIDE_OPTIONS.length === 0) {
            SIDE_OPTIONS = DEFAULT_SIDES.map((name, i) => ({
                id: i + 1,
                name: name,
                order: i + 1
            }));
        }
        
    } catch (e) {
        console.log('Usando acompañamientos por defecto');
        SIDE_OPTIONS = DEFAULT_SIDES.map((name, i) => ({
            id: i + 1,
            name: name,
            order: i + 1
        }));
    }
}

async function loadLastOrderNumber() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.VENTAS + '!A2:A10000'
        });
        
        const rows = response.result.values || [];
        if (rows.length > 0) {
            const numbers = rows.map(r => parseInt(r[0]) || 0);
            orderNumber = Math.max(...numbers) + 1;
        }
        
        // También obtener el último ID de detalle
        const detailResponse = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.DETALLE_VENTAS + '!A2:A50000'
        });
        
        const detailRows = detailResponse.result.values || [];
        if (detailRows.length > 0) {
            const detailNumbers = detailRows.map(r => parseInt(r[0]) || 0);
            lastDetailId = Math.max(...detailNumbers);
        }
        
        updateOrderNumber();
        
    } catch (e) {
        console.log('Usando número de orden local');
    }
}

// ========================================
// CONFIGURAR HOJAS EN GOOGLE SHEETS
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

        const hojas = sheet.result.sheets.map(s => s.properties.title);
        const sheetNames = Object.values(SHEETS);
        
        // Crear hojas que no existen
        for (const sheetName of sheetNames) {
            if (!hojas.includes(sheetName)) {
                await gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: { properties: { title: sheetName } }
                        }]
                    }
                });
                console.log('✅ Hoja creada:', sheetName);
            }
        }

        // Configurar encabezados de cada hoja
        await setupSheetHeaders(SHEETS.CATEGORIAS, COLUMNS.CATEGORIAS);
        await setupSheetHeaders(SHEETS.PRODUCTOS, COLUMNS.PRODUCTOS);
        await setupSheetHeaders(SHEETS.ACOMPAÑAMIENTOS, COLUMNS.ACOMPAÑAMIENTOS);
        await setupSheetHeaders(SHEETS.VENTAS, COLUMNS.VENTAS);
        await setupSheetHeaders(SHEETS.DETALLE_VENTAS, COLUMNS.DETALLE_VENTAS);
        
        // Cargar datos iniciales si las hojas están vacías
        await loadInitialData();

        hideLoading();
        showToast('¡Base de datos configurada!', 'success');
        
        // Recargar datos
        await loadDataFromSheets();
        
    } catch (e) {
        hideLoading();
        console.error(e);
        showToast('Error: ' + (e.result?.error?.message || e.message), 'error');
    }
}

async function setupSheetHeaders(sheetName, columns) {
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: sheetName + '!A1:' + String.fromCharCode(64 + columns.length) + '1',
        valueInputOption: 'RAW',
        resource: {
            values: [columns]
        }
    });
}

async function loadInitialData() {
    // Verificar si Categorias tiene datos
    const catResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.CATEGORIAS + '!A2:A3'
    });
    
    if (!catResponse.result.values || catResponse.result.values.length === 0) {
        // Cargar categorías por defecto
        const catData = Object.entries(DEFAULT_CATEGORIES).map(([id, cat], i) => [
            id, cat.name, cat.icon, cat.order || (i + 1), 'TRUE'
        ]);
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.CATEGORIAS + '!A2:E' + (catData.length + 1),
            valueInputOption: 'RAW',
            resource: { values: catData }
        });
        console.log('✅ Categorías iniciales cargadas');
    }
    
    // Verificar si Productos tiene datos
    const prodResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.PRODUCTOS + '!A2:A3'
    });
    
    if (!prodResponse.result.values || prodResponse.result.values.length === 0) {
        // Cargar productos por defecto
        const prodData = [];
        Object.values(DEFAULT_PRODUCTS).forEach(products => {
            products.forEach(p => {
                prodData.push([p.id, p.name, p.price, p.category, p.hasSide ? 'TRUE' : 'FALSE', 'TRUE']);
            });
        });
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.PRODUCTOS + '!A2:F' + (prodData.length + 1),
            valueInputOption: 'RAW',
            resource: { values: prodData }
        });
        console.log('✅ Productos iniciales cargados');
    }
    
    // Verificar si Acompañamientos tiene datos
    const sideResponse = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: SHEETS.ACOMPAÑAMIENTOS + '!A2:A3'
    });
    
    if (!sideResponse.result.values || sideResponse.result.values.length === 0) {
        // Cargar acompañamientos por defecto
        const sideData = DEFAULT_SIDES.map((name, i) => [i + 1, name, i + 1, 'TRUE']);
        
        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: SHEETS.ACOMPAÑAMIENTOS + '!A2:D' + (sideData.length + 1),
            valueInputOption: 'RAW',
            resource: { values: sideData }
        });
        console.log('✅ Acompañamientos iniciales cargados');
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
            const sideObj = item.sideId ? SIDE_OPTIONS.find(s => s.id === item.sideId) : null;
            
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

        console.log('✅ Venta guardada en Google Sheets');
        return true;
    } catch (error) {
        console.error('❌ Error guardando:', error);
        return false;
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

        if (ventasRows.length === 0) {
            hideLoading();
            showToast('No hay ventas registradas', 'warning');
            return;
        }

        // Crear mapa de detalles por ID_Venta
        const detallesPorVenta = {};
        detalleRows.forEach(row => {
            const idVenta = parseInt(row[1]) || 0;
            if (!detallesPorVenta[idVenta]) {
                detallesPorVenta[idVenta] = [];
            }
            detallesPorVenta[idVenta].push({
                id: parseInt(row[2]) || 0,
                name: row[3] || '',
                sideId: row[4] ? parseInt(row[4]) : null,
                side: row[5] || null,
                quantity: parseInt(row[6]) || 1,
                price: parseFloat(row[7]) || 0,
                category: row[9] || 'otros'
            });
        });

        // Construir historial de ventas
        salesHistory = ventasRows.map(row => {
            const idVenta = parseInt(row[0]) || 0;
            
            let timestamp = new Date();
            if (row[7]) {
                timestamp = new Date(row[7]);
            } else if (row[1] && row[1].includes('/')) {
                const parts = row[1].split('/');
                if (parts.length === 3) {
                    timestamp = new Date(parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0') + 'T' + (row[2] || '00:00:00'));
                }
            }

            return {
                orderNumber: idVenta,
                date: row[1] || '',
                time: row[2] || '',
                total: parseFloat(row[3]) || 0,
                received: parseFloat(row[4]) || 0,
                change: parseFloat(row[5]) || 0,
                items: detallesPorVenta[idVenta] || [],
                timestamp: timestamp.toISOString()
            };
        }).filter(sale => sale.orderNumber > 0);

        // Actualizar número de orden
        if (salesHistory.length > 0) {
            const maxOrder = Math.max(...salesHistory.map(s => s.orderNumber));
            orderNumber = maxOrder + 1;
            updateOrderNumber();
        }

        // Actualizar último ID de detalle
        if (detalleRows.length > 0) {
            const maxDetail = Math.max(...detalleRows.map(r => parseInt(r[0]) || 0));
            lastDetailId = maxDetail;
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

    // Ordenar categorías
    const sortedCategories = Object.entries(CATEGORIES)
        .sort((a, b) => (a[1].order || 99) - (b[1].order || 99));

    var html = '';
    sortedCategories.forEach(([key, cat]) => {
        html += '<button class="category-btn ' + (key === currentCategory ? 'active' : '') + '" onclick="changeCategory(\'' + key + '\')">' +
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
    var html = '';

    for (var i = 0; i < items.length; i++) {
        var product = items[i];
        html += '<div class="product-card" onclick="handleProductClick(' + product.id + ')">' +
            '<div class="product-name">' + product.name + '</div>' +
            '<div class="product-price">' + CONFIG.MONEDA + ' ' + product.price.toFixed(2) + '</div>' +
        '</div>';
    }

    grid.innerHTML = html || '<div class="empty-products">No hay productos en esta categoría</div>';
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
        addToCart(product, null, null);
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
        SIDE_OPTIONS.forEach(side => {
            const sideName = typeof side === 'object' ? side.name : side;
            const sideId = typeof side === 'object' ? side.id : null;
            html += '<div class="side-option" onclick="selectSide(' + (sideId || 'null') + ', \'' + sideName + '\')">' + sideName + '</div>';
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
    var cartItemId = sideName ? product.id + '-' + sideName : product.id.toString();

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
                    '<div class="cart-item-price">' + CONFIG.MONEDA + ' ' + item.price.toFixed(2) + ' c/u</div>' +
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

    document.getElementById('subtotal').textContent = CONFIG.MONEDA + ' ' + total.toFixed(2);
    document.getElementById('total').textContent = CONFIG.MONEDA + ' ' + total.toFixed(2);
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
    document.getElementById('paymentTotal').textContent = CONFIG.MONEDA + ' ' + total.toFixed(2);
    document.getElementById('amountReceived').value = '';
    document.getElementById('changeAmount').textContent = CONFIG.MONEDA + ' 0.00';
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
        changeAmount.textContent = 'Falta: ' + CONFIG.MONEDA + ' ' + Math.abs(change).toFixed(2);
        btnConfirm.disabled = true;
    } else {
        changeDisplay.classList.remove('insufficient');
        changeAmount.textContent = CONFIG.MONEDA + ' ' + change.toFixed(2);
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
        date: now.toLocaleDateString(CONFIG.FORMATO_FECHA),
        time: now.toLocaleTimeString(CONFIG.FORMATO_FECHA)
    };

    salesHistory.push(sale);
    saveState();

    prepareTicket(sale);

    document.getElementById('successTotal').textContent = CONFIG.MONEDA + ' ' + total.toFixed(2);
    document.getElementById('successReceived').textContent = CONFIG.MONEDA + ' ' + paymentInfo.received.toFixed(2);
    document.getElementById('successChange').textContent = CONFIG.MONEDA + ' ' + paymentInfo.change.toFixed(2);

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
                '<span>' + CONFIG.MONEDA + ' ' + (item.price * item.quantity).toFixed(2) + '</span>' +
            '</div>' +
            (item.side ? '<div class="ticket-item-side">+ ' + item.side + '</div>' : '') +
        '</div>';
    }
    document.getElementById('ticketItems').innerHTML = html;

    document.getElementById('ticketTotal').textContent = CONFIG.MONEDA + ' ' + sale.total.toFixed(2);
    document.getElementById('ticketReceived').textContent = CONFIG.MONEDA + ' ' + sale.received.toFixed(2);
    document.getElementById('ticketChange').textContent = CONFIG.MONEDA + ' ' + sale.change.toFixed(2);
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

    if (!dateFrom || !dateTo) return salesHistory;

    var from = new Date(dateFrom.value);
    var to = new Date(dateTo.value);
    to.setHours(23, 59, 59, 999);

    return salesHistory.filter(function(sale) {
        var saleDate = new Date(sale.timestamp);
        return saleDate >= from && saleDate <= to;
    });
}

function updateStats() {
    var filteredSales = getFilteredSales();

    // KPIs
    var totalSales = 0;
    var totalProducts = 0;

    for (var i = 0; i < filteredSales.length; i++) {
        totalSales += filteredSales[i].total;
        for (var j = 0; j < filteredSales[i].items.length; j++) {
            totalProducts += filteredSales[i].items[j].quantity;
        }
    }

    var avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

    var kpiSales = document.getElementById('kpiSales');
    var kpiOrders = document.getElementById('kpiOrders');
    var kpiAvg = document.getElementById('kpiAvg');
    var kpiProducts = document.getElementById('kpiProducts');

    if (kpiSales) kpiSales.textContent = CONFIG.MONEDA + ' ' + totalSales.toFixed(2);
    if (kpiOrders) kpiOrders.textContent = filteredSales.length;
    if (kpiAvg) kpiAvg.textContent = CONFIG.MONEDA + ' ' + avgTicket.toFixed(2);
    if (kpiProducts) kpiProducts.textContent = totalProducts;

    // Gráficos y tablas
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

    var sortedDates = Object.keys(salesByDay).sort(function(a, b) {
        var partsA = a.split('/');
        var partsB = b.split('/');
        var dateA = new Date(partsA[2] + '-' + partsA[1] + '-' + partsA[0]);
        var dateB = new Date(partsB[2] + '-' + partsB[1] + '-' + partsB[0]);
        return dateA - dateB;
    });

    var labels = sortedDates.slice(-14);
    var data = labels.map(function(d) { return salesByDay[d] || 0; });

    if (salesChart) salesChart.destroy();

    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas (' + CONFIG.MONEDA + ')',
                data: data,
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
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateCategoryChart(sales) {
    var canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');

    var salesByCategory = {};
    Object.keys(CATEGORIES).forEach(cat => {
        salesByCategory[cat] = 0;
    });

    for (var i = 0; i < sales.length; i++) {
        for (var j = 0; j < sales[i].items.length; j++) {
            var item = sales[i].items[j];
            if (salesByCategory.hasOwnProperty(item.category)) {
                salesByCategory[item.category] += item.price * item.quantity;
            }
        }
    }

    var labels = Object.keys(CATEGORIES).map(cat => CATEGORIES[cat].icon + ' ' + CATEGORIES[cat].name);
    var data = Object.keys(CATEGORIES).map(cat => salesByCategory[cat] || 0);

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#ff6f00', '#ffc107', '#00c853', '#2979ff', '#9c27b0', '#e91e63'],
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

        html += '<tr><td><span class="rank-badge ' + rankClass + '">' + (k + 1) + '</span></td><td><strong>' + product.name + '</strong></td><td>' + catDisplay + '</td><td>' + product.quantity + '</td><td><strong>' + CONFIG.MONEDA + ' ' + product.revenue.toFixed(2) + '</strong></td></tr>';
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
        html += '<tr><td><strong>#' + sale.orderNumber.toString().padStart(4, '0') + '</strong></td><td>' + sale.date + '</td><td>' + sale.time + '</td><td>' + itemCount + ' items</td><td><strong>' + CONFIG.MONEDA + ' ' + sale.total.toFixed(2) + '</strong></td><td>' + CONFIG.MONEDA + ' ' + (sale.received || 0).toFixed(2) + '</td><td>' + CONFIG.MONEDA + ' ' + (sale.change || 0).toFixed(2) + '</td></tr>';
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
        datetimeEl.textContent = now.toLocaleDateString(CONFIG.FORMATO_FECHA, options);
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
    loadState();
    loadDefaultData(); // Cargar datos por defecto inicialmente
    updateCart();
    updateOrderNumber();
    initDateFilters();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    updateStats();

    console.log('🍗 Sistema POS v2.0 inicializado');
});
