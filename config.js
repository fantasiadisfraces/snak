// ========================================
// ARCHIVO DE CONFIGURACIÓN - Sistema POS Reestructurado
// Versión 2.0 - Base de Datos Normalizada
// ========================================

const CONFIG = {
    // ID de tu Google Sheet (lo encuentras en la URL de tu hoja)
    // Ejemplo: https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
    GOOGLE_SHEET_ID: '1AmFocVwvywXz6LOwggkFscXjEhx_FZvZCVmb-1ihm5I',
    
    // Credenciales de Google API
    CLIENT_ID: '488089624210-ns62tr4g9rqov3k2b85965c4p4fto028.apps.googleusercontent.com',
    API_KEY: 'AIzaSyDsIk-N9hDAzZN7vc9b2rUIhcA7D8ViOFk',
    
    // ========================================
    // NOMBRES DE LAS 5 HOJAS (Base de Datos)
    // ========================================
    SHEETS: {
        CATEGORIAS: 'Categorias',
        PRODUCTOS: 'Productos',
        ACOMPAÑAMIENTOS: 'Acompañamientos',
        VENTAS: 'Ventas',
        DETALLE_VENTAS: 'Detalle_Ventas'
    },
    
    // ========================================
    // CONFIGURACIÓN DE COLUMNAS POR HOJA
    // (Para referencia y validación)
    // ========================================
    COLUMNS: {
        CATEGORIAS: ['ID_Categoria', 'Nombre', 'Icono', 'Orden', 'Activo'],
        PRODUCTOS: ['ID_Producto', 'Nombre', 'Precio', 'ID_Categoria', 'Tiene_Acompañamiento', 'Activo'],
        ACOMPAÑAMIENTOS: ['ID_Acompañamiento', 'Nombre', 'Orden', 'Activo'],
        VENTAS: ['ID_Venta', 'Fecha', 'Hora', 'Total', 'Pago_Recibido', 'Cambio', 'Usuario', 'Timestamp'],
        DETALLE_VENTAS: ['ID_Detalle', 'ID_Venta', 'ID_Producto', 'Nombre_Producto', 'ID_Acompañamiento', 'Nombre_Acompañamiento', 'Cantidad', 'Precio_Unitario', 'Subtotal', 'ID_Categoria']
    },
    
    // ========================================
    // CONFIGURACIÓN ADICIONAL
    // ========================================
    MONEDA: 'Bs.',
    FORMATO_FECHA: 'es-BO',
    
    // Nombre del negocio (para tickets)
    NEGOCIO: {
        NOMBRE: 'MILANESAS & POLLO',
        SUBTITULO: 'A LA BARBACOA',
        LOGO: '🍗',
        MENSAJE_TICKET: '¡GRACIAS POR SU COMPRA!'
    }
};
