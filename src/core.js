// No therapeutic data: every operand comes from the clinician.
export const DOSE_UNITS = ['mg/kg/dosis', 'mg/kg/día', 'µg/kg/dosis', 'µg/kg/día', 'mg/dosis', 'µg/dosis', 'UI/kg/dosis', 'UI/dosis'];
export const FORMS = {
  tablet: 'Tableta / comprimido', capsule: 'Cápsula', liquid: 'Solución / suspensión',
  injection: 'Solución inyectable', vial: 'Vial reconstituido', powder: 'Polvo / granulado',
  sachet: 'Sobre', percent: 'Preparación porcentual', drops: 'Gotas', topical: 'Crema / ungüento'
};
export function numeric(value, label, allowZero = false) {
  if (typeof value !== 'number' && typeof value !== 'string') throw new Error(`${label}: valor numérico obligatorio.`);
  const clean = typeof value === 'string' ? value.trim().replace(',', '.') : value;
  if (clean === '' || (typeof clean === 'string' && !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(clean))) throw new Error(`${label}: número decimal no válido.`);
  const n = Number(clean);
  if (typeof clean === 'string' && n === 0 && /[1-9]/.test(clean.split(/[eE]/)[0])) throw new Error(`${label}: valor inferior a la precisión numérica admitida.`);
  if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0)) throw new Error(`${label}: debe ser ${allowZero ? 'mayor o igual a' : 'mayor que'} cero y finito.`);
  return n;
}
export function display(value) {
  if (!Number.isFinite(value)) throw new Error('Resultado no finito.');
  if (value === 0) return '0';
  // Significant digits preserve tiny volumes; never round a nonzero amount to zero.
  return new Intl.NumberFormat('es-MX', {maximumSignificantDigits: 12, useGrouping: false}).format(value);
}
export function fraction(value) {
  for (const d of [1, 2, 3, 4, 8]) {
    const n = Math.round(value * d);
    if (Math.abs(value - n / d) <= Math.abs(value) * 1e-12) return d === 1 ? `${n}` : `${n}/${d}`;
  }
  return null;
}
export function validatePresentation(p) {
  if (!p || !Object.hasOwn(FORMS, p.type)) throw new Error('Presentación desconocida o aún no admitida.');
  const amount = numeric(p.amount, 'Contenido / concentración');
  if (p.type === 'percent') {
    if (!['pv', 'pp', 'vv'].includes(p.percentKind)) throw new Error('Especifique el tipo de porcentaje.');
    if (amount > 100) throw new Error('El porcentaje no puede superar 100.');
    if (p.percentKind === 'vv') return {concentration: amount / 100, unit: 'mL', dimension: 'volume', outputUnit: 'mL'};
    return {concentration: amount * 10, unit: 'mg', dimension: 'mass', outputUnit: p.percentKind === 'pv' ? 'mL' : 'g'};
  }
  if (!['mg', 'µg', 'UI'].includes(p.unit)) throw new Error('Unidad de contenido no válida.');
  if (p.unit === 'UI' && !['injection', 'vial'].includes(p.type)) throw new Error('UI solo se admite en inyectables y viales.');
  const dimension = p.unit === 'UI' ? 'activity' : 'mass';
  const unit = p.unit === 'UI' ? 'UI' : 'mg';
  const base = p.unit === 'µg' ? amount / 1000 : amount;
  const outputs = {tablet: 'tabletas', capsule: 'cápsulas', sachet: 'sobres', powder: 'g', topical: 'g'};
  let denominator = 1;
  if (['liquid', 'injection', 'drops'].includes(p.type)) denominator = numeric(p.perVolume, 'Volumen de referencia (mL)');
  if (p.type === 'vial') denominator = numeric(p.finalVolume, 'Volumen FINAL reconstituido (mL)');
  if (p.diluentVolume !== '' && p.diluentVolume != null) numeric(p.diluentVolume, 'Diluyente añadido');
  if (p.dropFactor !== '' && p.dropFactor != null) numeric(p.dropFactor, 'Gotas por mL');
  if (p.type === 'tablet' && p.fractions != null) {
    if (!Array.isArray(p.fractions) || p.fractions.some(f => ![0.5, 0.25, 0.125, 1/3].includes(f))) throw new Error('Fracciones de tableta no válidas.');
  }
  const concentration = base / denominator;
  if (!Number.isFinite(concentration) || concentration <= 0) throw new Error('Concentración fuera del rango numérico.');
  return {concentration, dimension, unit, outputUnit: outputs[p.type] || 'mL'};
}
function concentrationStep(p, normalized) {
  const result = `${display(normalized.concentration)} ${normalized.unit}/${normalized.outputUnit}`;
  if (p.type === 'percent') {
    const description = {pv:'g por 100 mL', pp:'g por 100 g', vv:'mL por 100 mL'}[p.percentKind];
    return `Concentración: ${display(Number(p.amount.toString().replace(',','.')))} ${description} = ${result}`;
  }
  const denominator = p.type === 'vial' ? p.finalVolume : ['liquid','injection','drops'].includes(p.type) ? p.perVolume : 1;
  return `${p.type==='vial'?'Reconstitución (volumen FINAL)':'Contenido normalizado'}: ${p.amount} ${p.unit} ÷ ${denominator} ${normalized.outputUnit} = ${result}`;
}
export function calculate(input) {
  if (!['canine', 'feline'].includes(input.species)) throw new Error('Seleccione la especie.');
  if (input.regimenSpecies && input.regimenSpecies !== 'both' && input.regimenSpecies !== input.species) throw new Error('La pauta pertenece a otra especie.');
  const weight = numeric(input.weight, 'Peso');
  const p = input.presentation;
  const normalized = validatePresentation(p);
  if (input.mode === 'content') {
    if (!['topical', 'percent'].includes(p.type)) throw new Error('El modo contenido requiere una preparación tópica o porcentual.');
    const quantity = numeric(input.measuredQuantity, 'Cantidad medida');
    const active = quantity * normalized.concentration;
    if (!Number.isFinite(active) || active <= 0) throw new Error('Contenido fuera del rango numérico.');
    return {mode: 'content', active, activeUnit: normalized.unit, quantity, outputUnit: normalized.outputUnit,
      steps: [concentrationStep(p,normalized), `${display(quantity)} ${normalized.outputUnit} × ${display(normalized.concentration)} ${normalized.unit}/${normalized.outputUnit} = ${display(active)} ${normalized.unit}`], warnings: ['Contenido de principio activo en una cantidad medida. No es una dosis sistémica.']};
  }
  if (p.type === 'topical') throw new Error('Para tópicos utilice el modo contenido; no se calcula una dosis sistémica.');
  if (!DOSE_UNITS.includes(input.doseUnit)) throw new Error('Unidad de dosis no válida.');
  const dose = numeric(input.dose, 'Dosis', true);
  const doseActivity = input.doseUnit.startsWith('UI');
  if ((doseActivity ? 'activity' : 'mass') !== normalized.dimension) throw new Error('Unidades incompatibles. No se convierten UI, masa o volumen entre sí.');
  const daily = input.doseUnit.endsWith('/día');
  const byWeight = input.doseUnit.includes('/kg/');
  const hours = input.intervalHours === '' || input.intervalHours == null ? null : numeric(input.intervalHours, 'Intervalo (horas)');
  if (daily && hours === null) throw new Error('Una dosis diaria requiere un intervalo de administración válido.');
  const administrationsPerDay = hours === null ? null : 24 / hours;
  const doseToBase = input.doseUnit.startsWith('µg') ? 0.001 : 1;
  const initial = dose * doseToBase * (byWeight ? weight : 1);
  const active = daily ? initial / administrationsPerDay : initial;
  const dailyActive = daily ? initial : administrationsPerDay === null ? null : active * administrationsPerDay;
  const quantity = active / normalized.concentration;
  const duration = input.durationDays === '' || input.durationDays == null ? null : numeric(input.durationDays, 'Duración (días)');
  // Convention: first administration at t=0, end of course excluded.
  const ratio = duration !== null && hours !== null ? duration * 24 / hours : null;
  const roundedRatio = ratio !== null && Math.round(ratio) > 0 && Math.abs(ratio-Math.round(ratio)) <= Math.abs(ratio)*Number.EPSILON*4 ? Math.round(ratio) : ratio;
  const count = roundedRatio === null ? null : Math.ceil(roundedRatio);
  if (count !== null && (!Number.isSafeInteger(count) || count <= 0)) throw new Error('Número de administraciones fuera del rango numérico admitido.');
  const total = count === null ? null : quantity * count;
  const drops = p.type === 'drops' && p.dropFactor ? quantity * numeric(p.dropFactor, 'Gotas por mL') : null;
  for (const value of [active, dailyActive, quantity, count, total, drops, administrationsPerDay]) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Resultado fuera del rango numérico.');
  }
  if (dose > 0 && (active === 0 || quantity === 0)) throw new Error('Resultado inferior a la precisión numérica admitida.');
  const steps = [concentrationStep(p,normalized), `${display(dose)} ${input.doseUnit}${byWeight ? ` × ${display(weight)} kg` : ''}${doseToBase !== 1 ? ' × 0.001 mg/µg' : ''} = ${display(initial)} ${normalized.unit}${daily ? '/día' : '/administración'}`];
  if (daily) steps.push(`${display(initial)} ${normalized.unit}/día ÷ ${display(administrationsPerDay)} administraciones/día = ${display(active)} ${normalized.unit}/administración`);
  steps.push(`${display(active)} ${normalized.unit} ÷ ${display(normalized.concentration)} ${normalized.unit}/${normalized.outputUnit} = ${display(quantity)} ${normalized.outputUnit}`);
  const warnings = ['Resultado matemático. La idoneidad clínica debe evaluarla el médico veterinario.'];
  if (p.type === 'tablet' && quantity % 1 !== 0) {
    const remainder = quantity % 1;
    const supported = (p.fractions || []).some(f => Math.round(remainder / f) > 0 && Math.abs(remainder / f - Math.round(remainder / f)) <= Math.abs(remainder / f)*1e-12);
    warnings.push(supported ? 'La fracción coincide con el fraccionamiento registrado; esto no valida su uso clínico.' : 'La cantidad requiere fraccionamiento no autorizado en esta presentación. No redondear automáticamente.');
  }
  if (['capsule', 'sachet'].includes(p.type) && quantity % 1 !== 0) warnings.push('Cantidad matemática fraccionaria. No se asume que esta unidad pueda dividirse o abrirse.');
  if (drops !== null && drops % 1 !== 0) warnings.push('La equivalencia contiene gotas fraccionarias. No se redondea ni valida el dispositivo.');
  if (p.type === 'vial') warnings.push('La concentración usa el volumen FINAL, no el volumen de diluyente añadido.');
  if (count !== null) warnings.push('Total: primera administración al inicio; se excluye el instante final de la duración. Confirme el calendario real.');
  if (hours !== null && hours > 24) warnings.push('La cantidad diaria es un promedio según intervalo; no implica administración todos los días.');
  return {mode: 'dose', active, activeUnit: normalized.unit, dailyActive, quantity, outputUnit: normalized.outputUnit, total, count, drops, fraction: ['tablet','capsule','sachet'].includes(p.type) ? fraction(quantity) : null, steps, warnings};
}
