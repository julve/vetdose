# VetDose 1.0

Calculadora matemática para uso veterinario en caninos y felinos. **No contiene, propone ni descarga dosis farmacológicas.** El profesional introduce cada pauta, concentración, frecuencia y parámetro. Un cálculo correcto no determina que una administración sea clínicamente adecuada.

La aplicación funciona sin cuentas, suscripciones, CDN, fuentes remotas, telemetría, almacenamiento en la nube ni servicios externos. Todos los datos de biblioteca se mantienen en el navegador. El identificador de paciente solo permanece en memoria durante la sesión; no forma parte de los respaldos. El botón de impresión permite incluirlo expresamente en el resultado impreso.

## Empezar sin instalar herramientas

Copie **`dist/VetDose.html`** a su computadora y ábralo con un navegador que permita ejecutar HTML local. Este único archivo incluye estilos y JavaScript; no necesita los archivos fuente, Node.js ni conexión a Internet para calcular.

El acceso a archivos locales puede estar restringido por el navegador, el sistema operativo o políticas administrativas. La apertura `file://` no garantiza almacenamiento persistente, ni una experiencia equivalente en iOS. En este entorno de desarrollo esa navegación está bloqueada por la política administrativa de Chromium y no pudo validarse. Se validó el mismo HTML servido por HTTP local y su cálculo después de desconectar la red.

**Exporte su biblioteca JSON antes de cerrar**, especialmente si trabaja con el HTML portable, navegación privada o un teléfono. El archivo HTML no incorpora automáticamente su biblioteca: transfiera también un respaldo JSON.

## Alternativa fiable para ejecutar y desarrollar

Requiere Node.js 20 o posterior, en Windows, macOS o Linux. Desde la carpeta del proyecto:

```sh
npm start
```

El servidor muestra su dirección y puerto: abra en su navegador la dirección `127.0.0.1`, puerto `4173`, usando HTTP. Es un servidor estático de su propia computadora, sin base de datos ni API. La biblioteca sigue guardándose exclusivamente en el navegador. No hace falta `npm install` para iniciar, construir o ejecutar las pruebas unitarias; esas operaciones usan módulos integrados de Node.js.

Para acceder desde un teléfono en la misma red local, inicie el servidor con la interfaz de red habilitada:

```sh
# macOS / Linux
HOST=0.0.0.0 npm start
```

```powershell
# PowerShell en Windows
$env:HOST = '0.0.0.0'
npm start
```

En Safari o Chrome del teléfono abra la dirección IP local de la computadora, puerto `4173`, usando HTTP. La computadora y el servidor deben permanecer encendidos para abrir o recargar la aplicación. El acceso a Internet no es necesario, pero sí la conexión a esa red local. Puede ser necesario autorizar el puerto en el firewall. Use una red de confianza; el servidor estático no tiene autenticación. Por defecto solo escucha en la propia computadora.

Este mecanismo evita depender de que iOS ejecute un archivo HTML desde Archivos. No instala una aplicación nativa ni ofrece una PWA con recarga offline. Cambiar IP, puerto, protocolo, navegador o perfil cambia el origen del almacenamiento: exporte e importe su JSON para trasladar datos. Los pasos para Windows, macOS y teléfonos son instrucciones de uso; las pruebas ejecutadas aquí fueron en Linux y Chromium.

## Uso de la calculadora

1. Seleccione canino o felino e introduzca un peso positivo en kg. El identificador es opcional.
2. Seleccione un medicamento de su biblioteca o utilice entrada manual. Identifique un único principio activo.
3. Escriba la dosis y su unidad, vía y frecuencia. Una dosis por día requiere intervalo en horas. Duración es opcional.
4. Seleccione la presentación e introduzca su contenido y unidad. Para líquidos introduzca también el volumen de referencia: por ejemplo, el denominador 5 de una concentración expresada por 5 mL. No se presupone 1 mL.
5. Pulse **Calcular cantidad** y revise la cantidad, el procedimiento, los datos y las advertencias.

Se aceptan decimales con punto o coma, sin separadores de miles. Las ocho unidades disponibles son mg/kg/dosis, mg/kg/día, µg/kg/dosis, µg/kg/día, mg/dosis, µg/dosis, UI/kg/dosis y UI/dosis. Cero es una dosis numéricamente válida y explícita; no se interpreta como campo vacío. No implica una indicación clínica.

Los cambios de la calculadora son temporales. Cambiar cualquier entrada invalida el resultado anterior. Para conservar una modificación, edite expresamente el medicamento en Biblioteca.

Una pauta registrada para otra especie se deshabilita y el motor bloquea su cálculo si estaba seleccionada al cambiar de especie. Cuando una pauta incluye mínimos y máximos, la dosis queda vacía al cargarla: debe elegir expresamente un valor dentro del intervalo. Para trabajar con otra unidad o fuera del intervalo debe seleccionar **Pauta manual**.

## Presentaciones y límites dimensionales

| Presentación | Datos requeridos | Resultado matemático |
| --- | --- | --- |
| Tableta | mg o µg por unidad | Tabletas decimales y fracción equivalente si es representable |
| Cápsula | mg o µg por unidad | Cápsulas; no presupone apertura o división |
| Solución / suspensión | mg o µg por volumen definido en mL | mL |
| Inyectable | mg, µg o UI por volumen definido en mL | mL |
| Vial reconstituido | Contenido total y volumen **final** en mL | mL; diluyente añadido es un dato informativo separado |
| Polvo / granulado | mg o µg por 1 g | g |
| Sobre | mg o µg por sobre | Sobres; sin asumir fraccionamiento |
| Porcentaje p/v | g de activo por 100 mL | mg/mL; cantidad en mL |
| Porcentaje p/p | g de activo por 100 g | mg/g; cantidad en g |
| Porcentaje v/v | mL de activo por 100 mL | Solo contenido en volumen medido; bloquea dosis de masa |
| Gotas | mg o µg por volumen definido en mL | mL y opcionalmente gotas con factor explícito del producto/dispositivo |
| Crema / ungüento | mg o µg por 1 g y cantidad medida | Solo contenido de activo; no dosis sistémica |

Para un tópico porcentual elija **Preparación porcentual** y **Contenido en cantidad medida**. No convierta el contenido obtenido en una pauta sistémica.

Las fracciones ½, ¼, ⅛ y ⅓ se pueden registrar como autorizadas en una tableta. Una coincidencia matemática no valida divisibilidad física, estabilidad ni idoneidad clínica. Las equivalencias fraccionarias son informativas; no se ajusta la dosis ni se redondea a unidades administrables. Tampoco se redondean gotas.

No se implementa conversión UI↔masa, incluso si se dispone de un factor: se conserva esa separación en la versión 1.0. No se inventan densidades para v/v. Aerosoles, parches, formulaciones especiales, liberación modificada y combinaciones de principios activos no se calculan. No existen ajustes renales o hepáticos, límites terapéuticos, toxicidad, CRI, fluidoterapia ni recomendaciones clínicas.

## Fórmulas y precisión

La representación interna de masa usa mg: 1 mg = 1000 µg. UI y volumen tienen dimensiones separadas.

```text
Activo por administración (por dosis) = dosis × peso, si la unidad es /kg
Administraciones por día = 24 / intervalo en horas
Activo por administración (dosis diaria) = activo diario / administraciones por día
Cantidad de presentación = activo por administración / concentración normalizada
Contenido medido = cantidad de preparación × concentración normalizada
```

La duración supone una administración inicial en t=0 y excluye el instante final del tratamiento. Número de administraciones = techo(días × 24 / intervalo en horas). Total de presentación = cantidad por administración × número de administraciones. Por ejemplo, un tratamiento matemático de 24 horas cada 10 horas contiene administraciones a las horas 0, 10 y 20. El profesional debe confirmar que esta convención corresponde al calendario deseado.

La cantidad diaria en intervalos mayores de 24 horas es un **promedio**; se advierte que no implica administrar a diario. Sin frecuencia no se calcula cantidad diaria ni total. Sin duración no se calcula el total.

Se usa aritmética IEEE-754 de JavaScript, con hasta 12 cifras significativas en la pantalla. No es aritmética decimal exacta. Se bloquean NaN, Infinity, entradas inválidas, divisiones por cero, desbordamientos detectados, subdesbordamientos detectados y conteos de administraciones fuera de los enteros seguros. No se redondean resultados no nulos a cero. Las diferencias flotantes en límites enteros del calendario se tratan con una tolerancia relativa de unas pocas unidades de precisión de máquina. Revise siempre unidades y capacidad real de medición.

## Biblioteca, respaldo y recuperación

La biblioteca está vacía al comenzar. Cada medicamento tiene identidad, principio activo, observaciones, precauciones, referencia y fecha de revisión. Sus pautas y presentaciones son registros separados con identificadores únicos. Puede agregar varias de cada una sin duplicar el medicamento.

- **Crear / editar:** Biblioteca → Nuevo medicamento o Editar → agregar pautas y presentaciones → Guardar medicamento.
- **Duplicar:** crea una copia editable con nuevos identificadores; todavía debe guardarla.
- **Eliminar:** requiere confirmación y elimina las asociaciones del medicamento.
- **Buscar / filtrar:** búsqueda por nombre o activo; filtro de especie según pautas registradas.
- **Exportar:** Configuración → Exportar biblioteca JSON. Compruebe que el archivo se haya descargado y guárdelo fuera del navegador.
- **Recuperar o trasladar:** Configuración → elegir JSON → Fusionar o Reemplazar → Validar e importar.

Los respaldos usan `schemaVersion: 1` y contienen `drugs`, con listas `regimens` y `presentations` anidadas. Se comprueban identificadores globalmente únicos, nombres, fechas, unidades, números, frecuencias, intervalos posológicos y estructuras completas. El límite de importación es 5 MB. Los datos adicionales no reconocidos se descartan; no se ejecuta contenido del archivo y todo texto se representa escapado en la interfaz.

**Fusionar** omite registros idénticos con el mismo identificador. Si ese identificador tiene cambios o hay un posible duplicado por nombre y activo, se bloquea toda la fusión: revise las copias o, con un respaldo previo, elija reemplazo. No existe fusión automática de cambios dentro de un medicamento. **Reemplazar** exige confirmación y sustituye la biblioteca completa; exporte antes una copia. Un archivo inválido no modifica los datos actuales.

Se utiliza `localStorage`: las escrituras individuales son síncronas y se comprueba el esquema antes de guardarlo. Si falla una escritura, se conservan la biblioteca anterior y el editor. Si el almacenamiento está denegado desde el inicio, se usa memoria con aviso y puede exportar la biblioteca. Los datos locales corruptos no se sobreescriben automáticamente: Configuración permite descargar su contenido original para recuperación y realizar un reemplazo explícito con un respaldo válido.

Use una sola pestaña para editar. Se detectan cambios externos mediante eventos de almacenamiento y comparación con la copia cargada; una pestaña con datos anteriores bloquea sus escrituras. Esto no constituye una base de datos transaccional entre pestañas. No se implementa sincronización, cifrado, protección de acceso al dispositivo, ni retención garantizada por el navegador. Las bibliotecas grandes pueden superar su cuota aunque el archivo sea válido. Mantenga respaldos fuera del dispositivo.

## Estructura y desarrollo

```text
index.html             Entrada de desarrollo
src/core.js            Unidades, normalización, cálculos y advertencias
src/library.js         Esquema, validación, persistencia y respaldos
src/app.js             Interfaz y estado temporal, sin cálculos duplicados
src/styles.css         Diseño responsive, claro, oscuro e impresión
scripts/build.js       Empaquetado determinista sin dependencias
scripts/serve.js       Servidor HTTP estático local
tests/                 Casos matemáticos, biblioteca y flujos de navegador
dist/VetDose.html      Distribución autocontenida generada
docs/VALIDACION.md      Evidencia y límites de las pruebas ejecutadas
```

```sh
npm test
npm run build
```

Para las pruebas de interfaz instale la única dependencia de desarrollo, fijada en el lockfile:

```sh
npm ci --cache /workspace/.cache/npm
npm run test:ui
```

La ruta de caché anterior corresponde al entorno cloud; en otra computadora puede usar simplemente `npm ci`. Playwright Core **no** descarga un navegador: requiere Chromium ya instalado. Por defecto se busca `/usr/bin/chromium`. Defina `BROWSER_PATH` con la ruta del ejecutable en otra plataforma. El runner inicia y detiene su propio servidor en el puerto 4174 y escribe capturas y reporte JSON en `test-results/`, carpeta ignorada por Git.

El runner usa `--no-sandbox` para Chromium en este contenedor de pruebas aislado. Si su sistema permite el sandbox normal, ejecute con `BROWSER_SANDBOX=1`. Esta opción solo corresponde al navegador de pruebas y no altera la aplicación, TLS ni la validación de paquetes.

No hay dependencias de terceros en el producto distribuido. El empaquetador incorpora únicamente los tres módulos y los estilos locales; los datos de pruebas no se incluyen. Después de modificar fuentes, regenere el archivo portable con `npm run build` y repita los controles correspondientes.
