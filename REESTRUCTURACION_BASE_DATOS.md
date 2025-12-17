# 🗄️ REESTRUCTURACIÓN DEL SISTEMA POS - Base de Datos Normalizada

## 📋 Resumen del Cambio

Tu sistema actual guarda todo en **una sola hoja** con datos desnormalizados (productos, cantidades, etc. como texto separado por comas). Esto dificulta las estadísticas y el mantenimiento.

La nueva estructura usa **5 hojas relacionadas** que funcionan como una base de datos relacional:

```
┌─────────────────┐     ┌─────────────────┐
│   CATEGORIAS    │────▶│    PRODUCTOS    │
└─────────────────┘     └────────┬────────┘
                                 │
┌─────────────────┐              │
│ ACOMPAÑAMIENTOS │              │
└─────────────────┘              │
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│     VENTAS      │◀────│  DETALLE_VENTAS │
└─────────────────┘     └─────────────────┘
```

---

## 📊 ESTRUCTURA DE LAS 5 HOJAS

### 1️⃣ HOJA: `Categorias`
Catálogo de categorías de productos.

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID_Categoria | Texto | Identificador único (ej: "milanesas") |
| B | Nombre | Texto | Nombre visible (ej: "Milanesas") |
| C | Icono | Texto | Emoji del ícono (ej: "🥩") |
| D | Orden | Número | Orden de aparición en el menú |
| E | Activo | Booleano | TRUE/FALSE para mostrar/ocultar |

**Datos iniciales:**
```
ID_Categoria | Nombre    | Icono | Orden | Activo
-------------|-----------|-------|-------|-------
milanesas    | Milanesas | 🥩    | 1     | TRUE
pollos       | Pollos    | 🍗    | 2     | TRUE
extras       | Extras    | 🍟    | 3     | TRUE
bebidas      | Bebidas   | 🥤    | 4     | TRUE
```

---

### 2️⃣ HOJA: `Productos`
Catálogo completo de productos con precios.

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID_Producto | Número | Identificador único |
| B | Nombre | Texto | Nombre del producto |
| C | Precio | Número | Precio en Bs. |
| D | ID_Categoria | Texto | Referencia a Categorias |
| E | Tiene_Acompañamiento | Booleano | TRUE si requiere guarnición |
| F | Activo | Booleano | TRUE/FALSE para mostrar/ocultar |

**Datos iniciales:**
```
ID_Producto | Nombre              | Precio | ID_Categoria | Tiene_Acompañamiento | Activo
------------|---------------------|--------|--------------|----------------------|-------
1           | Milanesa de Pollo   | 35     | milanesas    | TRUE                 | TRUE
2           | Milanesa de Carne   | 40     | milanesas    | TRUE                 | TRUE
3           | Milanesa Napolitana | 45     | milanesas    | TRUE                 | TRUE
4           | Milanesa con Queso  | 42     | milanesas    | TRUE                 | TRUE
5           | Milanesa Especial   | 50     | milanesas    | TRUE                 | TRUE
6           | Milanesa Simple     | 30     | milanesas    | TRUE                 | TRUE
7           | Pollo BBQ 1/4       | 30     | pollos       | TRUE                 | TRUE
8           | Pollo BBQ 1/2       | 55     | pollos       | TRUE                 | TRUE
9           | Pollo BBQ Entero    | 100    | pollos       | TRUE                 | TRUE
10          | Alitas BBQ (6u)     | 35     | pollos       | TRUE                 | TRUE
11          | Alitas BBQ (12u)    | 65     | pollos       | TRUE                 | TRUE
12          | Pechuga Plancha     | 40     | pollos       | TRUE                 | TRUE
13          | Muslos BBQ (2u)     | 38     | pollos       | TRUE                 | TRUE
14          | Papas Fritas        | 15     | extras       | FALSE                | TRUE
15          | Yuca Frita          | 15     | extras       | FALSE                | TRUE
16          | Ensalada            | 12     | extras       | FALSE                | TRUE
17          | Pan (unidad)        | 3      | extras       | FALSE                | TRUE
18          | Arroz Extra         | 10     | extras       | FALSE                | TRUE
19          | Porción Fideo       | 12     | extras       | FALSE                | TRUE
20          | Coca Cola 500ml     | 8      | bebidas      | FALSE                | TRUE
21          | Coca Cola 2L        | 15     | bebidas      | FALSE                | TRUE
22          | Sprite 500ml        | 8      | bebidas      | FALSE                | TRUE
23          | Fanta 500ml         | 8      | bebidas      | FALSE                | TRUE
24          | Agua Mineral        | 6      | bebidas      | FALSE                | TRUE
25          | Jugo Natural        | 12     | bebidas      | FALSE                | TRUE
26          | Cerveza Paceña      | 15     | bebidas      | FALSE                | TRUE
27          | Cerveza Huari       | 12     | bebidas      | FALSE                | TRUE
```

---

### 3️⃣ HOJA: `Acompañamientos`
Opciones de guarniciones disponibles.

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID_Acompañamiento | Número | Identificador único |
| B | Nombre | Texto | Nombre de la guarnición |
| C | Orden | Número | Orden de aparición |
| D | Activo | Booleano | TRUE/FALSE |

**Datos iniciales:**
```
ID_Acompañamiento | Nombre         | Orden | Activo
------------------|----------------|-------|-------
1                 | Arroz Blanco   | 1     | TRUE
2                 | Fideo al Pesto | 2     | TRUE
3                 | Puré de Papa   | 3     | TRUE
4                 | Ensalada Mixta | 4     | TRUE
```

---

### 4️⃣ HOJA: `Ventas`
Encabezado de cada pedido/venta (una fila por pedido).

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID_Venta | Número | Número de pedido (autoincremental) |
| B | Fecha | Fecha | Fecha de la venta (DD/MM/YYYY) |
| C | Hora | Texto | Hora de la venta (HH:MM:SS) |
| D | Total | Número | Total de la venta en Bs. |
| E | Pago_Recibido | Número | Dinero recibido del cliente |
| F | Cambio | Número | Vuelto entregado |
| G | Usuario | Texto | Email del usuario que registró |
| H | Timestamp | Texto | Fecha/hora ISO para ordenar |

**Ejemplo:**
```
ID_Venta | Fecha      | Hora     | Total  | Pago_Recibido | Cambio | Usuario           | Timestamp
---------|------------|----------|--------|---------------|--------|-------------------|------------------------
1        | 17/12/2025 | 14:30:25 | 78.00  | 100.00        | 22.00  | user@gmail.com    | 2025-12-17T14:30:25
2        | 17/12/2025 | 15:15:00 | 85.00  | 100.00        | 15.00  | user@gmail.com    | 2025-12-17T15:15:00
```

---

### 5️⃣ HOJA: `Detalle_Ventas`
Detalle de cada producto vendido (una fila por producto en el pedido).

| Columna | Nombre | Tipo | Descripción |
|---------|--------|------|-------------|
| A | ID_Detalle | Número | Identificador único del detalle |
| B | ID_Venta | Número | Referencia al pedido (Ventas) |
| C | ID_Producto | Número | Referencia al producto (Productos) |
| D | Nombre_Producto | Texto | Nombre del producto (para referencia rápida) |
| E | ID_Acompañamiento | Número | Referencia a guarnición (puede estar vacío) |
| F | Nombre_Acompañamiento | Texto | Nombre de la guarnición |
| G | Cantidad | Número | Cantidad vendida |
| H | Precio_Unitario | Número | Precio por unidad |
| I | Subtotal | Número | Cantidad × Precio_Unitario |
| J | ID_Categoria | Texto | Categoría del producto |

**Ejemplo:**
```
ID_Detalle | ID_Venta | ID_Producto | Nombre_Producto     | ID_Acompañamiento | Nombre_Acompañamiento | Cantidad | Precio_Unitario | Subtotal | ID_Categoria
-----------|----------|-------------|---------------------|-------------------|----------------------|----------|-----------------|----------|-------------
1          | 1        | 1           | Milanesa de Pollo   | 1                 | Arroz Blanco         | 2        | 35.00           | 70.00    | milanesas
2          | 1        | 20          | Coca Cola 500ml     |                   |                      | 1        | 8.00            | 8.00     | bebidas
3          | 2        | 8           | Pollo BBQ 1/2       | 4                 | Ensalada Mixta       | 1        | 55.00           | 55.00    | pollos
4          | 2        | 14          | Papas Fritas        |                   |                      | 2        | 15.00           | 30.00    | extras
```

---

## 🎯 VENTAJAS DE ESTA ESTRUCTURA

| Aspecto | Antes (1 hoja) | Ahora (5 hojas) |
|---------|----------------|-----------------|
| **Modificar precios** | Requiere cambiar código JS | Solo editar hoja Productos |
| **Agregar productos** | Requiere cambiar código JS | Solo agregar fila en Productos |
| **Agregar categorías** | Requiere cambiar código JS | Solo agregar fila en Categorias |
| **Estadísticas por producto** | Parsear strings complicados | Query simple con SUMIF |
| **Integridad de datos** | Datos duplicados y errores | Datos normalizados |
| **Backup/Restauración** | Difícil | Fácil por hojas separadas |

---

## 📝 INSTRUCCIONES PASO A PASO

### Paso 1: Crear las hojas en Google Sheets

1. Abre tu Google Sheet actual
2. Crea 5 hojas nuevas (click en "+" abajo):
   - `Categorias`
   - `Productos`
   - `Acompañamientos`
   - `Ventas`
   - `Detalle_Ventas`

### Paso 2: Configurar encabezados

**Hoja `Categorias` - Fila 1:**
```
ID_Categoria | Nombre | Icono | Orden | Activo
```

**Hoja `Productos` - Fila 1:**
```
ID_Producto | Nombre | Precio | ID_Categoria | Tiene_Acompañamiento | Activo
```

**Hoja `Acompañamientos` - Fila 1:**
```
ID_Acompañamiento | Nombre | Orden | Activo
```

**Hoja `Ventas` - Fila 1:**
```
ID_Venta | Fecha | Hora | Total | Pago_Recibido | Cambio | Usuario | Timestamp
```

**Hoja `Detalle_Ventas` - Fila 1:**
```
ID_Detalle | ID_Venta | ID_Producto | Nombre_Producto | ID_Acompañamiento | Nombre_Acompañamiento | Cantidad | Precio_Unitario | Subtotal | ID_Categoria
```

### Paso 3: Cargar datos iniciales

Copia los datos de las tablas de arriba (Categorias, Productos, Acompañamientos) a las hojas correspondientes.

### Paso 4: Reemplazar archivos

Reemplaza tu `config.js` y `script.js` con las versiones actualizadas que te proporciono.

---

## 📊 FÓRMULAS ÚTILES PARA ESTADÍSTICAS EN GOOGLE SHEETS

Una vez que tengas datos, puedes usar estas fórmulas directamente en Sheets:

### Total de ventas del día:
```
=SUMIF(Ventas!B:B, HOY(), Ventas!D:D)
```

### Cantidad vendida por producto:
```
=SUMIF(Detalle_Ventas!C:C, [ID_Producto], Detalle_Ventas!G:G)
```

### Ingresos por categoría:
```
=SUMIF(Detalle_Ventas!J:J, "milanesas", Detalle_Ventas!I:I)
```

### Producto más vendido:
```
=INDEX(Detalle_Ventas!D:D, MATCH(MAX(Detalle_Ventas!G:G), Detalle_Ventas!G:G, 0))
```

### Promedio de ticket:
```
=AVERAGE(Ventas!D:D)
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Migración de datos existentes**: Si tienes ventas antiguas en la hoja "Ventas" original, deberás migrarlas manualmente o crear un script de migración.

2. **Campos redundantes**: Los campos `Nombre_Producto` y `Nombre_Acompañamiento` en `Detalle_Ventas` son redundantes pero facilitan las consultas sin necesidad de hacer JOINs complejos.

3. **El sistema cargará los productos desde Google Sheets**: Ya no estarán hardcodeados en el JavaScript.

4. **Backup**: Antes de hacer cambios, haz una copia de tu Google Sheet actual.
