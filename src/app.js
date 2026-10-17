import { DOSE_UNITS, FORMS, calculate, display } from './core.js';
import { STORAGE_KEY, uid, emptyLibrary, validateLibrary, parseLibrary, mergeLibraries, saveLibrary, exportLibrary } from './library.js';
import { icon, fieldGuide } from './ui.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const option = (value, label, selected) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
const speciesName = value => ({canine:'Canino', feline:'Felino', both:'Ambas especies'}[value] || '');
let storage = null, library = emptyLibrary(), persistence = '', corrupt = false, rawCorrupt = '', storageSnapshot = null;
try {
  storage = window.localStorage;
  storageSnapshot = storage.getItem(STORAGE_KEY);
  library = storageSnapshot === null ? emptyLibrary() : parseLibrary(storageSnapshot);
  const probe = `vetdose.probe.${uid()}`;
  storage.setItem(probe, '1'); storage.removeItem(probe);
} catch (e) {
  persistence = `Almacenamiento no disponible o inválido: ${e.message}. Exporte sus datos antes de cerrar.`;
  try { rawCorrupt = storage?.getItem(STORAGE_KEY) || ''; corrupt = !!rawCorrupt; } catch { /* storage access denied */ }
}
let theme = 'light';
try { theme = storage?.getItem('vetdose.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch { /* use default */ }
document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
let page = 'calculator', draft = null, editingId = null, result = null, resultError = '';
let search = '', speciesFilter = 'all';
const blankPresentation = () => ({type:'liquid', amount:'', unit:'mg', perVolume:'', finalVolume:'', diluentVolume:'', dropFactor:'', percentKind:'pv', fractions:[]});
let calc = {species:'canine', weight:'', patient:'', drugId:'', regimenId:'', presentationId:'', name:'', active:'', indication:'', dose:'', doseUnit:DOSE_UNITS[0], route:'', intervalHours:'', durationDays:'', mode:'dose', measuredQuantity:'', presentation:blankPresentation()};
function guidedField(id, label, element, extraHint='') {
  const guide=fieldGuide(id,{calc,draft:draft||{}});
  const required=guide.required ? 'required aria-required="true"' : 'aria-required="false"';
  const control=element.replace('FIELD_ATTRIBUTES',`id="${id}" ${required} ${guide.disabled?'disabled':''} aria-labelledby="${id}-label" aria-describedby="${id}-hint"`);
  return `<div class="form-field" data-field="${id}" data-extra-hint="${esc(extraHint)}"><label id="${id}-label" for="${id}"><span class="field-title">${icon(guide.symbol)}<span>${esc(label)}</span><span class="required-marker" aria-hidden="true" ${guide.required?'':'hidden'}>*</span><span class="sr-only required-word" ${guide.required?'':'hidden'}> (obligatorio)</span></span></label>${control}<span class="hint field-example" id="${id}-hint">${esc(guide.hint)}${extraHint ? ` ${esc(extraHint)}` : ''}</span></div>`;
}
const field = (id, label, value = '', attrs = '') => guidedField(id,label,`<input FIELD_ATTRIBUTES value="${esc(value)}" ${attrs}>`);
const num = (id, label, value = '', hint = '') => guidedField(id,label,`<input FIELD_ATTRIBUTES value="${esc(value)}" inputmode="decimal" autocomplete="off">`,hint);
const select = (id, label, options) => guidedField(id,label,`<select FIELD_ATTRIBUTES>${options}</select>`);
const textarea = (id,label,value='') => guidedField(id,label,`<textarea FIELD_ATTRIBUTES>${esc(value)}</textarea>`);
function formLegend(context) {
  return `<div class="form-legend" role="note">${icon('info')}<div><strong><span class="required-marker">*</span> Dato obligatorio ${context}.</strong> Los demás campos son opcionales.<br><span>Los ejemplos son ficticios y muestran el formato; no son pautas ni concentraciones recomendadas.</span></div></div>`;
}
function refreshFieldGuidance() {
  for(const wrapper of document.querySelectorAll('.form-field[data-field]')) {
    const id=wrapper.dataset.field, guide=fieldGuide(id,{calc,draft:draft||{}}), control=$(id);
    control.required=Boolean(guide.required); control.setAttribute('aria-required',String(Boolean(guide.required)));
    control.disabled=Boolean(guide.disabled);
    wrapper.querySelector('.required-marker').hidden=!guide.required;
    wrapper.querySelector('.required-word').hidden=!guide.required;
    $(`${id}-hint`).textContent=guide.hint+(wrapper.dataset.extraHint?` ${wrapper.dataset.extraHint}`:'');
  }
}
function presentationFields(p, prefix) {
  const isPercent = p.type === 'percent';
  const liquid = ['liquid','injection','drops'].includes(p.type);
  const unitTypes = ['injection','vial'].includes(p.type) ? ['mg','µg','UI'] : ['mg','µg'];
  const contentLabel = {tablet:'Contenido por tableta',capsule:'Contenido por cápsula',sachet:'Contenido por sobre',powder:'Contenido por 1 g',topical:'Contenido por 1 g',vial:'Contenido total del vial'}[p.type] || 'Contenido de principio activo';
  return `<div class="grid">
    <div class="full">${select(`${prefix}-type`, 'Forma farmacéutica', Object.entries(FORMS).map(([k,v]) => option(k,v,p.type)).join(''))}</div>
    ${num(`${prefix}-amount`, isPercent ? 'Concentración (%)' : contentLabel, p.amount)}
    ${isPercent ? select(`${prefix}-percentKind`, 'Tipo de porcentaje', [['pv','% peso/volumen (g/100 mL)'],['pp','% peso/peso (g/100 g)'],['vv','% volumen/volumen (mL/100 mL)']].map(([k,v]) => option(k,v,p.percentKind)).join('')) : select(`${prefix}-unit`, 'Unidad del contenido', unitTypes.map(u => option(u,u,p.unit)).join(''))}
    ${liquid ? num(`${prefix}-perVolume`, 'Por volumen de referencia (mL)',p.perVolume) : ''}
    ${p.type === 'vial' ? num(`${prefix}-finalVolume`,'Volumen FINAL reconstituido (mL)',p.finalVolume) + num(`${prefix}-diluentVolume`,'Diluyente añadido (mL, opcional)',p.diluentVolume) : ''}
    ${p.type === 'drops' ? num(`${prefix}-dropFactor`,'Factor del dispositivo (gotas/mL, opcional)',p.dropFactor) : ''}
    ${p.type === 'tablet' ? `<fieldset class="fractions-field full"><legend class="field">${icon('pill')} Fraccionamiento autorizado por usted (opcional)</legend><div class="checkrow" style="margin-top:12px">${[[.5,'½'],[.25,'¼'],[.125,'⅛'],[1/3,'⅓']].map(([v,l]) => `<label><input type="checkbox" name="${prefix}-fractions" value="${v}" aria-describedby="${prefix}-fractions-hint" ${(p.fractions || []).includes(v) ? 'checked' : ''}>${l}</label>`).join('')}</div><span class="hint" id="${prefix}-fractions-hint">Ej.: marque ½ solo si confirmó que el producto permite esa división. Sin marcar no se asume divisibilidad; una coincidencia matemática no valida su uso clínico.</span></fieldset>` : ''}
    ${isPercent ? '<div class="notice info full">p/v: g por 100 mL. p/p: g por 100 g. v/v solo permite contenido en volumen; no se convierte a masa sin densidad.</div>' : ''}
  </div>`;
}
function readPresentation(prefix, prior = {}) {
  const p = {...prior};
  for (const key of ['type','amount','unit','perVolume','finalVolume','diluentVolume','dropFactor','percentKind']) if ($(`${prefix}-${key}`)) p[key] = $(`${prefix}-${key}`).value;
  p.fractions = [...document.querySelectorAll(`input[name="${prefix}-fractions"]:checked`)].map(el => Number(el.value));
  return p;
}
function readCalc() {
  if (!$('weight')) return;
  for (const key of ['weight','patient','name','active','indication','dose','doseUnit','route','intervalHours','durationDays','mode','measuredQuantity']) if ($(key)) calc[key] = $(key).value;
  calc.presentation = readPresentation('cp',calc.presentation);
}
function currentDrug() { return library.drugs.find(d => d.id === calc.drugId); }
function currentRegimen() { return currentDrug()?.regimens.find(r => r.id === calc.regimenId); }
function resultMarkup() {
  if (resultError) return `<div class="notice error" role="alert">${esc(resultError)}</div>`;
  if (!result) return '<div class="result-empty"><div class="symbol" aria-hidden="true">⌑</div><strong>Un cálculo, todos los detalles</strong><p>Introduzca los datos del paciente,<br>la dosis elegida y la presentación.<br>El procedimiento aparecerá aquí.</p></div>';
  const r = result;
  const detail = (key,value) => `<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`;
  const pair = r.mode === 'content' ? [r.active,r.activeUnit] : [r.quantity,r.outputUnit];
  return `<div class="result-main"><div class="result-label">${r.mode === 'content' ? 'Contenido en cantidad medida' : 'Cantidad por administración'}</div><div class="result-number">${esc(display(pair[0]))} <small>${esc(pair[1])}</small></div>${r.fraction ? `<div class="result-fraction">Equivalencia matemática: ${esc(r.fraction)} ${esc(r.outputUnit)}</div>` : ''}</div>
    <dl class="details">${detail('Paciente', `${speciesName(calc.species)} · ${calc.weight} kg${calc.patient ? ` · ${calc.patient}` : ''}`)}${detail('Principio activo',calc.active || 'No especificado')}${detail('Medicamento',calc.name || 'Entrada manual')}${detail('Indicación / pauta',calc.indication || 'No especificada')}${detail('Vía',calc.route || 'No especificada')}${detail('Dosis introducida',r.mode === 'content' ? 'Contenido medido, sin dosis' : `${calc.dose} ${calc.doseUnit}`)}${detail('Presentación',FORMS[calc.presentation.type])}${r.mode === 'dose' ? detail('Principio activo / administración',`${display(r.active)} ${r.activeUnit}`) : detail('Cantidad medida',`${display(r.quantity)} ${r.outputUnit}`)}${r.dailyActive !== null && r.dailyActive !== undefined ? detail('Principio activo / día',`${display(r.dailyActive)} ${r.activeUnit}`) : ''}${detail('Frecuencia',r.mode==='content' ? 'No aplica: contenido medido' : calc.intervalHours ? `Cada ${calc.intervalHours} h` : 'No especificada')}${detail('Duración',r.mode==='content' ? 'No aplica: contenido medido' : calc.durationDays ? `${calc.durationDays} días` : 'No especificada')}${r.total !== null && r.total !== undefined ? detail('Total del tratamiento',`${display(r.total)} ${r.outputUnit} · ${r.count} administraciones`) : ''}${r.drops !== null && r.drops !== undefined ? detail('Equivalencia en gotas',`${display(r.drops)} gotas`) : ''}</dl>
    <div class="formula"><strong>Procedimiento matemático</strong>${r.steps.map(s => `<div>${esc(s)}</div>`).join('')}<span class="hint">Visualización: hasta 12 cifras significativas. Sin redondeo a una cantidad administrable.</span></div>
    <ul class="warnings">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <button data-action="print">${icon('download')} Imprimir resultado</button>`;
}
function calcPage() {
  const d = currentDrug(), regimen = currentRegimen();
  return `<div class="page-heading"><h1>Calculadora de dosis</h1><p>Usted define la pauta. VetDose hace las cuentas.</p></div>${formLegend('para este cálculo; cambia según la operación y la presentación')}
  <div class="workspace"><div class="stack calculator-input">
    <section class="card"><h2><span class="step">01</span>${icon('paw')} Paciente</h2><div class="grid"><fieldset class="species-field full"><legend class="field">Especie <span class="required-marker" aria-hidden="true">*</span><span class="sr-only"> (obligatorio)</span></legend><div class="species" style="margin-top:8px"><button data-action="species" data-value="canine" class="${calc.species === 'canine' ? 'selected' : ''}" aria-pressed="${calc.species === 'canine'}">Canino</button><button data-action="species" data-value="feline" class="${calc.species === 'feline' ? 'selected' : ''}" aria-pressed="${calc.species === 'feline'}">Felino</button></div><span class="hint">Ej.: Canino si el paciente es un perro. Confirme la especie seleccionada.</span></fieldset>${num('weight','Peso corporal (kg)',calc.weight)}${field('patient','Identificador (opcional)',calc.patient,'autocomplete="off"')}</div></section>
    <section class="card"><h2><span class="step">02</span>${icon('pill')} Medicamento y pauta</h2><div class="grid">
    <div class="full">${select('drugId','Origen del medicamento',option('','Entrada manual · sin guardar',calc.drugId)+library.drugs.map(x => option(x.id,x.name,calc.drugId)).join(''))}</div>
    ${field('name','Nombre del medicamento',calc.name)}${field('active','Principio activo único',calc.active)}
    ${d ? `<div class="full">${select('regimenId','Pauta registrada',option('','Pauta manual',calc.regimenId)+d.regimens.map(r => `<option value="${esc(r.id)}" ${r.id===calc.regimenId?'selected':''} ${r.species!=='both' && r.species!==calc.species?'disabled':''}>${esc(`${r.indication} · ${speciesName(r.species)}`)}</option>`).join(''))}</div>` : ''}
    ${field('indication','Indicación / pauta',calc.indication)}${select('mode','Tipo de operación',option('dose','Cálculo por dosis',calc.mode)+option('content','Contenido en cantidad medida',calc.mode))}
    ${calc.mode === 'dose' ? num('dose','Dosis elegida por usted',calc.dose)+select('doseUnit','Unidad de dosis',DOSE_UNITS.map(u=>option(u,u,calc.doseUnit)).join('')) : num('measuredQuantity',`Cantidad medida (${calc.presentation.type==='percent' && calc.presentation.percentKind!=='pp' ? 'mL' : 'g'})`,calc.measuredQuantity)}
    ${regimen?.min != null ? `<div class="notice info full">Intervalo registrado: ${esc(regimen.min)}–${esc(regimen.max)} ${esc(regimen.doseUnit)}. Seleccione expresamente una dosis; no se elige un punto medio.</div>` : ''}
    ${field('route','Vía de administración',calc.route)}${num('intervalHours','Administrar cada (horas)',calc.intervalHours)}${num('durationDays','Duración (días, opcional)',calc.durationDays)}
    </div>${d?.precautions ? `<div class="notice range-note">Precauciones registradas: ${esc(d.precautions)}</div>` : ''}<span class="hint">Frecuencia y duración son introducidas por usted. El cálculo no valida una pauta terapéutica.</span></section>
    <section class="card"><h2><span class="step">03</span>${icon('flask')} Presentación farmacéutica</h2>
    ${d ? select('presentationId','Presentación registrada',option('','Presentación manual',calc.presentationId)+d.presentations.map(p=>option(p.id,p.name,calc.presentationId)).join(''))+'<div style="height:17px"></div>' : ''}
    ${presentationFields(calc.presentation,'cp')}<button class="primary calculate" data-action="calculate">${icon('calculator')} Calcular cantidad <span aria-hidden="true">→</span></button><span class="hint">Los cambios de esta pantalla son temporales: no modifican la biblioteca.</span></section>
    </div><aside class="card result-card"><h2><span>${icon('calculator')} Resultado</span> <span class="badge">CÁLCULO MATEMÁTICO</span></h2><div id="result" aria-live="polite">${resultMarkup()}</div></aside></div>
    <p class="footnote">VetDose 1.1 · Sin pautas precargadas · Sin conversiones entre UI y masa · Un solo principio activo<br>La exactitud matemática no garantiza la idoneidad clínica de una administración.</p>`;
}
function libraryPage() {
  return `<div class="page-heading"><h1>Su biblioteca</h1><p>Medicamentos, pautas y presentaciones registrados por usted.</p></div><div class="library-toolbar">${field('search','Buscar por nombre o principio activo',search,'type="search"')}${select('speciesFilter','Especie',option('all','Todas',speciesFilter)+['canine','feline'].map(s=>option(s,speciesName(s),speciesFilter)).join(''))}<button class="primary" data-action="new-drug">+ Nuevo medicamento</button></div><div id="drug-list" class="drug-list">${drugList()}</div>`;
}
function drugList() {
  const items = library.drugs.filter(d => `${d.name} ${d.active}`.toLowerCase().includes(search.toLowerCase()) && (speciesFilter==='all' || d.regimens.some(r=>r.species===speciesFilter || r.species==='both')));
  return items.map(d => `<article class="card drug-card"><div><h3>${esc(d.name)}</h3><p>${esc(d.active)}</p><p>${d.regimens.length} pautas · ${d.presentations.length} presentaciones${d.reviewDate ? ` · Revisado ${esc(d.reviewDate)}` : ''}</p></div><div class="actions"><button data-action="use" data-id="${esc(d.id)}">Usar</button><button data-action="edit" data-id="${esc(d.id)}">Editar</button><button data-action="duplicate" data-id="${esc(d.id)}">Duplicar</button><button class="danger" data-action="delete" data-id="${esc(d.id)}">Eliminar</button></div></article>`).join('') || '<div class="card empty-library"><strong>Una biblioteca a su medida</strong><p>No hay medicamentos que mostrar.<br>Agregue sus propias pautas y presentaciones.<br>VetDose no incluye dosis farmacológicas.</p></div>';
}
function editorPage() {
  return `<div class="page-heading editor-header"><div><h1>${editingId ? 'Editar medicamento' : 'Nuevo medicamento'}</h1><p>Los valores deben proceder de sus propias referencias.</p></div><button data-action="cancel-edit">Cancelar</button></div>
  ${formLegend('para guardar; cada pauta admite dosis puntual o intervalo mínimo–máximo completo')}<div class="stack"><section class="card"><h2>${icon('pill')} Identificación</h2><div class="grid">${field('ed-name','Nombre del medicamento',draft.name)}${field('ed-active','Principio activo único',draft.active)}${field('ed-reference','Referencia bibliográfica (opcional)',draft.reference)}${field('ed-reviewDate','Fecha de última revisión',draft.reviewDate,'type="date"')}<div class="full">${textarea('ed-notes','Observaciones',draft.notes)}</div><div class="full">${textarea('ed-precautions','Precauciones y contraindicaciones',draft.precautions)}</div></div><span class="hint">Combinaciones de principios activos: capacidad futura. No registre una combinación como si fuera un solo principio activo.</span></section>
  <section class="card"><h2>Pautas posológicas</h2>${draft.regimens.map((r,i)=>`<div class="entry"><h3>Pauta ${i+1}</h3><div class="grid">${field(`r${i}-indication`,'Indicación',r.indication)}${select(`r${i}-species`,'Especie', ['canine','feline','both'].map(s=>option(s,speciesName(s),r.species)).join(''))}${num(`r${i}-dose`,'Dosis puntual',r.dose)}${select(`r${i}-doseUnit`,'Unidad de dosis',DOSE_UNITS.map(u=>option(u,u,r.doseUnit)).join(''))}${num(`r${i}-min`,'Dosis mínima del intervalo',r.min)}${num(`r${i}-max`,'Dosis máxima del intervalo',r.max)}${field(`r${i}-route`,'Vía',r.route)}${num(`r${i}-intervalHours`,'Intervalo (horas)',r.intervalHours)}${num(`r${i}-durationDays`,'Duración (días, opcional)',r.durationDays)}</div><button class="remove danger" data-action="remove-regimen" data-index="${i}">Quitar pauta</button></div>`).join('')}<button data-action="add-regimen">+ Agregar pauta</button></section>
  <section class="card"><h2>${icon('flask')} Presentaciones</h2>${draft.presentations.map((p,i)=>`<div class="entry"><h3>Presentación ${i+1}</h3>${field(`p${i}-name`,'Nombre comercial / identificación',p.name)}<div style="height:17px"></div>${presentationFields(p,`p${i}`)}<button class="remove danger" data-action="remove-presentation" data-index="${i}">Quitar presentación</button></div>`).join('')}<button data-action="add-presentation">+ Agregar presentación</button></section><div id="editor-error" class="notice error" role="alert"></div><div><button class="primary" data-action="save-drug">${icon('save')} Guardar medicamento</button></div></div>`;
}
function readDraft() {
  if (!draft) return;
  for (const key of ['name','active','reference','reviewDate','notes','precautions']) draft[key] = $(`ed-${key}`).value;
  draft.regimens.forEach((r,i)=> { for (const key of ['indication','species','dose','doseUnit','min','max','route','intervalHours','durationDays']) r[key]=$(`r${i}-${key}`).value; });
  draft.presentations = draft.presentations.map((p,i)=>({...readPresentation(`p${i}`,p),name:$(`p${i}-name`).value}));
}
function settingsPage() {
  return `<div class="page-heading"><h1>Configuración y respaldos</h1><p>Sus datos permanecen en este dispositivo. Usted controla sus copias.</p></div><div class="settings">
  <section class="card"><h2>Apariencia</h2>${select('theme','Tema',option('light','Claro',document.documentElement.dataset.theme)+option('dark','Oscuro',document.documentElement.dataset.theme))}</section>
  <section class="card"><h2>${icon('download')} Respaldo de biblioteca</h2><p>La exportación JSON incluye medicamentos, pautas y presentaciones. No incluye identificadores de pacientes ni cálculos. No existe sincronización automática entre dispositivos.</p><p><strong>${library.drugs.length} medicamentos en esta sesión.</strong></p><div class="actions"><button class="primary" data-action="export">${icon('download')} Exportar biblioteca JSON</button>${corrupt ? '<button data-action="recover">Descargar datos originales para recuperación</button>' : ''}</div><p>Guarde copias periódicas y antes de cambiar de navegador, borrar datos o trasladar la biblioteca.</p></section>
  <section class="card"><h2>${icon('upload')} Importar biblioteca</h2><p>Se valida todo el archivo antes de modificar los datos. La fusión omite copias idénticas y bloquea conflictos de identificadores o posibles duplicados.</p>${formLegend('para importar')}${field('import-file','Archivo de respaldo JSON','','type="file" accept=".json,application/json"')}${select('import-mode','Modo de importación',option('merge','Fusionar con biblioteca actual','merge')+option('replace','Reemplazar biblioteca actual','merge'))}<div class="actions"><button data-action="import">${icon('upload')} Validar e importar</button></div><div id="import-status" class="notice" role="status" style="margin-top:15px"></div></section>
  <section class="card"><h2>Almacenamiento y portabilidad</h2><p>${esc(persistence || 'Almacenamiento local disponible en esta sesión. Esto no garantiza retención indefinida.')}</p><p>Su biblioteca es privada de este navegador: no se comparte con otros visitantes ni se sincroniza entre dispositivos. El sitio web distribuye la aplicación; no recibe sus pautas ni los datos del paciente.</p><p>El navegador puede eliminar datos o aislarlos por dirección y perfil. En modo privado, bajo file:// y especialmente en iOS, la persistencia puede no funcionar. Exporte JSON antes de cerrar y mantenga una copia externa.</p><p>En el teléfono, abra el enlace web en Safari o Chrome. Si llegó por WhatsApp, use «Abrir en el navegador» para mantener sus datos en un navegador habitual. No necesita descargar un archivo para usar el sitio. La versión web requiere conexión para abrirse o recargarse; después de cargar, los cálculos no dependen de la red. El HTML portable sigue disponible para uso local.</p></section><section class="card"><h2>${icon('book')} Guía de uso</h2><p>Manual PDF con capturas, explicación de los asteriscos, ejemplos ficticios y pasos para conservar su biblioteca.</p><a class="button-link" href="${document.querySelector('script[src="src/app.js"]')?'docs/':''}Guia-de-usuario-VetDose.pdf" download>${icon('download')} Descargar guía PDF</a></section></div>`;
}
function render() {
  $('app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark" aria-hidden="true">+</span><div>VetDose <span class="version-tag">1.1</span><small>PRECISIÓN EN CADA CÁLCULO</small></div></div><nav class="nav" aria-label="Navegación principal">${[['calculator','calculator','Calculadora'],['library','book','Biblioteca'],['settings','settings','Configuración']].map(([id,symbol,label])=>`<button data-action="navigate" data-page="${id}" ${page===id || (page==='editor'&&id==='library')?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon(symbol)}</span>${label}</button>`).join('')}</nav><div class="sidebar-bottom"><span class="local-dot"></span>Datos locales · Sin cuentas<br>VetDose 1.1<br>Herramienta de apoyo matemático</div></aside><main class="main"><div class="topline"><span>Espacio de trabajo veterinario</span><span class="badge">DATOS LOCALES · SIN CUENTAS</span></div>${persistence || location.protocol==='file:' ? `<div class="notice storage-banner" role="status">${esc(persistence || 'Archivo local: el almacenamiento puede variar entre navegadores. Exporte un respaldo JSON antes de cerrar.')}${corrupt ? ' Los datos originales se conservan; recupérelos en Configuración antes de reemplazarlos.' : ''}</div>` : ''}${page==='calculator'?calcPage():page==='library'?libraryPage():page==='editor'?editorPage():settingsPage()}</main></div><div id="toast" role="status" hidden></div>`;
}
function pageStart() { window.scrollTo({top:0,behavior:'instant'}); }
let toastTimer;
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('toast').hidden=true;},6000); }
function invalidate() { result=null; resultError=''; if ($('result')) $('result').innerHTML=resultMarkup(); }
function commitLibrary(next, allowCorrupt = false) {
  const validated = validateLibrary(next);
  if (corrupt && !allowCorrupt) throw new Error('Los datos guardados no se pudieron leer. Descargue los originales en Configuración y use una importación con reemplazo.');
  if (storage) {
    try {
      if (storage.getItem(STORAGE_KEY)!==storageSnapshot) throw new Error('La biblioteca cambió en otra pestaña. Exporte su copia actual y recargue antes de guardar.');
      saveLibrary(storage,validated); storageSnapshot=JSON.stringify(validated); persistence=''; corrupt=false; rawCorrupt='';
    }
    catch (e) { throw new Error(`No se guardaron los cambios: ${e.message}. Exporte la biblioteca existente y revise el almacenamiento.`); }
  } else persistence='Modo de memoria: los cambios se perderán al cerrar. Exporte un respaldo JSON.';
  library=validated;
}
function download(raw, name, type='application/json') {
  const url=URL.createObjectURL(new Blob([raw],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function applyDrug(id) {
  calc.drugId=id; calc.regimenId=''; calc.presentationId='';
  const d=currentDrug();
  calc={...calc,name:d?.name||'',active:d?.active||'',indication:'',dose:'',route:'',intervalHours:'',durationDays:'',presentation:blankPresentation()};
  invalidate();
}
document.addEventListener('input',e=>{
  if (page==='calculator') { readCalc(); invalidate(); refreshFieldGuidance(); }
  if (page==='editor') { readDraft(); refreshFieldGuidance(); }
  if (e.target.id==='search') { search=e.target.value; $('drug-list').innerHTML=drugList(); }
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if (page==='calculator') {
    readCalc();
    if (id==='drugId') applyDrug(e.target.value);
    else if (id==='regimenId') {
      calc.regimenId=e.target.value; const r=currentRegimen();
      calc={...calc,indication:r?.indication||'',dose:r?.min!=null?'':r?.dose??'',doseUnit:r?.doseUnit||DOSE_UNITS[0],route:r?.route||'',intervalHours:r?.intervalHours??'',durationDays:r?.durationDays??''};
    } else if (id==='presentationId') {
      calc.presentationId=e.target.value;
      calc.presentation=structuredClone(currentDrug()?.presentations.find(p=>p.id===calc.presentationId)||blankPresentation());
      calc.mode=calc.presentation.type==='topical' || (calc.presentation.type==='percent' && calc.presentation.percentKind==='vv')?'content':'dose';
    } else if (id==='cp-type') {
      calc.presentation={...blankPresentation(),type:e.target.value}; calc.presentationId='';
      calc.mode=e.target.value==='topical'?'content':'dose';
    } else if (!['mode','cp-percentKind'].includes(id)) { invalidate(); refreshFieldGuidance(); return; }
    invalidate(); render();
  } else if (page==='editor' && /^p\d+-type$/.test(id)) {
    readDraft(); const i=Number(id.match(/^p(\d+)/)[1]); const prior=draft.presentations[i];
    draft.presentations[i]={...blankPresentation(),id:prior.id,name:prior.name,type:e.target.value}; render();
  } else if (page==='editor') { readDraft(); refreshFieldGuidance(); }
  else if (id==='speciesFilter') { speciesFilter=e.target.value; $('drug-list').innerHTML=drugList(); }
  else if (id==='theme') { document.documentElement.dataset.theme=e.target.value; try { storage?.setItem('vetdose.theme',e.target.value); } catch { toast('Tema aplicado solo para esta sesión.'); } }
});
document.addEventListener('click',async e=>{
  const button=e.target.closest('button[data-action]'); if (!button) return;
  const {action,id,index}=button.dataset;
  try {
    if (action==='navigate') {
      if (page==='editor' && !confirm('¿Descartar los cambios sin guardar del medicamento?')) return;
      if (page==='calculator') readCalc();
      page=button.dataset.page; draft=null; render(); pageStart();
    } else if (action==='species') { readCalc();calc.species=button.dataset.value;invalidate();render(); }
    else if (action==='calculate') {
      readCalc();
      try {
        if (!calc.active.trim()) throw new Error('Indique el principio activo único.');
        const r=currentRegimen();
        if (calc.mode==='dose' && r?.min!=null && (calc.doseUnit!==r.doseUnit || Number(String(calc.dose).replace(',','.'))<r.min || Number(String(calc.dose).replace(',','.'))>r.max)) throw new Error('Seleccione una dosis dentro del intervalo registrado y conserve su unidad. Para otra pauta seleccione «Pauta manual».');
        result=calculate({...calc,regimenSpecies:r?.species});resultError='';
      } catch(err) {result=null;resultError=err.message;}
      $('result').innerHTML=resultMarkup();
      if (matchMedia('(max-width: 1050px)').matches) {
        $('result').setAttribute('tabindex','-1');
        $('result').focus({preventScroll:true});
        $('result').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
      }
    } else if (action==='print') window.print();
    else if (action==='new-drug' || action==='edit') {
      editingId=action==='edit'?id:null;
      draft=editingId?structuredClone(library.drugs.find(d=>d.id===id)):{id:uid(),name:'',active:'',notes:'',precautions:'',reference:'',reviewDate:'',regimens:[],presentations:[]};
      page='editor';render();pageStart();
    } else if (action==='cancel-edit') { if(confirm('¿Descartar los cambios sin guardar?')) {draft=null;page='library';render();} }
    else if (action==='add-regimen') {
      readDraft();draft.regimens.push({id:uid(),species:'canine',indication:'',dose:'',min:'',max:'',doseUnit:DOSE_UNITS[0],route:'',intervalHours:'',durationDays:''});render();
    } else if (action==='add-presentation') { readDraft();draft.presentations.push({...blankPresentation(),id:uid(),name:''});render(); }
    else if (action==='remove-regimen' || action==='remove-presentation') {readDraft();draft[action==='remove-regimen'?'regimens':'presentations'].splice(Number(index),1);render();}
    else if (action==='save-drug') {
      readDraft();
      try {
        const next=structuredClone(library);const existing=next.drugs.findIndex(d=>d.id===draft.id);
        if(next.drugs.some(d=>d.id!==draft.id && d.name.toLowerCase().trim()===draft.name.toLowerCase().trim() && d.active.toLowerCase().trim()===draft.active.toLowerCase().trim())) throw new Error('Ya existe un medicamento con este nombre y principio activo. Edite ese registro o use un nombre distinto.');
        if(existing<0) next.drugs.push(draft);else next.drugs[existing]=draft;
        commitLibrary(next);draft=null;page='library';invalidate();render();toast('Medicamento guardado.');
      } catch(err) { $('editor-error').textContent=err.message; }
    } else if (action==='duplicate') {
      const copy=structuredClone(library.drugs.find(d=>d.id===id));copy.id=uid();copy.name+=' (copia)';copy.regimens.forEach(r=>r.id=uid());copy.presentations.forEach(p=>p.id=uid());
      draft=copy;editingId=null;page='editor';render();
    } else if (action==='delete') {
      const d=library.drugs.find(d=>d.id===id);
      if (!confirm(`¿Eliminar «${d.name}», sus pautas y presentaciones? Esta acción no puede deshacerse. Exporte un respaldo si lo necesita.`)) return;
      commitLibrary({...library,drugs:library.drugs.filter(x=>x.id!==id)});if(calc.drugId===id) applyDrug('');render();toast('Medicamento eliminado.');
    } else if (action==='use') {applyDrug(id);page='calculator';render();pageStart();}
    else if (action==='export') {download(exportLibrary(library),`VetDose-respaldo-${new Date().toISOString().slice(0,10)}.json`);toast('Respaldo preparado. Compruebe que el archivo se haya guardado.');}
    else if (action==='recover') download(rawCorrupt,'VetDose-datos-originales.txt','text/plain');
    else if (action==='import') {
      const status=$('import-status');
      button.disabled=true;status.textContent='Validando archivo…';status.className='notice info';
      try {
        const file=$('import-file').files[0];if(!file) throw new Error('Seleccione un archivo JSON.');
        if(file.size>5*1024*1024) throw new Error('El archivo supera 5 MB.');
        const replace=$('import-mode').value==='replace';
        const incoming=parseLibrary(await file.text());
        if(!status.isConnected) return;
        const next=replace?incoming:mergeLibraries(library,incoming);
        if(replace && !confirm('¿Reemplazar toda la biblioteca? Exporte primero un respaldo de sus datos actuales.')) return;
        commitLibrary(next,replace);applyDrug('');render();$('import-status').textContent=`Importación completada: ${library.drugs.length} medicamentos en la biblioteca.`;
      } catch(err) {status.textContent=err.message;status.className='notice error';}
      finally {button.disabled=false;}
    }
  } catch(err) {toast(err.message);}
});
window.addEventListener('beforeunload',e=>{if(page==='editor'){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY || e.key===null) toast('La biblioteca cambió en otra pestaña. Exporte su copia actual y recargue antes de guardar.');});
render();
