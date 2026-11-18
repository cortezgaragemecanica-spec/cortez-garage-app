import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

test('Cortez fica visível na equipe e mantém a agenda externa exclusiva',async()=>{
  const [privacy,supabase,agenda,enhancements,budget,main,history,pdf,admin,sql]=await Promise.all([
    '../src/mechanic-privacy.js','../src/supabase.js','../src/agenda.js','../src/agenda-enhancements.js',
    '../src/budget-order.js','../src/main.js','../src/client-history.js','../src/pdf-order-sections.js',
    '../src/admin.js','../supabase/agenda-cortez-privada.sql'
  ].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
  assert.match(privacy,/PRIVATE_AGENDA_LABEL='Cortez Atendimento Externo'/);
  assert.match(privacy,/PRIVATE_MECHANIC_MASK='\*\*'/);
  assert.match(privacy,/selectableMechanics=names=>/);
  assert.match(supabase,/DEFAULT_INACTIVE_MECHANICS=new Set\(\)/);
  assert.match(supabase,/active:isPrivateMechanic\(name\)\|\|/);
  assert.match(agenda,/agendaDisplayName\(mechanic\)/);
  assert.match(agenda,/Exclusiva do proprietário/);
  assert.doesNotMatch(enhancements,/filter\(name=>name\.trim\(\)\.toLowerCase\(\)!=='cortez'\)/);
  for(const source of[budget,main,history,pdf])assert.match(source,/mechanicDisplayName/);
  assert.doesNotMatch(admin,/financeOwner\(\)\|\|!isPrivateMechanic/);
  assert.match(admin,/Mecânico da equipe/);
  assert.match(sql,/jsonb_build_object\('active', true\)/);
  assert.match(sql,/or lower\(trim\(coalesce\(mecanico, ''\)\)\) <> 'cortez'/);
});

test('nome Cortez e opção de mecânico aparecem para toda a equipe',async()=>{
  const{agendaDisplayName,mechanicDisplayName,selectableMechanics}=await import('../src/mechanic-privacy.js');
  const owner='cortezgaragemecanica@gmail.com',team='mecanico@exemplo.com',names=['Gustavo','Cortez','Fabio'];
  assert.equal(mechanicDisplayName('Cortez',owner),'Cortez');
  assert.equal(mechanicDisplayName('Cortez',team),'Cortez');
  assert.deepEqual(selectableMechanics(names,owner),names);
  assert.deepEqual(selectableMechanics(names,team),names);
  assert.equal(agendaDisplayName('Cortez'),'Cortez Atendimento Externo');
});
