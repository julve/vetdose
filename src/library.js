import { DOSE_UNITS, numeric, validatePresentation } from './core.js';

export const STORAGE_KEY = 'vetdose.library.v1';
export function uid() {
  return globalThis.crypto?.randomUUID?.() || `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
export function emptyLibrary() { return {schemaVersion: 1, drugs: []}; }
function textField(value, label, required = false) {
  if (typeof value !== 'string' || value.length > 10000 || (required && !value.trim())) throw new Error(`${label}: texto no válido.`);
  return value.trim();
}
function optionalNumber(value, label, zero = false) {
  return value === '' || value == null ? null : numeric(value, label, zero);
}
export function validateLibrary(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.drugs) || data.drugs.length > 5000) throw new Error('Biblioteca inválida o versión de esquema no admitida.');
  const ids = new Set(), medicationKeys = new Set();
  const checkedId = id => {
    textField(id, 'Identificador', true);
    if (ids.has(id)) throw new Error('Identificadores duplicados.');
    ids.add(id); return id;
  };
  const drugs = data.drugs.map(d => {
    if (!d || !Array.isArray(d.regimens) || !Array.isArray(d.presentations) || d.regimens.length > 200 || d.presentations.length > 200) throw new Error('Asociaciones de medicamento inválidas.');
    const result = {id: checkedId(d.id), name: textField(d.name, 'Nombre', true), active: textField(d.active, 'Principio activo', true)};
    const medicationKey=`${result.name.toLocaleLowerCase()}|${result.active.toLocaleLowerCase()}`;
    if (medicationKeys.has(medicationKey)) throw new Error('Medicamentos duplicados por nombre y principio activo.');
    medicationKeys.add(medicationKey);
    for (const field of ['notes', 'precautions', 'reference', 'reviewDate']) result[field] = textField(d[field] ?? '', field);
    if (result.reviewDate && !/^\d{4}-\d{2}-\d{2}$/.test(result.reviewDate)) throw new Error('Fecha de revisión inválida.');
    if (result.reviewDate) {
      const date=new Date(`${result.reviewDate}T00:00:00Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==result.reviewDate) throw new Error('Fecha de revisión inválida.');
    }
    result.regimens = d.regimens.map(r => {
      if (!r || !['canine', 'feline', 'both'].includes(r.species) || !DOSE_UNITS.includes(r.doseUnit)) throw new Error('Especie o unidad de pauta inválida.');
      const regimen = {id: checkedId(r.id), species: r.species, indication: textField(r.indication, 'Indicación', true), route: textField(r.route ?? '', 'Vía'), doseUnit: r.doseUnit,
        dose: optionalNumber(r.dose, 'Dosis', true), min: optionalNumber(r.min, 'Mínimo', true), max: optionalNumber(r.max, 'Máximo', true), intervalHours: optionalNumber(r.intervalHours, 'Intervalo'), durationDays: optionalNumber(r.durationDays, 'Duración')};
      if ((regimen.min === null) !== (regimen.max === null) || (regimen.min !== null && regimen.min > regimen.max)) throw new Error('Intervalo de dosis inválido.');
      if (regimen.dose === null && regimen.min === null) throw new Error('La pauta necesita una dosis o un intervalo completo.');
      if (regimen.min !== null && regimen.dose !== null && (regimen.dose < regimen.min || regimen.dose > regimen.max)) throw new Error('La dosis está fuera del intervalo registrado.');
      if (regimen.doseUnit.endsWith('/día') && regimen.intervalHours === null) throw new Error('La pauta diaria requiere frecuencia.');
      return regimen;
    });
    result.presentations = d.presentations.map(p => {
      validatePresentation(p);
      const presentation = {id: checkedId(p.id), name: textField(p.name, 'Nombre de presentación', true), type: p.type, amount: numeric(p.amount, 'Contenido')};
      for (const field of ['unit', 'percentKind']) if (p[field] != null) presentation[field] = textField(p[field], field);
      for (const field of ['perVolume', 'finalVolume', 'diluentVolume', 'dropFactor']) if (p[field] !== '' && p[field] != null) presentation[field] = numeric(p[field], field);
      presentation.fractions = p.type === 'tablet' ? [...(p.fractions || [])] : [];
      return presentation;
    });
    return result;
  });
  return {schemaVersion: 1, drugs};
}
export function parseLibrary(raw) {
  if (typeof raw !== 'string' || raw.length > 5 * 1024 * 1024) throw new Error('Archivo ausente o superior a 5 MB.');
  try { return validateLibrary(JSON.parse(raw)); } catch (e) { throw new Error(`No se pudo importar: ${e.message}`); }
}
export function mergeLibraries(current, incoming) {
  const left = validateLibrary(current), right = validateLibrary(incoming);
  const byId = new Map(left.drugs.map(d => [d.id, d]));
  const key = d => `${d.name.trim().toLocaleLowerCase()}|${d.active.trim().toLocaleLowerCase()}`;
  for (const d of right.drugs) {
    const prior = byId.get(d.id);
    if (prior) {
      if (JSON.stringify(prior) !== JSON.stringify(d)) throw new Error(`Conflicto en «${d.name}»: el mismo identificador tiene cambios. Use reemplazo o resuelva la copia antes de fusionar.`);
      continue;
    }
    if ([...byId.values()].some(existing => key(existing) === key(d))) throw new Error(`Posible duplicado: «${d.name}». Revise los registros antes de fusionar.`);
    byId.set(d.id, d);
  }
  return validateLibrary({schemaVersion: 1, drugs: [...byId.values()]});
}
export function loadLibrary(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null ? emptyLibrary() : parseLibrary(raw);
}
export function saveLibrary(storage, library) {
  const validated = validateLibrary(library);
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}
export function exportLibrary(library) { return JSON.stringify(validateLibrary(library), null, 2); }
