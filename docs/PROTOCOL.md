# BLE GATT — VBT Lab, protocolo experimental v1

Serviço: `824f0001-53cb-4a5b-9f4b-93e1a5e8f001`

| Característica | UUID | Propriedade | Uso |
|---|---|---|---|
| COMMAND | `824f0002-53cb-4a5b-9f4b-93e1a5e8f001` | WRITE | UTF-8 `START`, `STOP`, `PING` |
| DATA | `824f0003-53cb-4a5b-9f4b-93e1a5e8f001` | NOTIFY | Amostra binária de 19 bytes |
| STATUS | `824f0004-53cb-4a5b-9f4b-93e1a5e8f001` | READ, NOTIFY | UTF-8 `READY`, `STARTED`, `STOPPED`, `ERROR:...` |

## Pacote de amostra

**Sempre 19 bytes, little-endian.** Não requer aumento de MTU.

| Offset | Tipo | Conteúdo | Conversão para unidade física |
|---:|---|---|---|
| 0 | uint8 | Tipo de mensagem = 1 | — |
| 1 | uint16 | Número sequencial | Volta a zero após 65535 |
| 3 | uint32 | Microssegundos desde START | segundos = valor / 1 000 000 |
| 7 | int16 | ax | m/s² = valor / 256 |
| 9 | int16 | ay | m/s² = valor / 256 |
| 11 | int16 | az | m/s² = valor / 256 |
| 13 | int16 | gx | rad/s = valor / 2048 |
| 15 | int16 | gy | rad/s = valor / 2048 |
| 17 | int16 | gz | rad/s = valor / 2048 |

`ax`, `ay`, `az` incluem a gravidade. Os ângulos não são exportados, pois o giroscópio fornece velocidade angular, não orientação absoluta.

## Consistência

- Uma amostra nominal a cada 10 ms (100 Hz) gerada pelo ESP32.
- O relógio de aquisição é `micros()` no ESP32, não o horário de recebimento do celular.
- `seq` possibilita identificar lacunas; não garante retransmissão.
- Nesta versão, dados não são armazenados permanentemente no ESP32: perda da conexão pode implicar perda irrecuperável de amostras.
- Um `notify()` aceito pelo sistema BLE não constitui confirmação de recebimento pelo navegador.
- `uint32` de tempo relativo reinicia após cerca de 71,6 min: limitar as séries a poucos minutos. `uint16` de sequência reinicia em 655,36 s (100 Hz), tratado com aritmética modular.
- `gyro` tem resolução de aproximadamente 0,000488 rad/s; `accel` 0,00390625 m/s².

## Formato de arquivo

JSON canônico: objeto com `schemaVersion:1`, `metadata`, `samples` e `quality`, `derived`.

Cada `samples[i]` é `[seq,t_us,ax_ms2,ay_ms2,az_ms2,gx_rad_s,gy_rad_s,gz_rad_s]`.

CSV: uma linha por amostra, repetindo campos de metadados da série, para permitir filtrar múltiplas séries sem arquivo auxiliar. O aplicativo importa/exporta pacotes JSON de múltiplas séries.

## Evolução necessária antes de uso científico

Adicionar protocolo com manifesto de sessão, indicação explícita de versão de firmware, checksum, amostras esperadas, armazenamento no ESP32, janela de retransmissão, confirmação ACK/NACK e sincronização de tempo (se houver vários sensores). Revisar segurança BLE em uso compartilhado.
