# SADIIN — BRchain Portal (Squad 45)

## Sobre o Projeto

O **SADIIN (BRchain Portal)** é um portal web de saúde pública que integra informações oficiais do **SUS / DATASUS** (CNES, e-SUS APS, OpenDataSUS) e do padrão **HL7 FHIR R4 (RNDS)**. O objetivo é facilitar o acesso de cidadãos e gestores a consultas de medicamentos, doenças e sintomas, localização de Unidades Básicas de Saúde (UBS) próximas e indicadores regionais de saúde.

---

## Como Rodar o Projeto (Front-end)

### Pré-requisitos
- **Node.js** (versão 20 ou superior)
- **npm**

### Passo a passo

1. Entre na pasta do front-end:
   ```bash
   cd frontend
   ```

2. Crie o arquivo de variáveis de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```

4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

5. Acesse no navegador o endereço exibido no terminal (por padrão `http://localhost:5173`).

> Por padrão, o front-end roda com `VITE_DATA_MODE=mock`, simulando os dados da API localmente enquanto o back-end está em desenvolvimento.

### Outros comandos úteis (dentro de `frontend/`)
- `npm test` — executa os testes automatizados
- `npm run build` — gera a versão de produção

---

## Equipe — Squad 45

- **Tech Lead:** Lia / Yasmin
- **Front-end:** Lia
- **Back-end:** Lucas, Marina, Áquila e Bruno
- **Responsável por IA:** Yasmin
- **QA e Documentação:** Nícolas
