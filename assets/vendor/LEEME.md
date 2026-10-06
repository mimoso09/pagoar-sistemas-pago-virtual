# Librerías incluidas (vendor)

Se sirven desde el mismo sitio para no depender de CDNs externos durante la exposición.
`assets/js/ar.js` usa estas copias y, solo si fallan, intenta el CDN oficial equivalente.

| Archivo | Versión | Origen | Licencia | SHA-256 |
|---|---|---|---|---|
| `aframe-1.5.0.min.js` | A-Frame 1.5.0 | https://aframe.io/releases/1.5.0/aframe.min.js | MIT | `4fe911ce356f034b05da1a00d3a205ec19c8cf9de0ea17592cc6481b2cb98afb` |
| `mindar-image-aframe-1.2.5.prod.js` | MindAR 1.2.5 (incluye TensorFlow.js, Apache-2.0) | https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js | MIT | `42764d6f1b39387f5786b9c4cfbe50883e13ca3f47b42bf1e54e84510b374013` |
| `qrcode-1.0.0.min.js` | qrcodejs 1.0.0 | https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js | MIT | `c541ef06327885a8415bca8df6071e14189b4855336def4f36db54bde8484f36` |

Los hashes de A-Frame y MindAR coinciden byte a byte con los archivos del CDN (verificado el 2026-10-06).

La imagen `assets/targets/tarjeta-ar.png` es el target de ejemplo `card.png` distribuido con MindAR
(repositorio hiukim/mind-ar-js, licencia MIT).
