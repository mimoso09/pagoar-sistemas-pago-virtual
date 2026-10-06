/*
 * PAGOAR — Motor de hologramas animados.
 *
 * Un único MODELO DE MOVIMIENTO describe, para cada instante, qué elementos hay, dónde están
 * (coordenadas de diseño 800×1000), a qué profundidad z (unidades AR) y con qué opacidad/escala.
 * Dos dibujadores lo consumen:
 *   - ar.js  → planos de A-Frame/three.js a distintas profundidades (parallax real sobre la tarjeta).
 *   - montar2D() (aquí) → canvas 2D para demo.html.
 * Los textos e íconos se pintan UNA vez en canvas pequeños (sprites) y se reutilizan: en cada fotograma
 * solo cambian posiciones, escalas y opacidades (barato en teléfonos). Máx. ~30 partículas simultáneas.
 */
(function () {
  'use strict';
  var C = window.PAGOAR_CONTENIDO;
  var W = 800, H = 1000;
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var COL = { cyan: '#00e1ff', azul: '#3d8bff', oro: '#ffc73e', verde: '#4be39a', rojo: '#ff6b7a', blanco: '#ffffff', tenue: '#9fb6d6', tinta: '#d3e3f7' };
  var REDUCIDO = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var INTRO_PANEL = 2.2, INTRO_ESCENA = 2.35, INTRO_FIN = 2.65;

  /* ======================= utilidades de animación ======================= */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  var ease = {
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return 0.5 - 0.5 * Math.cos(Math.PI * p); },
    back: function (p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }
  };
  /* Emerger desde la tarjeta: escala 0.7 → 1.05 → 1, opacidad 0 → 1, sube un poco y gana profundidad. */
  function E(t, d) {
    if (REDUCIDO) { var q = seg(t, d, d + 0.25); return { o: q, s: 1, dy: 0, zf: 1 }; }
    var p = seg(t, d, d + 0.62);
    var s = p < 0.7 ? 0.7 + 0.35 * ease.out(p / 0.7) : 1.05 - 0.05 * ease.inOut((p - 0.7) / 0.3);
    return { o: ease.out(seg(p, 0, 0.55)), s: s, dy: (1 - ease.out(p)) * 26, zf: ease.out(p) };
  }
  function hash(n) { var v = Math.sin(n) * 43758.5453; return v - Math.floor(v); } // pseudoaleatorio estable
  function flot(t, i, amp) { return REDUCIDO ? 0 : Math.sin(t * 1.05 + i * 1.71) * (amp || 2.2); }

  /* ======================= arte: sprites cacheados ======================= */
  var REG = {}, LIENZOS = {}, TINTADOS = {};
  var med = document.createElement('canvas').getContext('2d');
  function fuente(px, peso) { return (peso || 800) + ' ' + px + 'px ' + FONT; }
  function espaciado(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }
  function ancho(txt, px, peso, ls) {
    med.font = fuente(px, peso); espaciado(med, ls || 0);
    var w = med.measureText(txt).width; espaciado(med, 0); return w;
  }
  function color(n) { return COL[n] || n; }
  function rgba(hex, a) { var v = parseInt(hex.slice(1), 16); return 'rgba(' + (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')'; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function partir(txt, px, peso, maxW, maxL) {
    var pal = String(txt).split(' '), out = [], l = '';
    med.font = fuente(px, peso);
    pal.forEach(function (p) { var pr = l ? l + ' ' + p : p; if (med.measureText(pr).width > maxW && l) { out.push(l); l = p; } else l = pr; });
    if (l) out.push(l);
    return out.length <= maxL ? out : null;
  }
  function ajustar(txt, px, peso, maxW, maxL) { // reduce el tamaño hasta que quepa
    for (var s = px; s >= 16; s -= 2) { var ls = partir(txt, s, peso, maxW, maxL); if (ls) return { px: s, lineas: ls }; }
    return { px: 16, lineas: [txt] };
  }
  function reg(key, w, h, pintar, esc) { if (!REG[key]) REG[key] = { w: w, h: h, pintar: pintar, esc: esc || 1 }; return key; }
  function lienzo(key) {
    if (!LIENZOS[key]) {
      var r = REG[key], c = document.createElement('canvas');
      c.width = Math.ceil(r.w * r.esc); c.height = Math.ceil(r.h * r.esc);
      var x = c.getContext('2d'); x.scale(r.esc, r.esc); r.pintar(x, r.w, r.h);
      LIENZOS[key] = c;
    }
    return LIENZOS[key];
  }
  function tintado(key, tinte) { // solo para el renderizador 2D (en 3D se usa material.color)
    var k = key + '#' + tinte;
    if (!TINTADOS[k]) {
      var src = lienzo(key), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      var x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = tinte; x.fillRect(0, 0, c.width, c.height);
      TINTADOS[k] = c;
    }
    return TINTADOS[k];
  }

  /* ---------- Íconos de línea (rejilla de 24) ---------- */
  function icono(ctx, n, cx, cy, s, col) {
    var u = s / 24;
    ctx.save(); ctx.translate(cx - 12 * u, cy - 12 * u); ctx.scale(u, u);
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var b = function () { ctx.beginPath(); }, st = function () { ctx.stroke(); };
    var circ = function (x, y, r, rel) { b(); ctx.arc(x, y, r, 0, Math.PI * 2); rel ? ctx.fill() : st(); };
    switch (n) {
      case 'usuario': circ(12, 8, 3.6); b(); ctx.moveTo(4.5, 20); ctx.bezierCurveTo(4.5, 15.5, 8, 13.5, 12, 13.5); ctx.bezierCurveTo(16, 13.5, 19.5, 15.5, 19.5, 20); st(); break;
      case 'comercio':
        b(); ctx.moveTo(3, 9); ctx.lineTo(4.6, 4); ctx.lineTo(19.4, 4); ctx.lineTo(21, 9); ctx.closePath(); st();
        b(); ctx.moveTo(3, 9); for (var k = 0; k < 4; k++) ctx.arc(5.25 + k * 4.5, 9, 2.25, Math.PI, 0, true); st();
        b(); ctx.moveTo(4.6, 11.5); ctx.lineTo(4.6, 20); ctx.lineTo(19.4, 20); ctx.lineTo(19.4, 11.5); st();
        b(); ctx.moveTo(10, 20); ctx.lineTo(10, 15); ctx.lineTo(14, 15); ctx.lineTo(14, 20); st(); break;
      case 'tarjeta': rr(ctx, 2.5, 5.5, 19, 13, 2.2); st(); ctx.lineWidth = 2.4; b(); ctx.moveTo(2.8, 9.6); ctx.lineTo(21.2, 9.6); st(); ctx.lineWidth = 1.8; rr(ctx, 5.5, 13, 4, 2.8, .6); st(); break;
      case 'banco':
        b(); ctx.moveTo(3, 9); ctx.lineTo(12, 3.5); ctx.lineTo(21, 9); ctx.closePath(); st();
        [6, 10, 14, 18].forEach(function (x) { b(); ctx.moveTo(x, 11); ctx.lineTo(x, 17.5); st(); });
        b(); ctx.moveTo(3, 20); ctx.lineTo(21, 20); st(); break;
      case 'servidores':
        [3.5, 9.5, 15.5].forEach(function (y) { rr(ctx, 4, y, 16, 5, 1.4); st(); circ(7, y + 2.5, .9, true); b(); ctx.moveTo(11, y + 2.5); ctx.lineTo(17, y + 2.5); st(); }); break;
      case 'check': circ(12, 12, 9); b(); ctx.moveTo(7.6, 12.4); ctx.lineTo(10.6, 15.3); ctx.lineTo(16.6, 9.1); st(); break;
      case 'documento':
        b(); ctx.moveTo(6, 3); ctx.lineTo(14, 3); ctx.lineTo(18, 7); ctx.lineTo(18, 21); ctx.lineTo(6, 21); ctx.closePath(); st();
        b(); ctx.moveTo(14, 3); ctx.lineTo(14, 7); ctx.lineTo(18, 7); st();
        [11, 14, 17].forEach(function (y, i) { b(); ctx.moveTo(8.5, y); ctx.lineTo(i === 2 ? 13 : 15.5, y); st(); }); break;
      case 'escudo':
        b(); ctx.moveTo(12, 3); ctx.lineTo(19.5, 6); ctx.lineTo(19.5, 11.5); ctx.bezierCurveTo(19.5, 16, 16.3, 19.4, 12, 21);
        ctx.bezierCurveTo(7.7, 19.4, 4.5, 16, 4.5, 11.5); ctx.lineTo(4.5, 6); ctx.closePath(); st();
        b(); ctx.moveTo(9, 12); ctx.lineTo(11.2, 14.2); ctx.lineTo(15.2, 10); st(); break;
      case 'ciclo':
        b(); ctx.arc(12, 12, 7.5, Math.PI * 1.1, Math.PI * 1.85); st(); b(); ctx.arc(12, 12, 7.5, Math.PI * 0.1, Math.PI * 0.85); st();
        b(); ctx.moveTo(17.2, 3.4); ctx.lineTo(18.6, 6.9); ctx.lineTo(15, 7.6); st();
        b(); ctx.moveTo(6.8, 20.6); ctx.lineTo(5.4, 17.1); ctx.lineTo(9, 16.4); st(); break;
      case 'red':
        [[4.5, 6], [19.5, 6], [4.5, 18], [19.5, 18]].forEach(function (p) { b(); ctx.moveTo(12, 12); ctx.lineTo(p[0] + (12 - p[0]) * .28, p[1] + (12 - p[1]) * .28); st(); circ(p[0], p[1], 2); });
        circ(12, 12, 2.8, true); break;
      case 'hogar':
        b(); ctx.moveTo(3.5, 11); ctx.lineTo(12, 4); ctx.lineTo(20.5, 11); st();
        b(); ctx.moveTo(5.8, 9.5); ctx.lineTo(5.8, 20); ctx.lineTo(18.2, 20); ctx.lineTo(18.2, 9.5); st();
        b(); ctx.moveTo(10, 20); ctx.lineTo(10, 15); ctx.lineTo(14, 15); ctx.lineTo(14, 20); st(); break;
      case 'edificio':
        rr(ctx, 5, 3.5, 14, 16.5, 1.2); st();
        [[8, 7], [12.5, 7], [8, 10.5], [12.5, 10.5], [8, 14], [12.5, 14]].forEach(function (p) { ctx.fillRect(p[0], p[1], 2.4, 2); });
        b(); ctx.moveTo(10.5, 20); ctx.lineTo(10.5, 17); ctx.lineTo(13.5, 17); ctx.lineTo(13.5, 20); st(); break;
      case 'gobierno':
        b(); ctx.moveTo(6.5, 10); ctx.arc(12, 10, 5.5, Math.PI, 0); ctx.closePath(); st();
        b(); ctx.moveTo(12, 4.5); ctx.lineTo(12, 1.8); ctx.lineTo(15, 2.6); ctx.lineTo(12, 3.4); st();
        b(); ctx.moveTo(4, 10.5); ctx.lineTo(20, 10.5); st();
        [7, 10.4, 13.6, 17].forEach(function (x) { b(); ctx.moveTo(x, 12.5); ctx.lineTo(x, 18); st(); });
        b(); ctx.moveTo(3.5, 20.5); ctx.lineTo(20.5, 20.5); st(); break;
      case 'terminal':
        rr(ctx, 6, 2.5, 12, 19, 2); st(); rr(ctx, 8.5, 5, 7, 4.5, .8); st();
        [[9.5, 13], [12, 13], [14.5, 13], [9.5, 16.3], [12, 16.3], [14.5, 16.3]].forEach(function (p) { circ(p[0], p[1], .85, true); }); break;
      case 'capas':
        b(); ctx.moveTo(12, 3); ctx.lineTo(21, 8); ctx.lineTo(12, 13); ctx.lineTo(3, 8); ctx.closePath(); st();
        b(); ctx.moveTo(3, 12); ctx.lineTo(12, 17); ctx.lineTo(21, 12); st();
        b(); ctx.moveTo(3, 16); ctx.lineTo(12, 21); ctx.lineTo(21, 16); st(); break;
      case 'flechas':
        b(); ctx.moveTo(4, 8); ctx.lineTo(19, 8); ctx.moveTo(15.5, 4.5); ctx.lineTo(19, 8); ctx.lineTo(15.5, 11.5); st();
        b(); ctx.moveTo(20, 16); ctx.lineTo(5, 16); ctx.moveTo(8.5, 12.5); ctx.lineTo(5, 16); ctx.lineTo(8.5, 19.5); st(); break;
    }
    ctx.restore();
  }

  /* ---------- Sprites ---------- */
  var S = {
    panel: function () {
      return reg('panel', W, H, function (x) {
        x.save(); x.shadowColor = 'rgba(0,225,255,.45)'; x.shadowBlur = 22;
        rr(x, 20, 20, W - 40, H - 40, 44);
        var g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(9,24,50,.88)'); g.addColorStop(1, 'rgba(4,12,30,.92)');
        x.fillStyle = g; x.fill(); x.restore();
        x.save(); rr(x, 24, 24, W - 48, H - 48, 40); x.clip();
        x.strokeStyle = 'rgba(120,190,255,.06)'; x.lineWidth = 1.5;
        for (var i = 44; i < W; i += 48) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
        for (var j = 44; j < H; j += 48) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
        var hl = x.createLinearGradient(0, 0, 0, 220); hl.addColorStop(0, 'rgba(0,225,255,.10)'); hl.addColorStop(1, 'rgba(0,225,255,0)');
        x.fillStyle = hl; x.fillRect(0, 0, W, 220); x.restore();
        x.lineWidth = 2.5; x.strokeStyle = 'rgba(0,225,255,.85)'; rr(x, 20, 20, W - 40, H - 40, 44); x.stroke();
        x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,.07)'; rr(x, 30, 30, W - 60, H - 60, 36); x.stroke();
        x.strokeStyle = COL.oro; x.lineWidth = 4; x.lineCap = 'round';
        [[52, 52, 1, 1], [W - 52, 52, -1, 1], [52, H - 52, 1, -1], [W - 52, H - 52, -1, -1]].forEach(function (c) {
          x.beginPath(); x.moveTo(c[0], c[1] + 26 * c[3]); x.lineTo(c[0], c[1]); x.lineTo(c[0] + 26 * c[2], c[1]); x.stroke();
        });
      }, 0.75);
    },
    cab: function (idx) {
      var e = C.etapas[idx], tot = C.etapas.length;
      return reg('cab|' + idx, 760, 176, function (x, w) {
        x.textBaseline = 'middle';
        x.font = fuente(26, 900); espaciado(x, 3); x.fillStyle = COL.cyan; x.textAlign = 'left';
        x.fillText('ETAPA ' + (idx + 1) + ' / ' + tot, 64, 34); espaciado(x, 0);
        x.font = fuente(28, 900); var pw = x.measureText(e.clave).width + 34;
        rr(x, w - 64 - pw, 12, pw, 44, 22); x.fillStyle = COL.oro; x.fill();
        x.fillStyle = '#071226'; x.textAlign = 'center'; x.fillText(e.clave, w - 64 - pw / 2, 35);
        var a = ajustar(e.holo.titulo, 50, 900, w - 40, 2);
        x.font = fuente(a.px, 900); x.fillStyle = COL.blanco; x.shadowColor = 'rgba(0,225,255,.55)'; x.shadowBlur = 16;
        var lh = a.px * 1.08, y0 = 118 - (a.lineas.length - 1) * lh / 2;
        a.lineas.forEach(function (l, i) { x.fillText(l, w / 2, y0 + i * lh); });
      });
    },
    nodo: function (ic, col, R) {
      var c = color(col), d = R * 2 + 28;
      return reg('nodo|' + ic + '|' + col + '|' + R, d, d, function (x) {
        var cx = d / 2, g = x.createRadialGradient(cx, cx - R * .3, R * .1, cx, cx, R);
        g.addColorStop(0, 'rgba(22,58,108,.98)'); g.addColorStop(1, 'rgba(7,20,44,.98)');
        x.save(); x.shadowColor = rgba(c, .6); x.shadowBlur = 12;
        x.beginPath(); x.arc(cx, cx, R, 0, Math.PI * 2); x.fillStyle = g; x.fill(); x.restore();
        x.lineWidth = 3.5; x.strokeStyle = c; x.beginPath(); x.arc(cx, cx, R, 0, Math.PI * 2); x.stroke();
        x.lineWidth = 1; x.strokeStyle = rgba(c, .3); x.beginPath(); x.arc(cx, cx, R - 7, 0, Math.PI * 2); x.stroke();
        icono(x, ic, cx, cx, R * 1.08, c);
      });
    },
    num: function (txt, R) {
      var d = R * 2 + 28;
      return reg('num|' + txt + '|' + R, d, d, function (x) {
        var cx = d / 2;
        x.beginPath(); x.arc(cx, cx, R, 0, Math.PI * 2); x.fillStyle = 'rgba(9,26,54,.96)'; x.fill();
        x.lineWidth = 3.5; x.strokeStyle = COL.cyan; x.stroke();
        x.font = fuente(R * .78, 900); x.fillStyle = COL.blanco; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, cx, cx + 2);
      });
    },
    icono: function (ic, col, s) {
      return reg('ico|' + ic + '|' + col + '|' + s, s + 8, s + 8, function (x) { icono(x, ic, (s + 8) / 2, (s + 8) / 2, s, color(col)); });
    },
    etiqueta: function (t, s, alin, w, colSub) {
      var px = 34, a = ajustar(t, px, 800, w - 8, alin === 'center' ? 2 : 1), b = ajustar(s || '', 24, 600, w - 8, 1);
      var h = a.lineas.length * a.px * 1.12 + (s ? b.px + 14 : 0) + 10;
      return reg('et|' + t + '|' + s + '|' + alin + '|' + w + '|' + colSub, w, h, function (x) {
        x.textAlign = alin; x.textBaseline = 'top'; var xx = alin === 'center' ? w / 2 : 4;
        x.font = fuente(a.px, 800); x.fillStyle = COL.blanco;
        a.lineas.forEach(function (l, i) { x.fillText(l, xx, 4 + i * a.px * 1.12); });
        if (s) { x.font = fuente(b.px, 600); x.fillStyle = color(colSub); x.fillText(b.lineas[0], xx, 8 + a.lineas.length * a.px * 1.12); }
      });
    },
    texto: function (t, px, col, maxW, peso, ls) {
      peso = peso || 800; ls = ls || 0;
      var a = ajustar(t, px, peso, maxW, 2), w = maxW, h = a.lineas.length * a.px * 1.18 + 14;
      return reg('tx|' + t + '|' + px + '|' + col + '|' + maxW + '|' + peso + '|' + ls, w, h, function (x) {
        x.font = fuente(a.px, peso); espaciado(x, ls); x.fillStyle = color(col); x.textAlign = 'center'; x.textBaseline = 'middle';
        a.lineas.forEach(function (l, i) { x.fillText(l, w / 2, 7 + a.px * .59 + i * a.px * 1.18); });
      });
    },
    estado: function (t, col) {
      var w = Math.min(760, ancho(t, 30, 900, 2) + 30);
      return reg('st|' + t + '|' + col, w, 52, function (x) {
        x.font = fuente(30, 900); espaciado(x, 2); x.fillStyle = color(col); x.textAlign = 'center'; x.textBaseline = 'middle';
        x.shadowColor = rgba(color(col), .6); x.shadowBlur = 12; x.fillText(t, w / 2, 27);
      });
    },
    chip: function (t, col) {
      var c = color(col), w = Math.ceil(ancho(t, 21, 800, 1.5) + 48);
      return reg('chip|' + t + '|' + col, w, 46, function (x) {
        rr(x, 2, 2, w - 4, 42, 21); x.fillStyle = rgba(c, .13); x.fill(); x.lineWidth = 2; x.strokeStyle = rgba(c, .75); x.stroke();
        x.font = fuente(21, 800); espaciado(x, 1.5); x.fillStyle = c; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, w / 2, 24);
      });
    },
    glow: function () {
      return reg('glow', 128, 128, function (x) {
        var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.28, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      });
    },
    punto: function () {
      return reg('punto', 32, 32, function (x) {
        var g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, '#fff'); g.addColorStop(.55, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 32, 32);
      });
    },
    anillo: function () { // radio 118 dentro de 256
      return reg('anillo', 256, 256, function (x) { x.lineWidth = 6; x.strokeStyle = '#fff'; x.beginPath(); x.arc(128, 128, 118, 0, Math.PI * 2); x.stroke(); });
    },
    anilloP: function () { // anillo punteado, radio 246 dentro de 512
      return reg('anilloP', 512, 512, function (x) {
        x.lineWidth = 3; x.strokeStyle = '#fff'; x.setLineDash([16, 14]); x.beginPath(); x.arc(256, 256, 246, 0, Math.PI * 2); x.stroke();
        x.setLineDash([]); x.lineWidth = 6;
        for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + Math.PI / 4; x.beginPath(); x.arc(256, 256, 246, a - .06, a + .06); x.stroke(); }
      });
    },
    arco: function () {
      return reg('arco', 256, 256, function (x) { x.lineWidth = 9; x.lineCap = 'round'; x.strokeStyle = '#fff'; x.beginPath(); x.arc(128, 128, 112, 0, Math.PI * 1.35); x.stroke(); });
    },
    disco: function (col) {
      var c = color(col);
      return reg('disco|' + col, 128, 128, function (x) {
        var g = x.createRadialGradient(64, 52, 6, 64, 64, 60); g.addColorStop(0, rgba(c, 1)); g.addColorStop(1, rgba(c, .82));
        x.save(); x.shadowColor = rgba(c, .8); x.shadowBlur = 8; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fillStyle = g; x.fill(); x.restore();
      });
    },
    moneda: function () {
      return reg('moneda', 64, 64, function (x) {
        var g = x.createRadialGradient(26, 24, 2, 32, 32, 28); g.addColorStop(0, '#fff2b8'); g.addColorStop(.5, COL.oro); g.addColorStop(1, '#c78a12');
        x.beginPath(); x.arc(32, 32, 26, 0, Math.PI * 2); x.fillStyle = g; x.fill();
        x.lineWidth = 2.5; x.strokeStyle = '#a8740f'; x.beginPath(); x.arc(32, 32, 19, 0, Math.PI * 2); x.stroke();
        x.font = fuente(24, 900); x.fillStyle = '#7a5208'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 32, 34);
      });
    },
    logo: function () {
      return reg('logo', 640, 210, function (x) {
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = fuente(124, 900);
        var w1 = x.measureText('PAGO').width, w2 = x.measureText('AR').width, x0 = 320 - (w1 + w2) / 2;
        x.shadowColor = 'rgba(0,225,255,.7)'; x.shadowBlur = 24; x.textAlign = 'left';
        x.fillStyle = COL.blanco; x.fillText('PAGO', x0, 92); x.fillStyle = COL.cyan; x.fillText('AR', x0 + w1, 92);
        x.shadowBlur = 0; x.font = fuente(24, 800); espaciado(x, 6); x.textAlign = 'center'; x.fillStyle = COL.tinta;
        x.fillText('SISTEMAS DE PAGO VIRTUAL', 320, 178);
      });
    },
    marcador: function (v, tot) {
      return reg('mk|' + v + '|' + tot, 420, 140, function (x) {
        x.textBaseline = 'middle'; x.font = fuente(122, 900);
        var a = String(v), b = ' / ' + tot, wa = x.measureText(a).width; x.font = fuente(70, 800); var wb = x.measureText(b).width;
        var x0 = 210 - (wa + wb) / 2;
        x.font = fuente(122, 900); x.textAlign = 'left'; x.fillStyle = COL.blanco; x.shadowColor = 'rgba(0,225,255,.55)'; x.shadowBlur = 18;
        x.fillText(a, x0, 74); x.shadowBlur = 0; x.font = fuente(70, 800); x.fillStyle = COL.tenue; x.fillText(b, x0 + wa, 82);
      });
    }
  };

  /* ======================= pincel: acumula elementos de un fotograma ======================= */
  function Pincel(out, pref, X) { this.out = out; this.pref = pref; this.mo = 1 - X; this.mdy = -26 * X; this.ms = 1 - 0.05 * X; }
  /* Sprite: k clave única, s sprite, (x,y) centro en diseño, z profundidad, o opacidad, sc escala, e emerger, ex extra */
  Pincel.prototype.s = function (k, s, x, y, z, o, sc, e, ex) {
    sc = sc == null ? 1 : sc;
    if (e) { o *= e.o; sc *= e.s; y += e.dy; z *= 0.3 + 0.7 * e.zf; }
    o *= this.mo; if (o <= 0.003) return;
    var r = REG[s], it = { k: this.pref + k, s: s, x: x, y: y + this.mdy, z: z, w: r.w, h: r.h, o: Math.min(1, o), sc: sc * this.ms, rot: 0, add: false, tint: null };
    if (ex) for (var p in ex) it[p] = ex[p];
    this.out.push(it);
  };
  Pincel.prototype.l = function (k, x1, y1, x2, y2, z, an, col, o, e) {
    var dy = this.mdy;
    if (e) { o *= e.o; dy += e.dy; z *= 0.3 + 0.7 * e.zf; }
    o *= this.mo; if (o <= 0.003 || (x1 === x2 && y1 === y2)) return;
    this.out.push({ k: this.pref + k, linea: true, x1: x1, y1: y1 + dy, x2: x2, y2: y2 + dy, z: z, ancho: an, color: color(col), o: Math.min(1, o) });
  };
  /* Partícula luminosa (halo + núcleo) */
  Pincel.prototype.p = function (k, x, y, z, o, tam, col, e) {
    this.s(k + 'h', S.glow(), x, y, z, o * 0.85, 1, e, { w: tam * 3.4, h: tam * 3.4, tint: color(col), add: true });
    this.s(k + 'c', S.punto(), x, y, z + 0.002, o, 1, e, { w: tam, h: tam });
  };
  /* Anillo que se expande (radio r en diseño) */
  Pincel.prototype.anillo = function (k, x, y, z, r, o, col, grosor) {
    var w = r * 256 / 118;
    this.s(k, S.anillo(), x, y, z, o, 1, null, { w: w, h: w, tint: color(col) });
  };
  /* Momento "aprobado": anillos, disco, palomita que se dibuja y ráfaga de partículas. q = segundos desde el inicio. */
  Pincel.prototype.aprobado = function (k, x, y, z, R, q, f, nPart) {
    var V = COL.verde;
    for (var j = 0; j < 2; j++) { var d = j * 0.16, p = seg(q, d, d + 0.8); if (p > 0 && p < 1) this.anillo(k + 'r' + j, x, y, z, R + 130 * ease.out(p), 0.85 * (1 - p) * f, V); }
    var pd = seg(q, 0, 0.32);
    this.s(k + 'd', S.disco('verde'), x, y, z + 0.004, seg(q, 0, 0.1) * f, (R * 2.15 / 112) * ease.back(pd));
    var m = R / 50, p1 = ease.out(seg(q, 0.2, 0.33)), p2 = ease.out(seg(q, 0.33, 0.52));
    var ax = x - 20 * m, ay = y + 2 * m, bx = x - 6 * m, by = y + 16 * m, cx = x + 21 * m, cy = y - 14 * m;
    if (p1 > 0) this.l(k + 'c1', ax, ay, lerp(ax, bx, p1), lerp(ay, by, p1), z + 0.008, 8.5 * m, '#ffffff', f);
    if (p2 > 0) this.l(k + 'c2', bx, by, lerp(bx, cx, p2), lerp(by, cy, p2), z + 0.008, 8.5 * m, '#ffffff', f);
    if (!REDUCIDO) for (var i = 0; i < nPart; i++) {
      var pp = seg(q, 0.1, 0.95); if (pp <= 0 || pp >= 1) break;
      var a = i * Math.PI * 2 / nPart + 0.3, dist = R + 8 + 120 * ease.out(pp);
      this.p(k + 'b' + i, x + Math.cos(a) * dist, y + Math.sin(a) * dist, z + 0.002, (1 - seg(pp, 0.35, 1)) * 0.9 * f, i % 2 ? 12 : 16, i % 2 ? COL.blanco : V);
    }
  };

  /* ======================= escenas ======================= */
  function cabecera(P, idx, te) { P.s('cab', S.cab(idx), 400, 118, 0.085, 1, 1, E(te, 0.08)); }

  /* Intro al detectar la tarjeta: barrido de escaneo, puntos digitales, estado y logotipo. */
  function escenaIntro(t, P, R) {
    var w = R.x1 - R.x0, h = R.y1 - R.y0, cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2;
    var salida = 1 - seg(t, 1.95, 2.35);
    // esquinas que "fijan" el objetivo
    var fij = ease.out(seg(t, 0.05, 0.6)), off = 26 * (1 - fij), oE = seg(t, 0.05, 0.3) * salida, L = 64;
    [[R.x0, R.y0, 1, 1], [R.x1, R.y0, -1, 1], [R.x0, R.y1, 1, -1], [R.x1, R.y1, -1, -1]].forEach(function (c, i) {
      var x = c[0] - c[2] * off, y = c[1] - c[3] * off, col = t > 1.15 && t < 1.6 ? COL.verde : COL.cyan;
      P.l('q' + i + 'a', x, y, x + c[2] * L, y, 0.012, 6, col, oE);
      P.l('q' + i + 'b', x, y, x, y + c[3] * L, 0.012, 6, col, oE);
    });
    // barrido
    var ps = seg(t, 0.1, 0.9);
    if (ps > 0 && ps < 1) {
      var ys = R.y0 + h * ease.inOut(ps), ob = Math.sin(Math.PI * ps);
      P.s('banda', S.glow(), cx, ys, 0.01, 0.5 * ob, 1, null, { w: w * 1.15, h: 110, tint: COL.cyan, add: true });
      P.l('scan', R.x0, ys, R.x1, ys, 0.014, 4, COL.cyan, 0.95 * ob);
    }
    // puntos digitales que se encienden al pasar el barrido
    var pts = [];
    for (var i = 0; i < 16; i++) {
      var px = R.x0 + 50 + hash(i * 12.9898) * (w - 100), py = R.y0 + 60 + ((i + hash(i * 78.233)) / 16) * (h - 120);
      var tl = 0.1 + 0.8 * (py - R.y0) / h, o = seg(t, tl, tl + 0.08) * (1 - 0.65 * seg(t, tl + 0.12, tl + 0.7)) * salida;
      pts.push([px, py, tl]);
      if (o > 0) P.p('d' + i, px, py, 0.016, o, 10, COL.cyan);
    }
    for (var j = 0; j + 1 < pts.length; j += 2) {
      var a = pts[j], b = pts[j + 1], ol = 0.35 * seg(t, Math.max(a[2], b[2]) + 0.05, Math.max(a[2], b[2]) + 0.35) * salida;
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 420) P.l('dl' + j, a[0], a[1], b[0], b[1], 0.015, 2, COL.cyan, ol);
    }
    // estados
    var o1 = seg(t, 0.25, 0.4) * (1 - seg(t, 1.0, 1.15));
    if (o1 > 0) {
      P.s('an', S.estado('ANALIZANDO SISTEMA', 'cyan'), cx, cy, 0.05, o1, 1, null, { z: 0.05 });
      var wt = REG[S.estado('ANALIZANDO SISTEMA', 'cyan')].w;
      for (var k = 0; k < 3; k++) P.s('an' + k, S.punto(), cx + wt / 2 + 4 + k * 16, cy + 9, 0.05, o1 * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 10 - k * 1.3))), 1, null, { w: 11, h: 11, tint: COL.cyan });
    }
    var o2 = seg(t, 1.15, 1.3) * (1 - seg(t, 1.72, 1.86));
    if (o2 > 0) {
      P.s('det', S.estado('SISTEMA DE PAGO DETECTADO', 'cyan'), cx, cy, 0.055, o2, 0.94 + 0.06 * ease.out(seg(t, 1.15, 1.4)));
      var pr = seg(t, 1.15, 1.75); P.anillo('detr', cx, cy, 0.05, 60 + 260 * ease.out(pr), 0.6 * (1 - pr), COL.cyan);
    }
    var pl = seg(t, 1.8, 2.15), sal = seg(t, 2.25, 2.6);
    if (pl > 0 && sal < 1) P.s('logo', S.logo(), cx, cy, 0.07, ease.out(pl) * (1 - sal), (0.6 + 0.4 * ease.back(pl)) * (1 + 0.15 * sal));
  }

  /* 3.1 (flujo) y 3.4 (secuencia): un paquete recorre los nodos; al final, aprobación. */
  function escenaCadena(hl, te, tc, P) {
    var flujo = hl.tipo === 'flujo', n = hl.nodos.length, X = 172;
    var y0 = flujo ? 292 : 320, paso = flujo ? 112 : 142, R = flujo ? 44 : 50, tr = flujo ? 0.42 : 0.62;
    var ys = [], A = [], D = [], tt = 0.25;
    for (var i = 0; i < n; i++) { var esp = hl.nodos[i].espera || (flujo ? 0.16 : 0.45); ys.push(y0 + i * paso); A.push(tt); D.push(tt + esp); tt += esp + tr; }
    var tAp = A[n - 1], ciclo = tAp + 2.8;
    var c = REDUCIDO ? tAp + 1.3 : (tc >= 0 ? tc % ciclo : -1);
    var reset = 1 - seg(c, ciclo - 0.45, ciclo);
    P.s('chip', S.chip(hl.chip, 'cyan'), 400, 214, 0.05, 1, 1, E(te, 0.14));
    var eL = E(te, 0.2);
    P.l('base', X, ys[0], X, ys[n - 1], 0.03, 4, COL.cyan, 0.25, eL);
    // ¿dónde está el paquete?
    var yP = null, tramo = -1;
    for (i = 0; i < n - 1; i++) if (c >= D[i] && c < A[i + 1]) { tramo = i; yP = lerp(ys[i], ys[i + 1], ease.inOut(seg(c, D[i], A[i + 1]))); }
    var ultimo = -1; for (i = 0; i < n; i++) if (c >= A[i]) ultimo = i;
    var yLuz = yP != null ? yP : (ultimo >= 0 ? ys[ultimo] : ys[0]);
    if (ultimo >= 0 || yP != null) P.l('luz', X, ys[0], X, yLuz, 0.032, 5, COL.cyan, 0.9 * reset, eL);
    var aprob = c >= tAp, q = c - tAp;
    for (i = 0; i < n; i++) {
      var nd = hl.nodos[i], e = E(te, 0.22 + i * 0.07), f = flot(te, i);
      var act = c >= A[i] ? (1 - 0.55 * seg(c, A[i], A[i] + 0.7)) * reset : 0;
      var pico = c >= A[i] ? (1 - seg(c, A[i], A[i] + 0.35)) * reset : 0;
      var verde = aprob && i === n - 1;
      P.s('g' + i, S.glow(), X, ys[i] + f, 0.038, act * (verde ? 0.75 : 0.55), 1, e, { w: R * 4.4, h: R * 4.4, tint: verde ? COL.verde : COL.cyan, add: true });
      P.s('n' + i, S.nodo(nd.icono, 'cyan', R), X, ys[i] + f, 0.045 + act * 0.008, 1, 1 + 0.1 * pico, e);
      P.s('t' + i, S.etiqueta(nd.t, nd.s, 'left', 500, nd.clave ? 'oro' : 'tenue'), X + R + 26 + 250, ys[i] + f, 0.05, 0.82 + 0.18 * act, 1, E(te, 0.26 + i * 0.07));
      if (i < n - 1 && !REDUCIDO) { var pr = seg(c, D[i], D[i] + 0.5); if (pr > 0 && pr < 1) P.anillo('r' + i, X, ys[i], 0.055, R + 6 + 44 * ease.out(pr), 0.75 * (1 - pr) * reset, COL.cyan); }
      // validación: arco girando mientras espera
      if (nd.espera && nd.espera > 0.8 && c >= A[i] && c < D[i]) {
        var os = seg(c, A[i], A[i] + 0.12) * (1 - seg(c, D[i] - 0.12, D[i]));
        P.s('sp' + i, S.arco(), X, ys[i], 0.056, os, 1, null, { w: (R + 14) * 256 / 112, h: (R + 14) * 256 / 112, rot: c * 5.5, tint: COL.cyan });
      }
    }
    // paquete de datos con estela
    if (yP != null && !REDUCIDO) {
      var dir = Math.sign(ys[tramo + 1] - ys[tramo]);
      P.p('pk', X, yP, 0.062, reset, 17, COL.cyan);
      for (var k = 1; k <= 3; k++) P.s('pt' + k, S.glow(), X, yP - dir * k * 15, 0.06, (0.5 - k * 0.13) * reset, 1, null, { w: 44 - k * 9, h: 44 - k * 9, tint: COL.cyan, add: true });
    }
    // estados de la secuencia (3.4)
    if (!flujo) for (i = 0; i < n - 1; i++) {
      if (!hl.nodos[i].estado) continue;
      var oe = seg(c, A[i], A[i] + 0.15) * (1 - seg(c, A[i + 1] - 0.12, A[i + 1])) * reset;
      if (oe > 0) P.s('st' + i, S.estado(hl.nodos[i].estado, 'cyan'), 400, 872, 0.07, oe * (REDUCIDO ? 1 : 0.8 + 0.2 * Math.sin(c * 7)), 1, e);
    }
    if (aprob) {
      P.aprobado('ap', X, ys[n - 1], 0.06, R, REDUCIDO ? 2 : q, reset, 10);
      var pa = seg(q, 0.25, 0.55), yA = flujo ? 946 : 872;
      P.s('apt', S.estado(hl.aprobado, 'verde'), 400, yA + 16 * (1 - ease.out(pa)), 0.072, seg(q, 0.25, 0.45) * reset, 0.92 + 0.08 * ease.back(pa));
      if (hl.aprobadoSub) P.s('aps', S.chip(hl.aprobadoSub, 'verde'), 400, 938, 0.07, seg(q, 0.45, 0.65) * reset, 1);
    }
  }

  /* 3.2: red que alterna entre dos modelos de gestión. */
  function escenaRed(hl, te, tc, P) {
    var CX = 400, CY = 585, RO = 272, RC = 66, RS = 48, PER = 5.5;
    var sat = [[176, 428], [624, 428], [176, 742], [624, 742]];
    var tm = REDUCIDO ? 0 : Math.max(0, tc);
    // Un modelo a la vez: el actual se desvanece al final de su periodo y el siguiente entra (sin superponer textos).
    var kk = Math.floor(tm / PER), f = tm - kk * PER, modo = kk % 2;
    var peso = [0, 0]; peso[modo] = REDUCIDO ? 1 : (kk === 0 ? 1 : ease.out(seg(f, 0, 0.3))) * (1 - seg(f, PER - 0.3, PER));
    var eO = E(te, 0.16);
    P.s('orb', S.anilloP(), CX, CY, 0.03, 0.45, 1, eO, { w: RO * 2 * 512 / 492, h: RO * 2 * 512 / 492, rot: REDUCIDO ? 0 : te * 0.12, tint: COL.cyan });
    P.s('orbl', S.chip(hl.anillo, 'oro'), CX, CY - RO, 0.05, 1, 1, E(te, 0.2));
    // paquetes: cada 1.1 s uno nuevo de un participante al centro y de ahí a otro
    var act = [0, 0, 0, 0], pulsoC = 0, pulsoS = [0, 0, 0, 0], paqs = [];
    if (!REDUCIDO && tc > 0) {
      var j0 = Math.floor(tm / 1.1);
      for (var j = j0; j >= Math.max(0, j0 - 2); j--) {
        var a = tm - j * 1.1; if (a > 1.7) continue;
        var m = Math.floor((j * 1.1) / PER) % 2, ruta = hl.modelos[m].rutas[j % 4], de = sat[ruta[0]], a2 = sat[ruta[1]];
        if (a < 0.6) { var p = ease.inOut(a / 0.6); paqs.push([lerp(de[0], CX, p), lerp(de[1], CY, p), 'a' + (j % 3)]); act[ruta[0]] = Math.max(act[ruta[0]], 1); pulsoS[ruta[0]] = Math.max(pulsoS[ruta[0]], 1 - seg(a, 0, 0.4)); }
        else if (a >= 0.68 && a < 1.28) { var p2 = ease.inOut((a - 0.68) / 0.6); paqs.push([lerp(CX, a2[0], p2), lerp(CY, a2[1], p2), 'a' + (j % 3)]); act[ruta[1]] = Math.max(act[ruta[1]], 1); }
        if (a >= 0.6) pulsoC = Math.max(pulsoC, 1 - seg(a, 0.6, 1.0));
        if (a >= 1.28) pulsoS[ruta[1]] = Math.max(pulsoS[ruta[1]], 1 - seg(a, 1.28, 1.7));
      }
    }
    for (var i = 0; i < 4; i++) P.l('sp' + i, sat[i][0], sat[i][1], CX, CY, 0.032, 3, COL.cyan, 0.2 + 0.45 * act[i], E(te, 0.2));
    paqs.forEach(function (pq) { P.p('pk' + pq[2], pq[0], pq[1], 0.062, 1, 15, COL.cyan); });
    // centro (operador) y participantes, con fundido cruzado entre modelos
    for (var mm = 0; mm < 2; mm++) {
      if (peso[mm] <= 0.003) continue;
      var md = hl.modelos[mm], ce = md.centro, w = peso[mm];
      P.s('mc' + mm, S.chip(md.chip, 'cyan'), 400, 212, 0.05, w, 1, E(te, 0.14));
      var eC = E(te, 0.24);
      P.s('cg' + mm, S.glow(), CX, CY, 0.04, (0.35 + 0.4 * pulsoC) * w, 1, eC, { w: RC * 4.6, h: RC * 4.6, tint: ce.oro ? COL.oro : COL.cyan, add: true });
      P.s('c' + mm, S.nodo(ce.icono, ce.oro ? 'oro' : 'cyan', RC), CX, CY, 0.048, w, 1 + 0.07 * pulsoC, eC);
      P.s('ct' + mm, S.etiqueta(ce.t, ce.s, 'center', 340, ce.oro ? 'oro' : 'tenue'), CX, CY + RC + 50, 0.05, w, 1, E(te, 0.3));
      for (i = 0; i < 4; i++) {
        var nd = md.nodos[i], eS = E(te, 0.3 + i * 0.07), fl = flot(te, i + 3);
        P.s('sg' + mm + i, S.glow(), sat[i][0], sat[i][1] + fl, 0.04, 0.6 * pulsoS[i] * w, 1, eS, { w: RS * 4.4, h: RS * 4.4, tint: COL.cyan, add: true });
        P.s('s' + mm + i, S.nodo(nd.icono, 'cyan', RS), sat[i][0], sat[i][1] + fl, 0.045, w, 1 + 0.08 * pulsoS[i], eS);
        P.s('st' + mm + i, S.etiqueta(nd.t, nd.s, 'center', 260, 'tenue'), sat[i][0], sat[i][1] + RS + 48 + fl, 0.05, w, 1, E(te, 0.34 + i * 0.07));
      }
    }
    P.s('pie', S.texto(hl.pie, 27, 'tinta', 680, 700), 400, 946, 0.05, 0.95, 1, E(te, 0.45));
  }

  /* 3.3: el dinero circula entre hogares, empresas y gobierno. */
  function escenaCirculacion(hl, te, tc, P) {
    var CX = 400, CY = 548, RR = 218, ang = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
    var tm = REDUCIDO ? 0 : Math.max(0, tc);
    var eR = E(te, 0.16);
    P.s('aro', S.anillo(), CX, CY, 0.03, 0.38, 1, eR, { w: RR * 256 / 118, h: RR * 256 / 118, tint: COL.cyan });
    P.s('aro2', S.anilloP(), CX, CY, 0.035, 0.28, 1, eR, { w: 150 * 2 * 512 / 492, h: 150 * 2 * 512 / 492, rot: REDUCIDO ? 0 : -te * 0.18, tint: COL.cyan });
    P.s('ico', S.icono('ciclo', 'cyan', 84), CX, CY - 34, 0.06, 1, 1, E(te, 0.24), { rot: REDUCIDO ? 0 : te * 0.6 });
    P.s('cen', S.texto(hl.centro, 30, 'blanco', 270, 900), CX, CY + 48, 0.07, 1, 1, E(te, 0.3));
    // monedas en órbita
    var monedas = [], N = 5;
    if (tc > 0 || REDUCIDO) for (var k = 0; k < N; k++) {
      var a = k * Math.PI * 2 / N + tm * 0.55, om = REDUCIDO ? 1 : seg(tc, 0, 0.5);
      monedas.push(a);
      var mx = CX + Math.cos(a) * RR, my = CY + Math.sin(a) * RR;
      P.s('mg' + k, S.glow(), mx, my, 0.058, 0.45 * om, 1, null, { w: 86, h: 86, tint: COL.oro, add: true });
      P.s('m' + k, S.moneda(), mx, my, 0.062, om, 1, null, { w: 46, h: 46 });
    }
    for (var i = 0; i < 3; i++) {
      var nd = hl.nodos[i], x = CX + Math.cos(ang[i]) * RR, y = CY + Math.sin(ang[i]) * RR, e = E(te, 0.26 + i * 0.08);
      var pul = 0;
      monedas.forEach(function (a) { var d = Math.abs(Math.atan2(Math.sin(a - ang[i]), Math.cos(a - ang[i]))); pul = Math.max(pul, 1 - clamp(d / 0.38, 0, 1)); });
      P.s('g' + i, S.glow(), x, y, 0.04, 0.55 * pul, 1, e, { w: 200, h: 200, tint: COL.cyan, add: true });
      P.s('n' + i, S.nodo(nd.icono, 'cyan', 46), x, y, 0.045, 1, 1 + 0.08 * pul, e);
      P.s('t' + i, S.texto(nd.t, 26, 'blanco', 220, 800, 1.5), x, y + 74, 0.05, 1, 1, e);
    }
    var foco = REDUCIDO ? -1 : Math.floor(tm / 1.6) % 3;
    hl.chips.forEach(function (t, j) {
      var x = [170, 400, 630][j], on = j === foco ? Math.sin(Math.PI * seg(tm % 1.6, 0, 1.6)) : 0, e = E(te, 0.4 + j * 0.06);
      P.s('cg' + j, S.glow(), x, 868, 0.048, 0.4 * on, 1, e, { w: 260, h: 90, tint: COL.cyan, add: true });
      P.s('c' + j, S.chip(t, 'cyan'), x, 868, 0.05, 0.7 + 0.3 * on, 1 + 0.05 * on, e);
    });
    P.s('pie', S.texto(hl.pie, 27, 'tinta', 680, 700), 400, 946, 0.05, 0.95, 1, E(te, 0.45));
  }

  /* Final: 01-04 se iluminan, convergen al centro, palomita, misión completada y resultado. */
  function escenaFinal(est, te, P) {
    if (REDUCIDO) te = Math.max(te, 4);
    var CX = 400, CY = 420, RF = 182, R = 40, ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    P.s('chip', S.chip('MISIÓN AR · RESULTADO', 'cyan'), 400, 92, 0.085, 1, 1, E(te, 0.05));
    var cv = ease.inOut(seg(te, 1.75, 2.25));
    for (var i = 0; i < 4; i++) {
      var x0 = CX + Math.cos(ang[i]) * RF, y0 = CY + Math.sin(ang[i]) * RF, x = lerp(x0, CX, cv), y = lerp(y0, CY, cv);
      var Li = seg(te, 0.55 + i * 0.28, 0.75 + i * 0.28), pico = Li > 0 ? 1 - seg(te, 0.75 + i * 0.28, 1.05 + i * 0.28) : 0, o = 1 - seg(te, 2.0, 2.3);
      var e = E(te, 0.1 + i * 0.08);
      if (o <= 0) continue;
      P.l('fl' + i, x, y, CX, CY, 0.035, 3, COL.cyan, 0.45 * Li * o * (1 - cv * 0.5), e);
      P.s('g' + i, S.glow(), x, y, 0.04, 0.65 * Li * o, 1, e, { w: 200, h: 200, tint: COL.cyan, add: true });
      P.s('n' + i, S.num('0' + (i + 1), R), x, y, 0.05, o, (1 + 0.12 * pico) * (1 - 0.6 * cv), e);
    }
    if (te >= 2.15) {
      var q = te - 2.15;
      P.aprobado('ok', CX, CY, 0.06, 64, q, 1, 12);
      var oA = seg(q, 0.45, 0.9);
      P.s('a1', S.anilloP(), CX, CY, 0.055, 0.5 * oA, 1, null, { w: 104 * 2 * 512 / 492, h: 104 * 2 * 512 / 492, rot: REDUCIDO ? 0 : te * 0.35, tint: COL.cyan });
      P.s('a2', S.anilloP(), CX, CY, 0.05, 0.3 * oA, 1, null, { w: 134 * 2 * 512 / 492, h: 134 * 2 * 512 / 492, rot: REDUCIDO ? 0 : -te * 0.22, tint: COL.cyan });
      if (!REDUCIDO) for (var k = 0; k < 6; k++) {
        var a = k * Math.PI / 3 + te * 0.5; P.p('o' + k, CX + Math.cos(a) * 152, CY + Math.sin(a) * 152, 0.065, 0.6 * seg(q, 0.7, 1.2), 9, k % 3 ? COL.cyan : COL.oro);
      }
    }
    var t1 = seg(te, 2.55, 2.85), t2 = seg(te, 2.7, 3.0), t3 = seg(te, 2.85, 3.15);
    P.s('mc', S.texto('MISIÓN COMPLETADA', 54, 'blanco', 700, 900), 400, 680 + 18 * (1 - ease.out(t1)), 0.08, t1, 1);
    P.s('sp', S.texto('SISTEMAS DE PAGO VIRTUAL', 25, 'cyan', 700, 800, 5), 400, 738 + 14 * (1 - ease.out(t2)), 0.07, t2, 1);
    var v = Math.min(est.aciertos, Math.floor(seg(te, 2.85, 2.85 + 0.18 * Math.max(1, est.aciertos)) * est.aciertos + 0.0001));
    P.s('sc', S.marcador(v, est.total), 400, 838, 0.075, t3, 0.9 + 0.1 * ease.back(t3));
    P.s('rc', S.texto('respuestas correctas', 27, 'tenue', 600, 700), 400, 918, 0.07, seg(te, 3.0, 3.3), 1);
  }

  function dibujarEscena(est, te, tc, P) {
    if (est.fase === 'final') { escenaFinal(est, te, P); return; }
    var hl = C.etapas[est.etapa].holo;
    cabecera(P, est.etapa, te);
    if (hl.tipo === 'red') escenaRed(hl, te, tc, P);
    else if (hl.tipo === 'circulacion') escenaCirculacion(hl, te, tc, P);
    else escenaCadena(hl, te, tc, P);
  }

  /* Partículas ambientales: pocos "datos" que suben despacio. */
  function ambiente(t, P) {
    if (REDUCIDO) return;
    for (var i = 0; i < 9; i++) {
      var per = 7 + (i * 1.7) % 3, f = ((t + i * 1.37) / per) % 1;
      var x = 80 + ((i * 173) % 640), y = 240 + ((i * 97) % 640) - f * 120, o = Math.sin(Math.PI * f) * 0.42 * seg(t, 0.6, 1.4);
      P.s('am' + i, S.glow(), x, y, 0.05 + (i % 4) * 0.012, o, 1, null, { w: 30 + (i % 3) * 10, h: 30 + (i % 3) * 10, tint: i % 4 === 0 ? COL.oro : COL.cyan, add: true });
    }
  }

  /* ======================= controlador de la línea de tiempo ======================= */
  function clave(est) { return est.fase === 'final' ? 'fin' : 'e' + est.etapa; }

  function Controlador(opts) {
    this.rect = opts.rect || { x0: 40, y0: 40, x1: 760, y1: 960 };
    this.estado = null; this.t0 = 0; this.ciclo0 = 0;
    this.previo = null;
    this.intro0 = -1; this.panel0 = -1;
    this.flash0 = -1; this.flashCol = COL.cyan; this.n = 0;
  }
  Controlador.prototype.setEstado = function (est, ahora) {
    var nuevo = { etapa: est.etapa, fase: est.fase, aciertos: est.aciertos, total: est.total };
    if (!this.estado) { this.estado = nuevo; this.t0 = ahora; this.ciclo0 = ahora; this.id = clave(nuevo) + (this.n++); return; }
    var antes = this.estado;
    if (clave(antes) === clave(nuevo)) { this.estado.aciertos = nuevo.aciertos; return; } // misma escena (info ↔ pregunta)
    this.previo = { estado: antes, t0: this.t0, ciclo0: this.ciclo0, salida: ahora, id: this.id };
    this.estado = nuevo; this.id = clave(nuevo) + (this.n++);
    this.t0 = ahora + 0.15; this.ciclo0 = this.t0 + 0.75;
    if (antes.fase === 'final' && nuevo.etapa === 0 && this.panel0 >= 0) this.intro(ahora); // reinicio real: repite la intro
    else this.destello(COL.cyan, ahora);
  };
  /* Primera detección (o reinicio): intro completa y luego la escena emerge. */
  Controlador.prototype.intro = function (ahora) {
    if (REDUCIDO) { this.aparecer(ahora); return; }
    this.intro0 = ahora; this.panel0 = ahora + INTRO_PANEL; this.t0 = ahora + INTRO_ESCENA; this.ciclo0 = this.t0 + 0.75; this.previo = null;
  };
  Controlador.prototype.aparecer = function (ahora) { this.panel0 = ahora; this.t0 = ahora + 0.1; this.ciclo0 = this.t0 + 0.75; };
  /* Al reencontrar la tarjeta: la escena sigue igual, pero la animación del flujo vuelve a empezar. */
  Controlador.prototype.reaparecer = function (ahora) { if (ahora - this.t0 > 1) this.ciclo0 = ahora + 0.3; };
  Controlador.prototype.destello = function (col, ahora) { this.flash0 = ahora; this.flashCol = color(col); };
  Controlador.prototype.duracionIntro = function () { return REDUCIDO ? 0.3 : INTRO_FIN; };
  Controlador.prototype.frame = function (ahora) {
    var out = [];
    if (this.intro0 >= 0 && ahora - this.intro0 < INTRO_FIN) escenaIntro(ahora - this.intro0, new Pincel(out, 'i|', 0), this.rect);
    if (this.panel0 >= 0 && ahora >= this.panel0) {
      var P = new Pincel(out, '', 0), tp = ahora - this.panel0;
      if (this.flash0 >= 0) { var fq = seg(ahora - this.flash0, 0, 0.7); if (fq < 1) P.s('halo', S.glow(), 400, 500, 0.012, 0.55 * Math.sin(Math.PI * fq), 1.12, null, { w: 1150, h: 1350, tint: this.flashCol, add: true }); }
      P.s('panel', S.panel(), 400, 500, 0.02, 1, 1, E(tp, 0));
      ambiente(tp, P);
      if (this.previo) {
        var x = seg(ahora - this.previo.salida, 0, 0.3);
        if (x < 1) dibujarEscena(this.previo.estado, ahora - this.previo.t0, ahora - this.previo.ciclo0, new Pincel(out, this.previo.id + '|', ease.out(x)));
        else this.previo = null;
      }
      if (this.estado && ahora >= this.t0) dibujarEscena(this.estado, ahora - this.t0, ahora - this.ciclo0, new Pincel(out, this.id + '|', 0));
    }
    return out;
  };

  /* ======================= renderizador 2D (demo.html) ======================= */
  /* Pinta un fotograma. Parallax: las capas con más z se desplazan más (puntero en escritorio + deriva lenta). */
  function pintar2D(ctx, items, t, px, py) {
    items.forEach(function (it, i) { it._i = i; });
    items.sort(function (a, b) { return a.z - b.z || a._i - b._i; });
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], k = it.z / 0.09;
      var ox = REDUCIDO ? 0 : ((px || 0) * 7 + Math.sin(t * 0.35) * 2.5) * k, oy = REDUCIDO ? 0 : ((py || 0) * 7 + Math.cos(t * 0.3) * 1.8) * k;
      ctx.globalAlpha = it.o; ctx.globalCompositeOperation = it.add ? 'lighter' : 'source-over';
      if (it.linea) {
        ctx.strokeStyle = it.color; ctx.lineWidth = it.ancho; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(it.x1 + ox, it.y1 + oy); ctx.lineTo(it.x2 + ox, it.y2 + oy); ctx.stroke();
      } else {
        var img = it.tint ? tintado(it.s, it.tint) : lienzo(it.s), w = it.w * it.sc, h = it.h * it.sc;
        if (it.rot) { ctx.save(); ctx.translate(it.x + ox, it.y + oy); ctx.rotate(it.rot); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore(); }
        else ctx.drawImage(img, it.x + ox - w / 2, it.y + oy - h / 2, w, h);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function montar2D(canvas, ctrl) {
    var ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    var px = 0, py = 0, tx = 0, ty = 0, activo = true, visible = true, pedido = 0;
    canvas.addEventListener('pointermove', function (ev) {
      var r = canvas.getBoundingClientRect(); tx = ((ev.clientX - r.left) / r.width - 0.5) * 2; ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
    });
    canvas.addEventListener('pointerleave', function () { tx = 0; ty = 0; });
    function dibujar(ms) {
      pedido = 0;
      if (!activo || !visible) return;
      var t = ms / 1000;
      px += (tx - px) * 0.06; py += (ty - py) * 0.06;
      pintar2D(ctx, ctrl.frame(t), t, px, py);
      pedir();
    }
    function pedir() { if (!pedido && activo && visible) pedido = requestAnimationFrame(dibujar); }
    document.addEventListener('visibilitychange', function () { activo = !document.hidden; pedir(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; pedir(); }).observe(canvas);
    pedir();
    return { detener: function () { activo = false; } };
  }

  window.PagoarHolo = {
    W: W, H: H, REDUCIDO: REDUCIDO, color: color,
    crear: function (opts) { return new Controlador(opts || {}); },
    lienzo: lienzo, info: function (k) { return REG[k]; },
    montar2D: montar2D, pintar2D: pintar2D,
    // Rectángulo de la tarjeta AR (372×674 → ancho 1 × alto 1.81 unidades) en coordenadas de diseño.
    RECT_TARJETA: { x0: 126, y0: 6, x1: 674, y1: 994 },
    UNIDAD: 1.82 / 1000
  };
})();
