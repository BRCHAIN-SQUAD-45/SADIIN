# Issue #17 — US-04.1 Mapa interativo de UBS

## Implementação

- O mapa Leaflet já existente recebe as unidades retornadas pela API e usa latitude/longitude do CNES.
- As coordenadas de cada estabelecimento são persistidas em `ubs_geolocalizacao`, identificadas pelo CNES.
- A gravação usa `INSERT ... ON CONFLICT (cnes) DO UPDATE`, evitando duplicatas.
- Coordenadas fora dos limites geográficos são rejeitadas pelo banco.
- A atualização mensal é executada pelo script `backend/scripts/atualizar_geolocalizacao_ubs.py`.
- O script atualiza os municípios já registrados no cache municipal, consulta novamente CNES/IBGE e atualiza as coordenadas recebidas. Dados antigos não são apagados quando a fonte não fornece uma coordenada nova.

## Banco de dados

Aplicar a migration `backend/app/database/migrations/002_ubs_geolocalizacao.sql` no PostgreSQL. A aplicação também cria a tabela automaticamente ao persistir o cache de unidades.

## Agendamento mensal

Na raiz do projeto, com ambiente Python do backend ativado:

```bash
cd backend
python -m scripts.atualizar_geolocalizacao_ubs
```

Exemplo de cron para executar às 03:00 no primeiro dia de cada mês:

```cron
0 3 1 * * cd /caminho/SADIIN-main/backend && .venv/bin/python -m scripts.atualizar_geolocalizacao_ubs
```

Configure `DATABASE_URL` no ambiente do processo agendado. O agendamento precisa ser cadastrado no servidor/host de implantação; o repositório inclui o script pronto, mas não consegue instalar o cron no servidor por conta própria.

## Limites conhecidos

- Só são atualizados automaticamente os municípios que já foram consultados e registrados em `ubs_cache_municipio`.
- A disponibilidade e a qualidade das coordenadas dependem dos dados publicados pelo CNES.
- O mapa não inventa coordenadas: unidades sem latitude/longitude válidas não viram pinos.


## Correção do centro/localização padrão (26/11/2026)

- O padrão inicial do projeto estava fixado em São Paulo (IBGE `3550308`), independentemente da cidade selecionada pelo usuário.
- O padrão foi alinhado para Brasília/DF (IBGE `5300108`), configurável por `VITE_DEFAULT_CITY_IBGE` no frontend e `SADIIN_DEFAULT_CITY_IBGE` no backend.
- A chave de armazenamento local foi versionada para `brchain.location.v2`, evitando reutilizar a seleção antiga gravada no navegador.
- O marcador "Você está aqui" agora só aparece quando a localização foi obtida pelo botão de GPS; coordenadas padrão ou de cidade não são apresentadas como GPS.
- Para usar outra cidade como padrão, altere os códigos IBGE nas variáveis de ambiente. O usuário também pode escolher a cidade no seletor da aplicação.


## Correção dos marcadores fixos (27/11/2026)

- Removida a camada duplicada de marcadores HTML posicionados por percentuais (`top`, `left`, `right`, `bottom`), que ficava presa à tela durante o arraste/zoom.
- Mantidos somente os marcadores Leaflet, cada um ancorado às coordenadas `[latitude, longitude]` da UBS.
- Removidos os estilos CSS obsoletos dos marcadores ilustrativos fixos.
- O marcador de localização do usuário também permanece como camada Leaflet e só é exibido quando `showUserMarker` está habilitado.
