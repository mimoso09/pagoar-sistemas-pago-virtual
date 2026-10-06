/*
 * PAGOAR — Motor de la misión (4 etapas + pregunta + retroalimentación + resultado).
 * Lo comparten index.html (AR) y demo.html (sin AR). El progreso se guarda en sessionStorage,
 * así que recargar la página o cambiar entre AR y demo no hace perder lo avanzado.
 */
(function () {
  'use strict';
  var C = window.PAGOAR_CONTENIDO;
  var N = C.etapas.length;
  var CLAVE = 'pagoar-progreso-v1';
  var LETRAS = ['A', 'B', 'C', 'D'];

  function nuevo() { return { etapa: 0, fase: 'info', respuestas: new Array(N).fill(null) }; }

  function valido(s) {
    return s && Array.isArray(s.respuestas) && s.respuestas.length === N &&
      Number.isInteger(s.etapa) && s.etapa >= 0 && s.etapa < N &&
      ['info', 'pregunta', 'final'].indexOf(s.fase) !== -1 &&
      s.respuestas.every(function (r) { return r === null || (Number.isInteger(r) && r >= 0 && r < 4); });
  }
  function leer() {
    try { var s = JSON.parse(sessionStorage.getItem(CLAVE)); return valido(s) ? s : null; } catch (e) { return null; }
  }
  function guardar(s) { try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); } catch (e) { /* modo privado: seguimos en memoria */ } }
  function borrar() { try { sessionStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ } }
  function aciertos(s) {
    return s.respuestas.reduce(function (n, r, i) { return n + (r === C.etapas[i].correcta ? 1 : 0); }, 0);
  }
  /** ¿Hay una misión empezada (para ofrecer "continuar")? */
  function enCurso() {
    var s = leer();
    return s && (s.etapa > 0 || s.fase !== 'info' || s.respuestas.some(function (r) { return r !== null; })) ? s : null;
  }

  /* Constructor de nodos DOM: siempre textContent, nunca innerHTML con datos. */
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'text') el.textContent = props[k];
      else if (k === 'class') el.className = props[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), props[k]);
      else el.setAttribute(k, props[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }

  function vibrar(ms) {
    try {
      var ua = navigator.userActivation; // solo tras un toque real (si no, Chrome lo bloquea y avisa en consola)
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms);
    } catch (e) { /* no soportado (iPhone) */ }
  }

  /* ---------- Modal de fuentes (compartido) ---------- */
  var modal = null;
  function abrirFuentes() {
    if (!modal) {
      var lista = h('ul', { class: 'sources' });
      C.fuentes.forEach(function (f) {
        lista.appendChild(h('li', null,
          h('a', { href: f.url, target: '_blank', rel: 'noopener', text: f.titulo }),
          h('small', { text: f.uso })));
      });
      var cerrar = h('button', { class: 'btn btn-primary', type: 'button', text: 'Cerrar', onclick: function () { modal.hidden = true; } });
      modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Fuentes' },
        h('div', { class: 'modal-card' },
          h('h2', { text: 'Fuentes' }),
          h('p', { text: C.aviso }),
          lista, cerrar));
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal) modal.hidden = true; });
      document.body.appendChild(modal);
    }
    modal.hidden = false;
  }

  /**
   * crear({ raiz, onCambio(estado) }) monta la misión dentro de `raiz`.
   * onCambio recibe { etapa, fase, aciertos, total, nuevaVista } en cada cambio (para el holograma AR / demo);
   * nuevaVista es false cuando solo se respondió la pregunta (la vista no cambió de etapa/fase).
   */
  function crear(opts) {
    var raiz = opts.raiz;
    var onCambio = opts.onCambio || function () {};
    var s = leer() || nuevo();
    var bloqueoHasta = 0; // evita que un doble toque salte una etapa

    function listo() { return Date.now() >= bloqueoHasta; }
    function ir(cambios) {
      Object.keys(cambios).forEach(function (k) { s[k] = cambios[k]; });
      guardar(s);
      render(true);
    }

    function progreso() {
      var barra = h('div', { class: 'm-progress', 'aria-hidden': 'true' });
      for (var i = 0; i < N; i++) {
        var cls = s.fase === 'final' || i < s.etapa ? 'done' : (i === s.etapa ? 'now' : '');
        barra.appendChild(h('i', { class: cls }));
      }
      return barra;
    }
    function cabecera(e) {
      return h('div', { class: 'm-eyebrow' }, 'Etapa ' + (s.etapa + 1) + ' de ' + N + ' · ', h('span', { text: e.clave }), ' ' + e.nombre);
    }

    function vistaInfo(e) {
      var puntos = h('ul', { class: 'm-points' });
      e.puntos.forEach(function (p) { puntos.appendChild(h('li', null, h('b', { text: p[0] + ': ' }), p[1])); });
      return h('div', { class: 'fade-in' },
        progreso(), cabecera(e),
        h('h2', { class: 'm-title', text: e.titulo }),
        h('p', { class: 'm-text', text: e.texto }),
        puntos,
        h('div', { class: 'm-actions' },
          h('button', { class: 'btn btn-primary', type: 'button', text: 'Responder la pregunta →', onclick: function () { if (listo()) ir({ fase: 'pregunta' }); } })));
    }

    function vistaPregunta(e) {
      var resp = s.respuestas[s.etapa];
      var respondida = resp !== null;
      var lista = h('div', { class: 'm-answers', role: 'group', 'aria-label': 'Opciones de respuesta' });
      e.opciones.forEach(function (txt, i) {
        var cls = 'answer';
        if (respondida && i === e.correcta) cls += ' correct';
        else if (respondida && i === resp) cls += ' wrong';
        var b = h('button', { class: cls, type: 'button' }, h('span', { class: 'letter', text: LETRAS[i] }), h('span', { text: txt }));
        if (respondida) b.disabled = true;
        b.addEventListener('click', function () { elegir(i); });
        lista.appendChild(b);
      });
      var hijos = [progreso(), cabecera(e), h('h2', { class: 'm-question', text: e.pregunta }), lista];
      if (respondida) {
        var ok = resp === e.correcta;
        hijos.push(h('div', { class: 'm-feedback ' + (ok ? 'ok' : 'bad'), role: 'status', 'aria-live': 'polite' },
          h('strong', { text: ok ? '✅ ¡Correcto!' : '❌ No es la mejor opción' }),
          (ok ? '' : 'La respuesta correcta es la ' + LETRAS[e.correcta] + '. ') + e.explicacion));
        var ultima = s.etapa === N - 1;
        hijos.push(h('div', { class: 'm-actions' },
          h('button', {
            class: 'btn btn-primary', type: 'button', text: ultima ? 'Ver mi resultado 🏆' : 'Siguiente etapa →',
            onclick: function () {
              if (!listo()) return;
              if (ultima) ir({ fase: 'final' }); else ir({ etapa: s.etapa + 1, fase: 'info' });
            }
          })));
      } else {
        hijos.push(h('div', { class: 'm-actions' },
          h('button', { class: 'btn btn-ghost', type: 'button', text: '← Repasar la información', onclick: function () { if (listo()) ir({ fase: 'info' }); } })));
      }
      var cont = h('div', { class: 'fade-in' });
      hijos.forEach(function (c) { cont.appendChild(c); });
      return cont;
    }

    function vistaFinal() {
      var a = aciertos(s);
      var msg = a === N ? '¡Excelente! Dominaste los cuatro apartados.'
        : a === N - 1 ? '¡Muy bien! Repasa el apartado que falló.'
        : a >= 2 ? 'Buen intento. Revisa las explicaciones y vuelve a intentarlo.'
        : 'Sigue practicando: vuelve a empezar y lee cada explicación.';
      var recap = h('ul', { class: 'm-recap' });
      C.etapas.forEach(function (e, i) {
        var ok = s.respuestas[i] === e.correcta;
        recap.appendChild(h('li', null, h('span', { class: ok ? 'ok' : 'bad', text: ok ? '✔' : '✘' }), e.clave + ' ' + e.nombre));
      });
      return h('div', { class: 'm-done' },
        h('div', { class: 'm-trophy', text: '🏆' }),
        h('div', { class: 'm-done-title', text: '¡MISIÓN COMPLETADA!' }),
        h('div', { class: 'm-score' }, 'Resultado: ', h('big', { text: a + ' / ' + N }), ' respuestas correctas'),
        h('p', { text: msg }),
        recap,
        h('p', { text: C.cierre }),
        h('div', { class: 'm-actions' },
          h('button', { class: 'btn btn-primary', type: 'button', text: '↻ Volver a empezar', onclick: function () { if (listo()) reiniciar(); } }),
          h('button', { class: 'btn btn-secondary', type: 'button', text: 'Ver fuentes', onclick: abrirFuentes })));
    }

    function elegir(i) {
      if (s.fase !== 'pregunta' || s.respuestas[s.etapa] !== null || !listo()) return;
      s.respuestas[s.etapa] = i;
      guardar(s);
      vibrar(i === C.etapas[s.etapa].correcta ? 40 : [60, 40, 60]);
      render(false);
      var fb = raiz.querySelector('.m-feedback');
      if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function render(arriba) {
      var e = C.etapas[s.etapa];
      var vista = s.fase === 'final' ? vistaFinal() : s.fase === 'pregunta' ? vistaPregunta(e) : vistaInfo(e);
      raiz.textContent = '';
      raiz.appendChild(vista);
      if (arriba) raiz.scrollTop = 0;
      bloqueoHasta = Date.now() + 350;
      if (s.fase === 'final' && arriba) vibrar([40, 60, 40, 60, 120]);
      try { onCambio({ etapa: s.etapa, fase: s.fase, aciertos: aciertos(s), total: N, nuevaVista: !!arriba }); } catch (err) { console.warn(err); }
    }

    function reiniciar() { s = nuevo(); guardar(s); render(true); }

    return { render: render, reiniciar: reiniciar, estado: function () { return { etapa: s.etapa, fase: s.fase, aciertos: aciertos(s), total: N }; } };
  }

  window.PagoarMision = { crear: crear, enCurso: enCurso, borrar: borrar, abrirFuentes: abrirFuentes, vibrar: vibrar, total: N, h: h };
})();
