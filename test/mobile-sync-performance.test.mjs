import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const read=file=>readFile(new URL(`../${file}`,import.meta.url),'utf8');

test('sincronização inicial não baixa todas as fotos das O.S.',async()=>{
  const supabase=await read('src/supabase.js');
  assert.match(supabase,/const ORDER_SYNC_FIELDS=/);
  assert.doesNotMatch(supabase,/ordens_servico\?select=\*&order=numero\.asc/);
  assert.match(supabase,/export async function readOrderPhotos\(orderId\)/);
  assert.match(supabase,/photosLoaded:row\.fotos!==undefined/);
});

test('seção de consulta de fotos removida preserva fotos antigas ao salvar',async()=>{
  const[main,supabase]=await Promise.all([read('src/main.js'),read('src/supabase.js')]);
  assert.doesNotMatch(main,/Consultar fotos do veículo/);
  assert.doesNotMatch(main,/mountOrderPhotoLoader/);
  assert.match(supabase,/order\.photosLoaded===false\?current\.fotos\|\|\[\]/);
  assert.match(supabase,/item\.photosLoaded===false\?remote\?\.fotos\|\|\[\]/);
});

test('tela abre antes da sincronização completa',async()=>{
  const main=await read('src/main.js');
  assert.match(main,/shell\(\);setTimeout\(\(\)=>syncNow\(true\)/);
  assert.doesNotMatch(main,/shell\(\);await syncNow\(true\);shell\(\)/);
});
