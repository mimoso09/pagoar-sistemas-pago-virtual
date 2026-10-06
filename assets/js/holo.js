/*
 * PAGOAR — Dibuja el "holograma" de cada etapa en un <canvas> 2D.
 * index.html lo usa como textura sobre la tarjeta AR; demo.html lo muestra directamente.
 * Usar canvas evita descargar fuentes 3D externas y permite acentos (Ó, É…) y emojis.
 */
(function () {
  'use strict';
  var C = window.PAGOAR_CONTENIDO;
  var W = 800, H = 1000;
  var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var COLORES = ['#ffc73e', '#00e1ff', '#5b8cff'];

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function lineas(ctx, texto, maxW) {
    var palabras = String(texto).split(' '), out = [], linea = '';
    palabras.forEach(function (p) {
      var prueba = linea ? linea + ' ' + p : p;
      if (ctx.measureText(prueba).width > maxW && linea) { out.push(linea); linea = p; } else linea = prueba;
    });
    if (linea) out.push(linea);
    return out;
  }
  /* Escribe texto centrado ajustando el tamaño para que quepa en maxLineas. */
  function texto(ctx, t, x, y, maxW, size, peso, color, maxLineas, interlineado) {
    var ls;
    for (var s = size; s >= 18; s -= 2) {
      ctx.font = peso + ' ' + s + 'px ' + FONT;
      ls = lineas(ctx, t, maxW);
      if (ls.length <= maxLineas) { size = s; break; }
    }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var lh = size * (interlineado || 1.15), y0 = y - (ls.length - 1) * lh / 2;
    ls.forEach(function (l, i) { ctx.fillText(l, x, y0 + i * lh); });
  }

  function fondo(ctx) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'butt';
    // panel translúcido con borde luminoso
    ctx.save();
    ctx.shadowColor = 'rgba(0,225,255,.55)'; ctx.shadowBlur = 28;
    rr(ctx, 18, 18, W - 36, H - 36, 46);
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(8,22,46,.92)'); g.addColorStop(1, 'rgba(5,14,32,.92)');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = '#00e1ff'; rr(ctx, 18, 18, W - 36, H - 36, 46); ctx.stroke();
    // retícula sutil
    ctx.save(); rr(ctx, 22, 22, W - 44, H - 44, 42); ctx.clip();
    ctx.strokeStyle = 'rgba(120,190,255,.07)'; ctx.lineWidth = 2;
    for (var x = 40; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (var y = 40; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    // esquinas tecnológicas en amarillo
    ctx.strokeStyle = '#ffc73e'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    [[48, 48, 1, 1], [W - 48, 48, -1, 1], [48, H - 48, 1, -1], [W - 48, H - 48, -1, -1]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1] + 40 * c[3]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + 40 * c[2], c[1]); ctx.stroke();
    });
  }

  function puntos(ctx, actual, total, y) {
    var r = 11, gap = 40, x0 = W / 2 - (total - 1) * gap / 2;
    for (var i = 0; i < total; i++) {
      ctx.beginPath(); ctx.arc(x0 + i * gap, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i < actual ? '#00e1ff' : i === actual ? '#ffc73e' : 'rgba(120,160,210,.35)';
      ctx.fill();
    }
  }

  function etapa(ctx, idx) {
    var e = C.etapas[idx], hl = e.holo, total = C.etapas.length;
    fondo(ctx);
    // cabecera
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '900 34px ' + FONT; ctx.fillStyle = '#00e1ff';
    ctx.fillText('ETAPA ' + (idx + 1) + ' / ' + total, 70, 96);
    ctx.font = '900 34px ' + FONT;
    var cw = ctx.measureText(e.clave).width + 40;
    rr(ctx, W - 70 - cw, 70, cw, 52, 26); ctx.fillStyle = '#ffc73e'; ctx.fill();
    ctx.fillStyle = '#071226'; ctx.textAlign = 'center'; ctx.fillText(e.clave, W - 70 - cw / 2, 97);
    texto(ctx, hl.titulo, W / 2, 205, W - 140, 56, '900', '#ffffff', 2, 1.1);
    // nodos
    var nw = 600, nh = 148, gap = 66, y0 = 300, x = (W - nw) / 2;
    hl.nodos.forEach(function (n, i) {
      var y = y0 + i * (nh + gap);
      ctx.save(); ctx.shadowColor = COLORES[i]; ctx.shadowBlur = 18;
      rr(ctx, x, y, nw, nh, 30); ctx.fillStyle = 'rgba(18,44,84,.95)'; ctx.fill(); ctx.restore();
      ctx.lineWidth = 5; ctx.strokeStyle = COLORES[i]; rr(ctx, x, y, nw, nh, 30); ctx.stroke();
      texto(ctx, n[0], W / 2, y + 56, nw - 60, 46, '900', '#ffffff', 1);
      texto(ctx, n[1], W / 2, y + 108, nw - 60, 28, '600', '#b9cde8', 1);
      if (i < hl.nodos.length - 1) {
        var cy = y + nh + gap / 2;
        ctx.beginPath(); ctx.arc(W / 2, cy, 27, 0, Math.PI * 2); ctx.fillStyle = '#00e1ff'; ctx.fill();
        ctx.font = '900 40px ' + FONT; ctx.fillStyle = '#04101f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(hl.conector, W / 2, cy + 2);
      }
    });
    texto(ctx, hl.pie, W / 2, 900, W - 160, 32, '700', '#d6e4f7', 2, 1.2);
    puntos(ctx, idx, total, 952);
  }

  function final(ctx, aciertos, total) {
    fondo(ctx);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '200px ' + FONT; ctx.fillText('🏆', W / 2, 250);
    texto(ctx, 'MISIÓN COMPLETADA', W / 2, 450, W - 120, 64, '900', '#ffc73e', 2, 1.05);
    ctx.font = '900 170px ' + FONT; ctx.fillStyle = '#ffffff'; ctx.fillText(aciertos + ' / ' + total, W / 2, 640);
    texto(ctx, 'respuestas correctas', W / 2, 760, W - 160, 40, '700', '#00e1ff', 1);
    texto(ctx, 'Sistemas de Pago Virtual · PAGOAR', W / 2, 880, W - 160, 30, '700', '#b9cde8', 1);
    puntos(ctx, total, total, 940);
  }

  /**
   * Dibuja el estado { etapa, fase, aciertos, total } en el canvas.
   * El diseño es de 800×1000; con ancho/alto distintos (p. ej. 1024×1024 para una textura
   * potencia de 2 en WebGL) se escala, y el plano 3D con proporción 0.8 lo devuelve a su forma.
   */
  function dibujar(canvas, estado, ancho, alto) {
    ancho = ancho || W; alto = alto || H;
    if (canvas.width !== ancho) canvas.width = ancho;
    if (canvas.height !== alto) canvas.height = alto;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ancho / W, 0, 0, alto / H, 0, 0);
    if (estado.fase === 'final') final(ctx, estado.aciertos, estado.total);
    else etapa(ctx, estado.etapa);
  }

  window.PagoarHolo = { dibujar: dibujar, ancho: W, alto: H };
})();
