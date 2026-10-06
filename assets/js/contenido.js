/*
 * PAGOAR — Contenido académico compartido por index.html (AR) y demo.html (sin AR).
 * Todas las afirmaciones se apoyan en las fuentes de Banco de México listadas al final.
 * Es un MODELO CONCEPTUAL: la arquitectura real cambia según el sistema de pago.
 */
window.PAGOAR_CONTENIDO = {
  aviso: 'Modelo conceptual con fines educativos. Los participantes y los pasos concretos cambian según el sistema de pago (no es lo mismo una transferencia SPEI® que un pago con tarjeta).',

  etapas: [
    {
      clave: '3.1',
      nombre: 'Definición y estructura',
      titulo: '¿Qué es un sistema de pago?',
      texto: 'Banco de México lo define como un «conjunto de instrumentos, procedimientos bancarios y, por lo general, sistemas interbancarios de transferencia de fondos que aseguran la circulación del dinero».',
      puntos: [
        ['Instrumentos', 'con qué se paga: transferencias, tarjetas, cheques, domiciliación.'],
        ['Procedimientos y reglas', 'cómo se emite, autoriza y procesa cada orden de pago.'],
        ['Infraestructura', 'sistemas que transfieren, compensan y liquidan fondos entre instituciones.']
      ],
      pregunta: 'Según Banco de México, ¿qué forma un sistema de pago?',
      opciones: [
        'Solo la aplicación del banco con la que pagas',
        'Instrumentos, procedimientos y, por lo general, sistemas interbancarios de transferencia de fondos',
        'Únicamente las tarjetas y las terminales de los comercios'
      ],
      correcta: 1,
      explicacion: 'Una app o una tarjeta son solo la parte visible (el instrumento o el canal). Detrás hay procedimientos, reglas e infraestructura que hacen circular el dinero.',
      // Holograma: un pago recorre la cadena. En amarillo, los tres componentes de la definición de Banxico.
      holo: {
        tipo: 'flujo',
        titulo: 'DEFINICIÓN Y ESTRUCTURA',
        chip: 'MODELO CONCEPTUAL',
        nodos: [
          { icono: 'usuario', t: 'USUARIO', s: 'inicia el pago' },
          { icono: 'comercio', t: 'COMERCIO', s: 'recibe el pago' },
          { icono: 'tarjeta', t: 'MEDIO DE PAGO', s: 'instrumento', clave: true },
          { icono: 'banco', t: 'INSTITUCIÓN', s: 'procedimientos y reglas', clave: true },
          { icono: 'servidores', t: 'INFRAESTRUCTURA', s: 'sistemas interbancarios', clave: true },
          { icono: 'check', t: 'CONFIRMACIÓN', s: 'el pago se completa' }
        ],
        aprobado: 'TRANSACCIÓN APROBADA'
      }
    },
    {
      clave: '3.2',
      nombre: 'Estructuras de gestión',
      titulo: '¿Quién gestiona un sistema de pago?',
      texto: 'Cada sistema define quién lo opera, quiénes participan y con qué reglas. Según Banco de México, el sistema abarca a la entidad que gestiona la compensación y la liquidación y también a los participantes que dan servicio a sus clientes.',
      puntos: [
        ['Banco de México', 'regulador, supervisor, desarrollador y operador (por ejemplo, opera el SPEI®).'],
        ['SPEI®', 'participan instituciones financieras reguladas que envían y reciben transferencias.'],
        ['Pagos con tarjeta', 'intervienen emisores, adquirentes, agregadores, titulares de marca y cámaras de compensación.']
      ],
      pregunta: '¿Qué afirmación sobre la gestión de los sistemas de pago es correcta?',
      opciones: [
        'Todos los sistemas de pago tienen exactamente los mismos participantes y el mismo proceso',
        'La estructura cambia según el sistema: cada uno define quién lo opera, quiénes participan y con qué reglas',
        'Cada comercio fija sus propias reglas y liquida los pagos por su cuenta'
      ],
      correcta: 1,
      explicacion: 'No hay un modelo único: una transferencia SPEI® y un pago con tarjeta tienen participantes y reglas distintos. En México, Banco de México regula y supervisa los sistemas de pago y opera algunos, como el SPEI®.',
      // Holograma: la misma red cambia de operador y participantes según el sistema (SPEI® ↔ tarjetas).
      holo: {
        tipo: 'red',
        titulo: 'ESTRUCTURAS DE GESTIÓN',
        anillo: 'REGLAS DEL SISTEMA',
        pie: 'La estructura cambia según el sistema',
        modelos: [
          {
            chip: 'MODELO: SPEI®',
            centro: { icono: 'banco', t: 'BANCO DE MÉXICO', s: 'opera el SPEI®', oro: true },
            nodos: [
              { icono: 'banco', t: 'EMISORA', s: 'institución que envía' },
              { icono: 'banco', t: 'RECEPTORA', s: 'institución que abona' },
              { icono: 'banco', t: 'BANCOS', s: 'participantes' },
              { icono: 'edificio', t: 'IFNB', s: 'no bancarias' }
            ],
            rutas: [[0, 1], [2, 3], [3, 0], [1, 2]]
          },
          {
            chip: 'MODELO: PAGO CON TARJETA',
            centro: { icono: 'red', t: 'CÁMARA DE COMPENSACIÓN', s: 'procesa y compensa' },
            nodos: [
              { icono: 'tarjeta', t: 'EMISOR', s: 'emite la tarjeta' },
              { icono: 'terminal', t: 'ADQUIRENTE', s: 'acepta pagos con tarjeta' },
              { icono: 'escudo', t: 'TITULAR DE MARCA', s: 'garantiza la liquidación' },
              { icono: 'capas', t: 'AGREGADOR', s: 'intermedia la aceptación' }
            ],
            rutas: [[1, 0], [0, 1], [3, 0], [1, 0]]
          }
        ]
      }
    },
    {
      clave: '3.3',
      nombre: 'Finalidad de los sistemas',
      titulo: '¿Para qué existen los sistemas de pago?',
      texto: 'Su finalidad central es asegurar la circulación del dinero: por ellos se procesa la mayor parte de las transacciones de empresas, gobierno y hogares. La Ley del Banco de México le encomienda propiciar su buen funcionamiento.',
      puntos: [
        ['Circulación', 'que los fondos lleguen de quien paga a quien cobra.'],
        ['Seguridad y eficiencia', 'la visión de Banxico: pagos electrónicos seguros, inmediatos, eficientes y a bajo costo.'],
        ['Estabilidad', 'su buen funcionamiento contribuye a la estabilidad de los mercados financieros.']
      ],
      pregunta: '¿Cuál es la finalidad principal de un sistema de pago?',
      opciones: [
        'Asegurar que el dinero circule: transferir y liquidar pagos de forma segura y eficiente',
        'Crear dinero nuevo cada vez que alguien paga',
        'Sustituir a los bancos y a las demás instituciones financieras'
      ],
      correcta: 0,
      explicacion: 'Un sistema de pago no crea dinero: permite que los fondos pasen de quien paga a quien cobra, con reglas que buscan seguridad y eficiencia.',
      // Holograma: el dinero circula entre hogares, empresas y gobierno.
      holo: {
        tipo: 'circulacion',
        titulo: 'FINALIDAD',
        centro: 'CIRCULACIÓN DEL DINERO',
        nodos: [
          { icono: 'hogar', t: 'HOGARES' },
          { icono: 'edificio', t: 'EMPRESAS' },
          { icono: 'gobierno', t: 'GOBIERNO' }
        ],
        chips: ['SEGURIDAD', 'EFICIENCIA', 'ESTABILIDAD'],
        pie: 'Mover fondos de forma ordenada y confiable'
      }
    },
    {
      clave: '3.4',
      nombre: 'Operatividad',
      titulo: '¿Cómo opera una transferencia SPEI®?',
      texto: 'Una transferencia electrónica requiere indicar el monto y la cuenta que recibirá los recursos, y autorizar el movimiento mediante identificación y autenticación. En el SPEI®, Banco de México describe este recorrido:',
      puntos: [
        ['1 · Orden', 'la persona solicita la transferencia en su institución (app, portal o sucursal).'],
        ['2 · Validación', 'la institución emisora la verifica y tramita; Banco de México la valida y la envía.'],
        ['3 · Abono', 'la institución receptora acredita los recursos; el beneficiario puede consultar el CEP (Comprobante Electrónico de Pago).']
      ],
      pregunta: 'En una transferencia SPEI®, ¿cuál es el orden correcto?',
      opciones: [
        'Institución receptora → cliente → Banco de México → institución emisora',
        'Cliente → institución emisora → Banco de México → institución receptora',
        'Cliente → comercio → terminal de tarjetas → Banco de México'
      ],
      correcta: 1,
      explicacion: 'La orden sale del cliente, su institución la tramita, Banco de México la valida y la envía, y la institución receptora abona los recursos. El SPEI® opera 24/7 y liquida en tiempo real. Otros sistemas, como las tarjetas, siguen pasos distintos.',
      // Holograma: secuencia de una transferencia SPEI® (ejemplo; otros sistemas siguen pasos distintos).
      holo: {
        tipo: 'secuencia',
        titulo: 'OPERATIVIDAD · SPEI®',
        chip: 'EJEMPLO: TRANSFERENCIA SPEI®',
        nodos: [
          { icono: 'documento', t: 'INSTRUCCIÓN', s: 'el cliente ordena en su institución', estado: 'ENVIANDO INSTRUCCIÓN…' },
          { icono: 'banco', t: 'VALIDACIÓN', s: 'Banco de México valida y envía', estado: 'VALIDANDO EN SPEI®…', espera: 1.1 },
          { icono: 'flechas', t: 'TRANSFERENCIA', s: 'la institución receptora abona', estado: 'ABONANDO LOS RECURSOS…' },
          { icono: 'check', t: 'CONFIRMACIÓN', s: 'CEP: comprobante del pago' }
        ],
        aprobado: 'TRANSFERENCIA ACREDITADA',
        aprobadoSub: 'CEP DISPONIBLE · 24/7'
      }
    }
  ],

  cierre: 'Una app o una tarjeta no son, por sí solas, el sistema de pago: detrás hay instrumentos, reglas, participantes e infraestructura. Y esa arquitectura cambia según el sistema.',

  fuentes: [
    {
      titulo: 'Banco de México — Introducción a los sistemas de pago',
      url: 'https://www.banxico.org.mx/sistemas-de-pago/introduccion-sistemas-pago-tr.html',
      uso: 'Definición de sistema de pagos; instrumentos; papel de Banco de México.'
    },
    {
      titulo: 'Banco de México — SPEI®: información general',
      url: 'https://www.banxico.org.mx/servicios/spei_-informacion-banco-mex.html',
      uso: 'Qué es el SPEI®, participantes y pasos de una transferencia; CEP; operación 24/7.'
    },
    {
      titulo: 'Banco de México — Informe Anual sobre las Infraestructuras de los Mercados Financieros 2022 (PDF)',
      url: 'https://www.banxico.org.mx/publicaciones-y-prensa/informe-anual-sobre-las-infraestructuras-de-los-me/%7BE90A6B02-CBDC-343B-93ED-0ABD8A05B60B%7D.pdf',
      uso: 'Funciones de Banxico (regulador, supervisor, desarrollador, operador); transferencias; participantes de pagos con tarjeta.'
    },
    {
      titulo: 'MindAR — documentación oficial (tecnología AR usada)',
      url: 'https://hiukim.github.io/mind-ar-js-doc/',
      uso: 'Biblioteca de seguimiento de imágenes en el navegador.'
    }
  ]
};
