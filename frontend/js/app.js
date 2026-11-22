
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
document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (typeof dbListo !== "undefined") {
            await dbListo;
        }

        await cargarTodoElSistemaReal();
    } catch (error) {
        console.error("No se pudo iniciar el sistema:", error);
    }
});

async function cargarTodoElSistemaReal() {
    try {
        _todosLosInsumos = await obtenerTodosLosRegistros("insumos");
        _todosLosProductos = await obtenerTodosLosRegistros("productos");
        _todasLasVentas = await obtenerTodosLosRegistros("ventas");

        filtrarInsumosReales();
        filtrarProductosReales();
        await renderizarCajaYHistorialReal();
        await renderizarPestañaPrincipalResumen();
    } catch (ex) {
        console.error("❌ Error de consistencia en el refresco:", ex);
    }
}

// Conversiones admitidas entre unidades de la misma dimension.
const UNIDADES_INSUMO = {
    mm: { dimension: "longitud", base: "cm", factor: 0.1, simbolo: "mm", precision: 1 },
    cm: { dimension: "longitud", base: "cm", factor: 1, simbolo: "cm", precision: 2 },
    m:  { dimension: "longitud", base: "cm", factor: 100, simbolo: "m", precision: 2 },
    g:  { dimension: "masa", base: "g", factor: 1, simbolo: "g", precision: 2 },
    kg: { dimension: "masa", base: "g", factor: 1000, simbolo: "kg", precision: 2 },
    ml: { dimension: "volumen", base: "ml", factor: 1, simbolo: "ml", precision: 2 },
    l:  { dimension: "volumen", base: "ml", factor: 1000, simbolo: "l", precision: 2 },
    u:  { dimension: "cantidad", base: "u", factor: 1, simbolo: "u", precision: 0 }
};

function obtenerFactorConversion(unidadCompra, unidadBase) {
    const compra = UNIDADES_INSUMO[unidadCompra];
    const base = UNIDADES_INSUMO[unidadBase];
    if (!compra || !base || compra.dimension !== base.dimension) {
        throw new Error("La unidad de compra y la unidad base deben pertenecer a la misma dimensión.");
    }
    return compra.factor / base.factor;
}

function calcularDatosCostoInsumo(precioCompra, cantidadPresentacion, unidadCompra, unidadBase, rendimiento) {
    const precio = Number(precioCompra);
    const cantidad = Number(cantidadPresentacion);
    const factor = obtenerFactorConversion(unidadCompra, unidadBase);
    const cantidadBase = cantidad * factor;
    const piezas = Number(rendimiento) || 0;
    if (!Number.isFinite(precio) || precio < 0 || !Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error("Ingresá un precio y una cantidad de presentación válidos.");
    }
    return {
        factorAUnidadBase: factor,
        cantidadUnidadBase: cantidadBase,
        costoPorUnidadBase: precio / cantidadBase,
        costoPorRendimiento: piezas > 0 ? precio / piezas : null
    };
}

function formatoMoneda(valor) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(Number(valor) || 0);
}

// ============================================================================
// ====== MÓDULO 1: GESTIÓN DE INSUMOS REALES Y FILTRADO ACTIVADO ======
// ============================================================================



async function renderizarInsumosReales(listaFiltrada = null) {
    const tbody = document.getElementById("tbody-insumos-reales");
    if (!tbody) return;

    tbody.innerHTML = "";

    const datos = listaFiltrada || _todosLosInsumos;

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center;padding:20px;color:#8A7A78;font-weight:600;">
                    No hay insumos cargados. Presiona '+ Nuevo Insumo'.
                </td>
            </tr>`;
        return;
    }

    // Nombre completo de cada unidad para mostrar en la tabla.
    const nombresUnidades = {
        mm: "Milímetros (MM)",
        cm: "Centímetros (CM)",
        m: "Metros (M)",
        g: "Gramos (G)",
        kg: "Kilogramos (KG)",
        ml: "Mililitros (ML)",
        l: "Litros (L)",
        u: "Unidades (U)"
    };

    datos.forEach(insumo => {
        const unidadBase =
            insumo.unidadControl?.unidadBase ||
            (insumo.unidad === "xM" ? "m" : "u");

        const simbolo =
            UNIDADES_INSUMO[unidadBase]?.simbolo || unidadBase;

        const nombreUnidad =
            nombresUnidades[unidadBase] || unidadBase;

        const precioCompra =
            Number(insumo.precioCompra ?? insumo.precioBase) || 0;

        const rendimiento = Number(insumo.rendimiento) || 0;

        const sucursales = Array.isArray(insumo.sucursales)
            ? insumo.sucursales
            : [];

        const mejor = sucursales.length
            ? [...sucursales].sort(
                (a, b) =>
                    (Number(a.precio) || 0) -
                    (Number(b.precio) || 0)
            )[0]
            : null;

        const precioReferencia = mejor
            ? Number(mejor.precio) || 0
            : precioCompra;

        const cantidadBase =
            Number(insumo.presentacionCompra?.cantidadUnidadBase) || 0;

        const costoBase = cantidadBase > 0
            ? precioReferencia / cantidadBase
            : Number(insumo.costoPorUnidadBase ?? insumo.precioBase) || 0;

        const costoPieza = rendimiento > 0
            ? precioReferencia / rendimiento
            : null;

        const stock =
            Number(insumo.stockUnidadBase ?? insumo.stock) || 0;

        const proveedor = mejor
            ? esc(mejor.nombre)
            : esc(insumo.sucursalInicial || "Sin comercio");

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <!-- Nombre -->
            <td style="
                padding:14px 16px;
                font-weight:700;
                color:#4A3E3D;
            ">
                ${esc(insumo.nombre)}
            </td>

            <!-- Costo por unidad base -->
            <td style="padding:14px 16px;white-space:nowrap;">
                <strong style="
                    font-weight:800;
                    color:#4A3E3D;
                ">
                    ${formatoMoneda(costoBase)}
                </strong>
                <span style="color:#777;">
                    / ${esc(simbolo)}
                </span>
            </td>

            <!-- Unidad base -->
            <td style="
                padding:14px 16px;
                font-weight:600;
                color:#4A3E3D;
                white-space:nowrap;
            ">
                ${esc(nombreUnidad)}
            </td>

            <!-- Rendimiento y costo por pieza -->
            <td style="padding:14px 16px;white-space:nowrap;">
                ${
                    rendimiento > 0
                        ? `
                            <span>${rendimiento} piezas · </span>
                            <strong style="
                                font-weight:800;
                                color:#4A3E3D;
                            ">
                                ${formatoMoneda(costoPieza)} c/u
                            </strong>
                        `
                        : `<span style="color:#888;">Sin rendimiento</span>`
                }
            </td>

            <!-- Comercio y stock -->
            <td style="
                padding:14px 16px;
                color:#2E7D32;
                font-weight:700;
            ">
                ${proveedor}
                <br>
                <small style="color:#777;font-weight:500;">
                    Stock: ${stock} ${esc(simbolo)}
                </small>
            </td>

            <!-- Acciones -->
            <td style="
                padding:10px 12px;
                text-align:center;
                min-width:190px;
                white-space:nowrap;
            ">
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    gap:5px;
                ">
                    <button
                        type="button"
                        onclick="abrirBalanzaComparativa(${Number(insumo.id)})"
                        title="Comparar comercios"
                        style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:4px;
                            padding:7px 8px;
                            border:1px solid #D6E8F8;
                            border-radius:7px;
                            background:#EEF6FD;
                            color:#1E88E5;
                            font-size:10px;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        <i data-lucide="scale" style="width:13px;height:13px;"></i>
                        Comparar
                    </button>

                    <button
                        type="button"
                        onclick="abrirModificarInsumo(${Number(insumo.id)})"
                        title="Modificar insumo"
                        style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:4px;
                            padding:7px 8px;
                            border:1px solid #E5DDE0;
                            border-radius:7px;
                            background:#F8F4F5;
                            color:#4A3E3D;
                            font-size:10px;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        <i data-lucide="edit" style="width:13px;height:13px;"></i>
                        Editar
                    </button>

                    <button
                        type="button"
                        onclick="ejecutarEliminarInsumo(${Number(insumo.id)})"
                        title="Eliminar insumo"
                        style="
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            gap:4px;
                            padding:7px 8px;
                            border:1px solid #F5D5D5;
                            border-radius:7px;
                            background:#FFF0F0;
                            color:#D32F2F;
                            font-size:10px;
                            font-weight:700;
                            cursor:pointer;
                        "
                    >
                        <i data-lucide="trash-2" style="width:13px;height:13px;"></i>
                        Eliminar
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(fila);
    });

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}



function filtrarInsumosReales() {
    const input = document.getElementById("filtro-insumos-input");
    if (!input) return;

    const buscar = input.value.trim().toLowerCase();

    if (!buscar) {
        renderizarInsumosReales(_todosLosInsumos);
    } else {
        const filtrados = _todosLosInsumos.filter(i =>
            String(i.nombre || "").toLowerCase().includes(buscar)
        );

        renderizarInsumosReales(filtrados);
    }
}

function abrirModalNuevoInsumo() {
    document.getElementById("form-real-insumo").reset();
    document.getElementById("insumo-real-id").value = "";
    document.getElementById("titulo-modal-insumo").innerText = "Nuevo Insumo Base";
    document.getElementById("insumo-real-unidad-base").value = "cm";
    document.getElementById("insumo-real-unidad-compra").value = "m";
    document.getElementById("insumo-real-cantidad-presentacion").value = "1";
    actualizarResumenCostoInsumo();
    document.getElementById("modal-alta-insumo").classList.remove("hidden");
}

function cerrarModalNuevoInsumo() {
    document.getElementById("modal-alta-insumo").classList.add("hidden");
}

function abrirModificarInsumo(id) {
    const insumo = _todosLosInsumos.find(i => i.id === id);
    if (!insumo) return;
    document.getElementById("form-real-insumo").reset();
    document.getElementById("insumo-real-id").value = insumo.id;
    document.getElementById("insumo-real-nombre").value = insumo.nombre || "";

    const unidadBase = insumo.unidadControl?.unidadBase || (insumo.unidad === "xM" ? "m" : "u");
    const presentacion = insumo.presentacionCompra || {};
    document.getElementById("insumo-real-unidad-base").value = unidadBase;
    document.getElementById("insumo-real-unidad-compra").value = presentacion.unidad || (unidadBase === "m" ? "m" : unidadBase);
    document.getElementById("insumo-real-cantidad-presentacion").value = presentacion.cantidad || 1;
    document.getElementById("insumo-real-precio").value = insumo.precioCompra ?? insumo.precioBase ?? 0;
    document.getElementById("insumo-real-sucursal").value = insumo.sucursalInicial || "Principal";
    document.getElementById("insumo-real-stock").value = Number(insumo.stockUnidadBase ?? insumo.stock) || 0;
    document.getElementById("insumo-real-rendimiento").value = Number(insumo.rendimiento) || "";
    document.getElementById("titulo-modal-insumo").innerText = "Modificar Insumo";
    actualizarResumenCostoInsumo();
    document.getElementById("modal-alta-insumo").classList.remove("hidden");
}

async function ejecutarEliminarInsumo(id) {
    confirmarAccion(
        "⚠️ ¿Estás seguro de que quieres eliminar este insumo? Esta acción no se puede deshacer.",
        async () => {
            await eliminarRegistro("insumos", id);
            await cargarTodoElSistemaReal();
            alert("Eliminado correctamente");
        }
    );
}

async function abrirBalanzaComparativa(id) {
    const insumo = _todosLosInsumos.find(i => i.id === id);
    if (!insumo) return;

    _idInsumoBalanzaActivo = id;
    _sucursalesBalanzaTemporal = (insumo.sucursales || []).map(s => ({ ...s }));

    document.getElementById("balanza-insumo-id").value = id;
    document.getElementById("balanza-insumo-titulo").innerText =
        `Balanza de Precios: ${insumo.nombre}`;

    renderizarTablaSucursalesBalanza();

    document.getElementById("modal-balanza-sucursales")
        .classList.remove("hidden");
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
            <td style="padding:8px 12px; font-weight:600;">
                ${esc(suc.nombre)}
            </td>
            <td style="padding:8px 12px; font-weight:700; color:#4A3E3D;">
                $${(Number(suc.precio) || 0).toFixed(2)}
            </td>
            <td style="padding:8px 12px; text-align:center;">
                <button onclick="eliminarPrecioSucursalBalanza(${index})"
                    class="row-btn" style="color:#E53935;">
                    <i data-lucide="x" style="width:14px; height:14px;"></i>
                </button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
}

async function agregarPrecioSucursalBalanza() {
    const nombreTienda =
        document.getElementById("balanza-nueva-sucursal").value.trim();

    const precioTienda =
        Number(document.getElementById("balanza-nuevo-precio").value) || 0;

    if (!nombreTienda || precioTienda <= 0) {
        alert("Completa el comercio y un precio válido.");
        return;
    }

    const insumo = _todosLosInsumos.find(
        i => i.id === _idInsumoBalanzaActivo
    );

    if (!insumo) return;

    const precioUnitario = precioTienda;

    _sucursalesBalanzaTemporal.push({
        nombre: nombreTienda,
        precio: precioUnitario
    });

    insumo.sucursales = _sucursalesBalanzaTemporal;

    await guardarRegistro("insumos", insumo);

    document.getElementById("balanza-nueva-sucursal").value = "";
    document.getElementById("balanza-nuevo-precio").value = "";

    renderizarTablaSucursalesBalanza();
    await cargarTodoElSistemaReal();
}

async function eliminarPrecioSucursalBalanza(index) {
    _sucursalesBalanzaTemporal.splice(index, 1);

    const insumo = _todosLosInsumos.find(
        i => i.id === _idInsumoBalanzaActivo
    );

    if (!insumo) return;

    insumo.sucursales = _sucursalesBalanzaTemporal;

    await guardarRegistro("insumos", insumo);

    renderizarTablaSucursalesBalanza();
    await cargarTodoElSistemaReal();
}

// ============================================================================
// ====== MÓDULO 2: PRODUCTOS Y ESCANDALLO ======
// ============================================================================

let _recetaTemporalProducto = [];

async function renderizarProductosReales(listaFiltrada = null) {
    const tbody = document.getElementById("tbody-productos-reales");
    if (!tbody) return;

    tbody.innerHTML = "";

    const datos = listaFiltrada || _todosLosProductos;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;
padding:20px; color:#8A7A78; font-weight:600;">No hay productos en catálogo.</td></tr>`;
        return;
    }

    datos.forEach(prod => {
        const stockActual = parseInt(prod.stock) || 0;
        const stockMinimo = parseInt(prod.minimo) || 0;
        const esStockCritico = stockActual <= stockMinimo;

        const costoFinal = Number(calcularCostoProducto(prod)) || 0;
        const precioVentaSeguro = Number(prod.precioVenta) || 0;

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td style="font-weight:700; color:#4A3E3D; padding:14px 16px;">
                ${esc(prod.nombre)}
            </td>
            <td style="padding:14px 16px;">$${costoFinal.toFixed(2)} ARS</td>
            <td style="color:#D81B60; font-weight:700; padding:14px 16px;">
                $${precioVentaSeguro.toFixed(2)} ARS
            </td>
            <td style="padding:14px 16px; font-weight:600;
                ${esStockCritico ? "color:#E53935; font-weight:700;" : "color:#555555;"}">
                ${stockActual} / <span style="font-size:12px; color:#999999;">${stockMinimo}</span>
            </td>
            <td style="text-align:center; padding:14px 16px; min-width:140px;">
                <button onclick="abrirModificarProducto(${prod.id})"
                    class="row-btn"
                    style="color:#4A3E3D; background:transparent; border:none; cursor:pointer; padding:4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                </button>

                <button onclick="ejecutarEliminarProducto(${prod.id})"
                    class="row-btn"
                    style="color:#E53935; background:transparent; border:none; cursor:pointer; padding:4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
}

function filtrarProductosReales() {
    const input = document.getElementById("filtro-productos-input");
    if (!input) return;

    const buscar = input.value.trim().toLowerCase();

    if (!buscar) {
        renderizarProductosReales(_todosLosProductos);
    } else {
        renderizarProductosReales(
            _todosLosProductos.filter(p =>
                String(p.nombre || "").toLowerCase().includes(buscar)
            )
        );
    }
}

function toggleInfoAdicional() {
    const checkbox = document.getElementById("chk-info-adicional");
    const seccionReceta =
        document.getElementById("seccion-receta-adicional");

    if (checkbox && seccionReceta) {
        if (checkbox.checked) {
            seccionReceta.classList.remove("hidden");
            cargarSelectorInsumosReceta();
        } else {
            seccionReceta.classList.add("hidden");
        }
    }
}

function cargarSelectorInsumosReceta() {
    const select = document.getElementById("receta-insumo-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccionar Insumo --</option>';

    _todosLosInsumos.forEach(insumo => {
        let precioIdeal = Number(insumo.precioBase) || 0;

        if (insumo.sucursales && insumo.sucursales.length > 0) {
            const ordenadas = [...insumo.sucursales].sort(
                (a, b) => (Number(a.precio) || 0) - (Number(b.precio) || 0)
            );

            precioIdeal = Number(ordenadas[0].precio) || 0;
        }

        const opcion = document.createElement("option");
        opcion.value = insumo.id;
        opcion.dataset.precio = precioIdeal;
        opcion.dataset.nombre = insumo.nombre;
        opcion.innerText = `${insumo.nombre} ($${precioIdeal.toFixed(2)})`;

        select.appendChild(opcion);
    });
}

function agregarInsumoARecetaTemporal() {
    const select = document.getElementById("receta-insumo-select");
    const inputCantidad = document.getElementById("receta-insumo-cantidad");

    if (!select || !inputCantidad) return;

    const idInsumo = parseInt(select.value);
    const cantidad = parseFloat(inputCantidad.value) || 0;

    if (!idInsumo || cantidad <= 0) {
        alert("Datos inválidos.");
        return;
    }

    const opcion = select.options[select.selectedIndex];
    const nombre = opcion.dataset.nombre;
    const precioUnitario = Number(opcion.dataset.precio) || 0;
    const costoParcial = precioUnitario * cantidad;

    const existente = _recetaTemporalProducto.find(
        linea => linea.insumoId === idInsumo
    );

    if (existente) {
        existente.cantidad += cantidad;
        existente.costoParcial = existente.cantidad * precioUnitario;
    } else {
        _recetaTemporalProducto.push({
            insumoId: idInsumo,
            nombre,
            cantidad,
            precioUnitario,
            costoParcial
        });
    }

    inputCantidad.value = "";
    select.value = "";

    renderizarRecetaTemporalFormulario();
}

function renderizarRecetaTemporalFormulario() {
    const tbody = document.getElementById("tbody-receta-temporal");
    if (!tbody) return;

    tbody.innerHTML = "";

    _recetaTemporalProducto.forEach((linea, index) => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td style="padding:6px 10px;">${esc(linea.nombre)}</td>
            <td style="padding:6px 10px; text-align:center;">
                ${linea.cantidad}
            </td>
            <td style="padding:6px 10px; text-align:right; font-weight:700;">
                $${(Number(linea.costoParcial) || 0).toFixed(2)}
            </td>
            <td style="padding:6px 10px; text-align:center;">
                <button type="button"
                    onclick="eliminarLineaRecetaTemporal(${index})"
                    class="row-btn"
                    style="color:#E53935;">
                    <i data-lucide="x" style="width:14px; height:14px;"></i>
                </button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();

    calcularPrecioSugeridoReal();
}

function eliminarLineaRecetaTemporal(index) {
    _recetaTemporalProducto.splice(index, 1);
    renderizarRecetaTemporalFormulario();
}

function calcularPrecioSugeridoReal() {
    const labelCosto = document.getElementById("calc-costo-total");
    const labelSugerido = document.getElementById("calc-precio-sugerido");
    const inputMargen = document.getElementById("prod-real-margen");
    const selectTipo = document.getElementById("prod-real-tipo-margen");
    const inputManoObra = document.getElementById("prod-real-mano-obra");

    if (!labelCosto || !labelSugerido || !inputMargen || !selectTipo) return;

    const costoTotal = _recetaTemporalProducto.reduce(
        (sum, linea) => sum + (Number(linea.costoParcial) || 0),
        0
    );

    labelCosto.innerText = `$${costoTotal.toFixed(2)} ARS`;

    const manoObra = inputManoObra
        ? Number(inputManoObra.value) || 0
        : 0;

    const costoMasManoObra = costoTotal + manoObra;
    const margen = Number(inputMargen.value) || 0;
    const tipo = selectTipo.value;

    const precioSugerido = tipo === "porcentaje"
        ? costoMasManoObra + (costoMasManoObra * (margen / 100))
        : costoMasManoObra + margen;

    labelSugerido.innerText = `$${precioSugerido.toFixed(2)} ARS`;
}

function abrirModalNuevoProducto() {
    const form = document.getElementById("form-real-producto");
    if (form) form.reset();

    document.getElementById("producto-real-id").value = "";
    document.getElementById("titulo-modal-producto").innerText =
        "Nuevo Producto para Catálogo";

    _recetaTemporalProducto = [];
    renderizarRecetaTemporalFormulario();

    document.getElementById("chk-info-adicional").checked = false;
    document.getElementById("seccion-receta-adicional").classList.add("hidden");

    document.getElementById("calc-costo-total").innerText = "$0.00 ARS";
    document.getElementById("calc-precio-sugerido").innerText = "$0.00 ARS";

    document.getElementById("modal-alta-producto").classList.remove("hidden");
}

function cerrarModalNuevoProducto() {
    document.getElementById("modal-alta-producto").classList.add("hidden");
}

async function guardarProductoReal(event) {
    event.preventDefault();

    const idStr = document.getElementById("producto-real-id").value;
    const nombre = document.getElementById("prod-real-nombre").value.trim();
    const precioVenta =
        Number(document.getElementById("prod-real-venta").value) || 0;
    const stock =
        parseInt(document.getElementById("prod-real-stock").value) || 0;
    const minimo =
        parseInt(document.getElementById("prod-real-minimo").value) || 0;

    const usaInfoAdicional =
        document.getElementById("chk-info-adicional").checked;

    const manoObra = usaInfoAdicional
        ? (Number(document.getElementById("prod-real-mano-obra")?.value) || 0)
        : 0;

    const costoInsumos = usaInfoAdicional
        ? _recetaTemporalProducto.reduce(
            (sum, linea) => sum + (Number(linea.costoParcial) || 0),
            0
        )
        : 0;

    const objetoProducto = {
        nombre,
        precioVenta,
        stock,
        minimo,
        usaReceta: usaInfoAdicional,
        receta: usaInfoAdicional
            ? structuredClone(_recetaTemporalProducto)
            : [],
        manoObra,
        costoProduccionFijo: costoInsumos + manoObra,
        margenGuardado:
            Number(document.getElementById("prod-real-margen").value) || 0,
        tipoMargenGuardado:
            document.getElementById("prod-real-tipo-margen").value
    };

    if (idStr) objetoProducto.id = parseInt(idStr);

    await guardarRegistro("productos", objetoProducto);

    cerrarModalNuevoProducto();
    await cargarTodoElSistemaReal();
}

function abrirModificarProducto(id) {
    const prod = _todosLosProductos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById("producto-real-id").value = prod.id;
    document.getElementById("prod-real-nombre").value = prod.nombre || "";
    document.getElementById("prod-real-venta").value = prod.precioVenta || 0;
    document.getElementById("prod-real-stock").value = prod.stock || 0;
    document.getElementById("prod-real-minimo").value = prod.minimo || 0;

    document.getElementById("prod-real-margen").value =
        prod.margenGuardado || 100;

    document.getElementById("prod-real-tipo-margen").value =
        prod.tipoMargenGuardado || "porcentaje";

    document.getElementById("prod-real-mano-obra").value =
        prod.manoObra || "";

    _recetaTemporalProducto = structuredClone(prod.receta || []);
    renderizarRecetaTemporalFormulario();

    document.getElementById("chk-info-adicional").checked = !!prod.usaReceta;

    document.getElementById("seccion-receta-adicional")
        .classList.toggle("hidden", !prod.usaReceta);

    if (prod.usaReceta) cargarSelectorInsumosReceta();

    document.getElementById("titulo-modal-producto").innerText =
        "Modificar Accesorio";

    document.getElementById("modal-alta-producto").classList.remove("hidden");
}

async function ejecutarEliminarProducto(id) {
    if (confirm("⚠️ ¿Estás seguro de eliminar este producto del catálogo de venta?")) {
        await eliminarRegistro("productos", id);
        await cargarTodoElSistemaReal();
    }
}

// ============================================================================
// ====== MÓDULO 3: CAJA REGISTRADORA ======
// ============================================================================

let _carritoMostradorTemporal = [];

async function cargarSelectorProductosVenta() {
    const select = document.getElementById("carrito-producto-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Elige del catálogo--</option>';

    _todosLosProductos.forEach(prod => {
        const opcion = document.createElement("option");

        opcion.value = prod.id;
        opcion.dataset.nombre = prod.nombre;
        opcion.dataset.precio = Number(prod.precioVenta) || 0;

        opcion.innerText =
            `${prod.nombre} ($${(Number(prod.precioVenta) || 0).toFixed(2)})`;

        select.appendChild(opcion);
    });
}

function agregarLineaAlCarritoTemporal() {
    const select = document.getElementById("carrito-producto-select");
    const inputCantidad = document.getElementById("carrito-cantidad-input");

    if (!select || !inputCantidad) return;

    const idProd = parseInt(select.value);
    const cantidad = parseInt(inputCantidad.value) || 0;

    if (!idProd || cantidad <= 0) {
        alert("Datos inválidos.");
        return;
    }

    const opcion = select.options[select.selectedIndex];
    const nombre = opcion.dataset.nombre;
    const precioUnitario = Number(opcion.dataset.precio) || 0;
    const subtotal = precioUnitario * cantidad;

    const existente = _carritoMostradorTemporal.find(
        item => item.productoId === idProd
    );

    if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * precioUnitario;
    } else {
        _carritoMostradorTemporal.push({
            productoId: idProd,
            nombre,
            cantidad,
            precioUnitario,
            subtotal
        });
    }

    inputCantidad.value = "1";
    select.value = "";

    renderizarCarritoMostrador();
}

function renderizarCarritoMostrador() {
    const tbody = document.getElementById("tbody-carrito-mostrador");
    const labelTotal =
        document.getElementById("label-total-carrito-mostrador");

    if (!tbody || !labelTotal) return;

    tbody.innerHTML = "";
    let totalAcumulado = 0;

    if (_carritoMostradorTemporal.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3"
            style="text-align:center; padding:12px; color:#999999; font-size:12px;">
            Carrito vacío
        </td></tr>`;

        labelTotal.innerText = "$ 0.00 ARS";
        return;
    }

    _carritoMostradorTemporal.forEach((item, index) => {
        totalAcumulado += Number(item.subtotal) || 0;

        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td style="padding:8px 10px; font-weight:600; color:#4A3E3D;">
                ${esc(item.nombre)} x ${item.cantidad}u
            </td>
            <td style="padding:8px 10px; text-align:right; font-weight:700; color:#C55A11;">
                $${(Number(item.subtotal) || 0).toFixed(2)}
            </td>
            <td style="padding:8px 10px; text-align:center;">
                <button type="button"
                    onclick="eliminarLineaCarritoMostrador(${index})"
                    class="row-btn"
                    style="color:#E53935; background:transparent; border:none; cursor:pointer; padding:2px;">
                    <svg width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </button>
            </td>
        `;

        tbody.appendChild(fila);
    });

    labelTotal.innerText = `$ ${totalAcumulado.toFixed(2)} ARS`;
}

function eliminarLineaCarritoMostrador(index) {
    _carritoMostradorTemporal.splice(index, 1);
    renderizarCarritoMostrador();
}

async function confirmarYRegistrarVentaConjunta() {
    if (_carritoMostradorTemporal.length === 0) {
        alert("Carrito vacío.");
        return;
    }

    const selectMetodo = document.getElementById("carrito-metodo-pago");
    const metodoPago = selectMetodo ? selectMetodo.value : "Efectivo";

    const totalTicket = _carritoMostradorTemporal.reduce(
        (sum, item) => sum + (Number(item.subtotal) || 0),
        0
    );

    for (const item of _carritoMostradorTemporal) {
        const producto = _todosLosProductos.find(
            p => p.id === item.productoId
        );

        if (!producto) {
            alert(`El producto "${item.nombre}" ya no existe.`);
            return;
        }

        if (item.cantidad > (parseInt(producto.stock) || 0)) {
            if (!confirm(`Stock insuficiente para ${producto.nombre}. ¿Registrar igual?`)) {
                return;
            }
        }
    }

    const productosMod = new Map();
    const insumosMod = new Map();

    const obtenerInsumo = (id) => {
        if (!insumosMod.has(id)) {
            const original = _todosLosInsumos.find(i => i.id === id);

            if (original) {
                insumosMod.set(id, { ...original });
            }
        }

        return insumosMod.get(id);
    };

    const itemsTicket = [];

    for (const item of _carritoMostradorTemporal) {
        const producto = _todosLosProductos.find(
            p => p.id === item.productoId
        );

        productosMod.set(producto.id, {
            ...producto,
            stock: Math.max(
                0,
                (parseInt(producto.stock) || 0) - item.cantidad
            )
        });

        const consumoInsumos = [];

        if (producto.usaReceta && Array.isArray(producto.receta)) {
            for (const linea of producto.receta) {
                const insumo = obtenerInsumo(linea.insumoId);
                if (!insumo) continue;

                const cantidadConsumida =
                    (Number(linea.cantidad) || 0) * item.cantidad;

                insumo.stock = Math.max(
                    0,
                    (Number(insumo.stock) || 0) - cantidadConsumida
                );

                consumoInsumos.push({
                    insumoId: linea.insumoId,
                    cantidad: cantidadConsumida
                });
            }
        }

        itemsTicket.push({
            ...item,
            consumoInsumos
        });
    }

    const nuevaVentaReal = {
        total: totalTicket,
        metodoPago,
        fecha: new Date().toISOString(),
        detalle: _carritoMostradorTemporal
            .map(i => `${i.nombre} (${i.cantidad}u)`)
            .join(", "),
        items: itemsTicket,
        activa: true
    };

    try {
        for (const producto of productosMod.values()) {
            await guardarRegistro("productos", producto);
        }

        for (const insumo of insumosMod.values()) {
            await guardarRegistro("insumos", insumo);
        }

        await guardarRegistro("ventas", nuevaVentaReal);

        _carritoMostradorTemporal = [];
        renderizarCarritoMostrador();

        await cargarTodoElSistemaReal();

        alert(`🌸 Venta asentada: $${totalTicket.toFixed(2)} ARS`);
    } catch (ex) {
        console.error("Error guardando la venta:", ex);
        alert("Error guardando la venta.");
    }
}

async function renderizarCajaYHistorialReal() {
    const contenedor =
        document.getElementById("contenedor-historial-ventas-real");

    const labelTotalCaja =
        document.getElementById("caja-total-recaudado");

    const labelCantCaja =
        document.getElementById("caja-cantidad-ventas");

    const labelTitulo =
        document.getElementById("titulo-resumen-periodo");

    if (!contenedor || !labelTotalCaja || !labelCantCaja) return;

    contenedor.innerHTML = "";

    const ahora = new Date();
    const ventasFiltradas = [];

    _todasLasVentas.forEach(venta => {
        if (!venta.activa) return;

        const fechaVenta = new Date(venta.fecha);

        if (_filtroCajaActual === "DIA") {
            if (fechaVenta.toDateString() === ahora.toDateString()) {
                ventasFiltradas.push(venta);
            }
        } else if (_filtroCajaActual === "SEMANA") {
            const hace7Dias = new Date();
            hace7Dias.setDate(ahora.getDate() - 7);

            if (fechaVenta >= hace7Dias) {
                ventasFiltradas.push(venta);
            }
        } else if (_filtroCajaActual === "MES") {
            if (
                fechaVenta.getMonth() === ahora.getMonth() &&
                fechaVenta.getFullYear() === ahora.getFullYear()
            ) {
                ventasFiltradas.push(venta);
            }
        }
    });

    ventasFiltradas.sort(
        (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    let totalRecaudado = 0;

    if (labelTitulo) {
        labelTitulo.innerText = `Resumen de Caja (${_filtroCajaActual})`;
    }

    if (ventasFiltradas.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align:center; padding:20px; color:#8A7A78; font-size:13px;">
                No hay ventas en este período.
            </div>
        `;
    }

    ventasFiltradas.forEach((venta, idx) => {
        const totalVenta = Number(venta.total) || 0;
        totalRecaudado += totalVenta;

        const fechaVenta = new Date(venta.fecha);

        const horaStr = fechaVenta.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        const tarjeta = document.createElement("div");
        tarjeta.className = "order-card";

        tarjeta.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="display:flex; flex-direction:column; gap:3px;">
                    <h4 style="font-size:14px; font-weight:700; color:#4A3E3D;">
                        Orden #${1000 + (venta.id || idx)}
                    </h4>

                    <p style="font-size:11px; color:#777777; font-weight:500;">
                        Hora: ${horaStr} hs &middot; ${esc(venta.metodoPago)}
                    </p>

                    <p style="font-size:12px; color:#D81B60; font-weight:600; margin-top:2px;">
                        ${esc(venta.detalle)}
                    </p>
                </div>

                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                    <span style="font-size:15px; font-weight:700; color:#4A3E3D;">
                        $${totalVenta.toFixed(2)}
                    </span>

                    <button onclick="anularTicketReal(${venta.id})"
                        class="row-btn"
                        style="color:#E53935; background:transparent; border:none; cursor:pointer; padding:2px;">
                        <svg width="15" height="15" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" stroke-width="2.5"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
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

    if (typeof lucide !== "undefined") lucide.createIcons();
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

    const activo = _filtroCajaActual === "DIA"
        ? btnDia
        : (_filtroCajaActual === "SEMANA" ? btnSem : btnMes);

    activo.style.backgroundColor = "#FCE4C8";
    activo.style.border = "none";
    activo.style.color = "#000000";
}

async function anularTicketReal(id) {
    if (!confirm("⚠️ ¿Deseas anular esta orden? Se devolverá el stock.")) {
        return;
    }

    // Corrección del error de escritura: _todasLasVentas.
    const venta = _todasLasVentas.find(v => v.id === id);

    try {
        if (venta && Array.isArray(venta.items)) {
            for (const item of venta.items) {
                const producto = _todosLosProductos.find(
                    p => p.id === item.productoId
                );

                if (producto) {
                    producto.stock =
                        (parseInt(producto.stock) || 0) + item.cantidad;

                    await guardarRegistro("productos", producto);
                }

                for (const consumo of (item.consumoInsumos || [])) {
                    const insumo = _todosLosInsumos.find(
                        i => i.id === consumo.insumoId
                    );

                    if (insumo) {
                        insumo.stock =
                            (Number(insumo.stock) || 0) + consumo.cantidad;

                        await guardarRegistro("insumos", insumo);
                    }
                }
            }
        }

        await eliminarRegistro("ventas", id);
    } catch (ex) {
        console.error("Error al anular el ticket:", ex);
        alert("Error al anular.");
    }

    await cargarTodoElSistemaReal();
}

// ============================================================================
// ====== MÓDULO 4: RESUMEN DASHBOARD ======
// ============================================================================

async function renderizarPestañaPrincipalResumen() {
    const totalInsumosLabel =
        document.getElementById("dash-total-insumos");

    const totalProductosLabel =
        document.getElementById("dash-total-productos");

    const pedidosActivosLabel =
        document.getElementById("dash-pedidos-activos");

    const ventasHoyLabel =
        document.getElementById("dash-ventas-hoy");

    const panelAlertasInsumos =
        document.getElementById("lista-alertas-insumos");

    const alertasCountLabel =
        document.getElementById("dash-alertas-insumos-count");

    if (totalInsumosLabel) {
        totalInsumosLabel.innerText = _todosLosInsumos.length;
    }

    if (totalProductosLabel) {
        totalProductosLabel.innerText = _todosLosProductos.length;
    }

    let contadorAlertas = 0;

    if (panelAlertasInsumos) {
        panelAlertasInsumos.innerHTML = "";

        _todosLosProductos.forEach(producto => {
            const stockActual = parseInt(producto.stock) || 0;
            const stockMinimo = parseInt(producto.minimo) || 0;

            if (stockActual <= stockMinimo) {
                contadorAlertas++;

                const item = document.createElement("div");
                item.className = "alert-item";

                item.innerHTML = `
                    <span>${esc(producto.nombre)} &middot; Stock: ${stockActual} u</span>
                    <i data-lucide="alert-triangle"
                        style="width:16px; height:16px; color:#E65100;">
                    </i>
                `;

                panelAlertasInsumos.appendChild(item);
            }
        });
    }

    if (alertasCountLabel) {
        alertasCountLabel.innerText = contadorAlertas;
    }

    const ahora = new Date();
    let totalHoy = 0;

    const diasSemana = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
    const montos7Dias = [0, 0, 0, 0, 0, 0, 0];
    const etiquetas7Dias = [];

    for (let i = 6; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(ahora.getDate() - i);

        etiquetas7Dias.push(
            `${diasSemana[fecha.getDay()]} ${fecha.getDate()}`
        );

        _todasLasVentas.forEach(venta => {
            if (
                venta.activa &&
                new Date(venta.fecha).toDateString() === fecha.toDateString()
            ) {
                const total = Number(venta.total) || 0;

                montos7Dias[6 - i] += total;

                if (i === 0) {
                    totalHoy += total;
                }
            }
        });
    }

    if (ventasHoyLabel) {
        ventasHoyLabel.innerText = `$${totalHoy.toFixed(2)} ARS`;
    }

    if (pedidosActivosLabel) {
        pedidosActivosLabel.innerText = _todosLosProductos.filter(
            producto =>
                (parseInt(producto.stock) || 0) <=
                (parseInt(producto.minimo) || 0)
        ).length;
    }

    const contenedorGrafico =
        document.querySelector(".chart-container");

    if (contenedorGrafico) {
        const maxMonto = Math.max(...montos7Dias, 1000);

        contenedorGrafico.innerHTML = `
            <div class="chart-line-bg">
                <div></div><div></div><div></div><div></div>
            </div>
        `;

        montos7Dias.forEach((monto, idx) => {
            const alturaPorcentaje = Math.min(
                90,
                Math.max(10, (monto / maxMonto) * 90)
            );

            const esHoy = idx === 6;
            const columnaWrapper = document.createElement("div");

            columnaWrapper.className = "chart-bar-wrapper";

            columnaWrapper.innerHTML = `
                <span style="font-size:10px; font-weight:700; color:#4A3E3D;">
                    $${monto.toFixed(0)}
                </span>

                <div class="chart-bar"
                    style="height:${alturaPorcentaje}px;
                    background-color:${esHoy ? "#D81B60" : "#F48FB1"};
                    width:16px; border-radius:4px 4px 0 0;
                    transition:height 0.3s;">
                </div>

                <span style="font-size:10px; color:#8A7A78; font-weight:600;">
                    ${etiquetas7Dias[idx]}
                </span>
            `;

            contenedorGrafico.appendChild(columnaWrapper);
        });
    }

    if (typeof cargarSelectorProductosVenta === "function") {
        await cargarSelectorProductosVenta();
    }

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

// ============================================================================
// ====== FUNCIONES AUXILIARES DE INSUMOS Y COSTOS ======
// ============================================================================

function actualizarResumenCostoInsumo() {
    const precio = Number(document.getElementById("insumo-real-precio")?.value) || 0;
    const cantidad = Number(document.getElementById("insumo-real-cantidad-presentacion")?.value) || 0;
    const unidadCompra = document.getElementById("insumo-real-unidad-compra")?.value || "m";
    const unidadBase = document.getElementById("insumo-real-unidad-base")?.value || "cm";
    const rendimiento = Number(document.getElementById("insumo-real-rendimiento")?.value) || 0;
    const salida = document.getElementById("insumo-real-resumen-costos");
    if (!salida) return;
    try {
        const calculo = calcularDatosCostoInsumo(precio, cantidad, unidadCompra, unidadBase, rendimiento);
        const simbolo = UNIDADES_INSUMO[unidadBase].simbolo;
        salida.innerHTML = `Costo por ${esc(simbolo)}: <strong>${formatoMoneda(calculo.costoPorUnidadBase)}</strong>${rendimiento > 0 ? `<br>Costo por pieza según rendimiento: <strong>${formatoMoneda(calculo.costoPorRendimiento)}</strong>` : ""}`;
    } catch (error) {
        salida.textContent = error.message;
    }
}

function toggleCamposRendimiento() {
    actualizarResumenCostoInsumo();
}

async function guardarInsumoReal(event) {
    event.preventDefault();
    const idStr = document.getElementById("insumo-real-id").value;
    const nombre = document.getElementById("insumo-real-nombre").value.trim();
    const precio = Number(document.getElementById("insumo-real-precio").value);
    const cantidadPresentacion = Number(document.getElementById("insumo-real-cantidad-presentacion").value);
    const unidadCompra = document.getElementById("insumo-real-unidad-compra").value;
    const unidadBase = document.getElementById("insumo-real-unidad-base").value;
    const rendimiento = Number(document.getElementById("insumo-real-rendimiento").value) || 0;
    const sucursal = document.getElementById("insumo-real-sucursal").value.trim();
    const stock = Math.max(0, Number(document.getElementById("insumo-real-stock").value) || 0);

    if (!nombre || !sucursal || !Number.isFinite(precio) || precio < 0) {
        alert("Completá el nombre, el comercio y un precio válido.");
        return;
    }
    if (rendimiento < 0) { alert("El rendimiento no puede ser negativo."); return; }

    let calculo;
    try { calculo = calcularDatosCostoInsumo(precio, cantidadPresentacion, unidadCompra, unidadBase, rendimiento); }
    catch (error) { alert(error.message); return; }

    const viejo = idStr ? _todosLosInsumos.find(i => i.id === Number(idStr)) : null;
    if (idStr && !viejo) { alert("El insumo ya no existe."); return; }

    const sucursales = (viejo?.sucursales || []).map(s => ({ ...s }));
    const indice = sucursales.findIndex(s => s.nombre === (viejo?.sucursalInicial || sucursal));
    const precioSucursal = { nombre: sucursal, precio };
    if (indice >= 0) sucursales[indice] = precioSucursal;
    else sucursales.unshift(precioSucursal);

    const unidadInfo = UNIDADES_INSUMO[unidadBase];
    const objetoInsumo = {
        ...(viejo || {}),
        nombre,
        unidad: unidadBase === "u" ? "xU" : "xM", // compatibilidad temporal con módulos anteriores
        unidadControl: { dimension: unidadInfo.dimension, unidadBase, simbolo: unidadInfo.simbolo, precision: unidadInfo.precision },
        presentacionCompra: { cantidad: cantidadPresentacion, unidad: unidadCompra, factorAUnidadBase: calculo.factorAUnidadBase, cantidadUnidadBase: calculo.cantidadUnidadBase },
        presentacionesCompra: [{ nombre: `${cantidadPresentacion} ${unidadCompra}`, cantidad: cantidadPresentacion, unidad: unidadCompra, factorAUnidadBase: calculo.factorAUnidadBase }],
        precioCompra: precio,
        precioBase: calculo.costoPorUnidadBase,
        costoPorUnidadBase: calculo.costoPorUnidadBase,
        rendimiento: rendimiento > 0 ? rendimiento : null,
        costoPorRendimiento: calculo.costoPorRendimiento,
        sucursalInicial: sucursal,
        sucursales,
        stockUnidadBase: stock,
        stock,
        factorLegado: viejo?.factorLegado ?? viejo?.factor ?? null
    };

    await guardarRegistro("insumos", objetoInsumo);
    cerrarModalNuevoInsumo();
    await cargarTodoElSistemaReal();
}

// Escapa texto para evitar insertar HTML no deseado en las tablas.
function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[caracter]));
}

// ============================================================================
// ====== CÁLCULO DE COSTOS DE PRODUCTOS ======
// ============================================================================

// Corrección del error que provocaba el toFixed() sobre undefined.

function cargarSelectorInsumosReceta() {
    const select = document.getElementById("receta-insumo-select");
    if (!select) return;

    select.innerHTML = '<option value="">-- Seleccionar Insumo --</option>';

    _todosLosInsumos.forEach(insumo => {
        const precioUnitario = precioIdealInsumo(insumo);

        const opcion = document.createElement("option");
        opcion.value = insumo.id;
        opcion.dataset.precio = precioUnitario;
        opcion.dataset.nombre = insumo.nombre;

        opcion.innerText =
            `${insumo.nombre} (${formatoMoneda(precioUnitario)} c/u)`;

        select.appendChild(opcion);
    });
}


function agregarInsumoARecetaTemporal() {
    const select = document.getElementById("receta-insumo-select");
    const inputCantidad = document.getElementById("receta-insumo-cantidad");

    if (!select || !inputCantidad) return;

    const idInsumo = parseInt(select.value);
    const cantidad = parseFloat(inputCantidad.value) || 0;

    if (!idInsumo || cantidad <= 0) {
        alert("Datos inválidos.");
        return;
    }

    const opcion = select.options[select.selectedIndex];

    const nombre = opcion.dataset.nombre;
    const precioUnitario = Number(opcion.dataset.precio) || 0;

    // El costo se calcula usando el costo por pieza del insumo.
    const costoParcial = precioUnitario * cantidad;

    const existente = _recetaTemporalProducto.find(
        linea => Number(linea.insumoId) === idInsumo
    );

    if (existente) {
        existente.cantidad += cantidad;
        existente.precioUnitario = precioUnitario;
        existente.costoParcial =
            existente.cantidad * precioUnitario;
    } else {
        _recetaTemporalProducto.push({
            insumoId: idInsumo,
            nombre,
            cantidad,
            precioUnitario,
            costoParcial
        });
    }

    inputCantidad.value = "";
    select.value = "";

    renderizarRecetaTemporalFormulario();
}


// ============================================================================
// ====== CÁLCULO DE COSTOS DE PRODUCTOS ======
// ============================================================================

function calcularCostoProducto(prod) {
    if (!prod || typeof prod !== "object") {
        return 0;
    }

    if (!prod.usaReceta || !Array.isArray(prod.receta)) {
        return Number(prod.costoProduccionFijo) || 0;
    }

    const costoInsumos = prod.receta.reduce((suma, linea) => {

        const insumo = _todosLosInsumos.find(
            i => Number(i.id) === Number(linea.insumoId)
        );

        // Si el insumo existe, utilizamos su costo actualizado.
        // Si no existe, conservamos el precio guardado en la receta.
        const precio = insumo
            ? precioIdealInsumo(insumo)
            : (Number(linea.precioUnitario) || 0);

        const cantidad = Number(linea.cantidad) || 0;

        return suma + (precio * cantidad);

    }, 0);

    return costoInsumos + (Number(prod.manoObra) || 0);
}


// ============================================================================
// ====== OBTENER COSTO CORRECTO DEL INSUMO ======
// ============================================================================

function precioIdealInsumo(insumo) {
    if (!insumo) return 0;

    const rendimiento = Number(insumo.rendimiento) || 0;

    // PRIORIDAD 1: costo por pieza según rendimiento.
    if (rendimiento > 0) {

        const costoPorPieza = Number(insumo.costoPorRendimiento);

        if (Number.isFinite(costoPorPieza) && costoPorPieza >= 0) {
            return costoPorPieza;
        }

        // Compatibilidad con insumos anteriores.
        const precioCompra = Number(insumo.precioCompra) || 0;

        if (precioCompra > 0) {
            return precioCompra / rendimiento;
        }
    }

    // PRIORIDAD 2: costo por unidad base.
    const costoUnidadBase =
        Number(insumo.costoPorUnidadBase ?? insumo.precioBase);

    return Number.isFinite(costoUnidadBase) && costoUnidadBase >= 0
        ? costoUnidadBase
        : 0;
}


// Confirmación reutilizable para acciones destructivas.
function confirmarAccion(mensaje, callback) {
    if (confirm(mensaje)) {
        callback();
    }
}
