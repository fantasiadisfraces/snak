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
        checkReady();
    } catch (e) {
        console.error(e);
        alert('Error inicializando Google API');
    }
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse
    });
    gisInited = true;
    checkReady();
}

function checkReady() {
    if (gapiInited && gisInited) {
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
        showToast('Google API cargando...', 'warning');
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
        showToast('Error de autenticación Google', 'error');
        return;
    }

    gapi.client.setToken(resp);
    localStorage.setItem('pos_google_token', resp.access_token);
    usuarioGoogle = true;

    updateGoogleStatus(true);
    obtenerEmailUsuario();
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
    } catch {
        logoutGoogle();
    }
}

async function obtenerEmailUsuario() {
    try {
        const res = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            {
                headers: {
                    Authorization:
                        'Bearer ' + gapi.client.getToken().access_token
                }
            }
        );
        const data = await res.json();
        emailUsuario = data.email || '';
        document.getElementById('userEmail').textContent =
            emailUsuario ? '👤 ' + emailUsuario : '';
    } catch (e) {
        console.error(e);
    }
}

// ========================================
// GOOGLE SHEETS
// ========================================
async function verificarHojaVentas() {
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

        await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:L1`,
            valueInputOption: 'RAW',
            resource: {
                values: [[
                    'Pedido','Fecha','Hora','Productos','Acompañamientos',
                    'Cantidades','Categorias','Subtotales',
                    'Total','Recibido','Cambio','Usuario'
                ]]
            }
        });
    }
}

async function saveToGoogleSheets(sale) {
    if (!usuarioGoogle) return false;

    try {
        await verificarHojaVentas();

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
            range: `${SHEET_NAME}!A:L`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: row }
        });

        return true;
    } catch (error) {
        console.error(error);
        showToast(
            error.result?.error?.message ||
            error.message ||
            'Error al guardar en Sheets',
            'error'
        );
        return false;
    }
}

// ========================================
// UI HELPERS
// ========================================
function updateGoogleStatus(ok) {
    document.getElementById('statusDot').classList.toggle('connected', ok);
    document.getElementById('statusText').textContent =
        ok ? 'Conectado' : 'Desconectado';
    document.getElementById('btnGoogleText').textContent =
        ok ? 'Desconectar' : 'Conectar';
}

function showToast(msg, type = 'info') {
    alert(msg); // simple y estable (puedes mejorar luego)
}

// ========================================
// APP INIT
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ POS listo');
});
