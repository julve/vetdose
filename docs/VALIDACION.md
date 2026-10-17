# Validación ejecutada de VetDose 1.0

Entorno real: Linux, Node.js 24.19.0, npm 11.9.0 y Chromium 154.0.8037.57. Se usaron exclusivamente sustancias y valores matemáticos ficticios; no se incluyeron dosis terapéuticas ni bibliotecas precargadas.

## Resultados

| Comando / comprobación | Resultado |
| --- | --- |
| `npm test` | 104 pruebas aprobadas, 0 fallidas, 0 omitidas |
| `npm run build` | HTML autocontenido generado correctamente |
| `npm run test:ui` | 21 comprobaciones aprobadas y 1 omitida por política del navegador |
| HTML portable servido; luego red desactivada | Cálculo correcto; una única solicitud para el HTML, ninguna dependencia adicional |
| Interfaz de escritorio y ancho móvil de 390 px | Capturas inspeccionadas; sin desbordamiento horizontal |
| Apertura directa `file://` en Chromium | No validada: `ERR_BLOCKED_BY_ADMINISTRATOR` |

La suite matemática cubre las ocho unidades de dosificación, dosis diaria y por administración, conversiones mg↔µg, mg/mL, mg/5 mL, mg/10 mL, denominador personalizado, tabletas, cápsulas, polvos, sobres, viales, p/v, p/p, v/v, UI, gotas y contenido tópico. Compara resultados esperados definidos como constantes o ecuaciones independientes del motor. Incluye decimales con coma, frecuencias no divisoras de 24, calendario de tratamiento, valores extremos y unidades incompatibles.

La suite de biblioteca verifica escritura y lectura, fallo de cuota, datos corruptos, importación/exportación, identidades y asociaciones, esquemas, fechas, campos no reconocidos, límites de tamaño, conflictos y duplicados. Ninguna prueba clínica se infiere de estas comprobaciones matemáticas.

La suite de interfaz ejecuta creación, edición, duplicación, eliminación con confirmación, carga de biblioteca en calculadora, separación de cambios temporales, bloqueo por especie, selección explícita de dosis dentro de un intervalo, exportación descargable sin paciente, importación por fusión y reemplazo, rechazo de archivos inválidos, persistencia tras recarga, tema oscuro, modo tópico, v/v incompatible con masa, ancho móvil, ausencia de solicitudes externas y errores de JavaScript, almacenamiento denegado, recuperación de datos corruptos, texto importado sin ejecución y protección ante una copia anterior en otra pestaña.

El reporte del último recorrido y las capturas se regeneran en `test-results/`. La prueba `file://` queda registrada como omitida por la política administrativa de este entorno, sin modificar ni eludir esa política. La prueba independiente del HTML servido y desconectado sí fue ejecutada.

## No probado ni certificado

- Safari, Firefox, Edge y dispositivos físicos iOS/Android.
- Windows y macOS; se proporcionan instrucciones compatibles con Node.js, sin afirmar ejecución en esos sistemas.
- Retención indefinida del almacenamiento, navegación privada en todos los navegadores o comportamiento universal de descargas locales.
- Validación farmacológica, dosificación terapéutica, fraccionamiento físico o precisión de un dispositivo de administración.
- Restauración del entorno en una nueva tarea después de publicación.

La versión es funcional y las pruebas indicadas pasaron en este entorno. Antes de depender de ella en otro dispositivo, compruebe apertura, almacenamiento, exportación y recuperación de una biblioteca de prueba. Conserve respaldos independientes.
