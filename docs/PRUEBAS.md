# Reporte de pruebas técnicas

Fecha: 2026-10-06. Navegador de pruebas: Chromium (escritorio), con emulación de teléfono 375×812.

> **Importante:** no se probó con la cámara física de un teléfono real. La cámara se **simuló** con un
> `MediaStream` generado desde un `<canvas>` que dibuja la tarjeta AR, de modo que MindAR, A-Frame, los eventos
> y la interfaz se ejecutaron de verdad, pero la imagen no venía de un sensor físico. Ver «Limitaciones».

## 1. Auditoría del proyecto recibido — errores encontrados y corregidos

| # | Problema en la versión recibida | Impacto | Corrección |
|---|---|---|---|
| 1 | `index.html` cargaba MindAR desde `cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/dist/...` → **HTTP 404** | La AR **nunca** iniciaba | Se usan los archivos publicados en npm (`mind-ar@1.2.5`), copiados en `assets/vendor/` |
| 2 | Cargaba `mindar-image.prod.js` (módulo ES con `import`) como script clásico | Error de sintaxis JS | Se eliminó; solo se usa el build A-Frame autocontenido |
| 3 | `card.mind` oficial está compilado con la imagen **girada 90°** (674×372) y `target-card.html` mostraba `card.png` vertical (372×674) | Holograma de lado respecto a la hoja | Se recompiló el target con MindAR 1.2.5 a partir de la imagen exacta y en la misma orientación que se imprime |
| 4 | La cámara se iniciaba automáticamente al cargar | Permiso pedido sin contexto | Pantalla inicial con **Iniciar experiencia AR** / **Usar versión sin AR** |
| 5 | `targetFound` llamaba a `renderHUD()` | La pregunta se **reiniciaba** al reencontrar la tarjeta y se podía volver a contestar sumando puntos | El HUD se crea una vez; encontrar/perder la tarjeta ya no toca el estado |
| 6 | `targetLost` ocultaba todo el HUD | Mover el teléfono hacía desaparecer la pregunta | El panel permanece; solo aparece un aviso «Tarjeta fuera de vista» |
| 7 | No se escuchaban `arReady` / `arError` y los errores de cámara se detectaban por texto | Sin mensajes útiles al fallar | Errores clasificados (permiso, sin cámara, ocupada, red, lento) con botones **Reintentar** y **Abrir versión sin AR** |
| 8 | El fondo del contenedor tapaba el `<video>` (z-index −2 de MindAR) en la nueva maqueta | Cámara negra | El contenedor crea su propio contexto de apilamiento (`z-index: 0`) |
| 9 | `demo.html` era solo un carrusel | El Plan B no tenía preguntas ni puntuación | Misma misión completa (motor compartido `assets/js/mision.js`) |
| 10 | `qr.html` exigía pegar la URL | Paso manual el día de la exposición | QR automático de la URL publicada (corrección H) + campo manual secundario |
| 11 | `target-card.html` con ancho fijo de 210 mm | Desbordaba en teléfono/iPad | Diseño adaptable, impresión carta/A4 y modo proyección |
| 12 | Textos 3D con fuente remota (`cdn.aframe.io`) y sin acentos | Dependencia externa; «DEFINICION» | Holograma dibujado en canvas (acentos correctos, sin descargas extra) |
| 13 | Sin `viewport-fit=cover` | `env(safe-area-inset-*)` valía 0 en iPhone | Añadido |
| 14 | Botones de 13 px de texto y ~36 px de alto | Difíciles de tocar | Botones ≥ 54 px de alto y 16–18 px de texto |
| 15 | `deploy-pages@v4` | Versión anterior a la plantilla oficial | `deploy-pages@v5` (plantilla oficial de GitHub) |

## 2. Elección del target: tarjeta oficial vs. tarjeta personalizada

Ambas imágenes se compilaron con el compilador de MindAR 1.2.5 y se pasaron por el detector real de MindAR con
fotogramas sintéticos de 640×480 (fondo con objetos, distintas condiciones). `trk` = puntos de seguimiento
encontrados después de la detección (MindAR necesita **al menos 4** para seguir la imagen).

| Condición | Personalizada `payment-target-custom.png` | Oficial `tarjeta-ar.png` |
|---|---|---|
| Frontal 90 % del cuadro | Detecta · trk 7 | Detecta · trk 24 |
| Frontal 60 % | Detecta · trk 4 | Detecta · trk 24 |
| Pequeña 40 % | Detecta · trk 10 | Detecta · trk 23 |
| Muy pequeña 28 % | Detecta · trk 9 | Detecta · trk 25 |
| Rotada 30° | Detecta · trk 8 | Detecta · trk 24 |
| Rotada 90° | Detecta · trk 4 | Detecta · trk 24 |
| Inclinada (escorzo) | Detecta · **trk 0** | Detecta · trk 8 |
| Inclinada + cizalla | Detecta · **trk 0** | Detecta · trk 16 |
| Desenfoque 2 px | Detecta · **trk 2** | Detecta · trk 19 |
| Poco contraste | Detecta · trk 7 | Detecta · trk 24 |
| Proyector «lavado» | Detecta · trk 10 | Detecta · trk 24 |
| Poca luz + ruido | Detecta · trk 6 | Detecta · trk 24 |
| Combinado difícil | Detecta · **trk 1** | Detecta · trk 12 |
| Descentrada | Detecta · trk 10 | Detecta · trk 25 |
| Sin tarjeta (falso positivo) | No detecta (correcto) | No detecta (correcto) |

Puntos de seguimiento por escala al compilar: personalizada 31 / 13; oficial 30 / 32.

**Conclusión:** la tarjeta personalizada se detecta, pero su seguimiento es débil (fondo oscuro y líneas finas
que desaparecen a 256 px), lo que haría parpadear el holograma. Se usa la **tarjeta oficial de MindAR**,
compilada en orientación vertical. `payment-target-custom.png` se conserva en el repositorio sin usarse.

## 3. Pruebas funcionales (servidor local, cámara simulada)

| Prueba | Resultado |
|---|---|
| Pantalla inicial: no pide cámara al cargar | ✅ |
| «Iniciar experiencia AR» → una sola llamada a `getUserMedia` (el stream se entrega a MindAR) | ✅ |
| `arReady` (motor listo) | ✅ ~1.3 s en escritorio |
| `targetFound` con la tarjeta a ~65 % del alto del cuadro | ✅ ~2.9 s |
| `targetFound` con la tarjeta ocupando ~80 % (muy cerca) | ✅ pero tardó ~11 s → se recomienda dejar margen |
| Holograma alineado sobre la tarjeta, con acentos, moneda animada | ✅ |
| Perder la tarjeta a mitad de una pregunta respondida | ✅ HUD y respuesta se conservan; aparece aviso |
| Recuperar la tarjeta | ✅ aviso desaparece, no se reinicia nada |
| Doble toque en otra respuesta tras contestar | ✅ bloqueado |
| Recorrido 4 etapas con 1 error | ✅ «Resultado: 3 / 4 respuestas correctas» y resumen por etapa |
| Recargar con misión en curso | ✅ «Continuar experiencia AR», reanuda en la etapa guardada |
| Permiso denegado (`NotAllowedError`, y bloqueo real del navegador) | ✅ «No tenemos permiso para usar la cámara» + instrucciones iPhone/Android |
| Cámara ocupada (`NotReadableError`) | ✅ «La cámara está ocupada» |
| Sin cámara (`NotFoundError`) | ✅ «Este navegador no puede abrir la cámara» |
| Error desconocido | ✅ mensaje genérico sin jerga técnica |
| «Reintentar» → recarga y reinicia la cámara sin otro toque, sin bucles | ✅ |
| MindAR local no disponible → respaldo CDN | ✅ cargó `cdn.jsdelivr.net/npm/mind-ar@1.2.5` y llegó a `arReady` |
| Archivos locales = archivos de CDN (SHA-256) | ✅ idénticos (A-Frame y MindAR) |
| `demo.html`: 4 etapas, retroalimentación, 4/4, fuentes, «Volver a empezar» | ✅ |
| `qr.html`: QR automático; decodificado con jsQR | ✅ `https://mimoso09.github.io/pagoar-sistemas-pago-virtual/` (versión 7, nivel H) |
| `target-card.html` normal y `?modo=proyeccion` | ✅ sin deformación (proporción 372:674 fija) |
| Sintaxis JS (`node --check`) y rutas relativas existentes | ✅ 0 faltantes |

## 4. Pruebas en producción (GitHub Pages)

Sitio: https://mimoso09.github.io/pagoar-sistemas-pago-virtual/ — desplegado con GitHub Actions
(workflow «Deploy static site to GitHub Pages», conclusión: success).

| Prueba | Resultado |
|---|---|
| `/`, `index.html`, `demo.html`, `target-card.html`, `qr.html` | ✅ HTTP 200, `text/html` |
| CSS, JS propios, A-Frame, MindAR, qrcodejs (todos en el mismo dominio) | ✅ HTTP 200 |
| `assets/targets/tarjeta-ar.mind` y `tarjeta-ar.png` | ✅ HTTP 200; SHA-256 idéntico al del repositorio |
| HTTPS | ✅ `http://` responde 301 → `https://`; la página corre en contexto seguro (`isSecureContext = true`) |
| Rutas relativas bajo `/pagoar-sistemas-pago-virtual/` | ✅ todos los recursos cargan desde esa ruta |
| Flujo AR publicado (cámara simulada) | ✅ `arReady` 1.2 s; tarjeta detectada a los 3.4 s |
| Perder/recuperar la tarjeta en producción | ✅ aviso a los ~0.2 s (el primero ~3.2 s); redetección 0.15–1.2 s; nada se reinicia |
| Misión completa en producción | ✅ «¡MISIÓN COMPLETADA! Resultado: 3 / 4» (con un error intencional) |
| Pasar de la AR a `demo.html` en la misma pestaña | ✅ conserva el progreso; recorrido 4/4 y «Volver a empezar» |
| QR de `qr.html` publicado, decodificado con jsQR | ✅ `https://mimoso09.github.io/pagoar-sistemas-pago-virtual/` (versión 7, nivel H) |
| QR de respaldo `assets/qr-pagoar.png` publicado | ✅ misma URL |
| QR del modo proyección de `target-card.html` | ✅ misma URL |
| `target-card.html?modo=proyeccion` (1024×768) | ✅ proporción mostrada 0.5519 = real 0.5519; cabe completa en pantalla |
| Desbordamiento horizontal a 375 px y 768 px (4 páginas) | ✅ ninguno |
| Enlaces de fuentes (Banxico ×3, MindAR) | ✅ HTTP 200 |

## 5. Limitaciones (no comprobadas)

- **Cámara física real** en iPhone/Android: no se pudo probar desde este entorno. Hay que hacer el ensayo del
  apartado «Antes de empezar» de la guía del expositor.
- Detección con **iluminación, proyector y distancia reales** del salón (solo se simularon).
- Rendimiento en teléfonos de gama baja (MindAR usa WebGL/TensorFlow.js).
- Navegadores dentro de apps (WhatsApp/Instagram): la app avisa y sugiere abrir en el navegador, pero no se probó.
- Impresión física: el CSS fija 168 mm de alto para la tarjeta en carta/A4; no se imprimió una hoja real.
