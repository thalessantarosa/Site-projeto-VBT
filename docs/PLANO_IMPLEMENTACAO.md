# Plano de implementação: VBT Lab — ESP32 + Web Bluetooth

## 0. Objetivo e escopo

Criar um sistema VBT (Velocity-Based Training) local, sem servidor, que permita conectar um ESP32 com IMU à barra, registrar uma série com metadados, visualizar e comparar sinais brutos, importar/exportar séries, calcular métricas validadas e evoluir para avisos sonoros em tempo real.

**Princípio:** preservar sempre os dados brutos, mesmo se os algoritmos de análise mudarem. O software não deve apresentar valores de velocidade/1RM que não tenham sido calibrados e validados.

### Escopo do MVP que acompanha este plano

- [x] Interface responsiva de captura, biblioteca e análise.
- [x] BLE GATT no navegador compatível, características COMMAND, STATUS e DATA.
- [x] Firmware de referência para ESP32 + MPU6050 (100 Hz nominal).
- [x] Campos de exercício, carga, observações, data e modo padrão.
- [x] Botões iniciar e finalizar, contador de amostras e relógio da sessão.
- [x] Ao encerrar: salvar no IndexedDB, baixar JSON ou ambos.
- [x] Importação JSON/CSV, inclusive múltiplas séries.
- [x] Filtros de exercício, carga mínima e busca textual.
- [x] Seleção de séries e gráficos sobrepostos com diferentes canais de aceleração/giroscópio.
- [x] Amostras sintéticas para testar sem sensor físico.
- [x] PWA com cache dos arquivos estáticos (funcionamento offline depende do navegador).
- [x] Testes automatizados para pacote BLE e formatos de arquivo.
- [ ] Compilar o firmware para a **placa exata** do usuário e validar no sensor físico.
- [ ] Garantia de captura sem perdas / transferência pós-série com armazenamento no ESP32.
- [ ] Cálculo confiável de repetições e velocidade média concêntrica.
- [ ] 1RM estimado, pausa e comandos sonoros em tempo real.

## 1. Requisitos funcionais

**RF01 - Conectar dispositivo.** Usuário pressiona Conectar; app abre seletor Bluetooth, mostra dispositivo, permite desconectar. Proibir START se não conectado.

**RF02 - Configuração de série.** Obrigatórios: exercício, carga total em kg. Opcionais: observações. Automáticos: identificador único, data ISO-8601, nome do dispositivo, taxa nominal, versão do firmware, modo e status.

**RF03 - Captura.** Acesso à IMU com relógio do microcontrolador. Pacotes tipo 1 (19 bytes) com contador de sequência, timestamp e 6 canais. START e STOP por escrita BLE. Contador no app.

**RF04 - Persistência.** Após STOP mostrar opções de destinos: somente navegador, somente JSON baixado, ambos. A exportação CSV é oferecida pela biblioteca. Avisar que IndexedDB não é sincronização em nuvem.

**RF05 - Biblioteca.** Listar data, exercício, carga, VMC (apenas depois de validada), quantidade de amostras e qualidade. Filtro, seleção múltipla, importação, exportação e exclusão.

**RF06 - Gráficos.** Sobrepor acelerações XYZ / magnitude e giroscópio XYZ / magnitude, com escala temporal real ou normalizada. Distinguir série sintética.

**RF07 - Cálculo de repetições e métricas.** Detectar ciclos e fases conforme exercício; calcular velocidade média concêntrica por repetição, melhor repetição, média da série, perda percentual, desvio e indicadores de qualidade.

**RF08 - 1RM individual.** Selecionar várias séries de um mesmo exercício, com cargas diferentes, ajustar relação carga–velocidade com estimativa de incerteza, validar contra referência; não exibir 1RM em amostras insuficientes.

**RF09 - Regras futuras em tempo real.** Supino com pausa regulamentar ou personalizada, limiar de perda de velocidade, comando de amplitude. ESP32 detecta evento; smartphone emite som. A emissão sonora depende de o navegador estar ativo e o áudio ser desbloqueado após interação do usuário.

## 2. Modelo de dados

```json
{
  "schemaVersion": 1,
  "metadata": {
    "id": "UUID",
    "startedAt": "2026-11-06T17:00:00.000Z",
    "endedAt": "2026-11-06T17:00:22.000Z",
    "exercise": "Supino",
    "mode": "padrao",
    "loadKg": 60,
    "notes": "RPE 7",
    "deviceName": "VBT-ESP32",
    "sampleRateHz": 100,
    "source": "bluetooth",
    "firmwareVersion": "prototype-1",
    "status": "complete"
  },
  "samples": [
    [0, 1234, 0.01, 0.02, 9.81, 0.00, 0.01, 0.00],
    [1, 11234, 0.02, 0.02, 9.80, 0.00, 0.01, 0.00]
  ],
  "quality": {"missingPackets": 0, "outOfOrder": 0, "totalSamples": 2},
  "derived": {"version": null, "meanConcentricVelocityMs": null, "oneRmKg": null, "validated": false}
}
```

`startedAt` é tempo do celular (UTC). `t_us` é o tempo decorrido desde o START no ESP32 (mais apropriado para a cinemática). Não assumir que o horário do celular é uma amostragem precisa. O firmware usa a biblioteca Adafruit para converter a saída da IMU em SI; os dados são brutos do ponto de vista cinemático, ou seja, não foram corrigidos pela gravidade, orientação ou deriva.

## 3. Etapas e critérios de aceite

| Etapa | Implementação | Critério objetivo de aceite | Prioridade |
|---|---|---|---|
| A. Integração | Confirmar modelo exato de ESP32 e IMU; checar I2C, alimentação, pinos; Arduino IDE | IMU identificada e 6 canais variam plausivelmente no monitor serial | P0 |
| B. Aquisição BLE | START/STOP, 100 Hz nominal, numeração e timestamp | App recebe amostras; 3 testes de 60s com lacunas quantificadas; não presumir 0 perdas | P0 |
| C. Web de captura | Formulário e escolha de armazenamento, JSON/CSV e IndexedDB | Série salva, exportada, reimportada sem modificar os valores | P0 |
| D. Biblioteca e gráficos | Busca, filtros, sobreposição e visualização de qualidade | 10 séries de teste importadas, filtradas e comparadas corretamente | P0 |
| E. Registro robusto | Circular buffer + armazenamento persistente no ESP32, índice e retransmissão BLE | Série de 2 min recuperada integralmente após interrupção de conexão simulada | P1 |
| F. Calibração / processamento | Estimar bias, orientação, eixo vertical, gravidade, filtro, fases, integração | Erro de VMC analisado contra dispositivo de referência em diferentes cargas | P1 |
| G. Análises de séries | Repetições, melhor VMC, perda de velocidade, intervalos de confiança | Resultados reproduzíveis em dados de teste rotulados | P1 |
| H. 1RM estimado | Perfil carga–velocidade individual, regressão e qualidade | Previsão comparada com 1RM medido; exibir erro individual | P2 |
| I. Eventos sonoros | Regras no ESP32 + notificação de evento BLE + Web Audio no telefone | Latência medida e taxa de falsos avisos aceitável em ensaios controlados | P2 |
| J. Produto | PWA, logs diagnósticos, versões de protocolo e documentação | Uso offline e reconexões avaliados em Android/iOS alvo | P2 |

P0 = primeira versão; P1 = expansão analítica e confiabilidade; P2 = recursos avançados.

## 4. Processamento biomecânico: ordem correta

1. **Calibrar IMU:** por 3–5 segundos com sensor imóvel, calcular bias do giroscópio, verificar aceleração ~9,81 m/s² em repouso e eixo de montagem. Testar diferentes posições na barra.
2. **Filtrar ruído:** filtro passa-baixas aplicado com parâmetros que não deformem picos e transições; preservar sinais originais; documentar frequência de corte e atraso.
3. **Estimar orientação:** fusão acelerômetro + giroscópio por filtro complementar, Mahony ou Madgwick; estimar vetor de gravidade e transformar aceleração para o referencial global. Um magnetômetro não é obrigatório para a componente vertical e pode ser afetado pelo aço da barra.
4. **Extrair componente translacional:** obter aceleração vertical linear: componente global menos `g`, com eixo e sinal calibrados. Corrigir efeitos da rotação e do posicionamento da IMU sempre que necessário.
5. **Segmentar movimento:** classificar repouso, excêntrica, transição, concêntrica, pausa e final da repetição com limiares, histerese, duração mínima e regras por exercício.
6. **Integrar apenas segmentos pertinentes:** `v(t) = v(t0) + integral(a_vertical dt)`. Integração direta de aceleração sem correção acumula deriva rapidamente. Aplicar restrições físicas, como velocidade aproximadamente nula em paradas verificadas, e comparar com sensores de referência.
7. **Métricas por repetição:** `VMC = [z(t_fim) - z(t_inicio)] / (t_fim - t_inicio)` durante a concêntrica; equivalente à média da velocidade vertical no intervalo **se as fases e o deslocamento forem válidos**. Calcular velocidade de pico e *velocity loss* em relação à repetição mais rápida, e sinalizar qualidade.
8. **Validação:** comparar VMC de cada repetição com transdutor linear, vídeo de alta frequência com calibração ou sistema de captura de movimento. Reportar erro médio, MAE/RMSE, viés, concordância (ex.: Bland–Altman) e reprodutibilidade, por exercício e carga.

**Observação:** um valor alto de aceleração não significa necessariamente uma alta velocidade. A magnitude `sqrt(ax²+ay²+az²)` normalmente inclui gravidade e não pode ser integrada como se fosse aceleração vertical. Sensor de 6 eixos é suficiente para começar; magnetômetro não conta repetições por si só.

## 5. Algoritmo futuro de 1RM

- Selecionar séries do mesmo exercício, mesmo atleta e configuração de montagem, com cargas conhecidas e repetição concêntrica válida.
- Ter ao menos três cargas distintas como condição inicial de interface, mas definir número e dispersão exigidos de forma experimental.
- Obter para cada carga uma VMC representativa, idealmente de repetições próximas da intenção máxima de velocidade, sem misturar execução pausada e normal sem modelagem.
- Ajustar regressão individual `v = a + b * carga` e rejeitar ajuste sem inclinação negativa, sem faixa de cargas suficiente ou com pontos anômalos.
- Estimar `1RM = (v_MVT - a)/b`, **somente** com velocidade mínima de referência (`MVT`) validada para exercício e usuário ou outro modelo individual calibrado.
- Exibir erro estimado, intervalo de confiança e mensagens quando a previsão for extrapolação extrema; evitar apresentar precisão fictícia.

## 6. Avisos sonoros futuros

**Protocolo de eventos:** terceira característica/evento dedicado ou frames tipo 2 no mesmo DATA. Um evento deve levar `event_id`, `seq`, `t_us`, tipo de aviso e parâmetros; reenvio/ACK se necessário.

**Exemplos de máquinas de estados:**

- Supino com pausa: `DESCIDA → FUNDO_IDENTIFICADO → IMÓVEL_POR_T_MIN → EVENTO_PAUSA_CONCLUÍDA → SUBIDA`.
- Perda de velocidade: `PRIMEIRA_CONCÊNTRICA_VÁLIDA → REFERÊNCIA → REP_N → QUEDA_% ≥ LIMIAR → ALERTA`.
- Amplitude: detectar excursão com regra de exercício, referência calibrada e margem de erro, não por magnetômetro isoladamente.

O ESP32 deve decidir em tempo real para reduzir a dependência da latência da conexão; o telefone reproduz aviso apenas com página ativa, áudio desbloqueado após toque e permissões/condições atendidas. Não empregar como sistema de segurança de levantamentos.

## 7. Custos e compras

**Reaproveitamento primeiro:** usar o ESP32 e a IMU já disponíveis. Para uma montagem nova de bancada, ESP32-C3 Super Mini e MPU-6050 GY-521 são opções econômicas. Referências de consulta (novembro/2026, preços sujeitos a mudança):

- ESP32-C3 Super Mini (Usinainfo): R$ 27,17 — https://www.usinainfo.com.br/esp32/esp32-c3-super-mini-com-wifi-e-bluetooth-com-usb-c-8967.html
- MPU-6050 GY-521 (Vida de Silício): R$ 21,40 — https://vidadesilicio.com.br/produto/modulo-gy-521-acelerometro-giroscopio/
- Subtotal das placas: R$ 48,57, **sem** frete, jumpers, suporte e alimentação.

**Protótipo:** cabo USB + power bank já existente. Evitar circuito de bateria Li-ion carregável sem placa de proteção adequada. Fixação rígida e segura da IMU para reduzir vibração e desprendimento; nunca deixar fios soltos próximos aos pesos.

**Versão de precisão superior:** avaliar IMU com melhor estabilidade, FIFO e interrupção de dados, por exemplo ICM-42688-P, após definir requisito de erro em m/s. Não comprar magnetômetro antes de demonstrar necessidade.

## 8. Restrições de navegadores e confiabilidade

- Web Bluetooth requer origem segura (HTTPS ou `localhost`) e navegador com suporte. Chrome/Edge em Windows/Android são alvos iniciais; Safari no iOS não oferece a mesma API, e Bluefy é alternativa Web BLE específica.
- Não assumir que navegador em segundo plano continuará recebendo notificações BLE; manter tela ativa na primeira versão.
- IndexedDB é armazenamento por origem/navegador, sujeito a exclusão manual ou políticas de armazenamento. Disponibilizar exportação de backup e testar restauração.
- GitHub Pages hospeda HTML/CSS/JS, não salva sessões no servidor. Se for desejada sincronização entre aparelhos, criar backend separadamente depois.
- Verificar a integridade da captura com número de pacotes e timestamp. Lacuna detectada deve bloquear resultados biomecânicos que dependam do trecho ausente.
- Para confiabilidade maior, **a prioridade seguinte é armazenar localmente no ESP32 e transferir após STOP**, usando manifesto de série, verificação de dados e retransmissão.

## 9. Referências técnicas e científicas

1. MDN. Web Bluetooth API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
2. MDN. Storage quotas and eviction criteria — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
3. GitHub Docs. What is GitHub Pages? — https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
4. h2zero. NimBLE-Arduino 2.x — https://github.com/h2zero/NimBLE-Arduino
5. Adafruit. MPU6050 library — https://github.com/adafruit/Adafruit_MPU6050
6. Systematic Review: Validity and Reliability of the Inertial Measurement Unit for Barbell Velocity Assessments (2021) — https://pubmed.ncbi.nlm.nih.gov/33916801/
7. Warneke et al. Reliability, Device Agreement and Validity of Load–Velocity Profiles: A Systematic Review with Meta-analysis (2026) — https://pubmed.ncbi.nlm.nih.gov/42690493/
8. Evaluation of the Vmaxpro sensor for assessing movement velocity and load-velocity variables (2024) — https://pubmed.ncbi.nlm.nih.gov/38188099/
