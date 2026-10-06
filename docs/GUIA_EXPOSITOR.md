# Guía rápida para el expositor

## El día de la exposición (versión corta)

1. **Pantalla 1:** abre `qr.html` (el QR ya aparece solo) o usa el QR en tu diapositiva.
2. **Tarjeta AR:** imprime `target-card.html` (varias copias) y/o proyéctala con **⛶ Modo proyección**
   (`target-card.html?modo=proyeccion` muestra la tarjeta grande con el QR al lado).
3. Di: *«Escaneen el QR, toquen “Iniciar experiencia AR”, permitan la cámara y apunten a la tarjeta.»*
4. Quien tenga problemas toca **«Usar versión sin AR»** (o el enlace «¿Problemas con la cámara?»).

URL: https://mimoso09.github.io/pagoar-sistemas-pago-virtual/

## Antes de empezar (10 minutos antes)

- Abre la URL en **tu propio teléfono** con los datos móviles y con el Wi‑Fi del salón.
- Prueba con al menos **un iPhone (Safari) y un Android (Chrome)**.
- **Imprime 4–6 copias** de la tarjeta y repártelas entre filas: es más fiable que una sola proyección lejana.
- Si proyectas la tarjeta: sube el brillo del proyector, apaga luces que reflejen sobre la pantalla y deja la
  tarjeta en pantalla completa.
- Ten abierta `demo.html` en tu computadora por si quieres mostrar el recorrido a todos.

## Consejos para el público

- Mostrar la **tarjeta completa** en la pantalla del teléfono, a unos **30–60 cm** de una hoja impresa
  (o más cerca de la pantalla si está proyectada). Si está demasiado cerca y se corta, tarda más en detectarse.
- Buena luz, sin reflejos; la hoja plana, sin doblar.
- Si la tarjeta sale de cuadro, **no se pierde nada**: el panel de la misión sigue en pantalla.
- iPhone: abrir con **Safari**. Android: **Chrome**. Si el QR abre dentro de otra app (WhatsApp, Instagram),
  usar «Abrir en el navegador».

## Introducción sugerida (20–30 s)

> «Vamos a ver qué hay detrás de un pago virtual. Escaneen el QR, permitan la cámara y apunten a esta tarjeta.
> La misión tiene cuatro etapas, una por cada apartado del tema, y cada una termina con una pregunta.»

## Etapas

1. **3.1 Definición y estructura** — instrumentos, procedimientos y sistemas interbancarios de transferencia
   de fondos que aseguran la circulación del dinero (definición de Banco de México).
2. **3.2 Estructuras de gestión** — quién opera, quiénes participan y con qué reglas; no todos los sistemas
   tienen la misma arquitectura (SPEI® ≠ pagos con tarjeta). Banxico: regulador, supervisor, desarrollador y operador.
3. **3.3 Finalidad** — asegurar la circulación del dinero; pagos seguros, inmediatos, eficientes y a bajo costo.
4. **3.4 Operatividad** — ejemplo SPEI®: orden del cliente → institución emisora → Banco de México valida y
   envía → institución receptora abona; el beneficiario puede consultar el CEP.

## Cierre sugerido

> «Una tarjeta o una app no son por sí solas el sistema de pago. Detrás hay instrumentos, reglas,
> participantes e infraestructura que permiten que el dinero llegue de quien paga a quien cobra.
> Y esa arquitectura cambia según el sistema.»

## Plan B

| Problema | Qué hacer |
|---|---|
| Alguien niega la cámara o su navegador no la soporta | La app lo explica y ofrece **«Abrir versión sin AR»** |
| No detecta la tarjeta tras ~20 s | Aparece una ayuda con consejos y el botón de la versión sin AR |
| Falla el Internet del salón | Pedir que usen datos móviles; o mostrar `demo.html` proyectado |
| La cámara se detiene al cambiar de app | Botón **«Reanudar cámara»**; el progreso se conserva |

La versión sin AR (`demo.html`) tiene **las mismas 4 etapas, preguntas, retroalimentación y resultado**.
