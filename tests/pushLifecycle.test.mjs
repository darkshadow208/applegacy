import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../src/lib/pushLifecycle.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
const { PushLifecycle,nextNotificationId }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('callback de registro anterior no vuelve a asociar una cuenta cerrada',async()=>{
  const saved=[];const lifecycle=new PushLifecycle(async token=>{saved.push(token);},async()=>{});
  const old=lifecycle.start('A');lifecycle.stop();lifecycle.start('B');
  await lifecycle.bind(old,'token-A','native');
  assert.deepEqual(saved,[]);
});
test('cerrar durante un registro pendiente lo desvincula antes de terminar',async()=>{
  let release;let entered;const started=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});const removed=[];
  const lifecycle=new PushLifecycle(async()=>{entered();await gate;},async token=>{removed.push(token);});
  const generation=lifecycle.start('A');const saving=lifecycle.bind(generation,'phone','native');
  await started;const leaving=lifecycle.unlink();release();await Promise.all([saving,leaving]);
  assert.ok(removed.includes('phone'));
  assert.equal(lifecycle.isCurrent(generation),false);
});
test('fallo de desvinculación se propaga y permite reintentar',async()=>{
  let fail=true;let removed=0;
  const lifecycle=new PushLifecycle(async()=>{},async()=>{if(fail)throw Error('offline');removed++;});
  const generation=lifecycle.start('A');await lifecycle.bind(generation,'phone','web');
  await assert.rejects(lifecycle.unlink(),/offline/);fail=false;await lifecycle.unlink();assert.equal(removed,1);
});
test('ids de avisos inmediatos son int32 positivos, fuera del rango de recordatorios y distintos',()=>{
  const ids=Array.from({length:1000},()=>nextNotificationId());
  assert.ok(ids.every(id=>Number.isInteger(id)&&id>=3000&&id<=2147483647));
  assert.equal(new Set(ids).size,ids.length);
});
