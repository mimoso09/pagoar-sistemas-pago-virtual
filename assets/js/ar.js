/*
 * PAGOAR — Experiencia AR (index.html): pantalla inicial, cámara, MindAR + A-Frame y HUD de la misión.
 *
 * Decisiones de robustez:
 *  - La cámara NO se enciende al cargar: solo al tocar "Iniciar experiencia AR".
 *  - Pedimos la cámara nosotros mismos para mostrar errores comprensibles; luego entregamos
 *    ese mismo stream a MindAR (no se abre la cámara dos veces).
 *  - A-Frame y MindAR se sirven desde este mismo sitio (assets/vendor) con respaldo en CDN.
 *  - Perder la tarjeta de vista NO oculta ni reinicia la misión; el progreso se guarda en sessionStorage.
 */
(function () {
  'use strict';

  var TARGET_MIND = 'assets/targets/tarjeta-ar.mind';
  var LIBS = [
    {
      nombre: 'A-Frame',
      listo: function () { return !!window.AFRAME; },
      urls: ['assets/vendor/aframe-1.5.0.min.js', 'https://aframe.io/releases/1.5.0/aframe.min.js']
    },
    {
      nombre: 'MindAR',
      listo: function () { return !!(window.AFRAME && AFRAME.components['mindar-image']); },
      urls: ['assets/vendor/mindar-image-aframe-1.2.5.prod.js', 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js']
    }
  ];
  var CLAVE_AUTO = 'pagoar-autoiniciar';
  var T_LIBS = 45000;      // ms máximos para descargar el motor AR
  var T_LISTO = 45000;     // ms máximos desde que hay cámara hasta que MindAR está listo
  var T_AYUDA = 20000;     // ms escaneando sin éxito antes de ofrecer ayuda

  var $ = function (id) { return document.getElementById(id); };
  var h = window.PagoarMision.h;
  var mision = null, escena = null, ancla = null;
  var iniciando = false, arListo = false, desbloqueado = false, visible = false, introHecha = false;
  var tAyuda = null, tListo = null, tHud = null;
  // Línea de tiempo de los hologramas (assets/js/holo.js); el rectángulo es el de la tarjeta física.
  var holo = window.PagoarHolo.crear({ rect: window.PagoarHolo.RECT_TARJETA });
  var aciertosPrevios = null;
  function ahora() { return performance.now() / 1000; }

  /* ---------------- Carga del motor AR (local primero, CDN de respaldo) ---------------- */
  function cargarScript(url) {
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = url; s.async = false;
      s.onload = ok;
      s.onerror = function () { s.remove(); ko(new Error('No cargó ' + url)); };
      document.head.appendChild(s);
    });
  }
  function cargarLib(lib) {
    var i = 0;
    function intentar() {
      if (lib.listo()) return Promise.resolve();
      if (i >= lib.urls.length) return Promise.reject(new Error('No se pudo cargar ' + lib.nombre));
      return cargarScript(lib.urls[i++]).then(intentar, function (e) { console.warn(e.message); return intentar(); });
    }
    return intentar();
  }
  var promesaLibs = null;
  function cargarLibs() {
    if (!promesaLibs) {
      promesaLibs = LIBS.reduce(function (p, lib) { return p.then(function () { return cargarLib(lib); }); }, Promise.resolve());
      promesaLibs.catch(function () { promesaLibs = null; }); // permite reintentar
    }
    return promesaLibs;
  }
  function conLimite(promesa, ms, motivo) {
    return new Promise(function (ok, ko) {
      var t = setTimeout(function () { ko(new Error(motivo)); }, ms);
      promesa.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); ko(e); });
    });
  }

  /* ---------------- Mensajes (sin jerga técnica) ---------------- */
  var ERRORES = {
    permiso: {
      icono: '🚫', titulo: 'No tenemos permiso para usar la cámara',
      texto: 'Toca «Reintentar» y, cuando el navegador pregunte, elige «Permitir».',
      extra: 'iPhone: Ajustes › Safari › Cámara › Permitir. Android (Chrome): toca el ícono junto a la dirección › Permisos › Cámara › Permitir.'
    },
    'sin-camara': {
      icono: '📵', titulo: 'Este navegador no puede abrir la cámara',
      texto: 'Abre el enlace en Safari (iPhone) o en Chrome (Android).',
      extra: 'Si lo abriste desde WhatsApp, Instagram u otra app, usa el menú «⋯» › «Abrir en el navegador».'
    },
    ocupada: {
      icono: '📷', titulo: 'La cámara está ocupada',
      texto: 'Cierra otras apps o pestañas que estén usando la cámara y toca «Reintentar».',
      extra: ''
    },
    red: {
      icono: '📶', titulo: 'No se pudo cargar la realidad aumentada',
      texto: 'Revisa tu conexión a internet (Wi-Fi o datos) y toca «Reintentar».',
      extra: ''
    },
    lento: {
      icono: '⏳', titulo: 'La realidad aumentada está tardando demasiado',
      texto: 'Puede ser la conexión o que este teléfono no sea compatible.',
      extra: 'Puedes reintentar o continuar con la versión sin AR: tiene las mismas 4 etapas y preguntas.'
    },
    detenida: {
      icono: '⏸️', titulo: 'La cámara se detuvo',
      texto: 'Pasa a veces al cambiar de app o girar el teléfono. Tu progreso está guardado.',
      extra: '', boton: 'Reanudar cámara'
    },
    general: {
      icono: '⚠️', titulo: 'No pudimos iniciar la experiencia AR',
      texto: 'Toca «Reintentar» o usa la versión sin AR, que tiene el mismo contenido.',
      extra: ''
    }
  };
  function tipoErrorCamara(err) {
    var n = err && err.name;
    if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') return 'permiso';
    if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError' || n === 'TypeError') return 'sin-camara';
    if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'ocupada';
    return 'general';
  }

  function mostrarError(tipo, detalle) {
    if (detalle) console.warn('[PAGOAR]', tipo, detalle);
    var e = ERRORES[tipo] || ERRORES.general;
    clearTimeout(tListo);
    $('cargando').hidden = true;
    $('errIcono').textContent = e.icono;
    $('errTitulo').textContent = e.titulo;
    $('errTexto').textContent = e.texto;
    $('errExtra').textContent = e.extra;
    $('errExtra').hidden = !e.extra;
    $('errReintentar').textContent = e.boton || 'Reintentar';
    $('error').hidden = false;
    iniciando = false;
  }

  function pasoCarga(n, texto) {
    $('cargaTexto').textContent = texto;
    [].forEach.call(document.querySelectorAll('#cargaPasos li'), function (li, i) {
      li.className = i < n - 1 ? 'hecho' : (i === n - 1 ? 'activo' : '');
    });
  }

  /* Aviso "Vuelve a apuntar a la tarjeta" con fundido (no se oculta de golpe). */
  function avisoFuera(mostrar) { $('fuera').classList.toggle('mostrar', !!mostrar); }

  /* ---------------- HUD ---------------- */
  function mostrarHud() {
    if (!$('hud').hidden) return;
    $('hud').hidden = false;
    $('hud').classList.add('entrar');
  }
  function plegarHud(plegar) {
    var hud = $('hud');
    hud.classList.toggle('plegado', plegar);
    $('hudToggle').setAttribute('aria-expanded', String(!plegar));
    $('hudToggleTexto').textContent = plegar ? 'Mostrar misión' : 'Ocultar';
  }

  /* ---------------- Holograma 3D (componente A-Frame) ----------------
     Dibuja con planos de three.js lo que describe la línea de tiempo de holo.js, a varias profundidades
     (panel z≈0.02, líneas 0.03, nodos 0.045, partículas 0.06, títulos 0.085): al mover el teléfono
     se percibe el parallax real. El grupo copia la matriz del ancla de MindAR en cada fotograma, así
     puede desvanecerse suavemente al perder la tarjeta en lugar de desaparecer de golpe. */
  function registrarComponentes() {
    if (AFRAME.components['pagoar-holo3d']) return;
    AFRAME.registerComponent('pagoar-holo3d', {
      init: function () {
        var THREE = this.THREE = AFRAME.THREE;
        this.raiz = new THREE.Group(); this.raiz.matrixAutoUpdate = false; this.raiz.visible = false;
        this.cont = new THREE.Group(); this.raiz.add(this.cont);
        this.el.object3D.add(this.raiz);
        this.geo = new THREE.PlaneGeometry(1, 1);
        this.mallas = {}; this.tex = {}; this.texUso = {}; this.fade = 0; this.cuadro = 0;
        this.anclaEl = this.el.querySelector('#ancla');
        var r = this.el.renderer; this.aniso = r && r.capabilities ? Math.min(4, r.capabilities.getMaxAnisotropy()) : 1;
      },
      textura: function (k) {
        var t = this.tex[k], THREE = this.THREE;
        this.texUso[k] = this.cuadro;
        if (!t) {
          t = this.tex[k] = new THREE.CanvasTexture(window.PagoarHolo.lienzo(k));
          if ('colorSpace' in t && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace; else if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
          t.anisotropy = this.aniso;
        }
        return t;
      },
      tick: function (time, dt) {
        var anc = this.anclaEl && this.anclaEl.object3D;
        if (!anc) return;
        var vis = anc.visible, d = Math.min(dt || 16, 100) / 1000;
        if (vis) { this.raiz.matrix.copy(anc.matrix); this.raiz.matrixWorldNeedsUpdate = true; }
        this.fade = Math.max(0, Math.min(1, this.fade + (vis ? d / 0.3 : -d / 0.25)));
        if (this.fade <= 0) { this.raiz.visible = false; return; }
        this.raiz.visible = true;
        var s = 0.9 + 0.1 * (1 - Math.pow(1 - this.fade, 3));
        this.cont.scale.set(s, s, s);
        this.reconciliar(holo.frame(ahora()));
      },
      reconciliar: function (items) {
        var U = window.PagoarHolo.UNIDAD, f = this.fade, n = ++this.cuadro, THREE = this.THREE;
        for (var i = 0; i < items.length; i++) {
          var it = items[i], m = this.mallas[it.k], mat;
          if (!m) {
            mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false });
            if (!it.linea) mat.map = this.textura(it.s);
            m = new THREE.Mesh(this.geo, mat); m.frustumCulled = false; m.userData.col = '';
            this.cont.add(m); this.mallas[it.k] = m;
          }
          mat = m.material;
          var col = it.linea ? it.color : (it.tint || '#ffffff');
          if (m.userData.col !== col) { mat.color.set(col); m.userData.col = col; }
          if (it.linea) {
            var dx = it.x2 - it.x1, dy = it.y2 - it.y1;
            m.position.set(((it.x1 + it.x2) / 2 - 400) * U, (500 - (it.y1 + it.y2) / 2) * U, it.z);
            m.scale.set(Math.sqrt(dx * dx + dy * dy) * U, it.ancho * U, 1);
            m.rotation.z = -Math.atan2(dy, dx);
          } else {
            var tx = this.textura(it.s);
            if (mat.map !== tx) { mat.map = tx; mat.needsUpdate = true; }
            m.position.set((it.x - 400) * U, (500 - it.y) * U, it.z);
            m.scale.set(it.w * it.sc * U, it.h * it.sc * U, 1);
            m.rotation.z = -(it.rot || 0);
          }
          mat.opacity = it.o * f;
          m.renderOrder = Math.round(it.z * 20000) * 64 + Math.min(i, 63);
          m.visible = true; m.userData.n = n;
        }
        for (var k in this.mallas) {
          var mm = this.mallas[k];
          if (mm.userData.n === n) continue;
          mm.visible = false;
          if (n - mm.userData.n > 240) { this.cont.remove(mm); mm.material.dispose(); delete this.mallas[k]; }
        }
        // Libera de la GPU las texturas que llevan ~10 s sin usarse (etapas ya superadas).
        if (n % 120 === 0) for (var kt in this.tex) {
          if (n - this.texUso[kt] > 600) { this.tex[kt].dispose(); delete this.tex[kt]; delete this.texUso[kt]; }
        }
      }
    });
  }

  function alCambiarMision(estado) {
    // Respuesta (la vista no cambia): destello verde o rojo del holograma.
    if (!estado.nuevaVista && aciertosPrevios !== null) holo.destello(estado.aciertos > aciertosPrevios ? 'verde' : 'rojo', ahora());
    aciertosPrevios = estado.aciertos;
    holo.setEstado(estado, ahora());
  }

  /* ---------------- Escena ---------------- */
  function montarEscena() {
    registrarComponentes();
    $('arContenedor').innerHTML =
      '<a-scene embedded loading-screen="enabled: false" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"' +
      ' color-space="sRGB" renderer="colorManagement: true; antialias: true; alpha: true"' +
      ' mindar-image="imageTargetSrc: ' + TARGET_MIND + '; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no" pagoar-holo3d>' +
      '<a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>' +
      '<a-entity id="ancla" mindar-image-target="targetIndex: 0"></a-entity>' +
      '</a-scene>';

    escena = $('arContenedor').querySelector('a-scene');
    ancla = $('ancla');

    escena.addEventListener('arReady', function () {
      arListo = true; iniciando = false;
      clearTimeout(tListo);
      $('cargando').hidden = true;
      $('escaneo').hidden = $('visor').hidden = desbloqueado;
      if (desbloqueado && !visible) avisoFuera(true);
      vigilarVideo();
      if (!desbloqueado) programarAyuda();
    });
    escena.addEventListener('arError', function (ev) {
      mostrarError(ev.detail && ev.detail.error === 'VIDEO_FAIL' ? 'sin-camara' : 'general', ev.detail);
    });
    ancla.addEventListener('targetFound', function () {
      visible = true;
      avisoFuera(false);
      clearTimeout(tAyuda);
      $('ayuda').hidden = true;
      if (!introHecha) {
        // Primera detección: escaneo → "sistema de pago detectado" → PAGOAR → interfaz.
        introHecha = true;
        holo.intro(ahora());
        window.PagoarMision.vibrar(60);
        ocultarEscaneo();
        if (!desbloqueado) {
          desbloqueado = true;
          clearTimeout(tHud);
          tHud = setTimeout(mostrarHud, Math.max(0, holo.duracionIntro() * 1000 - 250));
        }
      } else {
        holo.reaparecer(ahora()); // continúa donde estaba; solo reinicia el ciclo de la animación
      }
    });
    ancla.addEventListener('targetLost', function () {
      visible = false;
      // La misión sigue en pantalla (etapa, respuestas y puntuación intactas); solo avisamos.
      if (desbloqueado) avisoFuera(true);
    });
  }

  function ocultarEscaneo() {
    ['escaneo', 'visor'].forEach(function (id) {
      var el = $(id); el.classList.add('saliendo');
      setTimeout(function () { el.hidden = true; el.classList.remove('saliendo'); }, 320);
    });
  }

  function programarAyuda() {
    clearTimeout(tAyuda);
    tAyuda = setTimeout(function () { if (!visible) $('ayuda').hidden = false; }, T_AYUDA);
  }

  /* Si el sistema pausa o detiene la cámara (cambio de app, rotación), ofrecemos reanudar. */
  function sistemaAR() { return escena && escena.systems && escena.systems['mindar-image-system']; }
  function vigilarVideo() {
    var sys = sistemaAR(), v = sys && sys.video;
    if (!v) return;
    v.addEventListener('resize', function () {
      var c = sys.controller;
      if (c && v.videoWidth && (v.videoWidth !== c.inputWidth || v.videoHeight !== c.inputHeight)) mostrarError('detenida', 'cambio de orientación del video');
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !arListo) return;
    var sys = sistemaAR(), v = sys && sys.video;
    if (!v || !v.srcObject) return;
    var pista = v.srcObject.getVideoTracks()[0];
    if (!pista || pista.readyState === 'ended') { mostrarError('detenida', 'pista finalizada'); return; }
    if (v.paused) {
      var p = v.play();
      if (p && p.catch) p.catch(function () { mostrarError('detenida', 'no se pudo reanudar el video'); });
    }
  });

  /* ---------------- Flujo principal ---------------- */
  function iniciarAR() {
    if (iniciando || arListo) return;
    iniciando = true;
    $('error').hidden = true;
    $('cargando').hidden = false;
    pasoCarga(1, 'Si tu navegador lo pregunta, toca «Permitir» para usar la cámara.');

    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      mostrarError('sin-camara', 'contexto inseguro o sin mediaDevices');
      return;
    }
    cargarLibs().catch(function () { /* se reintenta abajo con límite de tiempo */ });

    var stream = null;
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } })
      .then(function (s) {
        stream = s;
        pasoCarga(2, 'Cargando el motor de realidad aumentada…');
        return conLimite(cargarLibs(), T_LIBS, 'tiempo de descarga agotado');
      }, function (err) {
        mostrarError(tipoErrorCamara(err), err);
        throw null;
      })
      .then(function () {
        pasoCarga(3, 'Preparando el reconocimiento de la tarjeta…');
        entregarStream(stream);
        document.body.classList.add('modo-ar');
        $('inicio').hidden = true;
        $('arCapa').hidden = false;
        montarEscena();
        if (window.PagoarMision.enCurso()) { desbloqueado = true; mostrarHud(); }
        mision.render(true);
        tListo = setTimeout(function () { if (!arListo) mostrarError('lento', 'arReady no llegó'); }, T_LISTO);
      })
      .catch(function (err) {
        if (err === null) return; // ya se mostró el error de cámara
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        mostrarError('red', err);
      });
  }

  /* MindAR llama a getUserMedia por su cuenta: le damos el stream que ya tenemos. */
  function entregarStream(stream) {
    var md = navigator.mediaDevices, original = md.getUserMedia;
    var pendiente = stream;
    try {
      md.getUserMedia = function (restricciones) {
        if (pendiente) {
          var s = pendiente; pendiente = null;
          try { delete md.getUserMedia; } catch (e) { md.getUserMedia = original; }
          return Promise.resolve(s);
        }
        return original.call(md, restricciones);
      };
    } catch (e) { /* no se pudo sustituir */ }
    if (md.getUserMedia === original) {
      // No fue posible compartir el stream: lo cerramos y MindAR abrirá la cámara (permiso ya concedido).
      stream.getTracks().forEach(function (t) { t.stop(); });
    }
  }

  function recargar(autoiniciar) {
    try { if (autoiniciar) sessionStorage.setItem(CLAVE_AUTO, '1'); } catch (e) { /* sin almacenamiento */ }
    var sys = sistemaAR();
    try { if (sys && sys.video && sys.video.srcObject) sys.video.srcObject.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* nada que detener */ }
    location.reload();
  }

  /* Errores de MindAR fuera de nuestro control (p. ej. no se pudo descargar el .mind): MindAR se queda
     esperando sin avisar. No mostramos error de inmediato (podría ser algo inofensivo), pero acortamos la espera. */
  window.addEventListener('unhandledrejection', function (ev) {
    if (!iniciando || arListo || !escena) return;
    console.warn('[PAGOAR] promesa rechazada durante el arranque', ev.reason);
    clearTimeout(tListo);
    tListo = setTimeout(function () { if (!arListo) mostrarError('red', 'arranque interrumpido'); }, 8000);
  });

  /* ---------------- Pantalla inicial ---------------- */
  function pintarInicio() {
    var s = window.PagoarMision.enCurso();
    var aviso = $('enCurso');
    if (s) {
      aviso.hidden = false;
      $('enCursoTexto').textContent = s.fase === 'final'
        ? 'Ya completaste la misión. Puedes verla de nuevo o empezar de cero.'
        : 'Tienes una misión en curso: etapa ' + (s.etapa + 1) + ' de ' + window.PagoarMision.total + '.';
      $('btnARTexto').textContent = 'Continuar experiencia AR';
    } else {
      aviso.hidden = true;
      $('btnARTexto').textContent = 'Iniciar experiencia AR';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    mision = window.PagoarMision.crear({ raiz: $('mision'), onCambio: alCambiarMision });
    pintarInicio();

    $('btnAR').addEventListener('click', iniciarAR);
    $('btnReiniciarInicio').addEventListener('click', function () { mision.reiniciar(); pintarInicio(); });
    $('errReintentar').addEventListener('click', function () { recargar(true); });
    $('btnSalir').addEventListener('click', function () { recargar(false); });
    $('ayudaCerrar').addEventListener('click', function () { $('ayuda').hidden = true; programarAyuda(); });
    $('hudToggle').addEventListener('click', function () { plegarHud(!$('hud').classList.contains('plegado')); });
    [].forEach.call(document.querySelectorAll('[data-fuentes]'), function (b) { b.addEventListener('click', window.PagoarMision.abrirFuentes); });

    // Precarga el motor AR mientras la persona lee la pantalla inicial.
    setTimeout(function () { cargarLibs().catch(function () { /* se reintenta al iniciar */ }); }, 400);

    // Reintento/reanudación: arrancamos directamente sin pedir otro toque.
    var auto = false;
    try { auto = sessionStorage.getItem(CLAVE_AUTO) === '1'; sessionStorage.removeItem(CLAVE_AUTO); } catch (e) { /* sin almacenamiento */ }
    if (auto) iniciarAR();
  });
})();
