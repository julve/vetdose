import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, numeric, display, fraction, validatePresentation } from '../src/core.js';

const base = () => ({species:'canine',weight:4,dose:6,doseUnit:'mg/kg/dosis',intervalHours:8,durationDays:2,presentation:{type:'liquid',amount:12,unit:'mg',perVolume:1}});
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<=Math.max(Math.abs(expected)*1e-12,1e-14),`${actual} != ${expected}`);
test('mg/kg/dosis: 4 × 6 = 24 mg; 24/12 = 2 mL, seis administraciones',()=>{
  const r=calculate(base());assert.equal(r.active,24);assert.equal(r.quantity,2);assert.equal(r.dailyActive,72);assert.equal(r.count,6);assert.equal(r.total,12);
});
test('mg/kg/día: 3 × 24 = 72 mg/día; cada 8 h: 24 mg por administración',()=>{
  const r=calculate({...base(),weight:3,dose:24,doseUnit:'mg/kg/día'});assert.equal(r.dailyActive,72);assert.equal(r.active,24);assert.equal(r.quantity,2);
});
test('µg/kg/dosis convierte a mg sin cambiar la dimensión',()=>{
  const r=calculate({...base(),weight:2,dose:250,doseUnit:'µg/kg/dosis',presentation:{type:'liquid',amount:0.2,unit:'mg',perVolume:1}});assert.equal(r.active,.5);assert.equal(r.quantity,2.5);
});
test('µg/kg/día y concentración µg/mL',()=>{
  const r=calculate({...base(),weight:2,dose:900,doseUnit:'µg/kg/día',presentation:{type:'liquid',amount:300,unit:'µg',perVolume:1}});close(r.active,.6);close(r.quantity,2);
});
test('mg/dosis ignora el peso en el multiplicador',()=>{assert.equal(calculate({...base(),dose:30,doseUnit:'mg/dosis'}).quantity,2.5);});
test('µg/dosis: 3000 µg = 3 mg',()=>{assert.equal(calculate({...base(),dose:3000,doseUnit:'µg/dosis'}).quantity,.25);});
test('mg/5 mL: 40 mg/5 mL = 8 mg/mL',()=>{assert.equal(calculate({...base(),dose:32,doseUnit:'mg/dosis',presentation:{type:'liquid',amount:40,unit:'mg',perVolume:5}}).quantity,4);});
test('mg/10 mL y volumen de referencia arbitrario',()=>{
  for(const volume of [10,7]) assert.equal(calculate({...base(),dose:40,doseUnit:'mg/dosis',presentation:{type:'liquid',amount:40,unit:'mg',perVolume:volume}}).quantity,volume);
});
for (const [type,unit] of [['tablet','tabletas'],['capsule','cápsulas'],['sachet','sobres'],['powder','g']]) {
  test(`${type}: 24/16 = 1.5 ${unit}`,()=>{
    const r=calculate({...base(),presentation:{type,amount:16,unit:'mg'}});assert.equal(r.quantity,1.5);assert.equal(r.outputUnit,unit);
  });
}
test('microgramos por tableta',()=>{assert.equal(calculate({...base(),dose:1000,doseUnit:'µg/dosis',presentation:{type:'tablet',amount:500,unit:'µg'}}).quantity,2);});
test('fracciones no se autorizan automáticamente',()=>{
  const p={type:'tablet',amount:16,unit:'mg'};
  assert.match(calculate({...base(),presentation:p}).warnings.join(' '),/no autorizado/);
  assert.match(calculate({...base(),presentation:{...p,fractions:[.5]}}).warnings.join(' '),/coincide/);
});
test('cápsulas y sobres no se asumen divisibles',()=>{
  for(const type of ['capsule','sachet']) assert.match(calculate({...base(),presentation:{type,amount:16,unit:'mg'}}).warnings.join(' '),/No se asume/);
});
test('vial: usa 12 mL finales, no 10 mL de diluyente',()=>{
  const r=calculate({...base(),dose:60,doseUnit:'mg/dosis',presentation:{type:'vial',amount:240,unit:'mg',finalVolume:12,diluentVolume:10}});assert.equal(r.quantity,3);assert.match(r.steps[0],/240 mg ÷ 12 mL = 20 mg\/mL/);
});
test('porcentaje p/v: 1.2 g/100 mL = 12 mg/mL',()=>{assert.equal(calculate({...base(),dose:60,doseUnit:'mg/dosis',presentation:{type:'percent',amount:1.2,percentKind:'pv'}}).quantity,5);});
test('porcentaje p/p: 2 g/100 g = 20 mg/g',()=>{
  const r=calculate({...base(),dose:60,doseUnit:'mg/dosis',presentation:{type:'percent',amount:2,percentKind:'pp'}});assert.equal(r.quantity,3);assert.equal(r.outputUnit,'g');
});
test('porcentaje v/v solo contenido: 20% de 3 mL = 0.6 mL',()=>{
  const r=calculate({...base(),mode:'content',measuredQuantity:3,presentation:{type:'percent',amount:20,percentKind:'vv'}});close(r.active,.6);assert.equal(r.activeUnit,'mL');
});
test('tópico: 3 g × 2 mg/g = 6 mg de contenido',()=>{
  const r=calculate({...base(),mode:'content',measuredQuantity:3,presentation:{type:'topical',amount:2,unit:'mg'}});assert.equal(r.active,6);assert.match(r.warnings[0],/No es una dosis sistémica/);
});
test('contenido porcentual p/p',()=>{assert.equal(calculate({...base(),mode:'content',measuredQuantity:3,presentation:{type:'percent',amount:2,percentKind:'pp'}}).active,60);});
test('UI/kg/dosis y UI/dosis conservan unidades de actividad',()=>{
  const presentation={type:'injection',amount:22,unit:'UI',perVolume:1};
  const r=calculate({...base(),dose:11,doseUnit:'UI/kg/dosis',presentation});assert.equal(r.active,44);assert.equal(r.quantity,2);assert.equal(r.activeUnit,'UI');
  assert.equal(calculate({...base(),dose:44,doseUnit:'UI/dosis',presentation}).quantity,2);
});
test('vial de UI',()=>{assert.equal(calculate({...base(),dose:40,doseUnit:'UI/dosis',presentation:{type:'vial',amount:200,unit:'UI',finalVolume:10}}).quantity,2);});
test('gotas requieren factor explícito y no se redondean',()=>{
  const presentation={type:'drops',amount:12,unit:'mg',perVolume:1};
  assert.equal(calculate({...base(),presentation}).drops,null);
  assert.equal(calculate({...base(),presentation:{...presentation,dropFactor:17.3}}).drops,34.6);
});
test('números decimales con punto y coma',()=>{
  close(calculate({...base(),weight:'2,5',dose:'1.2',presentation:{type:'liquid',amount:'0,6',unit:'mg',perVolume:'1'}}).quantity,5);
});
test('frecuencia opcional para dosis por administración',()=>{const r=calculate({...base(),intervalHours:''});assert.equal(r.dailyActive,null);assert.equal(r.total,null);});
test('duración no divisible: 1 día cada 10 h = tres administraciones, inicio incluido',()=>{const r=calculate({...base(),intervalHours:10,durationDays:1});assert.equal(r.count,3);assert.equal(r.total,6);});
test('intervalos >24 h muestran promedio diario',()=>{const r=calculate({...base(),intervalHours:48,durationDays:3});assert.equal(r.count,2);assert.equal(r.dailyActive,12);assert.match(r.warnings.join(' '),/promedio/);});
test('duración mínima positiva incluye administración inicial',()=>{assert.equal(calculate({...base(),durationDays:1e-20}).count,1);});
test('cero es dosis explícita válida; no se convierte en valor faltante',()=>{assert.equal(calculate({...base(),dose:0}).quantity,0);});
test('volumen diminuto conserva significación y no muestra fracción cero',()=>{
  const r=calculate({...base(),dose:1e-12,doseUnit:'mg/dosis',presentation:{type:'tablet',amount:1,unit:'mg'}});assert.notEqual(display(r.quantity),'0');assert.equal(r.fraction,null);
});
test('fracciones legibles exactas',()=>{assert.equal(fraction(.5),'1/2');assert.equal(fraction(1.5),'3/2');assert.equal(fraction(1/3),'1/3');assert.equal(fraction(.123),null);});
const badCases = [
  ['peso cero',{weight:0}],['peso negativo',{weight:-1}],['peso vacío',{weight:''}],['peso infinito',{weight:Infinity}],['dosis negativa',{dose:-1}],['dosis vacía',{dose:''}],['dosis NaN',{dose:NaN}],['frecuencia cero',{intervalHours:0}],['frecuencia negativa',{intervalHours:-8}],['duración cero',{durationDays:0}],['especie desconocida',{species:'bird'}],['pauta de otra especie',{regimenSpecies:'feline'}],['unidad desconocida',{doseUnit:'mg/h'}],['dosis diaria sin frecuencia',{doseUnit:'mg/kg/día',intervalHours:''}],
  ['concentración cero',{presentation:{type:'liquid',amount:0,unit:'mg',perVolume:1}}],['volumen cero',{presentation:{type:'liquid',amount:12,unit:'mg',perVolume:0}}],['volumen omitido',{presentation:{type:'liquid',amount:12,unit:'mg'}}],['vial sin volumen final',{presentation:{type:'vial',amount:12,unit:'mg',diluentVolume:1}}],
  ['UI a masa',{doseUnit:'UI/dosis'}],['masa a UI',{presentation:{type:'injection',amount:12,unit:'UI',perVolume:1}}],['v/v a masa',{presentation:{type:'percent',amount:20,percentKind:'vv'}}],['tópico sistémico',{presentation:{type:'topical',amount:2,unit:'mg'}}],['porcentaje sin tipo',{presentation:{type:'percent',amount:1}}],['porcentaje >100',{presentation:{type:'percent',amount:101,percentKind:'pv'}}],['porcentaje cero',{presentation:{type:'percent',amount:0,percentKind:'pp'}}],['UI en tableta',{presentation:{type:'tablet',amount:2,unit:'UI'}}],['presentación futura',{presentation:{type:'patch',amount:1,unit:'mg'}}],['fracciones inválidas',{presentation:{type:'tablet',amount:12,unit:'mg',fractions:[.7]}}],['factor gotas cero',{presentation:{type:'drops',amount:12,unit:'mg',perVolume:1,dropFactor:0}}],['overflow',{weight:Number.MAX_VALUE,dose:12}],['underflow',{weight:Number.MIN_VALUE,dose:Number.MIN_VALUE}],['objeto como número',{weight:{}}],['booleano como número',{dose:true}],['cadena hexadecimal',{dose:'0x10'}],['separadores ambiguos',{dose:'1,000.2'}]
];
for(const [label,change] of badCases) test(`bloquea ${label}`,()=>assert.throws(()=>calculate({...base(),...change})));
test('normalización informa concentración y dimensiones',()=>{assert.deepEqual(validatePresentation({type:'liquid',amount:500,unit:'µg',perVolume:5}),{concentration:.1,dimension:'mass',unit:'mg',outputUnit:'mL'});});
test('parser numérico rechaza texto ejecutable y espacios internos',()=>{for(const v of ['1+1','alert(1)','2 5',null,[],undefined]) assert.throws(()=>numeric(v,'valor'));});
test('subdesbordamiento de texto no se interpreta como dosis cero',()=>assert.throws(()=>numeric('1e-400','Dosis',true),/precisión/));
test('no autoriza una fracción diminuta como cero fracciones',()=>assert.match(calculate({...base(),dose:1e-12,doseUnit:'mg/dosis',presentation:{type:'tablet',amount:1,unit:'mg',fractions:[.5]}}).warnings.join(' '),/no autorizado/));
test('bloquea cantidades de administraciones que no son enteros seguros',()=>assert.throws(()=>calculate({...base(),durationDays:1e20}),/rango/));
