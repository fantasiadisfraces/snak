# 🍗 Sistema POS Mindy's Fast Food - v2.4

## 📋 Archivos del Sistema

```
├── index.html      → Página principal de caja
├── script.js       → Lógica del sistema POS
├── styles.css      → Estilos de la caja
├── config.js       → Configuración de Google Sheets
├── kitchen.html    → Página de cocina (NUEVA)
├── kitchen.css     → Estilos de cocina (NUEVA)
└── kitchen.js      → Lógica de cocina (NUEVA)
```

---

## 🆕 Nuevas Funcionalidades v2.4

### 1. 🍳 Pantalla de Cocina

Una ventana completamente separada para que los chefs vean los pedidos:

- **Diseño tipo Post-its** con colores vibrantes
- **Estados del pedido:**
  - 🟡 PENDIENTE → El chef puede marcar "Preparando"
  - 🟠 PREPARANDO → Aparece con animación de fuego
  - ✅ ENTREGADO → Desaparece automáticamente
- **Actualización automática** cada 5 segundos
- **Notificación sonora** cuando llega un nuevo pedido
- **Indicador de tiempo** - Se pone rojo si pasan +10 minutos
- **Orden FIFO** - Los pedidos más antiguos aparecen primero

### 2. 💾 Persistencia de Sesión

- El **carrito se guarda automáticamente** al agregar/quitar productos
- Si actualizas la página, tus productos **permanecen en el carrito**
- La sesión de Google se mantiene activa

---

## 🚀 Instalación

### Paso 1: Subir archivos
Sube todos los archivos a tu servidor web o carpeta local.

### Paso 2: Configurar Google Sheets
1. Abre `index.html` en tu navegador
2. Conecta con Google
3. Ve a la sección de **Estadísticas**
4. Haz clic en **"⚙️ Configurar Hoja"**

Esto creará automáticamente la nueva hoja `Pedidos_Cocina` en tu Google Sheet.

### Paso 3: Verificar estructura de hojas
Tu Google Sheet debe tener estas hojas:

| Hoja | Descripción |
|------|-------------|
| Categorias | Categorías del menú |
| Productos | Lista de productos |
| Acompañamientos | Guarniciones disponibles |
| Ventas | Encabezados de ventas |
| Detalle_Ventas | Detalle de cada venta |
| Usuarios_Autorizados | Emails autorizados |
| **Pedidos_Cocina** | **NUEVA - Pedidos para chefs** |

---

## 📱 Uso del Sistema

### En la Caja (index.html)
1. Conectar con Google
2. Agregar productos al carrito
3. Procesar el pago
4. El pedido se envía automáticamente a la cocina

### En la Cocina (kitchen.html)
1. Abrir desde el botón verde "🍳 Cocina" en la navegación
2. O abrir directamente `kitchen.html` en otra pantalla/tablet
3. Conectar con Google (misma cuenta)
4. Los pedidos aparecen automáticamente como post-its
5. Marcar "🔥 Preparando" cuando empiecen a cocinar
6. Marcar "✅ Entregado" cuando esté listo

---

## 🔧 Estructura de la Hoja Pedidos_Cocina

| Columna | Campo | Descripción |
|---------|-------|-------------|
| A | ID_Pedido | Número del pedido |
| B | Fecha | Fecha del pedido |
| C | Hora | Hora del pedido |
| D | Items_JSON | Productos en formato JSON |
| E | Estado | PENDIENTE / PREPARANDO / ENTREGADO |
| F | Timestamp | Fecha y hora exacta (para ordenar) |
| G | Usuario | Email de quien tomó el pedido |

---

## ⚡ Características Técnicas

- **Sincronización en tiempo real** via Google Sheets
- **Sin base de datos externa** - Todo en Google Sheets
- **Funciona offline parcialmente** - Los datos se guardan en localStorage
- **Responsive** - Funciona en tablets y pantallas grandes
- **Notificaciones de audio** - Alerta cuando llegan pedidos nuevos

---

## 🎨 Colores de Post-its

Los pedidos rotan entre estos colores:
- 🟡 Amarillo
- 🟠 Naranja
- 🩷 Rosa
- 🟢 Verde
- 🔵 Azul
- 🟣 Morado

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que todas las hojas existan en Google Sheets
2. Asegúrate de que tu email esté en `Usuarios_Autorizados`
3. Recarga la página y vuelve a conectar con Google

---

**Versión:** 2.4  
**Última actualización:** Diciembre 2025
