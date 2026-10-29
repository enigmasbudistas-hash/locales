// Los locales del cartel vienen en locales.json; los que añades tú
// se guardan en este iPhone (almacenamiento de la web app).
// Los del cartel no se tocan: si borras uno se apunta como borrado,
// y si lo corriges se guarda una copia tuya que lo sustituye.

const CLAVE_PROPIOS = "locales-propios";
const CLAVE_BORRADOS = "locales-cartel-borrados";
const $ = id => document.getElementById(id);

let delCartel = [];
let propios = [];
let borrados = new Set();
let todos = [];
let buscador = new Buscador([]);
let muelles = [];
let plantas = [];

// ---------- Datos ----------

function cargarPropios() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_PROPIOS) || "[]");
    return Array.isArray(lista) ? lista.filter(l => l && l.id && l.nombre) : [];
  } catch {
    return [];
  }
}

function cargarBorrados() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_BORRADOS) || "[]");
    return new Set(Array.isArray(lista) ? lista : []);
  } catch {
    return new Set();
  }
}

function guardarCambios() {
  try {
    localStorage.setItem(CLAVE_PROPIOS, JSON.stringify(propios));
    localStorage.setItem(CLAVE_BORRADOS, JSON.stringify([...borrados]));
  } catch {
    alert("No se ha podido guardar en este iPhone.");
  }
}

function actualizar() {
  const corregidos = new Set(propios.map(p => p.reemplaza).filter(Boolean));
  const visibles = delCartel.filter(l => !borrados.has(l.id) && !corregidos.has(l.id));
  todos = [...visibles, ...propios].sort((a, b) => ordenAlfabetico.compare(a.nombre, b.nombre));
  buscador = new Buscador(todos);
}

const esPropio = local => propios.some(p => p.id === local.id);
const origen = local =>
  !esPropio(local) ? "Del cartel" : local.reemplaza ? "Corregido por ti" : "Añadido por ti";
const buscarPorId = id => todos.find(l => l.id === id);

function nuevoId() {
  return crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Utilidades de pintado ----------

const escapar = t => String(t).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const ICONOS = {
  camion: '<svg viewBox="0 0 24 24"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
  escalera: '<svg viewBox="0 0 24 24"><path d="M3 20h4v-4h4v-4h4V8h4V4h2"/></svg>',
  numero: '<svg viewBox="0 0 24 24"><path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/></svg>',
  persona: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
};

function etiqueta(icono, texto, clase) {
  return `<span class="etiqueta ${clase}">${ICONOS[icono]}${escapar(texto)}</span>`;
}

// ---------- Lista ----------

let textoBusqueda = "";

function pintarLista() {
  const vacia = !textoBusqueda.trim();
  const resultados = vacia ? todos : buscador.buscar(textoBusqueda);

  $("lista").innerHTML = resultados.map(local => `
    <li><button class="fila" data-id="${escapar(local.id)}">
      <div class="fila-cabeza">
        <span class="fila-nombre">${escapar(local.nombre)}</span>
        ${local.numero ? `<span class="fila-numero">${escapar(local.numero)}</span>` : ""}
      </div>
      <div class="fila-etiquetas">
        ${local.muelle ? etiqueta("camion", `Muelle ${local.muelle}`, "azul") : etiqueta("camion", "Muelle ?", "gris")}
        ${local.planta ? etiqueta("escalera", local.planta, "naranja") : etiqueta("escalera", "Planta ?", "gris")}
      </div>
      ${esPropio(local) ? `<div class="fila-propio">${ICONOS.persona}${origen(local)}</div>` : ""}
      ${local.notas ? `<div class="fila-notas">${escapar(local.notas)}</div>` : ""}
    </button></li>`).join("");

  const nada = !resultados.length && !vacia;
  $("sin-resultados").hidden = !nada;
  if (nada) {
    $("sin-titulo").textContent = `Sin resultados para «${textoBusqueda.trim()}»`;
    $("b-anadir-buscado").textContent = `Añadir «${textoBusqueda.trim()}»`;
  }
  $("b-borrar-busqueda").hidden = !textoBusqueda;

  $("b-recuperar").hidden = !vacia || !borrados.size;
  $("b-recuperar").textContent = borrados.size === 1
    ? "Recuperar 1 tienda del cartel borrada"
    : `Recuperar ${borrados.size} tiendas del cartel borradas`;
}

function recuperarBorrados() {
  const n = borrados.size;
  if (!confirm(n === 1
    ? "¿Volver a poner en la lista la tienda del cartel que borraste?"
    : `¿Volver a poner en la lista las ${n} tiendas del cartel que borraste?`)) return;
  borrados.clear();
  guardarCambios();
  actualizar();
  pintarLista();
}

// ---------- Ficha ----------

function tarjeta(titulo, valor, icono, color) {
  const clase = valor ? color : "gris";
  return `<div class="tarjeta ${clase}">
    ${ICONOS[icono]}
    <div>
      <div class="tarjeta-titulo">${titulo}</div>
      <div class="tarjeta-valor ${valor ? "" : "sin-dato"}">${valor ? escapar(valor) : "Sin anotar"}</div>
    </div>
  </div>`;
}

function pintarDetalle(local) {
  $("d-nombre").textContent = local.nombre;
  $("d-tarjetas").innerHTML =
    tarjeta("Se accede por el", local.muelle && `Muelle ${local.muelle}`, "camion", "azul") +
    tarjeta("Está en la planta", local.planta, "escalera", "naranja") +
    (local.numero ? tarjeta("Número de local", local.numero, "numero", "gris-fijo") : "") +
    (local.notas ? `<div class="notas"><h3>Notas</h3><p>${escapar(local.notas)}</p></div>` : "");
  $("d-origen").textContent = origen(local);
}

// ---------- Navegación: #local/<id> abre la ficha ----------

let scrollLista = 0;
let desdeLista = false;

function mostrarVista() {
  const coincide = location.hash.match(/^#local\/(.+)$/);
  const local = coincide && buscarPorId(decodeURIComponent(coincide[1]));
  if (coincide && !local) {
    history.replaceState(null, "", location.pathname);
  }
  $("vista-lista").hidden = !!local;
  $("vista-detalle").hidden = !local;
  if (local) {
    pintarDetalle(local);
    window.scrollTo(0, 0);
  } else {
    pintarLista();
    window.scrollTo(0, scrollLista);
  }
}

function abrirFicha(id) {
  scrollLista = window.scrollY;
  desdeLista = true;
  location.hash = `local/${encodeURIComponent(id)}`;
}

function volverALista() {
  if (desdeLista) {
    desdeLista = false;
    history.back();
  } else {
    history.replaceState(null, "", location.pathname);
    mostrarVista();
  }
}

function idAbierto() {
  const coincide = location.hash.match(/^#local\/(.+)$/);
  return coincide ? decodeURIComponent(coincide[1]) : null;
}

// ---------- Formulario ----------

let editando = null;
const seleccion = { muelle: "", planta: "" };

function pintarSegmentado(campo, opciones) {
  const caja = $(`f-${campo}`);
  caja.innerHTML = ["", ...opciones].map(op =>
    `<button type="button" data-valor="${escapar(op)}" class="${op === seleccion[campo] ? "elegido" : ""}">${op ? escapar(op) : "No sé"}</button>`
  ).join("");
}

function abrirFormulario(local = null, nombreInicial = "") {
  editando = local;
  $("f-titulo").textContent = local ? "Editar local" : "Nuevo local";
  $("f-nombre").value = local ? local.nombre : nombreInicial;
  $("f-numero").value = local?.numero || "";
  $("f-notas").value = local?.notas || "";
  seleccion.muelle = local?.muelle || "";
  seleccion.planta = local?.planta || "";
  pintarSegmentado("muelle", muelles);
  pintarSegmentado("planta", plantas);
  actualizarBotonGuardar();
  abrirHoja("formulario");
  if (!local && !nombreInicial) $("f-nombre").focus();
}

function actualizarBotonGuardar() {
  $("f-guardar").disabled = !$("f-nombre").value.trim();
}

/** Un campo en blanco se guarda como "sin dato". */
const siHay = texto => texto.trim() || undefined;

function guardarFormulario() {
  const nombre = $("f-nombre").value.trim();
  if (!nombre) return;
  // Corregir una del cartel crea una copia tuya que la sustituye
  const delCartelOriginal = editando && !esPropio(editando);
  const local = {
    id: editando && !delCartelOriginal ? editando.id : nuevoId(),
    nombre,
    muelle: siHay(seleccion.muelle),
    planta: siHay(seleccion.planta),
    numero: siHay($("f-numero").value),
    notas: siHay($("f-notas").value),
    alias: editando?.alias,
    reemplaza: delCartelOriginal ? editando.id : editando?.reemplaza,
  };
  const i = propios.findIndex(p => p.id === local.id);
  if (i >= 0) propios[i] = local; else propios.push(local);
  guardarCambios();
  actualizar();
  cerrarHoja("formulario");
  if (editando) {
    if (delCartelOriginal) history.replaceState(null, "", `#local/${encodeURIComponent(local.id)}`);
    mostrarVista();
  } else {
    // Se limpia la búsqueda para que veas la tienda nueva en la lista
    textoBusqueda = "";
    $("busqueda").value = "";
    abrirFicha(local.id);
  }
}

function borrarAbierto() {
  const local = buscarPorId(idAbierto());
  if (!local) return;
  const deCartel = !esPropio(local) || local.reemplaza;
  if (!confirm(deCartel
    ? `¿Borrar «${local.nombre}» de la lista?\n\nSi te equivocas, puedes recuperarla al final de la lista.`
    : `¿Borrar «${local.nombre}»?`)) return;
  if (esPropio(local)) {
    propios = propios.filter(p => p.id !== local.id);
    // Si era una corrección, la original del cartel tampoco debe volver
    if (local.reemplaza) borrados.add(local.reemplaza);
  } else {
    borrados.add(local.id);
  }
  guardarCambios();
  actualizar();
  volverALista();
}

// ---------- Hojas (formulario y horarios) ----------

function abrirHoja(id) {
  $(id).hidden = false;
  document.body.classList.add("con-hoja");
}

function cerrarHoja(id) {
  $(id).hidden = true;
  if ($("formulario").hidden && $("horarios").hidden) document.body.classList.remove("con-hoja");
}

// ---------- Eventos ----------

$("busqueda").addEventListener("input", e => { textoBusqueda = e.target.value; pintarLista(); });
$("busqueda").addEventListener("keydown", e => { if (e.key === "Enter") e.target.blur(); });
$("b-borrar-busqueda").addEventListener("click", () => {
  textoBusqueda = "";
  $("busqueda").value = "";
  pintarLista();
  $("busqueda").focus();
});
$("lista").addEventListener("click", e => {
  const fila = e.target.closest(".fila");
  if (fila) abrirFicha(fila.dataset.id);
});
$("b-anadir").addEventListener("click", () => abrirFormulario());
$("b-anadir-buscado").addEventListener("click", () => abrirFormulario(null, textoBusqueda.trim()));
$("b-horarios").addEventListener("click", () => abrirHoja("horarios"));
$("h-cerrar").addEventListener("click", () => cerrarHoja("horarios"));
$("b-volver").addEventListener("click", volverALista);
$("b-editar").addEventListener("click", () => abrirFormulario(buscarPorId(idAbierto())));
$("b-borrar").addEventListener("click", borrarAbierto);
$("b-recuperar").addEventListener("click", recuperarBorrados);
$("f-cancelar").addEventListener("click", () => cerrarHoja("formulario"));
$("f-guardar").addEventListener("click", guardarFormulario);
$("f-nombre").addEventListener("input", actualizarBotonGuardar);
for (const campo of ["muelle", "planta"]) {
  $(`f-${campo}`).addEventListener("click", e => {
    const boton = e.target.closest("button");
    if (!boton) return;
    seleccion[campo] = boton.dataset.valor;
    pintarSegmentado(campo, campo === "muelle" ? muelles : plantas);
  });
}
for (const id of ["formulario", "horarios"]) {
  $(id).addEventListener("click", e => { if (e.target.id === id) cerrarHoja(id); });
}
window.addEventListener("hashchange", mostrarVista);

// ---------- Arranque ----------

async function arrancar() {
  try {
    const respuesta = await fetch("locales.json");
    const lista = await respuesta.json();
    // El id sale de los datos (no de la posición) para que siga valiendo
    // aunque se añadan o reordenen locales en locales.json
    delCartel = lista.map(l => ({
      ...l,
      id: `cartel:${[l.nombre, l.numero, l.muelle, l.planta].map(v => v || "").join("|")}`,
    }));
  } catch {
    delCartel = [];
  }
  propios = cargarPropios();
  borrados = cargarBorrados();
  // En el cartel solo salen A, B y C, pero el centro tiene del A al E
  muelles = [...new Set(["A", "B", "C", "D", "E", ...delCartel.map(l => l.muelle).filter(Boolean)])].sort();
  plantas = [...new Set(delCartel.map(l => l.planta).filter(Boolean))].sort();
  actualizar();
  mostrarVista();
}

arrancar();

// Para que funcione sin conexión
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
