# PAGOAR — Misión AR · Sistemas de Pago Virtual

Actividad interactiva de **realidad aumentada en el navegador** para una exposición universitaria sobre
**III. Los sistemas de pago virtual**. Los asistentes escanean un QR, abren una página web (sin instalar
nada), apuntan la cámara a una tarjeta AR y completan una misión de 4 etapas con preguntas,
retroalimentación inmediata y puntuación final.

| | Enlace |
|---|---|
| 🌐 Experiencia AR | https://mimoso09.github.io/pagoar-sistemas-pago-virtual/ |
| 🧩 Versión sin AR (Plan B) | https://mimoso09.github.io/pagoar-sistemas-pago-virtual/demo.html |
| 🎯 Tarjeta AR (imprimir / proyectar) | https://mimoso09.github.io/pagoar-sistemas-pago-virtual/target-card.html |
| 🔳 QR para proyectar | https://mimoso09.github.io/pagoar-sistemas-pago-virtual/qr.html |

## Contenido de la misión

| Etapa | Apartado | Pregunta |
|---|---|---|
| 1 | 3.1 Definición y estructura | ¿Qué forma un sistema de pago según Banco de México? |
| 2 | 3.2 Estructuras de gestión | ¿Todos los sistemas tienen los mismos participantes? |
| 3 | 3.3 Finalidad de los sistemas | ¿Cuál es su finalidad principal? |
| 4 | 3.4 Operatividad | ¿En qué orden opera una transferencia SPEI®? |

Al final se muestra **🏆 MISIÓN COMPLETADA**, el resultado **X / 4 respuestas correctas**, un resumen por
etapa y el botón **Volver a empezar**. La actividad presenta un **modelo conceptual**: los participantes y los
pasos concretos cambian según el sistema de pago. El contenido se apoya en fuentes de Banco de México
(ver sección *Fuentes* dentro de la experiencia y `assets/js/contenido.js`).

## Cómo funciona

```
QR → index.html → [Iniciar experiencia AR] → permiso de cámara → MindAR reconoce la tarjeta
   → holograma sobre la tarjeta + panel de la misión → 4 etapas → resultado
            └─ si algo falla → mensaje claro + [Abrir versión sin AR] → demo.html
```

- **Tecnología:** HTML/CSS/JavaScript, [A-Frame 1.5.0](https://aframe.io) y
  [MindAR 1.2.5](https://hiukim.github.io/mind-ar-js-doc/) (image tracking), publicado con GitHub Pages (HTTPS).
- **Sin dependencias externas en tiempo de ejecución:** A-Frame, MindAR y el generador de QR se sirven desde
  `assets/vendor/` (mismo dominio). Si la copia local fallara, la app intenta el CDN oficial automáticamente.
- **La cámara solo se enciende al tocar el botón**, nunca al cargar la página.
- **El progreso no se pierde:** si la tarjeta sale de cuadro, el panel sigue visible; si la página se recarga o
  se cambia a la versión sin AR, la misión continúa donde iba (`sessionStorage`).

## Animaciones (lenguaje visual "holograma fintech")

Cada animación explica el contenido de su etapa:

| Momento | Qué se ve |
|---|---|
| Primera detección de la tarjeta | Barrido de escaneo, puntos digitales, «ANALIZANDO SISTEMA…», «SISTEMA DE PAGO DETECTADO», logotipo PAGOAR y el panel emerge de la tarjeta (≈2.6 s, solo la primera vez o al reiniciar) |
| 3.1 Definición y estructura | Un pago recorre USUARIO → COMERCIO → MEDIO DE PAGO → INSTITUCIÓN → INFRAESTRUCTURA → CONFIRMACIÓN; en dorado, los tres componentes de la definición; termina en «TRANSACCIÓN APROBADA» |
| 3.2 Estructuras de gestión | La misma red cambia entre el modelo SPEI® (Banco de México al centro) y el de pago con tarjeta (cámara de compensación, emisor, adquirente…), con paquetes de datos viajando |
| 3.3 Finalidad | Monedas circulando entre hogares, empresas y gobierno; se iluminan seguridad, eficiencia y estabilidad |
| 3.4 Operatividad | Secuencia SPEI®: «ENVIANDO INSTRUCCIÓN…» → «VALIDANDO EN SPEI®…» → «ABONANDO LOS RECURSOS…» → «TRANSFERENCIA ACREDITADA» |
| Respuestas | Correcta: pulso, palomita que se dibuja y destello verde; incorrecta: pequeño empujón horizontal, X y destello rojo |
| Cambio de etapa | Salida/entrada con fundido y progreso ①──②──③──④ que se llena |
| Cierre | 01–04 se encienden, convergen al centro, sello ✓, «MISIÓN COMPLETADA» y marcador X / 4 |

**Técnica:** `assets/js/holo.js` contiene un único modelo de movimiento que usan dos dibujadores: planos de
A-Frame a distintas profundidades (parallax real sobre la tarjeta) y un canvas 2D para `demo.html`.
Textos e íconos se pintan una sola vez como texturas; en cada fotograma solo cambian posiciones, escalas y
opacidades. Máximo 27 partículas simultáneas; sin shaders, modelos 3D ni post-procesado. Con
`prefers-reduced-motion` se omiten intro, partículas y movimientos continuos.

## Estructura

```
/index.html             Experiencia AR (pantalla inicial, cámara, holograma y misión)
/demo.html              Versión sin AR: mismas 4 etapas, preguntas, retroalimentación y resultado
/target-card.html       Tarjeta AR: imprimir (carta/A4), pantalla/iPad o modo proyección (?modo=proyeccion)
/qr.html                QR de la URL publicada, generado automáticamente (corrección de errores H)
/assets/js/contenido.js Textos académicos, preguntas y fuentes (único lugar para editar contenido)
/assets/js/mision.js    Motor de la misión (compartido por AR y demo)
/assets/js/holo.js      Hologramas animados: modelo de movimiento + arte vectorial + dibujador 2D
/assets/js/ar.js        Arranque de cámara, MindAR/A-Frame y manejo de errores
/assets/js/config.js    URL pública usada por el QR
/assets/targets/        tarjeta-ar.png + tarjeta-ar.mind (target compilado de esa misma imagen)
/assets/vendor/         A-Frame, MindAR y qrcodejs (ver LEEME.md: versiones, licencias y hashes)
/docs/                  Guía del expositor y reporte de pruebas
/.github/workflows/     Publicación automática en GitHub Pages
```

## Sobre la tarjeta AR (target)

`assets/targets/tarjeta-ar.mind` se compiló con el compilador de MindAR 1.2.5 a partir de
`assets/targets/tarjeta-ar.png`, que es **exactamente** la imagen que muestra `target-card.html`
(la imagen de ejemplo distribuida con MindAR, en orientación vertical).

También se evaluó `assets/payment-target-custom.png` (diseño temático). Se compiló y se detecta, pero obtuvo
muy pocos puntos de seguimiento (0–10 frente a 8–25 de la tarjeta elegida), lo que haría parpadear el
holograma. Por confiabilidad **no se usa**; el detalle está en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).

## Probar en local

```bash
python -m http.server 8080
```

Abre `http://localhost:8080/` (la cámara funciona en `localhost` o en HTTPS). La versión sin AR se puede revisar
en `http://localhost:8080/demo.html`.

## Publicación

Cada `push` a `main` ejecuta `.github/workflows/pages.yml` y publica la raíz del repositorio en GitHub Pages
(Settings › Pages › Source: **GitHub Actions**). Si cambias de usuario o de nombre de repositorio, actualiza
`assets/js/config.js` para que el QR apunte a la nueva URL.

## Uso en la exposición

Ver [`docs/GUIA_EXPOSITOR.md`](docs/GUIA_EXPOSITOR.md).

## Fuentes

- Banco de México — Introducción a los sistemas de pago: https://www.banxico.org.mx/sistemas-de-pago/introduccion-sistemas-pago-tr.html
- Banco de México — SPEI®: https://www.banxico.org.mx/servicios/spei_-informacion-banco-mex.html
- Banco de México — Informe Anual sobre las Infraestructuras de los Mercados Financieros 2022: https://www.banxico.org.mx/publicaciones-y-prensa/informe-anual-sobre-las-infraestructuras-de-los-me/%7BE90A6B02-CBDC-343B-93ED-0ABD8A05B60B%7D.pdf
- MindAR — documentación: https://hiukim.github.io/mind-ar-js-doc/
