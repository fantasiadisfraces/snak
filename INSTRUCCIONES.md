# 📋 INSTRUCCIONES DE CONFIGURACIÓN - Sistema de Caja con Google Sheets

## 📁 Archivos del Sistema

El sistema consta de 2 archivos que deben estar en la misma carpeta:

```
📂 sistema-caja/
├── 📄 index.html      (El sistema principal)
└── 📄 config.js       (Configuración de Google)
```

---

## 🔧 CONFIGURACIÓN DE GOOGLE SHEETS

### Paso 1: Preparar tu Hoja de Google Sheets

1. **Abre tu Google Sheet** con el ID: `1AmFocVwvywXz6LOwggkFscXjEhx_FZvZCVmb-1ihm5I`
   - URL: https://docs.google.com/spreadsheets/d/1AmFocVwvywXz6LOwggkFscXjEhx_FZvZCVmb-1ihm5I

2. **Crea una hoja llamada "Ventas"** (exactamente así, con V mayúscula)
   - Click derecho en la pestaña de hoja abajo → "Cambiar nombre" → escribir: `Ventas`
   - O si es hoja nueva: click en el "+" abajo → renombrar a `Ventas`

3. **Configura los encabezados** en la fila 1 (el sistema lo hace automático, pero si quieres hacerlo manual):

| Columna | Encabezado | Descripción |
|---------|------------|-------------|
| A | ID_Pedido | Número de pedido |
| B | Fecha | Fecha de la venta (DD/MM/YYYY) |
| C | Hora | Hora de la venta (HH:MM:SS) |
| D | Productos | Lista de productos vendidos |
| E | Acompañamientos | Guarniciones seleccionadas |
| F | Cantidades | Cantidad de cada producto |
| G | Categorias | Categoría de cada producto |
| H | Subtotales | Subtotal por producto |
| I | Total | Total de la venta |
| J | Pago_Recibido | Dinero que dio el cliente |
| K | Cambio | Vuelto entregado |

### Paso 2: Configurar Permisos de la Hoja

1. En tu Google Sheet, click en **"Compartir"** (botón verde arriba a la derecha)
2. Asegúrate de que la configuración de acceso permita edición
3. **IMPORTANTE**: La hoja debe estar accesible para la cuenta de Google que usarás

---

## 🖥️ USO DEL SISTEMA

### Primera Vez

1. **Abre el archivo `index.html`** en tu navegador (Chrome recomendado)
2. Verás el indicador **"Desconectado"** en rojo arriba a la derecha
3. Click en **"Conectar Google"**
4. Se abrirá una ventana de Google - **inicia sesión con tu cuenta**
5. **Autoriza los permisos** que solicita (acceso a Google Sheets)
6. El indicador cambiará a **"Conectado"** en verde
7. El sistema **creará automáticamente los encabezados** si no existen

### Realizar una Venta

1. **Selecciona productos** haciendo click en ellos
2. Si el producto tiene acompañamiento, **elige la guarnición**
3. Ajusta **cantidades** con los botones + y -
4. Click en **"💰 Cobrar Pedido"**
5. **Ingresa el dinero recibido** del cliente
6. El sistema calcula el **cambio automáticamente**
7. Click en **"✅ Confirmar Pago"**
8. El pedido se guarda en **Google Sheets** y **localmente**
9. Puedes **imprimir el ticket** si lo deseas

### Ver Estadísticas

1. Click en **"📊 Estadísticas"**
2. Usa los **filtros de fecha** para ver períodos específicos
3. Los **gráficos se actualizan automáticamente**
4. Puedes **sincronizar desde Google Sheets** para obtener datos de otros dispositivos
5. **Exporta a CSV** para análisis en Excel

---

## 📊 ESTRUCTURA DE DATOS EN GOOGLE SHEETS

Así se verá tu hoja después de algunas ventas:

| ID_Pedido | Fecha | Hora | Productos | Acompañamientos | Cantidades | Categorias | Subtotales | Total | Pago_Recibido | Cambio |
|-----------|-------|------|-----------|-----------------|------------|------------|------------|-------|---------------|--------|
| 1 | 16/12/2025 | 14:30:25 | Milanesa de Pollo, Coca Cola 500ml | Arroz Blanco, - | 2, 1 | milanesas, bebidas | 70.00, 8.00 | 78.00 | 100.00 | 22.00 |
| 2 | 16/12/2025 | 15:15:00 | Pollo Barbacoa 1/2, Papas Fritas Extra | Ensalada, - | 1, 2 | pollos, extras | 55.00, 30.00 | 85.00 | 100.00 | 15.00 |

---

## 🔄 SINCRONIZACIÓN

### Automática
- Cada venta se guarda **inmediatamente** en Google Sheets
- También se guarda **localmente** como respaldo

### Manual
- En "Estadísticas" → click en **"🔄 Sincronizar desde Google"**
- Esto descarga TODAS las ventas de Google Sheets
- Útil si usas el sistema en **múltiples dispositivos**

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

### "Error al conectar con Google"
- Verifica tu conexión a internet
- Asegúrate de usar **Chrome o Edge** (Firefox puede tener problemas)
- Limpia la caché del navegador y reintenta

### "Error guardando en Google"
- Verifica que la hoja "Ventas" exista
- Comprueba que tienes **permisos de edición** en la hoja
- Reconecta tu cuenta de Google

### "No se muestran las ventas"
- Click en **"🔄 Sincronizar desde Google"**
- Verifica los **filtros de fecha**
- Cambia el filtro a **"Todo"** para ver todas las ventas

### El cambio no se calcula
- Ingresa un **número válido** en el campo de pago
- El monto debe ser **mayor o igual** al total

---

## 📱 COMPATIBILIDAD

✅ **Funciona en:**
- Google Chrome (recomendado)
- Microsoft Edge
- Safari (Mac/iOS)
- Navegadores móviles modernos

❌ **Puede tener problemas en:**
- Firefox (algunas versiones)
- Internet Explorer (no soportado)

---

## 💡 TIPS ÚTILES

1. **Mantén Chrome abierto** - La conexión de Google se mantiene mientras no cierres el navegador
2. **Usa filtros rápidos** - "Hoy", "Esta Semana", "Este Mes" para análisis rápido
3. **Exporta regularmente** - El CSV sirve como respaldo adicional
4. **Revisa la hoja de Google** - Puedes hacer análisis adicionales directamente en Sheets
5. **Usa el botón "Exacto"** - Para pagos sin cambio, es más rápido

---

## 📞 SOPORTE

Si tienes problemas con la configuración:
1. Verifica que ambos archivos (index.html y config.js) estén en la misma carpeta
2. Asegúrate de que el ID de la hoja en config.js sea correcto
3. Comprueba que las credenciales de Google API sean válidas

---

¡Disfruta tu Sistema de Caja! 🍗🎉
