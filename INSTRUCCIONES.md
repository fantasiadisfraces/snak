# 📋 INSTRUCCIONES - Sistema POS v2.0

## ✅ ESTRUCTURA REQUERIDA EN GOOGLE SHEETS

Tu Google Sheet debe tener **5 hojas** con estos nombres EXACTOS:

### 1️⃣ Hoja: `Categorias`
**Encabezados (Fila 1):**
```
ID_Categoria | Nombre | Icono | Orden | Activo
```

**Ejemplo de datos:**
```
milanesas    | Milanesas | 🥩 | 1 | TRUE
pollos       | Pollos    | 🍗 | 2 | TRUE
extras       | Extras    | 🍟 | 3 | TRUE
bebidas      | Bebidas   | 🥤 | 4 | TRUE
```

---

### 2️⃣ Hoja: `Productos`
**Encabezados (Fila 1):**
```
ID_Producto | Nombre | Precio | ID_Categoria | Tiene_Acompañamiento | Activo
```

**Ejemplo de datos:**
```
1  | Milanesa de Pollo   | 35  | milanesas | TRUE  | TRUE
2  | Milanesa de Carne   | 40  | milanesas | TRUE  | TRUE
7  | Pollo BBQ 1/4       | 30  | pollos    | TRUE  | TRUE
14 | Papas Fritas        | 15  | extras    | FALSE | TRUE
20 | Coca Cola 500ml     | 8   | bebidas   | FALSE | TRUE
```

**IMPORTANTE:**
- `ID_Categoria` debe coincidir EXACTAMENTE con el `ID_Categoria` de la hoja Categorias
- `Tiene_Acompañamiento`: TRUE si el producto necesita elegir guarnición, FALSE si no

---

### 3️⃣ Hoja: `Acompañamientos`
**Encabezados (Fila 1):**
```
ID_Acompañamiento | Nombre | Orden | Activo
```

**Ejemplo de datos:**
```
1 | Arroz Blanco   | 1 | TRUE
2 | Fideo al Pesto | 2 | TRUE
3 | Puré de Papa   | 3 | TRUE
4 | Ensalada Mixta | 4 | TRUE
```

---

### 4️⃣ Hoja: `Ventas`
**Encabezados (Fila 1):**
```
ID_Venta | Fecha | Hora | Total | Pago_Recibido | Cambio | Usuario | Timestamp
```
*(Esta hoja se llena automáticamente con cada venta)*

---

### 5️⃣ Hoja: `Detalle_Ventas`
**Encabezados (Fila 1):**
```
ID_Detalle | ID_Venta | ID_Producto | Nombre_Producto | ID_Acompañamiento | Nombre_Acompañamiento | Cantidad | Precio_Unitario | Subtotal | ID_Categoria
```
*(Esta hoja se llena automáticamente con cada venta)*

---

## 🚀 CÓMO USAR

1. **Abre `index.html`** en tu navegador
2. **Presiona "Conectar"** para iniciar sesión con Google
3. El sistema **cargará automáticamente** las categorías, productos y acompañamientos
4. **¡Listo para vender!**

---

## 🔧 MODIFICAR PRODUCTOS/PRECIOS

Para cambiar precios o agregar productos:

1. Abre tu Google Sheet
2. Edita la hoja `Productos`
3. Guarda los cambios
4. En el sistema, presiona el botón de **Sincronizar** o reconecta

---

## ⚠️ SOLUCIÓN DE PROBLEMAS

### "No hay categorías en la hoja"
- Verifica que la hoja se llame exactamente `Categorias` (con C mayúscula)
- Verifica que haya datos desde la fila 2

### "No hay productos activos"
- Verifica que la columna `Activo` tenga `TRUE`
- Verifica que `ID_Categoria` coincida con las categorías existentes

### Los productos no aparecen
- Reconecta con Google (botón Desconectar y luego Conectar)
- Verifica que todos los campos tengan datos válidos
