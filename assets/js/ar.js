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
  var mision = null, escena = null, ancla = null, holo = null;
  var iniciando = false, arListo = false, desbloqueado = false, visible = false;
  var tAyuda = null, tToast = null, tListo = null;
  var ultimoEstado = null;

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

  function toast(texto, ms) {
    var t = $('toast');
    t.textContent = texto; t.hidden = false;
    t.classList.remove('salir'); void t.offsetWidth; t.classList.add('entrar');
    clearTimeout(tToast);
    tToast = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }

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

  /* ---------------- Holograma (componente A-Frame) ---------------- */
  function registrarComponentes() {
    if (AFRAME.components['pagoar-holo']) return;
    AFRAME.registerComponent('pagoar-holo', {
      init: function () {
        var THREE = AFRAME.THREE;
        this.canvas = document.createElement('canvas');
        this.textura = new THREE.CanvasTexture(this.canvas);
        if ('colorSpace' in this.textura && THREE.SRGBColorSpace) this.textura.colorSpace = THREE.SRGBColorSpace;
        else if (THREE.sRGBEncoding) this.textura.encoding = THREE.sRGBEncoding;
        var geo = new THREE.PlaneGeometry(1.12, 1.4); // proporción 0.8, igual que el diseño 800×1000
        var mat = new THREE.MeshBasicMaterial({ map: this.textura, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        this.el.setObject3D('mesh', new THREE.Mesh(geo, mat));
        holo = this;
        if (ultimoEstado) this.pintar(ultimoEstado);
      },
      pintar: function (estado) {
        window.PagoarHolo.dibujar(this.canvas, estado, 1024, 1024); // textura potencia de 2 → mipmaps nítidos
        this.textura.needsUpdate = true;
      },
      remove: function () {
        var m = this.el.getObject3D('mesh');
        if (m) { m.geometry.dispose(); m.material.dispose(); }
        this.textura.dispose();
        this.el.removeObject3D('mesh');
      }
    });
  }

  function alCambiarMision(estado) {
    if (!estado.nuevaVista && ultimoEstado) return; // solo se respondió: el holograma no cambia
    ultimoEstado = estado;
    if (holo) holo.pintar(estado);
    var raiz = $('holoRaiz');
    if (raiz && raiz.emit) raiz.emit('pop');
    var moneda = $('moneda');
    if (moneda) moneda.setAttribute('visible', estado.fase !== 'final');
  }

  /* ---------------- Escena ---------------- */
  function montarEscena() {
    registrarComponentes();
    $('arContenedor').innerHTML =
      '<a-scene embedded loading-screen="enabled: false" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"' +
      ' color-space="sRGB" renderer="colorManagement: true; antialias: true; alpha: true"' +
      ' mindar-image="imageTargetSrc: ' + TARGET_MIND + '; maxTrack: 1; uiLoading: no; uiScanning: no; uiError: no">' +
      '<a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>' +
      '<a-entity id="ancla" mindar-image-target="targetIndex: 0">' +
      '<a-entity id="holoRaiz" position="0 0 0.02" animation__pop="property: scale; from: 0.8 0.8 0.8; to: 1 1 1; dur: 420; easing: easeOutBack; startEvents: pop">' +
      '<a-entity pagoar-holo></a-entity>' +
      // Moneda que recorre el flujo: representa el dinero circulando por el sistema
      '<a-entity id="moneda" position="0.5 0.18 0.06"' +
      ' animation__ruta="property: position; from: 0.5 0.2 0.06; to: 0.5 -0.44 0.06; dur: 2600; loop: true; easing: easeInOutSine"' +
      ' animation__giro="property: rotation; from: 0 0 0; to: 0 360 0; dur: 1800; loop: true; easing: linear">' +
      '<a-cylinder radius="0.045" height="0.012" rotation="90 0 0" color="#ffc73e" material="shader: flat"></a-cylinder>' +
      '<a-ring radius-inner="0.03" radius-outer="0.037" position="0 0 0.007" color="#b8860b" material="shader: flat; side: double"></a-ring>' +
      '</a-entity>' +
      '</a-entity></a-entity></a-scene>';

    escena = $('arContenedor').querySelector('a-scene');
    ancla = $('ancla');

    escena.addEventListener('arReady', function () {
      arListo = true; iniciando = false;
      clearTimeout(tListo);
      $('cargando').hidden = true;
      $('escaneo').hidden = $('visor').hidden = desbloqueado;
      if (desbloqueado && !visible) $('fuera').hidden = false;
      vigilarVideo();
      if (!desbloqueado) programarAyuda();
    });
    escena.addEventListener('arError', function (ev) {
      mostrarError(ev.detail && ev.detail.error === 'VIDEO_FAIL' ? 'sin-camara' : 'general', ev.detail);
    });
    ancla.addEventListener('targetFound', function () {
      visible = true;
      $('fuera').hidden = true;
      clearTimeout(tAyuda);
      $('ayuda').hidden = true;
      if (!desbloqueado) {
        desbloqueado = true;
        $('escaneo').hidden = $('visor').hidden = true;
        toast('✅ ¡Tarjeta detectada! Misión desbloqueada');
        window.PagoarMision.vibrar(80);
        mostrarHud();
      }
    });
    ancla.addEventListener('targetLost', function () {
      visible = false;
      // La misión sigue en pantalla: solo avisamos que el holograma no está a la vista.
      if (desbloqueado) $('fuera').hidden = false;
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
