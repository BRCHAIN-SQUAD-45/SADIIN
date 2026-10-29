# FE01 — Fase 0: Inventário do Protótipo e Contrato da API (`/api/v1`)

- **ID:** FE01
- **Camada:** Front-end (`frontend/`)
- **Responsável:** Lia
- **Versão:** `v1.1`

---

## 1. Objetivo
Analisar os arquivos exportados do protótipo oficial do Figma (CSS e bundle React) e mapear todas as telas, estados, design tokens e endpoints necessários no contrato REST `/api/v1` para atender às Histórias de Usuário (`US-01.1` a `US-06.1`).

---

## 2. Prompt Utilizado (`v1.1`)

```text
Você é um engenheiro front-end sênior (React 18.3 + TypeScript + Vite).
Analise o protótipo oficial do BRchain Portal (CSS e bundle JS exportados do Figma) e a Entrega Parcial do Squad 45.

Entregue o inventário da Fase 0 contendo:
1. Mapa completo de telas e seções (Home, Medicamentos, Doenças e sintomas, Unidades de saúde).
2. Lista dos 20 ícones SVG, design tokens (cores, tipografia DM Sans, raios, sombras e breakpoints 980px, 760px e 480px).
3. Mapeamento de todos os textos e números que estavam hardcoded no protótipo para os respectivos endpoints do contrato /api/v1 (/meta, /locations, /search, /medications, /conditions, /units, /dashboard/regional, /news, /sources).
4. Sanitização obrigatória de encoding UTF-8 para corrigir caracteres corrompidos no export do protótipo (ex.: setas "→" e bullets "•").
```

---

## 3. Histórico de Revisão
- **`v1.0`:** Extração direta das strings do bundle trouxe caracteres com dupla codificação (mojibake).
- **`v1.1`:** Adicionada regra explícita de sanitização UTF-8 (item 4).
