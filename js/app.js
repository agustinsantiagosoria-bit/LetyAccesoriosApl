// ============================================================================
// ====== CONTROLADOR CENTRAL INTERACTIVO REAL - LETY ACCESORIOS APP ======
// ============================================================================

let _todosLosInsumos = [];
let _todosLosProductos = [];
let _todasLasVentas = [];
let _filtroCajaActual = "DIA"; // DIA, SEMANA, MES

// Variables de memoria temporal para formularios modales
let _sucursalesBalanzaTemporal = [];
let _idInsumoBalanzaActivo = null;

// Escuchar la carga de la interfaz y conectar con IndexedDB de db.js
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(async () => {
        try {
            await cargarTodoElSistemaReal();
        } catch (error) {
            console.warn("Sincronizando hilos con IndexedDB local...", error);
        }
    }, 250);
});

// CORREGIDO: Nombres de variables unificados sin cortes
async function cargarTodoElSistemaReal() {
    try {
        _todosLosInsumos = await obtenerTodosLosRegistros("insumos");
        _todosLosProductos = await obtenerTodosLosRegistros("productos");
        _todasLasVentas = await obtenerTodosLosRegistros("ventas");

        await renderizarInsumosReales();
        await renderizarProductosReales();
        await renderizarCajaYHistorialReal();
        await renderizarPestañaPrincipalResumen();
    } catch (ex) {
        console.error("❌ Error de consistencia en el refresco:", ex);
    }
}

// ============================================================================
// ====== MÓDULO 1: GESTIÓN DE INSUMOS REALES Y FILTRADO ACTIVADO ======
// ============================================================================

// 1. RENDERIZADO DE LA TABLA EXCEL DE INSUMOS REALES CORREGIDA
async function renderizarInsumosReales(listaFiltrada = null) {
    const tbody = document.getElementById("tbody-insumos-reales");
    if (!tbody) return;

    tbody.innerHTML = "";
    const datos = listaFiltrada || _todosLosInsumos;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#8A7A78; font-weight:600;">No hay insumos cargados. Presiona '+ Nuevo Insumo'.</td></tr>`;
        return;
    }

    datos.forEach(insumo => {
        let detallesProveedor = "Sin proveedores";
        let precioBaseDisplay = parseFloat(insumo.precioBase || 0).toFixed(2);

        // Corrección del mapeo del array de sucursales de la balanza
        if (insumo.sucursales && insumo.sucursales.length > 0) {
            const sucursalesOrdenadas = [...insumo.sucursales].sort((a, b) => a.precio - b.precio);
            const ideal = sucursalesOrdenadas[0]; // Tomar el precio más barato de la balanza
            
            if (insumo.sucursales.length > 1) {
                const peor = sucursalesOrdenadas[sucursalesOrdenadas.length - 1];
                const ahorro = peor.precio - ideal.precio;
                detallesProveedor = `${ideal.nombre} ⚖️ (Ahorra: $${ahorro.toFixed(2)})`;
            } else {
                detallesProveedor = `${ideal.nombre} ✨ (Ideal)`;
            }
            precioBaseDisplay = parseFloat(ideal.precio || 0).toFixed(2);
        } else {
            detallesProveedor = `${insumo.sucursalInicial || 'Principal'} ✨ (Ideal)`;
        }
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td style="font-weight: 700; color: #4A3E3D; padding: 14px 16px;">${insumo.nombre}</td>
            <td style="padding: 14px 16px;">$${precioBaseDisplay}</td>
            <td style="padding: 14px 16px;">${insumo.unidad === 'xM' ? 'Metro (xM)' : 'Unidad (xU)'}</td>
            <td style="color: #2E7D32; font-weight: 700; padding: 14px 16px;">${detallesProveedor}</td>
            <td style="text-align: center; padding: 14px 16px; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <button onclick="abrirBalanzaComparativa(${insumo.id})" class="row-btn" style="color: #1E88E5; background: transparent; border: none; cursor: pointer; padding: 4px;" title="Comparar Sucursales">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16V5a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2z"/><path d="M23 18H1"/><circle cx="7" cy="10" r="2"/></svg>
                </button>
                <button onclick="abrirModificarInsumo(${insumo.id})" class="row-btn" style="color: #4A3E3D; background: transparent; border: none; cursor: pointer; padding: 4px;" title="Modificar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button onclick="ejecutarEliminarInsumo(${insumo.id})" class="row-btn" style="color: #E53935; background: transparent; border: none; cursor: pointer; padding: 4px;" title="Eliminar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </td>


        `;
        tbody.appendChild(fila);
    });

    // Forzar la creación de íconos en los botones recién inyectados
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


// LÓGICA DE FILTRADO: Filtro por texto real conectado a la barra Excel
// CORREGIDO: Uso de .filter nativo de JavaScript estándar
function filtrarInsumosReales() {
    const buscar = document.getElementById("filtro-insumos-input").value.trim().toLowerCase();
    if (!buscar) {
        renderizarInsumosReales(_todosLosInsumos);
    } else {
        const filtrados = _todosLosInsumos.filter(i => i.nombre.toLowerCase().includes(buscar));
        renderizarInsumosReales(filtrados);
    }
}

// 2. CONTROL DEL FORMULARIO DE ALTA Y GUARDADO EN MEMORIA INDEXEDDB
function abrirModalNuevoInsumo() {
    document.getElementById("form-real-insumo").reset();
    document.getElementById("insumo-real-id").value = "";
    document.getElementById("titulo-modal-insumo").innerText = "Nuevo Insumo Base";
    document.getElementById("modal-alta-insumo").classList.remove("hidden");
}

function cerrarModalNuevoInsumo() {
    document.getElementById("modal-alta-insumo").classList.add("hidden");
}

async function guardarInsumoReal(event) {
    event.preventDefault();

    const idStr = document.getElementById("insumo-real-id").value;
    const nombre = document.getElementById("insumo-real-nombre").value.trim();
    const precio = parseFloat(document.getElementById("insumo-real-precio").value) || 0;
    const unidad = document.getElementById("insumo-real-unidad").value;
    const sucursal = document.getElementById("insumo-real-sucursal").value.trim();

    let objetoInsumo;

    if (idStr) {
        // Modo modificación: rescatar el anterior para no perder la balanza de proveedores
        const idInt = parseInt(idStr);
        const viejo = _todosLosInsumos.find(i => i.id === idInt);
        objetoInsumo = { ...viejo, nombre, unidad };
    } else {
        // Nuevo registro base
        objetoInsumo = {
            nombre: nombre,
            precioBase: precio,
            unidad: unidad,
            sucursalInicial: sucursal,
            sucursales: [{ nombre: sucursal, precio: precio }] // Primera sucursal de la balanza
        };
    }

    await guardarRegistro("insumos", objetoInsumo);
    cerrarModalNuevoInsumo();
    await cargarTodoElSistemaReal();
}

function abrirModificarInsumo(id) {
    const insumo = _todosLosInsumos.find(i => i.id === id);
    if (!insumo) return;

    document.getElementById("insumo-real-id").value = insumo.id;
    document.getElementById("insumo-real-nombre").value = insumo.nombre;
    document.getElementById("insumo-real-unidad").value = insumo.unidad;
    
    // Rellenar datos base de consulta
    document.getElementById("insumo-real-precio").value = insumo.precioBase;
    document.getElementById("insumo-real-sucursal").value = insumo.sucursalInicial || "Principal";

    document.getElementById("titulo-modal-insumo").innerText = "Modificar Nombre de Insumo";
    document.getElementById("modal-alta-insumo").classList.remove("hidden");
}

async function ejecutarEliminarInsumo(id) {
    if (confirm("⚠️ ¿Estás seguro de eliminar este insumo? Las recetas que lo utilicen perderán su costeo.")) {
        await eliminarRegistro("insumos", id);
        await cargarTodoElSistemaReal();
    }
}

// 3. LÓGICA DE LA BALANZA (⚖️): COMPARATIVAS AVANZADAS MULTISUCURSAL
async function abrirBalanzaComparativa(id) {
    const insumo = _todosLosInsumos.find(i => i.id === id);
    if (!insumo) return;

    _idInsumoBalanzaActivo = id;
    _sucursalesBalanzaTemporal = insumo.sucursales || [];

    document.getElementById("balanza-insumo-id").value = id;
    document.getElementById("balanza-insumo-titulo").innerText = `Balanza de Precios: ${insumo.nombre}`;
    
    renderizarTablaSucursalesBalanza();
    document.getElementById("modal-balanza-sucursales").classList.remove("hidden");
}

function cerrarModalBalanza() {
    document.getElementById("modal-balanza-sucursales").classList.add("hidden");
    _idInsumoBalanzaActivo = null;
}

function renderizarTablaSucursalesBalanza() {
    const tbody = document.getElementById("tbody-balanza-sucursales");
    if (!tbody) return;
    tbody.innerHTML = "";

    _sucursalesBalanzaTemporal.forEach((suc, index) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td style="padding: 8px 12px; font-weight:600;">${suc.nombre}</td>
            <td style="padding: 8px 12px; font-weight:700; color:#4A3E3D;">$${parseFloat(suc.precio).toFixed(2)}</td>
            <td style="padding: 8px 12px; text-align:center;">
                <button onclick="eliminarPrecioSucursalBalanza(${index})" class="row-btn" style="color:#E53935;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
            </td>
        `;
        tbody.appendChild(fila);
    });
    if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

}

async function agregarPrecioSucursalBalanza() {
    const nombreTienda = document.getElementById("balanza-nueva-sucursal").value.trim();
    const precioTienda = parseFloat(document.getElementById("balanza-nuevo-precio").value) || 0;

    if (!nombreTienda || precioTienda <= 0) {
        alert("Completa el comercio y un precio válido.");
        return;
    }

    _sucursalesBalanzaTemporal.push({ nombre: nombreTienda, precio: precioTienda });
    
    // Guardar los cambios directamente en IndexedDB de fondo
    const insumo = _todosLosInsumos.find(i => i.id === _idInsumoBalanzaActivo);
    insumo.sucursales = _sucursalesBalanzaTemporal;
    await guardarRegistro("insumos", insumo);

    document.getElementById("balanza-nueva-sucursal").value = "";
    document.getElementById("balanza-nuevo-precio").value = "";

    renderizarTablaSucursalesBalanza();
    await cargarTodoElSistemaReal();
}

async function eliminarPrecioSucursalBalanza(index) {
    _sucursalesBalanzaTemporal.splice(index, 1);
    
    const insumo = _todosLosInsumos.find(i => i.id === _idInsumoBalanzaActivo);
    insumo.sucursales = _sucursalesBalanzaTemporal;
    await guardarRegistro("insumos", insumo);

    renderizarTablaSucursalesBalanza();
    await cargarTodoElSistemaReal();
}
// ============================================================================
// ====== MÓDULO 2: GESTIÓN DE PRODUCTOS REALES Y CALCULADORA DE COSTOS =======
// ============================================================================

let _recetaTemporalProducto = []; // Guarda las líneas de insumos agregadas al abrir el formulario

// 1. RENDERIZADO DE LA TABLA EXCEL DE PRODUCTOS REALES (Foto 2 Derecha)
async function renderizarProductosReales(listaFiltrada = null) {
    const tbody = document.getElementById("tbody-productos-reales");
    if (!tbody) return;

    tbody.innerHTML = "";
    const datos = listaFiltrada || _todosLosProductos;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#8A7A78; font-weight:600;">No hay productos en catálogo. Presiona '+ Nuevo Producto'.</td></tr>`;
        return;
    }

    datos.forEach(prod => {
        const stockActual = parseInt(prod.stock) || 0;
        const stockMinimo = parseInt(prod.minimo) || 0;
        const esStockCritico = stockActual <= stockMinimo;

        // Calcular costo de producción líquido real si tiene receta guardada
        let costoFinal = parseFloat(prod.costoProduccionFijo) || 0;

        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td style="font-weight: 700; color: #4A3E3D; padding: 14px 16px;">${prod.nombre}</td>
            <td style="padding: 14px 16px;">$${costoFinal.toFixed(2)} ARS</td>
            <td style="color: #D81B60; font-weight: 700; padding: 14px 16px;">$${parseFloat(prod.precioVenta).toFixed(2)} ARS</td>
            <td style="padding: 14px 16px; font-weight: 600; ${esStockCritico ? 'color:#E53935; font-weight:700;' : 'color:#555555;'}">
                ${stockActual} / <span style="font-size:12px; color:#999999;">${stockMinimo}</span>
            </td>
        <td style="text-align: center; padding: 14px 16px; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <button onclick="abrirModificarProducto(${prod.id})" class="row-btn" style="color: #4A3E3D; background: transparent; border: none; cursor: pointer; padding: 4px;" title="Modificar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button onclick="ejecutarEliminarProducto(${prod.id})" class="row-btn" style="color: #E53935; background: transparent; border: none; cursor: pointer; padding: 4px;" title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
        </td>


        `;
        tbody.appendChild(fila);
    });

    if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

}

// LÓGICA DE FILTRADO: Buscador real conectado a la barra de herramientas del catálogo
function filtrarProductosReales() {
    const buscar = document.getElementById("filtro-productos-input").value.trim().toLowerCase();
    if (!buscar) {
        renderizarProductosReales(_todosLosProductos);
    } else {
        const filtrados = _todosLosProductos.filter(p => p.nombre.toLowerCase().includes(buscar));
        renderizarProductosReales(filtrados);
    }
}

// 2. LOGICA VISUAL DEL DESPLEGABLE RE-ACTIVO (CHECKBOX)
function toggleInfoAdicional() {
    const checkbox = document.getElementById("chk-info-adicional");
    const seccionReceta = document.getElementById("seccion-receta-adicional");
    
    if (checkbox && seccionReceta) {
        if (checkbox.checked) {
            seccionReceta.classList.remove("hidden");
            cargarSelectorInsumosReceta(); // Cargar la lista de insumos reales disponibles
        } else {
            seccionReceta.classList.add("hidden");
        }
    }
}

// Rellenar la lista de insumos que se pueden agregar a la receta del accesorio
function cargarSelectorInsumosReceta() {
    const select = document.getElementById("receta-insumo-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccionar Insumo --</option>';
    _todosLosInsumos.forEach(insumo => {
        let precioIdeal = parseFloat(insumo.precioBase) || 0;
        if (insumo.sucursales && insumo.sucursales.length > 0) {
            const ordenadas = [...insumo.sucursales].sort((a, b) => a.precio - b.precio);
            precioIdeal = ordenadas[0].precio;
        }

        const opcion = document.createElement("option");
        opcion.value = insumo.id;
        opcion.dataset.precio = precioIdeal;
        opcion.dataset.nombre = insumo.nombre;
        opcion.innerText = `${insumo.nombre} ($${precioIdeal.toFixed(2)})`;
        select.appendChild(opcion);
    });
}
// 3. MATEMÁTICAS DEL ESCANDALLO: Carga de Líneas de Receta y Precio Sugerido
function agregarInsumoARecetaTemporal() {
    const select = document.getElementById("receta-insumo-select");
    const inputCantidad = document.getElementById("receta-insumo-cantidad");
    if (!select || !inputCantidad) return;

    const idInsumo = parseInt(select.value);
    const cantidad = parseFloat(inputCantidad.value) || 0;

    if (!idInsumo || cantidad <= 0) {
        alert("Selecciona un insumo e ingresa una cantidad válida mayor a cero.");
        return;
    }

    const opcionSeleccionada = select.options[select.selectedIndex];
    const nombre = opcionSeleccionada.dataset.nombre;
    const precioUnitario = parseFloat(opcionSeleccionada.dataset.precio) || 0;
    const costoParcial = precioUnitario * cantidad;

    // Verificar si ya estaba agregado para sumar cantidad o meter una línea nueva
    const existente = _recetaTemporalProducto.find(linea => linea.insumoId === idInsumo);
    if (existente) {
        existente.cantidad += cantidad;
        existente.costoParcial = existente.cantidad * precioUnitario;
    } else {
        _recetaTemporalProducto.push({
            insumoId: idInsumo,
            nombre: nombre,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            costoParcial: costoParcial
        });
    }

    inputCantidad.value = "";
    select.value = "";

    renderizarRecetaTemporalFormulario();
    calcularPrecioSugeridoReal();
}

function renderizarRecetaTemporalFormulario() {
    const tbody = document.getElementById("tbody-receta-temporal");
    if (!tbody) return;
    tbody.innerHTML = "";

    _recetaTemporalProducto.forEach((linea, index) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td style="padding: 6px 10px;">${linea.nombre}</td>
            <td style="padding: 6px 10px; text-align: center;">${linea.cantidad}</td>
            <td style="padding: 6px 10px; text-align: right; font-weight:700;">$${linea.costoParcial.toFixed(2)}</td>
            <td style="padding: 6px 10px; text-align: center;">
                <button type="button" onclick="eliminarLineaRecetaTemporal(${index})" class="row-btn" style="color:#E53935; padding:2px;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
            </td>
        `;
        tbody.appendChild(fila);
    });
        // Reemplazo en línea 408 para que no rompa la ejecución
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

}

function eliminarLineaRecetaTemporal(index) {
    _recetaTemporalProducto.splice(index, 1);
    renderizarRecetaTemporalFormulario();
    calcularPrecioSugeridoReal();
}

function calcularPrecioSugeridoReal() {
    const labelCosto = document.getElementById("calc-costo-total");
    const labelSugerido = document.getElementById("calc-precio-sugerido");
    const inputMargen = document.getElementById("prod-real-margen");
    const selectTipo = document.getElementById("prod-real-tipo-margen");

    if (!labelCosto || !labelSugerido || !inputMargen || !selectTipo) return;

    // Sumar el costo parcial de todas las líneas añadidas
    const costoTotal = _recetaTemporalProducto.reduce((sum, linea) => sum + linea.costoParcial, 0);
    labelCosto.innerText = `$${costoTotal.toFixed(2)} ARS`;

    const margen = parseFloat(inputMargen.value) || 0;
    const tipo = selectTipo.value;
    let precioSugerido = costoTotal;

    if (tipo === "porcentaje") {
        precioSugerido = costoTotal + (costoTotal * (margen / 100));
    } else {
        precioSugerido = costoTotal + margen;
    }

    labelSugerido.innerText = `$${precioSugerido.toFixed(2)} ARS`;
}

// 4. CONTROL DE APERTURA, MODIFICACIÓN Y PERSISTENCIA FINAL DE PRODUCTOS
// MODIFICACIÓN QUIRÚRGICA: Corrección de caracteres de escape en el alta de productos
function abrirModalNuevoProducto() {
    const form = document.getElementById("form-real-producto");
    const modal = document.getElementById("modal-alta-producto");
    
    if (form) form.reset();
    
    const inputId = document.getElementById("producto-real-id");
    if (inputId) inputId.value = "";
    
    const titulo = document.getElementById("titulo-modal-producto");
    if (titulo) titulo.innerText = "Nuevo Producto para Catálogo";
    
    // Vaciar de forma segura el array provisional de la receta de escandallo
    _recetaTemporalProducto = [];
    if (typeof renderizarRecetaTemporalFormulario === 'function') {
        renderizarRecetaTemporalFormulario();
    }
    
    // Resetear visualmente el checkbox de Información Adicional
    const checkbox = document.getElementById("chk-info-adicional");
    if (checkbox) checkbox.checked = false;
    
    const seccionReceta = document.getElementById("seccion-receta-adicional");
    if (seccionReceta) seccionReceta.classList.add("hidden");
    
    // CORRECCIÓN CLAVE: Remoción de la barra invertida que rompía la ejecución
    const labelCosto = document.getElementById("calc-costo-total");
    if (labelCosto) labelCosto.innerText = "$0.00 ARS";
    
    const labelSugerido = document.getElementById("calc-precio-sugerido");
    if (labelSugerido) labelSugerido.innerText = "$0.00 ARS";
    
    // Desplegar la ventana modal de forma fluida
    if (modal) {
        modal.classList.remove("hidden");
    }
    console.log("🌸 Formulario de alta de productos inicializado.");
}


function cerrarModalNuevoProducto() {
    document.getElementById("modal-alta-producto").classList.add("hidden");
}

async function guardarProductoReal(event) {
    event.preventDefault();

    const idStr = document.getElementById("producto-real-id").value;
    const nombre = document.getElementById("prod-real-nombre").value.trim();
    const precioVenta = parseFloat(document.getElementById("prod-real-venta").value) || 0;
    const stock = parseInt(document.getElementById("prod-real-stock").value) || 0;
    const minimo = parseInt(document.getElementById("prod-real-minimo").value) || 0;
    const usaInfoAdicional = document.getElementById("chk-info-adicional").checked;

    const costoTotalReceta = _recetaTemporalProducto.reduce((sum, linea) => sum + linea.costoParcial, 0);

    const objetoProducto = {
        nombre: nombre,
        precioVenta: precioVenta,
        stock: stock,
        minimo: minimo,
        usaReceta: usaInfoAdicional,
        receta: usaInfoAdicional ? _recetaTemporalProducto : [],
        costoProduccionFijo: usaInfoAdicional ? costoTotalReceta : 0,
        margenGuardado: parseFloat(document.getElementById("prod-real-margen").value) || 0,
        tipoMargenGuardado: document.getElementById("prod-real-tipo-margen").value
    };

    if (idStr) {
        objetoProducto.id = parseInt(idStr);
    }

    await guardarRegistro("productos", objetoProducto);
    cerrarModalNuevoProducto();
    await cargarTodoElSistemaReal();
}

function abrirModificarProducto(id) {
    const prod = _todosLosProductos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById("producto-real-id").value = prod.id;
    document.getElementById("prod-real-nombre").value = prod.nombre;
    document.getElementById("prod-real-venta").value = prod.precioVenta;
    document.getElementById("prod-real-stock").value = prod.stock;
    document.getElementById("prod-real-minimo").value = prod.minimo;

    document.getElementById("prod-real-margen").value = prod.margenGuardado || 100;
    document.getElementById("prod-real-tipo-margen").value = prod.tipoMargenGuardado || "porcentaje";

    _recetaTemporalProducto = prod.receta || [];
    renderizarRecetaTemporalFormulario();

    const checkbox = document.getElementById("chk-info-adicional");
    checkbox.checked = prod.usaReceta || false;
    
    const seccionReceta = document.getElementById("seccion-receta-adicional");
    if (prod.usaReceta) {
        seccionReceta.classList.remove("hidden");
        cargarSelectorInsumosReceta();
        calcularPrecioSugeridoReal();
    } else {
        seccionReceta.classList.add("hidden");
    }

    document.getElementById("titulo-modal-producto").innerText = "Modificar Accesorio";
    document.getElementById("modal-alta-producto").classList.remove("hidden");
}

async function ejecutarEliminarProducto(id) {
    if (confirm("⚠️ ¿Estás seguro de eliminar este producto del catálogo de venta?")) {
        await eliminarRegistro("productos", id);
        await cargarTodoElSistemaReal();
    }
}
// ============================================================================
// ====== MÓDULO 3: CAJA REGISTRADORA, CARRITO MULTIPRODUCTO Y FILTROS ======
// ============================================================================

let _carritoMostradorTemporal = []; // Guarda las líneas de la venta en curso

// 1. RELLENAR SELECTOR DE VENTAS CON EL CATÁLOGO REAL EN BLANCO
async function cargarSelectorProductosVenta() {
    const select = document.getElementById("carrito-producto-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Elige del catálogo --</option>';
    _todosLosProductos.forEach(prod => {
        const opcion = document.createElement("option");
        opcion.value = prod.id;
        opcion.dataset.nombre = prod.nombre;
        opcion.dataset.precio = prod.precioVenta;
        opcion.innerText = `${prod.nombre} ($${parseFloat(prod.precioVenta).toFixed(2)})`;
        select.appendChild(opcion);
    });
}

// 2. MATEMÁTICAS DEL CARRITO DE COMPRAS CONJUNTO
function agregarLineaAlCarritoTemporal() {
    const select = document.getElementById("carrito-producto-select");
    const inputCantidad = document.getElementById("carrito-cantidad-input");
    if (!select || !inputCantidad) return;

    const idProd = parseInt(select.value);
    const cantidad = parseInt(inputCantidad.value) || 0;

    if (!idProd || cantidad <= 0) {
        alert("Selecciona un accesorio e ingresa una cantidad válida.");
        return;
    }

    const opcion = select.options[select.selectedIndex];
    const nombre = opcion.dataset.nombre;
    const precioUnitario = parseFloat(opcion.dataset.precio) || 0;
    const subtotal = precioUnitario * cantidad;

    const existente = _carritoMostradorTemporal.find(item => item.productoId === idProd);
    if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * precioUnitario;
    } else {
        _carritoMostradorTemporal.push({
            productoId: idProd,
            nombre: nombre,
            cantidad: cantidad,
            precioUnitario: precioUnitario,
            subtotal: subtotal
        });
    }

    inputCantidad.value = "1";
    select.value = "";

    renderizarCarritoMostrador();
}

function renderizarCarritoMostrador() {
    const tbody = document.getElementById("tbody-carrito-mostrador");
    const labelTotal = document.getElementById("label-total-carrito-mostrador");
    if (!tbody || !labelTotal) return;

    tbody.innerHTML = "";
    let totalAcumulado = 0;

    _carritoMostradorTemporal.forEach((item, index) => {
        totalAcumulado += item.subtotal;
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td style="padding: 6px 10px; font-weight:600;">${item.nombre} x ${item.cantidad}u</td>
            <td style="padding: 6px 10px; text-align: right; font-weight:700; color:#C55A11;">$${item.subtotal.toFixed(2)}</td>
            <td style="padding: 6px 10px; text-align: center;">
                <button type="button" onclick="eliminarLineaCarritoMostrador(${index})" class="row-btn" style="color:#E53935; padding:2px;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    labelTotal.innerText = `$ ${totalAcumulado.toFixed(2)} ARS`;
    if (typeof lucide !== 'undefined') {
    lucide.createIcons();
}

}

function eliminarLineaCarritoMostrador(index) {
    _carritoMostradorTemporal.splice(index, 1);
    renderizarCarritoMostrador();
}
// 3. ASENTAR TICKET DE COMPRA Y DESCONTAR INVENTARIO DE INSUMOS
async function confirmarYRegistrarVentaConjunta() {
    if (_carritoMostradorTemporal.length === 0) {
        alert("El carrito está vacío. Añade al menos un accesorio antes de cobrar.");
        return;
    }

    const selectMetodo = document.getElementById("carrito-metodo-pago");
    const metodoPago = selectMetodo ? selectMetodo.value : "Efectivo";
    const totalTicket = _carritoMostradorTemporal.reduce((sum, item) => sum + item.subtotal, 0);

    // Compilar renglón descriptivo compacto para el Historial
    const detalleTexto = _carritoMostradorTemporal.map(i => `${i.nombre} (${i.cantidad}u)`).join(", ");

    const nuevaVentaReal = {
        total: totalTicket,
        metodoPago: metodoPago,
        fecha: new Date().toISOString(),
        detalle: detalleTexto,
        items: _carritoMostradorTemporal,
        activa: true
    };

    try {
        // A) Descontar stock de productos finalizados y sus materias primas (insumos asociados)
        for (const item of _carritoMostradorTemporal) {
            // Descontar del catálogo de productos terminados
            const prodIndex = _todosLosProductos.findIndex(p => p.id === item.productoId);
            if (prodIndex !== -1) {
                let p = _todosLosProductos[prodIndex];
                p.stock = Math.max(0, (parseInt(p.stock) || 0) - item.cantidad);
                await guardarRegistro("productos", p);

                // Si el producto tiene una receta asociada, descontar insumos proporcionalmente
                if (p.usaReceta && p.receta && p.receta.length > 0) {
                    for (const lineaReceta of p.receta) {
                        const insumoIndex = _todosLosInsumos.findIndex(i => i.id === lineaReceta.insumoId);
                        if (insumoIndex !== -1) {
                            let ins = _todosLosInsumos[insumoIndex];
                            
                            // Limpiamos la unidad (m, u) si existe para restar matemáticamente
                            let valorLimpio = parseFloat(ins.stock.replace(/[^0-9.]/g, '')) || 0;
                            let sufijo = ins.stock.replace(/[0-9.]/g, '') || "u";
                            
                            let nuevoStock = Math.max(0, valorLimpio - (lineaReceta.cantidad * item.cantidad));
                            ins.stock = `${nuevoStock}${sufijo}`;
                            await guardarRegistro("insumos", ins);
                        }
                    }
                }
            }
        }

        // B) Guardar ticket en base de datos
        await guardarRegistro("ventas", nuevaVentaReal);

        // C) Limpiar el carrito de mostrador
        _carritoMostradorTemporal = [];
        renderizarCarritoMostrador();

        // D) Refrescar masivamente los paneles en pesos argentinos
        await cargarTodoElSistemaReal();
        alert(`🌸 ¡Venta Asentada con Éxito! Total: $${totalTicket.toFixed(2)} ARS por ${metodoPago}.`);

    } catch (ex) {
        console.error("Error al asentar la venta de mostrador:", ex);
        alert("Ocurrió un problema guardando el ticket.");
    }
}

// 4. FILTROS DE TIEMPO REALES DE LA CAJA REGISTRADORA
async function renderizarCajaYHistorialReal() {
    const contenedor = document.getElementById("contenedor-historial-ventas-real");
    const labelTotalCaja = document.getElementById("caja-total-recaudado");
    const labelCantCaja = document.getElementById("caja-cantidad-ventas");
    const labelTitulo = document.getElementById("titulo-resumen-periodo");

    if (!contenedor || !labelTotalCaja || !labelCantCaja) return;

    contenedor.innerHTML = "";
    let ahora = new Date();
    let ventasFiltradas = [];

    // Clasificación cronológica líquida real
    _todasLasVentas.forEach(v => {
        if (!v.activa) return;
        let fechaVenta = new Date(v.fecha);

        if (_filtroCajaActual === "DIA") {
            if (fechaVenta.toDateString() === ahora.toDateString()) ventasFiltradas.push(v);
        } else if (_filtroCajaActual === "SEMANA") {
            let hace7Dias = new Date();
            hace7Dias.setDate(ahora.getDate() - 7);
            if (fechaVenta >= hace7Dias) ventasFiltradas.push(v);
        } else if (_filtroCajaActual === "MES") {
            if (fechaVenta.getMonth() === ahora.getMonth() && fechaVenta.getFullYear() === ahora.getFullYear()) {
                ventasFiltradas.push(v);
            }
        }
    });

    // Ordenar de más reciente a más antiguo
    ventasFiltradas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    let totalRecaudado = 0;
    labelTitulo.innerText = `Resumen de Caja (${_filtroCajaActual})`;

    if (ventasFiltradas.length === 0) {
        contenedor.innerHTML = `<div style="text-align:center; padding:20px; color:#8A7A78; font-size:13px; font-weight:600;">No hay transacciones registradas en este período.</div>`;
    }

    ventasFiltradas.forEach((venta, idx) => {
        totalRecaudado += venta.total;
        const fV = new Date(venta.fecha);
        const horaStr = fV.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const tarjeta = document.createElement("div");
        tarjeta.className = "order-card";
        tarjeta.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; flex-direction: column; gap: 3px;">
                    <h4 style="font-size: 14px; font-weight: 700; color: #4A3E3D;">Orden #${1000 + (venta.id || idx)}</h4>
                    <p style="font-size: 11px; color: #777777; font-weight: 500;">Hora: ${horaStr} hs &middot; ${venta.metodoPago}</p>
                    <p style="font-size: 12px; color: #D81B60; font-weight: 600; margin-top:2px;">${venta.detalle}</p>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <span style="font-size: 15px; font-weight: 700; color: #4A3E3D;">$${venta.total.toFixed(2)}</span>
                                       // REEMPLAZO BLINDADO: Botón de anular ticket con SVG puro nativo
                    <button onclick="anularTicketReal(${venta.id})" class="row-btn" style="color: #E53935; background: transparent; border: none; cursor: pointer; padding: 2px;" title="Anular Orden">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>

                </div>
            </div>
            <div class="badge-green">Pagado, Despachado</div>
        `;
        contenedor.appendChild(tarjeta);
    });

    labelTotalCaja.innerText = `$ ${totalRecaudado.toFixed(2)} ARS`;
    labelCantCaja.innerText = ventasFiltradas.length;
    
    actualizarEstiloBotonesFiltroCaja();
    
    // CORREGIDO: Palabra unificada sin espacios ni cortes extraños
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}


function cambiarFiltroTiempoCaja(filtro) {
    _filtroCajaActual = filtro;
    renderizarCajaYHistorialReal();
}

function actualizarEstiloBotonesFiltroCaja() {
    const btnDia = document.getElementById("btn-filtro-dia");
    const btnSem = document.getElementById("btn-filtro-semana");
    const btnMes = document.getElementById("btn-filtro-mes");

    if (!btnDia || !btnSem || !btnMes) return;

    [btnDia, btnSem, btnMes].forEach(btn => {
        btn.style.backgroundColor = "transparent";
        btn.style.border = "1px solid #F48FB1";
        btn.style.color = "#D81B60";
    });

    const activo = _filtroCajaActual === "DIA" ? btnDia : (_filtroCajaActual === "SEMANA" ? btnSem : btnMes);
    activo.style.backgroundColor = "#FCE4C8";
    activo.style.border = "none";
    activo.style.color = "#000000";
}

async function anularTicketReal(id) {
    if (confirm("⚠️ ¿Deseas anular esta orden? El dinero se restará de las métricas de caja.")) {
        await eliminarRegistro("ventas", id);
        await cargarTodoElSistemaReal();
    }
}

// ============================================================================
// ====== MÓDULO 4: RENDERIZADO DE LA PESTAÑA PRINCIPAL (RESUMEN REAL) ======
// ============================================================================

async function renderizarPestañaPrincipalResumen() {
    const totalInsumosLabel = document.getElementById("dash-total-insumos");
    const totalProductosLabel = document.getElementById("dash-total-productos");
    const pedidosActivosLabel = document.getElementById("dash-pedidos-activos");
    const ventasHoyLabel = document.getElementById("dash-ventas-hoy");
    const panelAlertasInsumos = document.getElementById("lista-alertas-insumos");
    const alertasCountLabel = document.getElementById("dash-alertas-insumos-count");

    // MODIFICACIÓN BLINDADA: Evita que si falta un elemento secundario se congele el Dashboard
    if (totalInsumosLabel) totalInsumosLabel.innerText = _todosLosInsumos.length;
    if (totalProductosLabel) totalProductosLabel.innerText = _todosLosProductos.length;

    let contadorAlertas = 0;
    if (panelAlertasInsumos) {
        panelAlertasInsumos.innerHTML = "";

        _todosLosProductos.forEach(p => {
            const stockAct = parseInt(p.stock) || 0;
            const stockMin = parseInt(p.minimo) || 0;
            
            // Si el stock actual es igual o menor al mínimo, salta la alerta roja real
            if (stockAct <= stockMin) {
                contadorAlertas++;
                const item = document.createElement("div");
                item.className = "alert-item";
                item.innerHTML = `
                    <span>${p.nombre} &middot; Stock: ${stockAct} u</span>
                    <i data-lucide="alert-triangle" style="width: 16px; height: 16px; color: #E65100;"></i>
                `;
                panelAlertasInsumos.appendChild(item);
            }
        });
    }

    if (alertasCountLabel) alertasCountLabel.innerText = contadorAlertas;
    // Calcular las ventas reales del día en curso
    let ahoraStr = new Date().toDateString();
    let totalHoy = 0;

    _todasLasVentas.forEach(v => {
        if (!v.activa) return;
        if (new Date(v.fecha).toDateString() === ahoraStr) {
            totalHoy += v.total;
        }
    });

    // Inyectar valores reales en pesos argentinos
    if (ventasHoyLabel) {
        ventasHoyLabel.innerText = `$${totalHoy.toFixed(2)} ARS`;
    }
    
    if (pedidosActivosLabel) {
        // Cuenta cuántos productos reales están por debajo de su stock mínimo de seguridad
        const criticos = _todosLosProductos.filter(p => (parseInt(p.stock) || 0) <= (parseInt(p.minimo) || 0));
        pedidosActivosLabel.innerText = criticos.length;
    }

    // Mantener sincronizado el selector del carrito multiproducto de mostrador
    if (typeof cargarSelectorProductosVenta === 'function') {
        await cargarSelectorProductosVenta();
    }

    // Dibujar de forma segura los vectores Lucide cargados dinámicamente
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("🌸 Métricas reales del Dashboard renderizadas con éxito.");
}
