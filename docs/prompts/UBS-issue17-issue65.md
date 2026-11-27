# Prompt — Issues #17 e #65: mapa e filtro de UBS

- **Data:** 27/11/2026
- **Versão:** v1.0
- **Issues:** #17 e #65

## Prompts utilizados com resultado positivo

Os trechos abaixo foram registrados a partir da conversa de desenvolvimento. As confirmações são de testes manuais relatados, não de uma suíte completa de testes.

### Mapa interativo

> acho que pode tirar essa parte do cep, que o mapa possa ser usado com a rodinha do mouse

Resultado: retirada da pesquisa por CEP e endereço, zoom pelo mouse e manutenção do marcador arrastável, confirmação manual e rotas. A usuária confirmou que essa versão estava funcionando.

### Preservação da página original

> vamos fazer o seguinte, mantenha todas as alterações que tenha a ver com o mapa mas essa parte de unidades de saúde que está dando problema pode manter a original (aquela que eu mandei no primeiro zip)

Resultado: restauração da página original com preservação das melhorias do mapa e das rotas.

### Issue #65 — filtro e redirecionamento

Solicitação enviada por imagem da issue (síntese, não transcrição literal): corrigir filtro por estado/município e redirecionamento da aba UBS, com cache por city_ibge no PostgreSQL e remoção do fallback fictício no modo API.

Resultado: a usuária relatou que a versão funcionou. A persistência real, a atualização mensal e os testes completos ainda precisam de validação com o responsável pelo banco.

### Serviços e estrutura (complemento)

Solicitação confirmada na conversa: melhorar serviços, filtros, equipe, estrutura e contato, preservando o restante do projeto. A implementação foi entregue; não há confirmação explícita de todos os testes dessa seção.
