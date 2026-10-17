import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const admin=await readFile(new URL('../src/admin.js',import.meta.url),'utf8');
const supabase=await readFile(new URL('../src/supabase.js',import.meta.url),'utf8');

test('semana encerrada transfere o saldo para contas a pagar sem movimentar o caixa',()=>{
  assert.match(admin,/expiredPartnerCommissionWeeks\(ledger,current\.start\)/);
  assert.match(admin,/await archivePartnerCommissionWeek\(job\)/);
  assert.match(supabase,/categoria:'Conta a pagar'/);
  assert.match(supabase,/status:'Pendente'/);
  assert.match(supabase,/forma_pagamento:'Transferido para contas a pagar'/);
  assert.match(admin,/type\.includes\('transferido para contas a pagar'\)\)return'Sem movimentação de caixa'/);
});

test('arquivamento semanal é idempotente e preserva dívida sincronizada com atraso',()=>{
  assert.match(supabase,/partner-week-rollover-v1-\$\{slug\}-\$\{weekStart\}/);
  assert.match(supabase,/partner-payable-week-v1-\$\{slug\}-\$\{weekStart\}/);
  assert.match(supabase,/existingPayable\.status==='Realizado'\?amount/);
});

test('semana de comissão persistida segue segunda a sábado',()=>{
  assert.match(supabase,/day===0\?1:1-day/);
});
