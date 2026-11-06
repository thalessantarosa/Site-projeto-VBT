# VBT Lab

Monitoramento de movimentos da barra durante exercícios para preservar sinais medidos e permitir análises de treinamento baseadas em velocidade.

## Linguagem

**Série**:
Registro de uma execução de exercício, delimitado por início e término, com carga, observações e amostras associadas.
_Evitar_: sessão, treino, quando se tratar de uma única série.

**Amostra**:
Uma medição com sequência, tempo de aquisição, aceleração nos três eixos e velocidade angular nos três eixos.
_Evitar_: repetição, ponto de velocidade.

**Sinal bruto**:
Sequência de medições da IMU antes da correção de orientação, gravidade e deriva; a aceleração inclui gravidade.
_Evitar_: velocidade, deslocamento.

**Série sintética**:
Série gerada artificialmente para demonstrar e testar o sistema, sem aquisição de um sensor físico.
_Evitar_: série medida, treino real.

**Qualidade da captura**:
Indicadores de integridade das amostras, incluindo lacunas de sequência, desordem e quantidade recebida.
_Evitar_: precisão biomecânica, captura garantida sem perdas.

**VMC**:
Velocidade média concêntrica de uma repetição, dependente da identificação válida da fase concêntrica e de deslocamento ou velocidade validados.
_Evitar_: magnitude da aceleração, velocidade instantânea.

**1RM**:
Maior carga levantada em uma repetição válida de um exercício; sua estimativa exige um modelo individual validado.
_Evitar_: carga máxima calculada diretamente de aceleração bruta.
