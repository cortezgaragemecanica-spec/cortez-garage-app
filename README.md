# Cortez Garage

## Android

O APK é gerado automaticamente pelo GitHub e publicado na seção **Releases** com o nome `Cortez-Garage-Android.apk`. Ele abre o mesmo aplicativo online, mantém os dados locais do aparelho e usa a integração segura com a planilha.

Aplicativo instalável para gestão de oficina mecânica e auto elétrica. A interface responsiva usa a identidade oficial Cortez Garage, funciona offline e mantém clientes, veículos, checklists e ordens de serviço no próprio dispositivo.

## Funcionalidades

- Dashboard com indicadores, logo oficial e ordens recentes.
- Entrada guiada em cinco etapas: cliente, veículo, informações, checklist/fotos e revisão.
- Captura de fotos pela câmera ou galeria, assinatura na tela e impressão/PDF da OS.
- Cadastro sem duplicidade por telefone e placa.
- Gestão de status, diagnóstico, serviços, peças, valores, pagamento e responsável.
- Persistência em `localStorage`, instalação como PWA e operação offline.

## Executar localmente

Requer Node.js 18 ou superior e não possui dependências externas.

```bash
npm run dev
```

Acesse <http://localhost:4173/cortez-garage-app/>. Câmera e instalação PWA exigem HTTPS ou `localhost`.

## Build, preview e validação

```bash
npm test
node --check src/main.js
node --check public/sw.js
npm run build
npm run preview
```

O build é criado em `dist/`. O preview fica em <http://localhost:4173/cortez-garage-app/> e simula o prefixo de produção.

## Publicar no GitHub Pages

O projeto está preparado para `https://<usuario>.github.io/cortez-garage-app/`: HTML e manifest usam caminhos relativos, enquanto o service worker calcula seu próprio escopo. Não é necessário editar caminhos ao publicar.

1. Envie o repositório ao GitHub.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Execute **Publicar no GitHub Pages** em **Actions**, ou envie um commit para `main`/`work`.
4. O workflow `.github/workflows/pages.yml` testa, compila e publica `dist/`.

Se o branch padrão tiver outro nome, ajuste a lista `branches` no workflow.

## Marca e PWA

- Logo oficial completa: `public/official-logo.png`.
- Ícones instaláveis derivados da logo oficial: `public/icons/icon-192.png` e `public/icons/icon-512.png`.
- Configuração: `public/manifest.webmanifest`.
- Cache offline: `public/sw.js`.

Ao atualizar arquivos essenciais, altere a constante `CACHE` do service worker para forçar a renovação do cache instalado.

## Dados locais

Os dados são gravados na chave versionável `cortez-garage-v1`. Cada entidade recebe UUID local; clientes são conciliados pelo telefone e veículos pela placa. Para limpar os dados, remova essa chave no armazenamento local das ferramentas do navegador.

## Sincronização com Google Sheets

O aplicativo mantém o funcionamento offline e pode sincronizar, sem duplicar registros, com a planilha **Cortez Garage - Gestão da Oficina**. Clientes são conciliados pelo telefone, veículos pela placa e ordens pelo número.

1. Crie um projeto no Google Apps Script e cole `google-apps-script/Code.gs`.
2. Nas propriedades do script, crie `CORTEZ_API_TOKEN` com uma chave longa e exclusiva.
3. Implante como aplicativo da Web, executando como o proprietário e liberando o acesso para qualquer pessoa que possua o endereço. A chave continua obrigatória para ler ou gravar dados.
4. No cartão **Planilha** do aplicativo, informe o endereço da implantação e a chave. Essas informações ficam somente no dispositivo e não são incluídas no repositório.

A sincronização preserva os dados locais completos (fotos, assinatura e checklist) e envia à planilha os campos compatíveis das abas Clientes, Veículos e Ordens de Serviço.

