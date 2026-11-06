# Jornada — VBT Lab

Base: requisitos fornecidos e escopo confirmado pelo pedido de início; não houve pesquisa com usuários. Rever após o primeiro ensaio com hardware.

## Trabalho

Quando registro uma série de exercício, quero conservar os sinais e a carga para comparar execuções depois, sem depender de uma conta ou conexão com a internet.

## Arquitetura e fluxos

Três destinos orientados à tarefa: Captura, Biblioteca, Análise. A conexão e o estado de aquisição permanecem visíveis. Agrupamento por tarefa segue Rosenfeld/Morville; alvos grandes e próximos ao formulário seguem Fitts.

- Sensor: conectar → preencher metadados → iniciar → finalizar → escolher destino → salvar → biblioteca → selecionar → analisar.
- Demonstração: preencher metadados → criar série sintética → escolher destino → salvar → biblioteca → analisar.
- Recuperação: conexão perdida → série interrompida pendente → salvar dados recebidos ou descartar explicitamente.
- Arquivo: importar JSON/CSV → validar → persistir atomicamente → biblioteca. Erros preservam os dados atuais.

## Especificações das áreas

### Captura

Entrada inicial. Conteúdo: título, conexão, formulário de exercício/carga/observações, iniciar/finalizar, alternativa de demonstração; contador de amostras, duração e lacunas; sinal bruto; salvamento pendente. Estados: desconectado, pronto, iniciando, gravando, finalizando, pendente. Ação principal muda com o estado, sem permitir sobrescrever uma série pendente.

### Biblioteca

Entrada pela navegação ou após salvar. Conteúdo: armazenamento local, importação, busca, exercício e carga mínima; tabela com seleção, origem, data, amostras e qualidade; exportação e exclusão da seleção. Estados: carregando, vazio, sem resultados, falha de armazenamento, lista. Próximo destino: análise.

### Análise

Entrada pela navegação ou seleção da biblioteca. Conteúdo: canal e eixo temporal, gráfico, legenda com padrão e cor, tabela de resumo das séries, explicação de VMC indisponível. Estados: sem seleção e dados disponíveis. Próximo destino: biblioteca para ajustar seleção.

## Validação

Realizar o fluxo sintético completo, recarga do navegador, importação/exportação, filtro sem resultados, teclado e largura móvel. Os dados sintéticos são rotulados em todos os lugares. Não representar aceleração como velocidade.
