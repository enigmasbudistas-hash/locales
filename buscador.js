// Buscador que tolera faltas de ortografía, tildes, letras cambiadas
// y palabras a medio escribir ("farmasia", "zra", "corte ingles"...).
// Es el mismo que el de la app de iPhone (Buscador.swift).

const PALABRAS_VACIAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "a", "en"]);
const esLetraONumero = c => /[\p{L}\p{N}]/u.test(c);
const esNumero = c => /\p{N}/u.test(c);
const letras = s => Array.from(s);

function normalizar(texto) {
  const l = letras(texto.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase());
  // Se conserva el "-" de las plantas bajo tierra y de los rangos: "-1", "2290-2300"
  const limpio = l.map((c, i) => {
    if (esLetraONumero(c)) return c;
    if (c === "-" && i + 1 < l.length && esNumero(l[i + 1])) return c;
    return " ";
  }).join("");
  return limpio.split(" ").filter(Boolean).join(" ");
}

/** Cómo suena una palabra en español: b/v, c/z/s, ll/y, h muda, qu/k... */
function fonetica(palabra) {
  const l = letras(palabra);
  const salida = [];
  let i = 0;
  const siguiente = (n = 1) => (i + n < l.length ? l[i + n] : null);

  while (i < l.length) {
    const c = l[i];
    switch (c) {
      case "h": break;
      case "v": case "w": salida.push("b"); break;
      case "z": salida.push("s"); break;
      case "c":
        if (siguiente() === "h") { salida.push("x"); i++; }
        else if (siguiente() && "ei".includes(siguiente())) salida.push("s");
        else salida.push("k");
        break;
      case "q":
        salida.push("k");
        if (siguiente() === "u") i++;
        break;
      case "g":
        if (siguiente() && "ei".includes(siguiente())) salida.push("j");
        else {
          salida.push("g");
          if (siguiente() === "u" && siguiente(2) && "ei".includes(siguiente(2))) i++;
        }
        break;
      case "l":
        if (siguiente() === "l") { salida.push("y"); i++; } else salida.push("l");
        break;
      case "y": salida.push(siguiente() === null ? "i" : "y"); break;
      case "x": salida.push("k", "s"); break;
      default: salida.push(c);
    }
    i++;
  }
  // Letras repetidas cuentan como una: "rr" → "r"
  const sinDobles = [];
  for (const c of salida) if (sinDobles[sinDobles.length - 1] !== c) sinDobles.push(c);
  return sinDobles.join("");
}

/** Letras que hay que cambiar, añadir, quitar o intercambiar para pasar de un texto a otro. */
function distancia(a, b) {
  const x = letras(a), y = letras(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  const d = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = 0; i <= x.length; i++) d[i][0] = i;
  for (let j = 0; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const coste = x[i - 1] === y[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[x.length][y.length];
}

function erroresPermitidos(longitud) {
  if (longitud < 3) return 0;
  if (longitud <= 4) return 1;
  if (longitud <= 7) return 2;
  return 3;
}

/** Parecido entre 0 y 1 de dos textos completos. */
function parecido(a, b) {
  const la = letras(a).length;
  if (la < 4) return a === b ? 1 : 0;
  const d = distancia(a, b);
  if (d > erroresPermitidos(la)) return 0;
  return 1 - d / Math.max(la, letras(b).length);
}

const palabras = texto =>
  normalizar(texto).split(" ").filter(Boolean).map(p => ({ normal: p, fonetica: fonetica(p) }));

function encaje(b, p) {
  const q = b.normal, t = p.normal;
  const lq = letras(q).length, lt = letras(t).length;
  if (q === t) return 1;
  if (t.startsWith(q)) return lq >= 2 ? 0.92 : 0.6;
  if (b.fonetica === p.fonetica) return 0.9;

  let mejor = 0;
  const permitidos = erroresPermitidos(lq);
  if (permitidos > 0) {
    // Palabra completa con faltas: "farmasia" → "farmacia"
    const d = distancia(q, t);
    if (d <= permitidos) mejor = Math.max(mejor, 0.85 - 0.1 * d);
    // Suena igual aunque se escriba distinto: "bodafone" → "vodafone"
    const df = distancia(b.fonetica, p.fonetica);
    if (df <= permitidos) mejor = Math.max(mejor, 0.82 - 0.1 * df);
    // A medio escribir y con faltas: "frama" → "farmacia"
    if (lq >= 3 && lt > lq) {
      const dp = distancia(q, letras(t).slice(0, lq).join(""));
      if (dp <= Math.max(1, permitidos - 1)) mejor = Math.max(mejor, 0.78 - 0.1 * dp);
    }
  }
  if (lq >= 3 && t.includes(q)) mejor = Math.max(mejor, 0.7);
  return mejor;
}

/** Media de lo bien que encaja cada palabra buscada con alguna palabra del nombre. */
function puntuar(buscadas, nombre) {
  if (!buscadas.length || !nombre.length) return 0;
  let total = 0;
  for (const b of buscadas) total += Math.max(...nombre.map(p => encaje(b, p)));
  return total / buscadas.length;
}

// "muelle 3", "planta r2", "r1"
function filtroPorMuelleOPlanta(texto) {
  const l = letras(texto);
  if (l.length === 2 && l[0] === "r" && esNumero(l[1])) {
    return local => normalizar(local.planta || "") === texto;
  }
  const partes = texto.split(" ");
  if (partes.length < 2) return null;
  const valor = partes.slice(1).join(" ");
  // "muelle c" también encuentra los del muelle "D / C"
  const encaja = campo => {
    if (!campo) return false;
    const normal = normalizar(campo);
    return normal === valor || normal.split(" ").includes(valor);
  };
  if (distancia(partes[0], "muelle") <= 2) return local => encaja(local.muelle);
  if (distancia(partes[0], "planta") <= 2) return local => encaja(local.planta);
  return null;
}

// Número de local: "3510", "2295" (dentro de 2290-2300), "1100 bis"
function filtroPorNumero(texto) {
  if (!texto || !esNumero(letras(texto)[0])) return null;
  const cifras = texto.match(/^\d+/);
  const buscado = cifras ? Number(cifras[0]) : null;
  return local => {
    if (!local.numero) return false;
    const normal = normalizar(local.numero);
    if (normal.startsWith(texto)) return true;
    // Rangos como "2290-2300"
    const extremos = normal.split("-").filter(s => /^\d+$/.test(s)).map(Number);
    if (buscado !== null && extremos.length === 2 && extremos[0] <= extremos[1]) {
      return buscado >= extremos[0] && buscado <= extremos[1];
    }
    return false;
  };
}

const ordenAlfabetico = new Intl.Collator("es");

class Buscador {
  constructor(locales) {
    this.entradas = locales.map(local => {
      const todos = [local.nombre, ...(local.alias || [])];
      return {
        local,
        nombres: todos.map(palabras),
        compactos: todos.map(n => normalizar(n).replaceAll(" ", "")),
      };
    });
  }

  buscar(consulta) {
    const texto = normalizar(consulta);
    if (!texto) return [];

    const porCampo = filtroPorMuelleOPlanta(texto);
    if (porCampo) return this.entradas.filter(e => porCampo(e.local)).map(e => e.local);

    // Si no hay ningún local con ese número, se busca como nombre ("1x2")
    const porNumero = filtroPorNumero(texto);
    if (porNumero) {
      const encontrados = this.entradas.filter(e => porNumero(e.local));
      if (encontrados.length) return encontrados.map(e => e.local);
    }

    const todas = palabras(texto);
    const significativas = todas.filter(p => !PALABRAS_VACIAS.has(p.normal));
    const buscadas = significativas.length ? significativas : todas;
    const compacta = texto.replaceAll(" ", "");

    return this.entradas
      .map(e => {
        let mejor = 0;
        for (const nombre of e.nombres) mejor = Math.max(mejor, puntuar(buscadas, nombre));
        for (const compacto of e.compactos) mejor = Math.max(mejor, parecido(compacta, compacto) * 0.9);
        return { local: e.local, puntuacion: mejor };
      })
      .filter(r => r.puntuacion >= 0.55)
      .sort((a, b) => b.puntuacion - a.puntuacion || ordenAlfabetico.compare(a.local.nombre, b.local.nombre))
      .map(r => r.local);
  }
}
