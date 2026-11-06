# VBT Lab

Sistema local para registrar sinais de uma IMU na barra por ESP32 e Bluetooth Low Energy, organizar séries e comparar dados brutos.

## Executar

Com Node 20 ou superior, na raiz deste repositório:

```sh
npm start
```

Abra [http://localhost:8000](http://localhost:8000). O servidor usa somente módulos nativos do Node; não é necessário instalar dependências para executar a aplicação.

Alternativa com Python: `python -m http.server 8000 --directory web`. Para hospedagem estática, publique o conteúdo de `web/` em uma origem HTTPS; os caminhos também funcionam em subpastas. Nenhuma publicação é executada automaticamente pelo projeto.

## Experimentar sem sensor

1. Clique em **Criar demonstração**. Exercício e carga podem ser preenchidos antes; os padrões de demonstração são Supino e 20 kg.
2. Escolha onde guardar: navegador, arquivo JSON ou ambos. Clique em **Salvar série**.
3. Na **Biblioteca**, selecione séries e clique em **Ver gráficos**. Explore os canais e a duração normalizada.
4. Exporte JSON/CSV para backup ou importação em outro aparelho. A biblioteca não sincroniza dados entre navegadores.

A demonstração gera 1.200 amostras sintéticas identificadas como tal. A aplicação também funciona em memória e permite baixar JSON quando IndexedDB não está disponível.

## Capturar com ESP32

Prepare o firmware seguindo [firmware/README.md](firmware/README.md). No navegador com Web Bluetooth, em HTTPS ou localhost, clique em **Conectar ESP32**, informe exercício e carga e use **Iniciar série** → **Finalizar série** → **Salvar série**.

START/STOP aguardam confirmação do dispositivo. Uma desconexão preserva as amostras recebidas e marca a série como interrompida. Falha ao salvar mantém a série pendente para nova tentativa ou download. Mantenha a página ativa durante a aquisição.

O firmware de referência usa ESP32 + MPU6050 e NimBLE-Arduino 2.3.6. A placa real ainda precisa ser identificada; compilação e ensaios físicos estão pendentes. A taxa de 100 Hz é nominal. O protocolo atual transmite sinais, sem armazenamento em flash ou reenvio.

## O que foi feito

- Captura com metadados, estado de conexão, contador, duração e sinal ao vivo.
- Persistência IndexedDB; importação/exportação de uma ou várias séries em JSON/CSV.
- Busca, filtros, seleção, exclusão confirmada e comparação dos seis canais e magnitudes.
- Qualidade por lacunas detectadas, duplicatas e desordem; retorno modular de sequência.
- Interface responsiva, teclado e cache offline dos arquivos estáticos após primeiro carregamento.
- Firmware de referência e testes de dados, armazenamento, transporte e uso no navegador.

Validação da implementação: 11 testes de lógica e integração e dois testes de fluxo no Chromium aprovados, além da verificação de sintaxe. Foram verificados criação de demonstração, salvamento e recarga, filtros, comparação de 11 séries, exportação/restauração JSON e CSV, recuperação de falhas, uso offline e layout móvel. O firmware ainda não foi compilado nem testado em hardware real.

Os sinais de aceleração incluem gravidade. Repetições, VMC e 1RM permanecem indisponíveis até calibração e validação. O cache offline depende de service worker e de suporte do navegador; os dados locais podem ser apagados pelo usuário ou pelo navegador, portanto mantenha arquivos de backup.

## O que deve ser feito posteriormente

Na ordem recomendada:

1. **Validar o hardware:** identificar o modelo exato do ESP32 e da IMU, confirmar alimentação e pinos, compilar e gravar o firmware. Conferir os seis canais e realizar três capturas de 60 segundos para medir taxa efetiva, intervalos e perdas.
2. **Garantir recuperação da captura:** armazenar as amostras no ESP32 e implementar transferência após a série, com manifesto, checksum, confirmação e reenvio. Testar recuperação integral após desconexão.
3. **Calibrar e processar os sinais:** estimar vieses e orientação, remover gravidade, filtrar ruído e controlar a deriva, preservando os dados originais.
4. **Detectar repetições e validar velocidade:** identificar fases por exercício, calcular velocidade média concêntrica (VMC) e comparar com uma referência externa. Quantificar o erro antes de disponibilizar métricas.
5. **Adicionar análises de desempenho:** melhor repetição, média da série e perda de velocidade. Depois, ajustar e validar perfis individuais de carga–velocidade e estimativas de 1RM com indicação de incerteza.
6. **Implementar avisos sonoros:** eventos de pausa e perda de velocidade, com medição de latência e falsos avisos.
7. **Ampliar os ensaios de uso:** testar nos navegadores e aparelhos alvo, verificar reconexão, segundo plano, instalação e atualização offline da PWA.

## Verificar

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Dependências somente de desenvolvimento: Playwright e fake-indexeddb. Os testes de navegador usam um servidor temporário e dados isolados; capturas de tela são salvas em `test-results/`.

## Documentação

- [Formatos e indicadores de qualidade](docs/FORMATOS.md).
- [Protocolo BLE](docs/PROTOCOL.md).
- [Instalação e ensaios do firmware](firmware/README.md).
- [Glossário do domínio](CONTEXT.md).
- [Identidade visual e componentes](DESIGN.md).

## Estrutura do repositório

```text
web/          Aplicação estática e cache offline
firmware/     Sketch ESP32 e instruções de montagem/validação
tests/        Testes de dados, captura, armazenamento e navegador
scripts/      Servidor local e verificação de sintaxe
docs/         Protocolo BLE e formatos de arquivo
```

`package.json` e `package-lock.json` definem os comandos e as dependências de desenvolvimento. Arquivos temporários e dependências instaladas são ignorados pelo Git e podem ser recriados com os comandos acima.
