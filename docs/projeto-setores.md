# Mecânica e Auto elétrica

## Uso

O proprietário troca de setor pelo seletor na lateral ou pelo nome do setor no cabeçalho. A troca recarrega a página; salve o formulário aberto antes de trocar. Cada página fica vinculada a um setor durante toda a sua vida, inclusive com duas abas abertas simultaneamente.

As mesmas telas de O.S., clientes, veículos, compras, estoque, agenda, caixa, contas, comissões e relatórios trabalham no setor selecionado. A Auto elétrica começa vazia e possui numeração própria. Para serviços dos dois setores, use uma O.S. em cada setor; não há documento misto nesta implementação.

Em **Caixas dos setores**, o proprietário consulta os três caixas de cada setor e o consolidado. Pode registrar uma transferência ou ratear uma despesa. Transferências geram saída e entrada correspondentes, sem mudar o saldo consolidado. O rateio cria contas a pagar e preserva todos os centavos; só movimenta caixa quando essas contas forem pagas.

## Comissões

- Auto elétrica: exclusivamente Fabiano, 45% da base líquida do acerto semanal, após os custos, a reserva e a recuperação financeira configuradas naquele setor. A regra abrange peças e mão de obra e é protegida também no banco. Marcelino não recebe comissão da Auto elétrica.
- Mecânica: conserva as regras e os percentuais atuais.
- Pagar comissões gera uma saída consolidada por pessoa no caixa do setor aberto. A saída e as baixas acontecem na mesma transação. Repetir o pagamento dos mesmos registros não gera nova saída.
- Custos fixos da Auto elétrica começam em zero, para configuração explícita. Os custos e saldos da Mecânica não são copiados automaticamente.

## Isolamento

`src/sector-context.js` fixa o contexto da página, separa os caches e redireciona as operações. Sessão e identificação do dispositivo são compartilhadas; O.S., estoque, configurações, rascunhos e pendências locais são separados. A integração antiga com a planilha fica indisponível na Auto elétrica.

`supabase/setores-auto-eletrica.sql` cria novas tabelas `ae_*`, sem copiar registros. Cada tabela exige o proprietário por RLS. As rotinas operacionais são copiadas para um schema privado, com referências redirecionadas às tabelas novas; as entradas públicas de API verificam novamente o proprietário. Os demais usuários, inclusive Marcelino, não recebem dados elétricos nem por consulta direta à API. As tabelas e rotinas originais permanecem preservadas.

Backups novos identificam seu setor e não podem ser restaurados no outro. Backups antigos são reconhecidos como pertencentes à área histórica/Mecânica. Os dados anteriores permanecem na área original, sem classificação ou redistribuição automática de saldos.

## Instalação e validação

A migração é aditiva, transacional e recusa reinstalação sobre um setor já existente. Não execute novamente sobre produção; futuras mudanças precisam de migração incremental. As rotinas privadas representam as versões operacionais instaladas no momento da migração. Ao atualizar uma rotina de O.S., atualize também sua versão elétrica com revisão e testes.

Para testar antes de instalar, substitua o `commit` final pelo conteúdo de `test/sector-database.sql` seguido de `rollback`. O teste exercita persistência, textos longos, reconsulta, UPDATE da mesma O.S., status, estoque sem baixa duplicada, comissão de 45%, pagamento atômico, pagamentos de mecânicos por setor, transferências, rateio e negação de acesso a outro usuário. Compara também as impressões digitais dos registros antigos. Todos os dados de teste são revertidos.

Execute `node --test` e `node scripts/build.mjs` antes de publicar. A suíte inclui isolamento do cache, roteamento de todas as relações operacionais, tentativa de selecionar o setor por URL e regras distintas do acerto de cada setor.

## Limites explícitos

Não existe migração automática de O.S. antigas para a Auto elétrica nem divisão automática de uma O.S. entre setores. O consolidado é exclusivo do proprietário. A Mecânica mantém o histórico anterior; identificar quais lançamentos históricos pertencem à elétrica exige conferência antes de qualquer transferência contábil.
