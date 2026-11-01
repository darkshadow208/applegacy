import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

let instance=0;
async function loadModule(name,fetch) {
  const supabase=createClient('https://legacy-test.invalid','test-public-key',{
    global:{fetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });
  let source=await readFile(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');
  source=source.replace("import { supabase } from './supabase';",'const supabase=globalThis.__legacyTestClient;');
  globalThis.__legacyTestClient=supabase;
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
  try { return await import('data:text/javascript;base64,'+Buffer.from(code+`\n// instance ${++instance}`).toString('base64')); }
  finally { delete globalThis.__legacyTestClient; }
}

test('progreso rechaza un error de permisos en vez de confirmarlo como guardado',async()=>{
  const {saveCourseProgress}=await loadModule('studyProgress',async()=>new Response(
    JSON.stringify({message:'Sin autorización',code:'42501'}),{status:403,headers:{'content-type':'application/json'}}));
  await assert.rejects(saveCourseProgress('student','course','completed'),error=>error.code==='42501');
});

test('progreso usa conflicto usuario/curso sin sobrescribir prioridad',async()=>{
  let request;
  const {saveCourseProgress}=await loadModule('studyProgress',async(url,options)=>{
    request={url:new URL(url),body:JSON.parse(options.body)};
    return new Response(JSON.stringify({status:'completed',priority:'high'}),{status:200,headers:{'content-type':'application/json'}});
  });
  assert.deepEqual(await saveCourseProgress('student','course','completed'),{status:'completed',priority:'high'});
  assert.equal(request.url.searchParams.get('on_conflict'),'user_id,course_id');
  assert.deepEqual(request.body,{user_id:'student',course_id:'course',status:'completed'});
});

test('comprobantes históricos se convierten en enlaces temporales; no se abren URLs externas',async()=>{
  const requests=[];
  const {receiptPath,signedReceiptUrl}=await loadModule('receipts',async(url)=>{
    requests.push(String(url));
    return new Response(JSON.stringify({signedURL:'/object/sign/payment_receipts/receipt.png?token=test'}),
      {status:200,headers:{'content-type':'application/json'}});
  });
  const old='https://legacy-test.invalid/storage/v1/object/public/payment_receipts/receipt.png';
  assert.equal(receiptPath(old),'receipt.png');
  const signed=await signedReceiptUrl(old);
  assert.match(signed,/object\/sign\/payment_receipts/);
  assert.match(requests[0],/object\/sign\/payment_receipts\/receipt.png/);
  assert.throws(()=>receiptPath('https://other.invalid/receipt.png'),/no pertenece/);
  assert.throws(()=>receiptPath('../receipt.png'),/Ruta de comprobante/);
});
