# Separação Mecânica / Auto elétrica

## Regras aprovadas

- Proprietário responsável pelos dois setores e único com visão consolidada.
- Caixas independentes por setor e conta de recebimento.
- Marcelino não acessa dados, totais, comissões, arquivos nem relatórios da Auto elétrica.
- Auto elétrica: Fabiano recebe 45% da base líquida do acerto semanal; Marcelino recebe zero.
- Mecânica mantém percentuais atuais.
- Pagamento de mecânicos consolida por beneficiário **e setor**, com baixa atômica das comissões e saída no caixa respectivo.
- O.S. mista: itens explicitamente classificados e único PDF do cliente. A visão da Mecânica não pode conter o total da Auto elétrica.
- Registros históricos continuam sem classificação. Nenhum rateio ou transferência automática de saldos antigos.
- Despesas compartilhadas terão rateio explícito, preservando centavos.

## Implementação inicial

`src/business-sectors.js` contém regras independentes para classificação, divisão dos valores de O.S. mista, rateio em centavos, comissão exclusiva de Fabiano, consolidação de pagamento por setor e cálculo de saldos separados. Os testes cobrem essas regras.

Este módulo ainda não está conectado à aplicação publicada. Não altera os saldos existentes.

## Pendências obrigatórias antes de ativar

1. Criar armazenamento normalizado para projeções setoriais das O.S. mistas, seus itens e lançamentos, sem expor o documento integral a Marcelino.
2. Aplicar restrições SELECT/INSERT/UPDATE em todas as tabelas envolvidas, inclusive agenda, estoque e compras; auditar rotinas SECURITY DEFINER.
3. Separar dados sensíveis atualmente guardados em JSON na tabela sincronizacao. Uma política somente em ordens_servico não impede vazamento por configurações, histórico ou relatórios.
4. Implementar gravação atômica de pagamentos, recebimentos mistos, transferências e estornos por setor. A função atual payCommissions gera uma saída única com os_id nulo e não identifica setor.
5. Incorporar setor na criação, edição, sincronização, cache por usuário, PDF e filtros. Remover do cache de Marcelino qualquer conteúdo elétrico anterior após confirmação da persistência remota.
6. Conectar o acerto semanal ao cálculo de 45% da Auto elétrica e proteger essa regra também no banco, sem aceitar comissão de Marcelino enviada pelo cliente.
7. Incorporar seleção de setor nos caixas, contas e despesas compartilhadas. Totais do usuário devem ser calculados somente com seus setores autorizados.
8. Validar por usuários reais de teste: Marcelino, proprietário e operacional; testar API direta, O.S. mista, PDF, baixa por setor, estorno, duplicidade e concorrência.
9. Somente após validação, publicar e ativar a seleção dos novos setores.

## Compatibilidade

Não inferir setor pelo nome do mecânico, fornecedor ou descrição. A mesma pessoa pode trabalhar nos dois setores. Não marcar toda a base antiga como Mecânica, nem transformar o saldo atual em saldo inicial dos novos caixas sem classificação conferida.
