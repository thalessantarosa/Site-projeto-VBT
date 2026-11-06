# Firmware de referência

Código para ESP32 com BLE e MPU6050. Ainda não foi compilado para uma placa específica nem ensaiado em hardware neste projeto.

1. Na Arduino IDE, instale o pacote de placas esp32 da Espressif.
2. Instale **NimBLE-Arduino 2.3.6**, **Adafruit MPU6050**, **Adafruit Unified Sensor** e **Adafruit BusIO**. A API do ramo master do NimBLE mudou; este sketch usa explicitamente os callbacks da versão 2.3.6.
3. Confira o modelo da placa e adapte `I2C_SDA`/`I2C_SCL` no sketch. GPIO4/GPIO5 são apenas uma referência; não representam a pinagem confirmada de uma placa do usuário.
4. Ligue o MPU6050 a 3V3 e GND comum e confira SDA/SCL. O ESP32 usa sinais de 3,3 V. O sketch procura a IMU nos endereços 0x68 e 0x69.
5. Selecione a placa na IDE e abra `vbt_esp32/vbt_esp32.ino`. Compile, grave e abra o monitor serial a 115200 baud.
6. Confirme `MPU6050 ready. Advertising as VBT-ESP32`. Abra a aplicação em HTTPS ou localhost e conecte o sensor.

O loop é o único responsável pela IMU e pela aquisição; callbacks BLE enfileiram comandos. START/STOP são confirmados pelo STATUS. Há um único cliente ativo. A aquisição usa microssegundos do ESP32, taxa nominal de 100 Hz e limite de 180 segundos; atrasos do loop avançam a sequência sem gerar leituras artificiais. O filtro da IMU está configurado em 21 Hz, aceleração em ±8g e giroscópio em ±500°/s. A quantização segue o protocolo v1.

O firmware transmite sinais em SI, incluindo gravidade. A versão é mostrada no serial; o protocolo v1 não a transmite, portanto a web registra `firmwareVersion: unknown` para captura física. Não há flash, manifesto de amostras esperadas, checksum, ACK por amostra ou reenvio. Perdas no final da transmissão podem não ser detectadas pelo navegador; uma notificação aceita não comprova recebimento.

## Ensaio físico pendente

- Identificar ESP32 e IMU reais e confirmar pinagem/alimentação.
- Compilar e registrar as versões exatas do core ESP32 e das bibliotecas.
- Conferir seis canais plausíveis em repouso e em movimento e aceleração de aproximadamente 9,81 m/s² em repouso.
- Fazer três capturas de 60 segundos; medir taxa efetiva e distribuição dos intervalos usando `t_us`, lacunas, duplicatas e desordem.
- Interromper a conexão e verificar série marcada como interrompida, preservação de amostras recebidas e parada no firmware.

## Fontes primárias consultadas

- [Servidor do NimBLE-Arduino 2.3.6](https://github.com/h2zero/NimBLE-Arduino/blob/2.3.6/examples/NimBLE_Server/NimBLE_Server.ino).
- [Exemplo básico da biblioteca Adafruit MPU6050](https://github.com/adafruit/Adafruit_MPU6050/blob/master/examples/basic_readings/basic_readings.ino).
