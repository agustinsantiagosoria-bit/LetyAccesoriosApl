// ====== CONTROLADOR PRINCIPAL INTERACTIVO DE LETY ACCESORIOS ======

document.addEventListener("DOMContentLoaded", () => {
    // Escuchar cambios iniciales de renderizado al conectar la base de datos
    setTimeout(async () => {
        try {
            await actualizarTablasYPaneles();
        } catch (error) {
            console.warn("Esperando inicialización completa de IndexedDB...");
        }
    }, 300);
});

// Función global para actualizar de forma masiva los datos vivos de la pantalla
async function actualizarTablasYPaneles() {
    await renderizarInsumos();
    // Nota: En la parte 2 agregaremos el renderizado de productos y totales de ventas
}

// 1. RENDERIZADO DE LA TABLA EXCEL DE INSUMOS Y SUS ALERTAS CRÍTICAS
async function renderizarInsumos() {
    const listaInsumos = await obtenerTodosLosRegistros("insumos");
    const tbody = document.querySelector("#pestaña-insumos table tbody");
    const panelAlertas = document.getElementById("lista-alertas-insumos");
    const totalInsumosLabel = document.getElementById("dash-total-insumos");
    const alertasCountLabel = document.getElementById("dash-alertas-insumos-count");

    if (!tbody) return;

    // Actualizar los contadores superiores líquidos del Dashboard
    if (totalInsumosLabel) totalInsumosLabel.innerText = listaInsumos.length;

    // Limpiar contenedores
    tbody.innerHTML = "";
    if (panelAlertas) panelAlertas.innerHTML = "";

    let contadorAlertas = 0;

    listaInsumos.forEach(insumo => {
        // Validación de alerta de stock crítico (Por ejemplo, menor o igual a 10 unidades por defecto)
        const stockActual = parseFloat(insumo.stock) || 0;
        const esCritico = stockActual <= 10;

        // Inyectar fila limpia estilo Excel en la tabla de insumos (Foto 2 Izquierda)
        const fila = document.createElement("tr");
        fila.className = "hover:bg-gray-50/50 border-b border-gray-100 transition";
        fila.innerHTML = `
            <td class="p-3 font-semibold text-[#4A3E3D]">${insumo.nombre}</td>
            <td class="p-3">$${parseFloat(insumo.precio).toFixed(2)}/u</td>
            <td class="p-3 ${esCritico ? 'text-red-600 font-bold' : ''}">${insumo.stock}u</td>
            <td class="p-3 text-emerald-700 font-bold">${insumo.distribuidora || 'Distribuidor Ideal'}</td>
            <td class="p-3 text-center space-x-2">
                <button onclick="eliminarInsumoDeTabla(${insumo.id})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);

        // Si es crítico, agregar tarjeta de alerta visual en el panel lateral (Foto 3)
        if (esCritico && panelAlertas) {
            contadorAlertas++;
            const tarjetaAlerta = document.createElement("div");
            tarjetaAlerta.className = "bg-[#FFF3E0] px-3 py-2 rounded-xl flex justify-between items-center border border-[#FFE0B2] animate-fade-in";
            tarjetaAlerta.innerHTML = `
                <span class="text-xs font-semibold text-[#A04000]">${insumo.nombre} &middot; ${insumo.stock}u</span>
                <i data-lucide="alert-triangle" class="w-4 h-4 text-[#E65100]"></i>
            `;
            panelAlertas.appendChild(tarjetaAlerta);
        }
    });

    if (alertasCountLabel) alertasCountLabel.innerText = contadorAlertas;
    
    // Volver a dibujar los iconos vectoriales cargados dinámicamente
    lucide.createIcons();
}

// Acción del botón borrar insumo con confirmación limpia nativa
async function eliminarInsumoDeTabla(id) {
    if (confirm("¿Seguro que deseas eliminar este insumo del inventario?")) {
        await eliminarRegistro("insumos", id);
        await actualizarTablasYPaneles();
    }
}
// 2. RENDERIZADO DEL CATÁLOGO DE PRODUCCIÓN (TABLA EXCEL DERECHA)
async function renderizarProductos() {
    const listaProductos = await obtenerTodosLosRegistros("productos");
    const tbody = document.querySelector("#pestaña-productos table tbody");
    const totalProductosLabel = document.getElementById("dash-total-productos");

    if (!tbody) return;

    // Actualizar contador del Dashboard superior (Foto 3)
    if (totalProductosLabel) totalProductosLabel.innerText = listaProductos.length;

    tbody.innerHTML = "";

    listaProductos.forEach(prod => {
        const fila = document.createElement("tr");
        fila.className = "hover:bg-gray-50/50 border-b border-gray-100 transition";
        fila.innerHTML = `
            <td class="p-3 font-semibold text-[#4A3E3D]">${prod.nombre}</td>
            <td class="p-3">$${parseFloat(prod.costo).toFixed(2)}</td>
            <td class="p-3 text-[#D81B60] font-bold">$${parseFloat(prod.precioVenta).toFixed(2)}</td>
            <td class="p-3 font-bold text-gray-600">${prod.stock}</td>
            <td class="p-3 text-center space-x-2">
                <button onclick="eliminarProductoDeTabla(${prod.id})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        tbody.appendChild(fila);
    });

    lucide.createIcons();
}

async function eliminarProductoDeTabla(id) {
    if (confirm("¿Deseas eliminar este accesorio de tu catálogo de venta?")) {
        await eliminarRegistro("productos", id);
        await actualizarTablasYPaneles();
    }
}

// 3. FUNCIONES COMPLEMENTARIAS DE ACTUALIZACIÓN DEL DASHBOARD GENERAL
async function renderizarResumenVentas() {
    const listaVentas = await obtenerTodosLosRegistros("ventas");
    const ventasHoyLabel = document.getElementById("dash-ventas-hoy");
    const pedidosActivosLabel = document.getElementById("dash-pedidos-activos");

    if (!ventasHoyLabel || !pedidosActivosLabel) return;

    // Simulación del cálculo de caja del periodo líquido de las capturas (Foto 1)
    let totalCajaHoy = 0;
    let itemsEnCola = 0;

    listaVentas.forEach(v => {
        if (v.activa) {
            totalCajaHoy += parseFloat(v.total) || 0;
            if (v.estado === "pendiente") itemsEnCola++;
        }
    });

    // Formatear estrictamente con el símbolo '\$' según las capturas (Foto 1 y 3)
    ventasHoyLabel.innerText = `$${totalCajaHoy.toFixed(2)} MXN`;
    pedidosActivosLabel.innerText = itemsEnCola;
}

// Extensión del método masivo para enganchar todos los renderers en cadena
const actualizarViejo = actualizarTablasYPaneles;
actualizarTablasYPaneles = async function() {
    await actualizarViejo();
    await renderizarProductos();
    await renderizarResumenVentas();
};
// ====== EVENTOS DE CONTROL PARA LA VENTANA MODAL DE PRODUCTOS ======

// 1. Funciones para abrir y cerrar la tarjeta flotante de forma visual
function abrirModalProducto() {
    const modal = document.getElementById("modal-producto");
    if (modal) {
        modal.classList.remove("hidden");
        // Reiniciar el formulario para que no queden datos viejos
        document.getElementById("form-nuevo-producto").reset();
    }
}

function cerrarModalProducto() {
    const modal = document.getElementById("modal-producto");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// 2. Procesar el envío del formulario y guardarlo en la base de datos local
async function procesarGuardarProducto(event) {
    event.preventDefault(); // Evita que la página web se recargue por completo

    // Capturar las entradas de datos de los inputs del modal
    const nombre = document.getElementById("prod-nombre").value.trim();
    const costo = parseFloat(document.getElementById("prod-costo").value) || 0;
    const precioVenta = parseFloat(document.getElementById("prod-venta").value) || 0;
    const stock = parseInt(document.getElementById("prod-stock").value) || 0;

    // Crear el molde del accesorio para meter en el almacén indexado
    const nuevoProducto = {
        nombre: nombre,
        costo: costo,
        precioVenta: precioVenta,
        stock: stock,
        fechaCreacion: new Date().toISOString()
    };

    try {
        // Enviar el registro al almacén usando tu base de datos de js/db.js
        await guardarRegistro("productos", nuevoProducto);
        
        // Cerrar la tarjeta flotante de inmediato
        cerrarModalProducto();
        
        // Refrescar en cadena las tablas Excel y los contadores del panel principal
        await actualizarTablasYPaneles();
        
        console.log("🌸 ¡Éxito! Nuevo accesorio añadido al catálogo de Lety.");
    } catch (error) {
        console.error("❌ Error al persistir el nuevo producto:", error);
        alert("Ocurrió un error al guardar el producto en el dispositivo.");
    }
}

// ====== CONEXIÓN INTERACTIVA CON LOS BOTONES DE LA INTERFAZ ======

// Esperamos que se cargue la interfaz visual para enlazar el click del botón naranja
document.addEventListener("DOMContentLoaded", () => {
    // Buscar de manera segura el botón '+ Agregar Nuevo Producto' usando el texto de la tabla (Foto 2 Derecha)
    setTimeout(() => {
        const botones = document.querySelectorAll("button");
        botones.forEach(btn => {
            if (btn.innerText.includes("Agregar Nuevo Producto")) {
                btn.setAttribute("onclick", "abrirModalProducto()");
            }
        });
    }, 400);
});

// ====== EVENTOS DE CONTROL PARA LA VENTANA MODAL DE INSUMOS ======

// 1. Funciones para abrir y cerrar el modal de insumos
function abrirModalInsumo() {
    const modal = document.getElementById("modal-insumo");
    if (modal) {
        modal.classList.remove("hidden");
        document.getElementById("form-nuevo-insumo").reset();
    }
}

function cerrarModalInsumo() {
    const modal = document.getElementById("modal-insumo");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// 2. Procesar el envío del formulario y guardarlo en la base de datos local
async function procesarGuardarInsumo(event) {
    event.preventDefault(); // Evita la recarga de la página web

    // Capturar las entradas de datos de los inputs del modal
    const nombre = document.getElementById("insumo-nombre").value.trim();
    const precio = parseFloat(document.getElementById("insumo-precio").value) || 0;
    const stock = document.getElementById("insumo-stock").value.trim();
    const distribuidora = document.getElementById("insumo-distribuidora").value.trim();

    // Crear el molde del insumo para meter en el almacén indexado
    const nuevoInsumo = {
        nombre: nombre,
        precio: precio,
        stock: stock,
        distribuidora: distribuidora,
        fechaCreacion: new Date().toISOString()
    };

    try {
        // Enviar el registro al almacén usando tu base de datos de js/db.js
        await guardarRegistro("insumos", nuevoInsumo);
        
        // Cerrar la ventana flotante de inmediato
        cerrarModalInsumo();
        
        // Refrescar las tablas Excel y los contadores en tiempo real
        await actualizarTablasYPaneles();
        
        console.log("🌸 ¡Éxito! Nuevo material guardado en el inventario.");
    } catch (error) {
        console.error("❌ Error al persistir el nuevo insumo:", error);
        alert("Ocurrió un error al guardar el material en el dispositivo.");
    }
}

// ====== BOTÓN INTERACTIVO DE ALTA EN LA INTERFAZ DE INSUMOS ======

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        // Buscamos la barra de herramientas de la pestaña de insumos
        const barraInsumos = document.querySelector("#pestaña-insumos .flex-col");
        if (barraInsumos) {
            // Buscamos el contenedor de búsqueda para meter el botón al lado
            const contenedorFiltros = barraInsumos.querySelector(".flex");
            if (contenedorFiltros) {
                // Creamos el botón '+ Agregar Insumo' idéntico al estilo de producción (Foto 2)
                const botonNuevoInsumo = document.createElement("button");
                botonNuevoInsumo.className = "bg-[#FCE4C8] hover:bg-[#FADBB6] px-3 py-2 text-sm font-bold rounded-lg text-black flex items-center space-x-1 shrink-0 shadow-sm transition ml-2";
                botonNuevoInsumo.innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i> <span>Agregar Insumo</span>`;
                botonNuevoInsumo.setAttribute("onclick", "abrirModalInsumo()");
                
                contenedorFiltros.appendChild(botonNuevoInsumo);
                // Volvemos a dibujar los iconos vectoriales de Lucide
                lucide.createIcons();
            }
        }
    }, 450);
});
// ====== LÓGICA DE MOSTRADOR INTERACTIVO PARA LA PESTAÑA DE VENTAS ======

// 1. Rellenar dinámicamente el selector <select> con los accesorios del catálogo real
async function cargarSelectorProductosVenta() {
    const selectProducto = document.getElementById("venta-producto-select");
    if (!selectProducto) return;

    // Obtener los productos actuales guardados en IndexedDB
    const listaProductos = await obtenerTodosLosRegistros("productos");

    // Limpiar opciones anteriores dejando solo la de por defecto
    selectProducto.innerHTML = '<option value="">-- Elige del catálogo --</option>';

    listaProductos.forEach(prod => {
        const opcion = document.createElement("option");
        opcion.value = prod.id;
        // Mostramos el nombre y el precio de venta retail con formato limpio '\$'
        opcion.innerText = `${prod.nombre} ($${parseFloat(prod.precioVenta).toFixed(2)})`;
        // Guardamos los atributos necesarios como datos adjuntos en el elemento HTML
        opcion.dataset.nombre = prod.nombre;
        opcion.dataset.precio = prod.precioVenta;
        
        selectProducto.appendChild(opcion);
    });
}

// 2. Procesar el formulario de cobro al presionar el botón de confirmar
async function procesarVentaMostrador(event) {
    event.preventDefault();

    const selectProducto = document.getElementById("venta-producto-select");
    const inputCantidad = document.getElementById("venta-cantidad");
    const selectMetodo = document.getElementById("venta-metodo");

    if (!selectProducto || !inputCantidad || !selectMetodo) return;

    const opcionSeleccionada = selectProducto.options[selectProducto.selectedIndex];
    const productoId = opcionSeleccionada.value;

    // Validación de campos obligatorios antes de asentar la orden
    if (!productoId) {
        alert("Por favor, selecciona un accesorio del catálogo.");
        return;
    }

    const cantidad = parseInt(inputCantidad.value) || 0;
    if (cantidad <= 0) {
        alert("Ingresa una cantidad válida igual o mayor a 1.");
        return;
    }

    const nombreProducto = opcionSeleccionada.dataset.nombre;
    const precioVenta = parseFloat(opcionSeleccionada.dataset.precio) || 0;
    const metodoPago = selectMetodo.value;
    const totalTicket = precioVenta * cantidad;

    // Crear el objeto físico para persistir la orden en el historial de SQLite local
    const nuevaVentaVuestra = {
        total: totalTicket,
        metodoPago: metodoPago,
        estado: "completado",
        activa: true,
        fecha: new Date().toISOString(),
        detalle: `${nombreProducto} x ${cantidad}u`
    };

    try {
        // Guardar la transacción de mostrador en IndexedDB
        await guardarRegistro("ventas", nuevaVentaVuestra);

        // Descontar la materia prima (Cuentas, nylon, etc.) de forma automatizada
        await procesarDescuentoDeInsumos(nombreProducto, cantidad);

        // Resetear los controles a sus valores iniciales seguros
        selectProducto.value = "";
        inputCantidad.value = "1";
        selectMetodo.value = "Efectivo";

        // Refrescar masivamente todas las tablas y paneles del sistema
        await actualizarTablasYPaneles();

        alert(`🌸 ¡Venta Exitosa! Se registraron $${totalTicket.toFixed(2)} cobrados por ${metodoPago}.`);
    } catch (error) {
        console.error("❌ Error procesando el ticket de mostrador:", error);
        alert("No se pudo asentar la transacción en el almacenamiento local.");
    }
}

// 3. Modificación del disparador de actualización masiva para incluir el selector dinámico
const actualizarPrevioVentas = actualizarTablasYPaneles;
actualizarTablasYPaneles = async function() {
    await actualizarPrevioVentas();
    await cargarSelectorProductosVenta();
};

// Enganchar la carga inicial del selector cuando el usuario cambie a la pestaña de ventas
const cambiarPestañaOriginal = cambiarPestaña;
cambiarPestaña = function(pestañaId) {
    cambiarPestañaOriginal(pestañaId);
    if (pestañaId === 'ventas') {
        cargarSelectorProductosVenta();
    }
};

// ====== RENDERIZADO DEL HISTORIAL DE PEDIDOS REALES ======

async function renderizarHistorialVentas() {
    // 1. Obtener la lista de todas las transacciones guardadas en IndexedDB
    const listaVentas = await obtenerTodosLosRegistros("ventas");
    
    // Buscar el contenedor contenedor de las tarjetas en la pestaña de ventas (Foto 1 Izquierda)
    const contenedorHistorial = document.querySelector("#pestaña-ventas .overflow-y-auto");
    if (!contenedorHistorial) return;

    // Limpiar las tarjetas estáticas anteriores
    contenedorHistorial.innerHTML = "";

    // Si no hay ventas registradas aún, mostrar un mensaje amigable
    if (listaVentas.length === 0) {
        contenedorHistorial.innerHTML = `
            <div class="text-center py-8 text-[#8A7A78] font-medium text-sm">
                <i data-lucide="shopping-bag" class="w-8 h-8 mx-auto mb-2 text-gray-300"></i>
                No hay ventas registradas el día de hoy.
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Ordenar las ventas para que las más recientes aparezcan arriba de todo (Cronológico inverso)
    listaVentas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    listaVentas.forEach((venta, index) => {
        // Formatear la fecha en formato legible local de mostrador
        const fechaObj = new Date(venta.fecha);
        const horaFormateada = fechaObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const fechaFormateada = fechaObj.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

        // Determinar el número de orden simulada basado en el ID físico de IndexedDB
        const numeroOrden = 1000 + (venta.id || index);

        // Crear el contenedor de la tarjeta con los bordes redondeados y la sombra suave de la maqueta
        const tarjeta = document.createElement("div");
        tarjeta.className = "bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition hover:shadow-md animate-fade-in relative";
        
        // Estructura visual exacta adaptada de tus capturas (Foto 1)
        tarjeta.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="space-y-1">
                    <h4 class="font-bold text-base text-[#4A3E3D]">Orden #${numeroOrden}</h4>
                    <p class="text-xs text-gray-500 font-medium">Fecha: ${fechaFormateada} - ${horaFormateada} hs</p>
                    <p class="text-xs text-gray-400 font-semibold mt-1 text-[#8A7A78]">Detalle: ${venta.detalle || 'Venta de Mostrador'}</p>
                    <p class="text-[11px] text-gray-400">Medio de Pago: ${venta.metodoPago || 'Efectivo'}</p>
                </div>
                <div class="flex flex-col items-end space-y-2">
                    <span class="text-lg font-bold text-[#4A3E3D]">$${parseFloat(venta.total).toFixed(2)}</span>
                    <!-- Botón para anular o borrar la orden si hubo un error -->
                    <button onclick="anularOrdenCobrada(${venta.id})" class="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-lg transition">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            <div class="mt-3 flex space-x-2">
                <span class="bg-[#E2F0D9] text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-[#C5E1A5]">
                    Pagado, Despachado
                </span>
            </div>
        `;
        contenedorHistorial.appendChild(tarjeta);
    });

    // Volver a dibujar vectorialmente los iconos de basura cargados dinámicamente
    lucide.createIcons();
}
// ====== ACCIÓN: ANULAR/ELIMINAR ORDEN Y REFRESCAR EL HISTORIAL ======

// Función para eliminar un ticket del historial con ventana de confirmación nativa
async function anularOrdenCobrada(id) {
    if (confirm("⚠️ ¿Deseas anular esta orden? Se restará el dinero de la caja (Nota: Para recuperar los insumos deberás cargarlos manualmente).")) {
        try {
            // Eliminar el registro físico del almacén indexado de js/db.js
            await eliminarRegistro("ventas", id);
            
            // Forzar actualización inmediata en cadena de todas las pantallas
            await actualizarTablasYPaneles();
            console.log(" Ticket eliminado y caja recalculada.");
        } catch (error) {
            console.error("❌ Error al intentar anular la orden:", error);
            alert("No se pudo eliminar el registro de la memoria local.");
        }
    }
}

// ====== ENGANCHE CENTRAL DEL REFRESCO CÍCLICO ======

// Extendemos el actualizador global para que renderice el historial real
const actualizarViejoConHistorial = actualizarTablasYPaneles;
actualizarTablasYPaneles = async function() {
    await actualizarViejoConHistorial();
    await renderizarHistorialVentas();
};

// Sincronizar también para que cargue los pedidos al cambiar manualmente de pestaña
const cambiarPestañaConHistorial = cambiarPestaña;
cambiarPestaña = function(pestañaId) {
    cambiarPestañaConHistorial(pestañaId);
    if (pestañaId === 'ventas') {
        renderizarHistorialVentas();
    }
};

