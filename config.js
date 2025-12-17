// ========================================
// ARCHIVO DE CONFIGURACIÓN - Sistema POS v2.0
// ========================================

const CONFIG = {
    // ID de tu Google Sheet
    GOOGLE_SHEET_ID: '1AmFocVwvywXz6LOwggkFscXjEhx_FZvZCVmb-1ihm5I',
    
    // Credenciales de Google API
    CLIENT_ID: '488089624210-ns62tr4g9rqov3k2b85965c4p4fto028.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDsIk-N9hDAzZN7vc9b2rUIhcA7D8ViOFk',
    
    // ========================================
    // NOMBRES DE LAS 5 HOJAS
    // IMPORTANTE: Deben coincidir EXACTAMENTE con los nombres en tu Google Sheet
    // ========================================
    SHEETS: {
        CATEGORIAS: 'Categorias',
        PRODUCTOS: 'Productos', 
        ACOMPAÑAMIENTOS: 'Acompañamientos',
        VENTAS: 'Ventas',
        DETALLE_VENTAS: 'Detalle_Ventas'
    }
};
