# Formatos e integridade dos dados

## JSON

Importa uma série canônica, uma lista de séries ou um pacote `{ "schemaVersion": 1, "series": [...] }`. A exportação usa o pacote. Cada série contém `schemaVersion`, `metadata`, `samples`, `quality` e `derived`, conforme o [protocolo](PROTOCOL.md).

As amostras preservam a ordem de chegada e os valores `[seq, t_us, ax, ay, az, gx, gy, gz]`: sequência inteira de 0 a 65535, tempo inteiro de 0 a 4294967295 µs, aceleração em m/s² e velocidade angular em rad/s. Valores não finitos e amostras incompletas são rejeitados. `startedAt`/`endedAt` são datas do computador; o gráfico e a duração usam a extensão do relógio de aquisição.

`source` distingue `bluetooth` de `synthetic`. A versão física do firmware permanece `unknown` porque o protocolo v1 não transmite essa informação. Campos adicionais de `metadata` são preservados. Identificadores duplicados dentro do mesmo pacote são rejeitados; substituir registros locais existentes exige confirmação na interface.

Métricas externas em `derived` não são consideradas validadas: o aplicativo mantém `validated: false` e resultados VMC/1RM nulos. Não utiliza claims de validação de arquivos importados para exibir resultados biomecânicos.

## CSV

Separador vírgula; cabeçalho e uma linha por amostra. Campos com aspas, vírgulas e quebras de linha usam aspas duplas e escape por aspas duplicadas. Aceita BOM UTF-8.

Colunas: `schemaVersion`, `id`, `startedAt`, `endedAt`, `exercise`, `mode`, `loadKg`, `notes`, `deviceName`, `sampleRateHz`, `source`, `firmwareVersion`, `status`, `seq`, `t_us`, `ax_ms2`, `ay_ms2`, `az_ms2`, `gx_rad_s`, `gy_rad_s`, `gz_rad_s`, `metadata_extra_json`.

Os campos de metadados se repetem por linha para permitir filtrar séries sem arquivo auxiliar. A coluna opcional `metadata_extra_json` preserva extensões de metadados; CSVs sem essa coluna continuam aceitos. Metadados conflitantes para o mesmo ID são rejeitados. Séries sem amostras são representadas por uma linha com os oito campos de amostra vazios.

JSON e CSV não arredondam os canais para a apresentação. A interface limita importações a 50 MB; valores de uma importação inteira são validados antes da escrita atômica no IndexedDB.

## Qualidade da captura

- `missingPackets`: soma das lacunas de sequência detectadas ao avançar a captura. É um histórico de lacunas detectadas; uma amostra atrasada não desfaz esse indicador.
- `outOfOrder`: amostras com tempo não crescente ou sequência incompatível com o avanço esperado; não altera a ordem armazenada.
- `duplicates`: repetição do mesmo par sequência/timestamp.
- `totalSamples`: número de amostras recebidas, inclusive duplicatas e fora de ordem.

O retorno de 65535 para 0 é normal. Uma lacuna superior a meia faixa da sequência não pode ser desambiguada com confiança e é tratada como desordem. O gráfico interrompe a linha em lacunas ou desordem; não interpola pontos ausentes.

Esses indicadores não provam captura integral, qualidade de movimento ou precisão biomecânica. Sem manifesto de amostras esperadas, perdas de pacotes anteriores ao primeiro recebido ou posteriores ao último recebido podem passar despercebidas. Sem flash e retransmissão no firmware, amostras não recebidas são irrecuperáveis.
