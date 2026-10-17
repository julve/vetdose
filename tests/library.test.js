import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, validateLibrary, parseLibrary, mergeLibraries, loadLibrary, saveLibrary, exportLibrary, STORAGE_KEY } from '../src/library.js';
import { syntheticLibrary } from './fixtures.js';

test('exportar e importar conserva medicamento, pauta y presentación',()=>{const l=validateLibrary(syntheticLibrary());assert.deepEqual(parseLibrary(exportLibrary(l)),l);});
test('guardar y recuperar almacenamiento local',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  assert.deepEqual(loadLibrary(storage),emptyLibrary());saveLibrary(storage,syntheticLibrary());assert.deepEqual(loadLibrary(storage),validateLibrary(syntheticLibrary()));assert.equal(map.size,1);assert.ok(map.has(STORAGE_KEY));
});
test('fallo de cuota se propaga sin modificar biblioteca en memoria',()=>{const l=syntheticLibrary(),before=JSON.stringify(l);assert.throws(()=>saveLibrary({setItem:()=>{throw Error('QuotaExceededError');}},l),/Quota/);assert.equal(JSON.stringify(l),before);});
test('datos corruptos no se sustituyen silenciosamente por biblioteca vacía',()=>{assert.throws(()=>loadLibrary({getItem:()=>'{broken'}),/importar/);});
test('fusión idempotente omite copia idéntica',()=>{const l=syntheticLibrary();assert.equal(mergeLibraries(l,l).drugs.length,1);});
test('fusión incorpora otro medicamento sin mutar los originales',()=>{
  const l=syntheticLibrary(),incoming=syntheticLibrary();incoming.drugs[0].id='new';incoming.drugs[0].name='Otro producto ficticio';incoming.drugs[0].regimens[0].id='r-new';incoming.drugs[0].presentations[0].id='p-new';
  assert.equal(mergeLibraries(l,incoming).drugs.length,2);assert.equal(l.drugs.length,1);
});
test('mismo identificador con cambios bloquea sobrescritura',()=>{const l=syntheticLibrary(),r=syntheticLibrary();r.drugs[0].regimens[0].dose=8;assert.throws(()=>mergeLibraries(l,r),/Conflicto/);});
test('mismo nombre y activo con otro ID se considera posible duplicado',()=>{const l=syntheticLibrary(),r=syntheticLibrary();r.drugs[0].id='other';assert.throws(()=>mergeLibraries(l,r),/duplicado/);});
test('dosis en intervalo no se sustituye por un punto medio',()=>{const l=syntheticLibrary();Object.assign(l.drugs[0].regimens[0],{dose:null,min:2,max:8});const r=validateLibrary(l);assert.equal(r.drugs[0].regimens[0].dose,null);});
const invalid = [
  ['versión',l=>l.schemaVersion=2],['asociación ausente',l=>delete l.drugs[0].regimens],['ID repetido',l=>l.drugs[0].presentations[0].id=l.drugs[0].id],['ID vacío',l=>l.drugs[0].id=''],['nombre vacío',l=>l.drugs[0].name=' '],['especie inválida',l=>l.drugs[0].regimens[0].species='bird'],['unidad de dosis',l=>l.drugs[0].regimens[0].doseUnit='mg/h'],['dosis negativa',l=>l.drugs[0].regimens[0].dose=-1],['rango incompleto',l=>l.drugs[0].regimens[0].min=1],['rango invertido',l=>Object.assign(l.drugs[0].regimens[0],{min:9,max:2})],['dosis fuera de rango',l=>Object.assign(l.drugs[0].regimens[0],{min:1,max:2})],['pauta vacía',l=>l.drugs[0].regimens[0].dose=null],['pauta diaria sin frecuencia',l=>Object.assign(l.drugs[0].regimens[0],{doseUnit:'mg/kg/día',intervalHours:null})],['concentración inválida',l=>l.drugs[0].presentations[0].amount=0],['unidad de contenido',l=>l.drugs[0].presentations[0].unit='gallon'],['volumen inválido',l=>l.drugs[0].presentations[0].perVolume=-1]
];
for (const [name,mutate] of invalid) test(`importación rechaza ${name}`,()=>{const l=syntheticLibrary();mutate(l);assert.throws(()=>parseLibrary(JSON.stringify(l)));});
test('JSON inválido y raíz equivocada se rechazan',()=>{for(const raw of ['null','[]','{}','bad','{"schemaVersion":1,"drugs":{}}']) assert.throws(()=>parseLibrary(raw));});
test('importación limitada a 5 MB',()=>assert.throws(()=>parseLibrary(' '.repeat(5*1024*1024+1)),/5 MB/));
test('campos no reconocidos y datos del paciente no entran en la biblioteca',()=>{
  const l=syntheticLibrary();l.patient='No persistir';l.drugs[0].patient='Tampoco';assert.ok(!exportLibrary(l).includes('patient'));
});
test('texto importado se conserva como datos, sin ejecución',()=>{const l=syntheticLibrary();l.drugs[0].notes='<script>throw Error("unsafe")</script>';assert.equal(parseLibrary(exportLibrary(l)).drugs[0].notes,l.drugs[0].notes);});
test('validar no muta objeto ni permite referencias compartidas',()=>{const l=syntheticLibrary(),r=validateLibrary(l);r.drugs[0].presentations[0].fractions.push(.5);assert.deepEqual(l.drugs[0].presentations[0].fractions,[]);});
test('fechas inexistentes se rechazan',()=>{const l=syntheticLibrary();l.drugs[0].reviewDate='2026-02-30';assert.throws(()=>validateLibrary(l),/Fecha/);});
test('reemplazo también rechaza nombres y activos duplicados',()=>{const l=syntheticLibrary();l.drugs.push({...l.drugs[0],id:'new-drug',regimens:[],presentations:[]});assert.throws(()=>validateLibrary(l),/duplicados/);});
