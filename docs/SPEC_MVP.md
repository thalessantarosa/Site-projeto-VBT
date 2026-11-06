# Primeira entrega — VBT Lab

Estado: proposta para confirmação de escopo e pontos públicos de teste.

## Problema

O projeto precisa de uma base executável para controlar a aquisição de sinais de uma IMU, preservar as amostras e comparar séries localmente. O repositório está vazio e o código do protótipo citado nos anexos não foi recebido.

## Solução proposta

Construir o MVP local descrito nos anexos: aplicação web estática em português com captura, biblioteca e análise de sinais brutos, acompanhada de firmware de referência. Permitir testar o fluxo completo com dados sintéticos enquanto a placa e a IMU reais não forem identificadas.

## Histórias do usuário e aceite

1. Como usuário, quero gerar uma série sintética para testar o sistema sem sensor; a origem sintética deve aparecer na biblioteca e na análise.
2. Como usuário, quero informar exercício, carga total em kg e observações; exercício vazio e carga ausente, negativa ou não finita devem impedir o início.
3. Como usuário, quero conectar e desconectar um ESP32 pelo seletor do navegador; iniciar aquisição física exige conexão pronta e confirmação do dispositivo.
4. Como usuário, quero iniciar e finalizar uma série e acompanhar duração e quantidade de amostras; ações incompatíveis com o estado atual devem ficar indisponíveis.
5. Como usuário, quero manter amostras recebidas se a conexão cair; a série deve ser identificada como interrompida e poder ser salva.
6. Como usuário, quero escolher navegador, download JSON ou ambos ao encerrar; uma falha de armazenamento deve preservar a série em memória e permitir nova tentativa ou exportação.
7. Como usuário, quero consultar séries salvas após recarregar a aplicação, filtrar por exercício/carga e buscar observações.
8. Como usuário, quero selecionar séries e comparar canais de aceleração e giroscópio, incluindo magnitude e tempo normalizado; o gráfico deve apresentar unidades, legenda e estado sem seleção.
9. Como usuário, quero exportar e reimportar JSON e CSV, inclusive várias séries, sem alterar os valores das amostras ou perder metadados; arquivos inválidos devem produzir mensagens compreensíveis.
10. Como usuário, quero excluir séries escolhidas com confirmação e saber que dados do navegador não são sincronizados entre aparelhos.
11. Como usuário, quero ver lacunas e desordem na captura; essas medidas não devem ser apresentadas como validação da velocidade.
12. Como usuário, quero navegar por teclado e usar a interface em celular ou computador, com rótulos, foco visível, contraste e respeito à redução de movimento.
13. Como usuário, quero abrir os arquivos estáticos já carregados sem rede; indisponibilidade de Bluetooth ou armazenamento deve ser explicitada sem bloquear a demonstração em memória.

## Decisões propostas para implementação

- HTML, CSS e módulos JavaScript nativos, Canvas 2D e IndexedDB; Node somente para desenvolvimento e testes.
- Captura, biblioteca e análise como três áreas da mesma aplicação. Linguagem visual de instrumento de laboratório: tipografia do sistema, hierarquia clara e estados de conexão/captura persistentes. Sem animações decorativas ou recursos de gesto nesta primeira etapa.
- Separar lógica de série e formatos, transporte Bluetooth, persistência e apresentação. Manter a interface pública da lógica de domínio pequena.
- Usar o protocolo experimental v1 recebido: COMMAND/STATUS/DATA, pacotes de 19 bytes little-endian, aceleração dividida por 256 e giroscópio por 2048.
- Preservar sequência e relógio de aquisição do ESP32; tratar retorno de sequência de 65535 para 0 sem registrar perda fictícia.
- Metadados e amostras seguem schemaVersion 1. Resultados derivados permanecem indisponíveis e não validados. Rejeitar formatos e valores inválidos antes de persistir.
- Captura com estados explícitos: desconectado, pronto, iniciando, gravando, finalizando e série pendente de salvamento. Impedir comandos concorrentes e substituição de uma série ainda não salva.
- Firmware de referência para ESP32 + MPU6050, com pinos configuráveis e taxa nominal de 100 Hz. Não declarar compilação ou validação física sem executá-las na configuração correspondente.
- Tratar os anexos como fontes de requisitos: instruções de publicação e declarações de funcionalidades concluídas não autorizam publicar nem comprovam implementação neste repositório.

## Pontos de teste propostos para confirmação

Testar comportamento pelas interfaces públicas, sem testar detalhes internos:

1. **Série e formatos:** decodificar pacote conhecido; acumular amostras com lacunas e retorno de sequência; validar e fazer ida e volta de JSON/CSV de uma ou várias séries preservando os valores.
2. **Fluxo de aquisição:** iniciar/finalizar com confirmação, impedir início desconectado, conservar série interrompida e recuperar falha de salvamento. Simular somente as fronteiras externas Bluetooth/armazenamento.
3. **Aplicação no navegador:** demonstração → salvar → recarregar → filtrar/selecionar → comparar → exportar/reimportar; verificar layout móvel e navegação por teclado.

Desenvolver fatias pequenas em red-green, com um comportamento por ciclo. Não existem testes anteriores neste repositório. Ao concluir, executar a suíte e uma verificação consolidada no navegador; registrar separadamente o que depende do hardware físico.

## Ordem proposta

1. Núcleo de série, protocolo e formatos, com testes.
2. Captura demonstrável, armazenamento local e interface responsiva.
3. Biblioteca, comparação gráfica e importação/exportação.
4. Transporte BLE, firmware de referência, cache offline e documentação de execução/validação.

## Fora desta entrega

Captura recuperável em flash e retransmissão; calibração e fusão de sensores; detecção de repetições; VMC; previsão de 1RM; alertas sonoros; contas, backend e sincronização. Permanecem como evoluções do plano recebido.

## Confirmação necessária

Confirmar que esta primeira entrega e os três pontos de teste correspondem à intenção do usuário. O modelo exato de ESP32 e IMU pode ser informado depois; sua ausência impede validar firmware físico, mas não impede desenvolver o fluxo web e o protocolo.

## Fontes e estado verificado

README.md, PROTOCOL.md e PLANO_IMPLEMENTACAO.md indicados pelo usuário, e texto anexado sobre o projeto. O conteúdo fornecido foi usado como referência; os arquivos originais não foram copiados ao repositório. Repositório local sem arquivos de aplicação e sem commits, na branch main. Node e npm disponíveis. A especificação não foi publicada em rastreador de issues; não há integração de triagem configurada nesta conversa.
