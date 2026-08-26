# Cortez Garage

Primeira versão funcional e instalável do sistema de gestão para oficina mecânica e auto elétrica. A aplicação é responsiva, funciona offline e mantém clientes, veículos, checklists e ordens de serviço no próprio dispositivo.

## Funcionalidades

- Dashboard com indicadores e ordens recentes.
- Entrada guiada em cinco etapas: cliente, veículo, informações da entrada, checklist/fotos e revisão.
- Captura de fotos pela câmera ou galeria do celular.
- Cadastro sem duplicidade por telefone (cliente) e placa (veículo).
- Gestão da OS: status, diagnóstico, serviços, peças, valores, desconto, pagamento e responsável.
- Assinatura do cliente diretamente na tela.
- Impressão da OS / geração de PDF pelo diálogo do navegador.
- Persistência local (`localStorage`), PWA instalável e operação offline.

> **Logo:** o ícone em `public/icons/icon.svg` é provisório. Ao receber a logo oficial, substitua o arquivo pelo ativo fornecido, sem alterar o desenho. A interface já referencia esse caminho em todos os pontos.

## Executar

Requer Node.js 18 ou superior. O projeto não possui dependências externas.

```bash
npm run dev
```

Acesse <http://localhost:4173>. Para testar no celular, use o IP da máquina na mesma rede. Câmera e instalação PWA exigem HTTPS (ou `localhost`).

## Build e preview

```bash
npm run build
npm run preview
```

Os arquivos de produção serão criados em `dist/`.

## Testes e validação

```bash
npm test
node --check src/main.js
npm run build
```

## Dados e futura integração Google Sheets

Os dados são gravados sob uma única chave versionável (`cortez-garage-v1`). Cada entidade recebe um UUID local; clientes são conciliados pelo telefone e veículos pela placa. Esses identificadores e chaves naturais permitem implementar uma camada de sincronização com Google Sheets posteriormente, usando *upsert* em vez de inserções cegas, evitando duplicidade.

Para limpar os dados de demonstração/uso, remova a chave `cortez-garage-v1` no armazenamento local das ferramentas do navegador.
