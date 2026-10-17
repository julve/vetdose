// Presentation only: examples are fictional formatting aids, never default values.
export function icon(name) {
  const paths = {
    paw: '<circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="20.5" cy="12" r="1.5"/><path d="M7 20c-3-2 1-8 5-8s8 6 5 8c-2 1-3-1-5-1s-3 2-5 1Z"/>',
    scale: '<path d="M4 6h16v15H4zM8 6a4 4 0 0 1 8 0M12 11v4l3 2"/>',
    pill: '<path d="m8 16 8-8M5 19a5.7 5.7 0 0 1 0-8l6-6a5.7 5.7 0 0 1 8 8l-6 6a5.7 5.7 0 0 1-8 0Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    ruler: '<path d="M3 5h18v14H3zM7 5v5m5-5v8m5-8v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    calendar: '<path d="M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-11 4h1m4 0h1m-6 3h1"/>',
    flask: '<path d="M9 3h6m-5 0v7l-6 9a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 15h10"/>',
    drop: '<path d="M12 3C9 8 5 12 5 16a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/>',
    book: '<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    save: '<path d="M4 3h13l4 4v14H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',
    settings: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    text: '<path d="M4 5h16M12 5v15m-4 0h8"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.info}</svg>`;
}

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
export function fieldGuide(id, {calc = {}, draft = {}} = {}) {
  const guides = {
    weight: {required:true, symbol:'scale', hint:'Ej.: 4 o 4,5. Escriba el peso actual en kilogramos, mayor que cero.'},
    patient: {hint:'Ej.: Paciente de prueba. Opcional; solo permanece en esta sesión.'},
    name: {symbol:'pill', hint:'Ej.: Producto de práctica (nombre ficticio). Opcional para el cálculo.'},
    active: {required:true, symbol:'pill', hint:'Ej.: Sustancia ficticia X. Identifique un solo principio activo.'},
    indication: {symbol:'text', hint:'Ej.: Práctica de cálculo (texto ficticio). Opcional.'},
    drugId: {symbol:'book', hint:'Ej.: Entrada manual para calcular sin guardar, o un medicamento que usted registró.'},
    regimenId: {symbol:'book', hint:'Ej.: una pauta registrada para la especie del paciente, o Pauta manual.'},
    presentationId: {symbol:'flask', hint:'Ej.: una presentación guardada, o Presentación manual para introducir sus datos.'},
    mode: {required:true, symbol:'calculator', hint:'Ej.: Cálculo por dosis; para tópicos, Contenido en cantidad medida.'},
    dose: {required:true, symbol:'target', hint:`Ejemplo ficticio: 6 ${calc.doseUnit || 'mg/kg/dosis'}; escriba solo 6. Sin valor clínico.`},
    doseUnit: {required:true, symbol:'ruler', hint:'Ej.: mg/kg/dosis es por administración; mg/kg/día es el total diario. Verifique su pauta.'},
    route: {hint:'Ej.: nombre de la vía que usted haya indicado. Opcional para la cuenta matemática.'},
    intervalHours: {required:calc.mode !== 'content' && Boolean(calc.doseUnit?.endsWith('/día')), disabled:calc.mode === 'content', symbol:'clock', hint:calc.mode === 'content' ? 'No interviene en el cálculo de contenido medido; se habilita al volver a Cálculo por dosis.' : calc.doseUnit?.endsWith('/día') ? 'Ejemplo ficticio: 8 significa cada 8 horas. Obligatorio para repartir una dosis diaria.' : 'Ejemplo ficticio: 8 significa cada 8 horas, no 8 veces al día. Opcional para obtener cantidad diaria y total.'},
    durationDays: {disabled:calc.mode === 'content', symbol:'calendar', hint:calc.mode === 'content' ? 'No interviene en el cálculo de contenido medido; se habilita al volver a Cálculo por dosis.' : 'Ejemplo ficticio: 2 significa dos días. Opcional; el total requiere duración e intervalo.'},
    measuredQuantity: {required:true, symbol:'scale', hint:`Ejemplo ficticio: 3 ${calc.presentation?.type === 'percent' && calc.presentation?.percentKind !== 'pp' ? 'mL' : 'g'} de preparación medida. No es una dosis sistémica.`},
    search: {symbol:'book', hint:'Ej.: una parte del nombre o principio activo que registró.'},
    speciesFilter: {symbol:'paw', hint:'Ej.: Felino para ver medicamentos con pautas de esa especie.'},
    'ed-name': {required:true, symbol:'pill', hint:'Ej.: Producto de práctica (nombre ficticio). Nombre que identificará el registro.'},
    'ed-active': {required:true, symbol:'pill', hint:'Ej.: Sustancia ficticia X. Registre un único principio activo.'},
    'ed-reference': {symbol:'book', hint:'Ej.: título, autor y edición de la referencia que usted consultó. Opcional.'},
    'ed-reviewDate': {symbol:'calendar', hint:'Ej.: seleccione 15/01/2026 si esa fue su fecha de revisión. Opcional.'},
    'ed-notes': {hint:'Ej.: información de conservación que usted haya verificado. Opcional.'},
    'ed-precautions': {hint:'Ej.: una precaución de su referencia verificada. La app no añade precauciones clínicas.'},
    theme: {symbol:'settings', hint:'Ej.: Oscuro para cambiar la apariencia; Claro para volver al fondo claro.'},
    'import-file': {required:true, symbol:'upload', hint:'Ej.: un archivo VetDose-respaldo-2026-01-15.json. Seleccione JSON de VetDose, hasta 5 MB.'},
    'import-mode': {required:true, symbol:'upload', hint:'Ej.: Fusionar para conservar lo actual; Reemplazar sustituye toda la biblioteca y pide confirmación.'},
  };
  if (guides[id]) return {required:false, symbol:'text', ...guides[id]};
  const presentation = id.match(/^(cp|p\d+)-(\w+)$/);
  if (presentation) {
    const prefix=presentation[1], key=presentation[2];
    const p=prefix === 'cp' ? calc.presentation || {} : draft.presentations?.[Number(prefix.slice(1))] || {};
    const unit=p.unit || 'mg';
    const amountContext={tablet:'por tableta', capsule:'por cápsula', sachet:'por sobre', powder:'por 1 g de polvo', topical:'por 1 g de preparación', vial:'en el vial completo'}[p.type] || 'en el volumen de referencia indicado';
    const settings={
      name:{required:true,symbol:'flask',hint:'Ej.: Presentación de práctica (nombre ficticio). Identifica este producto y su concentración.'},
      type:{required:true,symbol:'flask',hint:'Ej.: Solución / suspensión si esa es la forma del producto; los campos se adaptan a su elección.'},
      amount:{required:true,symbol:'target',hint:p.type === 'percent' ? 'Ejemplo ficticio: 1,2 significa 1,2 % del tipo seleccionado. Use el porcentaje real de la etiqueta.' : `Ejemplo ficticio: 12 ${unit} ${amountContext}; escriba solo 12. Use el contenido real de la etiqueta.`},
      unit:{required:true,symbol:'ruler',hint:'Ej.: mg si el contenido está en miligramos; µg si está en microgramos. UI solo en formas admitidas.'},
      percentKind:{required:true,symbol:'ruler',hint:'Ej.: p/v = g/100 mL; p/p = g/100 g; v/v = mL/100 mL. Copie el tipo de la etiqueta.'},
      perVolume:{required:true,symbol:'drop',hint:'Ej.: si la etiqueta expresa el contenido por 5 mL, escriba 5. Para contenido por 1 mL, escriba 1.'},
      finalVolume:{required:true,symbol:'drop',hint:'Ejemplo ficticio: 12 mL de volumen FINAL tras reconstituir. Use el volumen final real, no el diluyente añadido.'},
      diluentVolume:{symbol:'drop',hint:'Ejemplo ficticio: 10 mL añadidos. Opcional e informativo; no sustituye al volumen final.'},
      dropFactor:{symbol:'drop',hint:'Ejemplo ficticio: 20 gotas/mL. Use el factor real del producto y dispositivo. Solo se necesita para mostrar gotas; los mL pueden calcularse sin él.'},
    };
    return {required:false,symbol:'text',...settings[key]};
  }
  const regimen=id.match(/^r(\d+)-(\w+)$/);
  if (regimen) {
    const r=draft.regimens?.[Number(regimen[1])] || {}, key=regimen[2];
    const range=present(r.min) || present(r.max);
    const settings={
      indication:{required:true,hint:'Ej.: Práctica de cálculo (texto ficticio). Identifica para qué registró esta pauta.'},
      species:{required:true,symbol:'paw',hint:'Ej.: Canino si la pauta corresponde a perros. Ambas especies solo si usted lo ha validado.'},
      dose:{required:!range,symbol:'target',hint:'Ejemplo ficticio: 6. Registre una dosis puntual o un intervalo mínimo–máximo completo; sin valor clínico.'},
      doseUnit:{required:true,symbol:'ruler',hint:'Ej.: mg/kg/dosis para cada administración, o mg/kg/día para el total diario.'},
      min:{required:range,symbol:'target',hint:'Ejemplo ficticio: 2 como límite inferior. Si introduce un límite, ambos extremos son obligatorios.'},
      max:{required:range,symbol:'target',hint:'Ejemplo ficticio: 8 como límite superior. La app no seleccionará un punto medio.'},
      route:{hint:'Ej.: la vía que usted haya definido para esta pauta. Opcional para guardar.'},
      intervalHours:{required:Boolean(r.doseUnit?.endsWith('/día')),symbol:'clock',hint:r.doseUnit?.endsWith('/día') ? 'Ejemplo ficticio: 8 horas entre administraciones. Obligatorio en una pauta diaria.' : 'Ejemplo ficticio: 8 horas entre administraciones. Opcional para una pauta por dosis.'},
      durationDays:{symbol:'calendar',hint:'Ejemplo ficticio: 2 días de duración. Opcional.'},
    };
    return {required:false,symbol:'text',...settings[key]};
  }
  return {required:false,symbol:'info',hint:'Introduzca el dato que corresponda a su registro.'};
}
