# Design — VBT Lab

Direção: instrumento de laboratório simples em português. O escopo atual e as próximas etapas estão no [README.md](README.md).

## Identidade e tokens

O produto comunica registro e comparação de sinais. Superfícies claras, tipografia do sistema e linhas de grade discretas priorizam leitura. Verde petróleo identifica ação e aquisição; âmbar identifica demonstração/pendência. Sem aparência de painel financeiro e sem métricas biomecânicas simuladas.

```css
--background: #f5f5f1;
--surface: #ffffff;
--surface-soft: #f0f2ef;
--text: #202c29;
--text-muted: #5b6862;
--line: #d7ded8;
--accent-solid: #176451;
--accent-hover: #104c3e;
--accent-soft: #e7f0ea;
--warning-text: #79501b;
--warning-soft: #fff4dd;
--error-text: #a22d28;
--error-soft: #fff0ed;
--success-text: #176451;
--info-text: #354e74;
```

Escala: 12/14/16/20/24/32/40 px em rem. Corpo 14–16 px, entrelinha 1,5; títulos grandes com tracking negativo. Valores usam algarismos tabulares. Espaçamento em múltiplos de 4 px, base 8 px; cantos 8–12 px. Ações primárias de pelo menos 44 px, foco de 3 px com offset de 3 px. Sem sombra em cards de conteúdo; bordas e espaçamento separam grupos.

## Componentes e comportamento

- Cabeçalho: marca, navegação de três destinos, estado de conexão. Empilha sem esconder funções em telas pequenas.
- Campos com rótulo permanente, ajuda local e validação com causa e correção (Yifrah). Obrigatórios indicados no texto.
- Botões com resposta imediata em `:active`; `disabled` espelha a máquina de captura. Redução de movimento elimina transformações.
- Avisos de status com `aria-live`, erro com foco acionável e botão fechar. Sem avisos que desaparecem antes de serem lidos.
- Tabela com seleção rotulada e overflow contido. Ações em lote ficam próximas da seleção.
- Canvas com resumo textual e tabela alternativa. Linhas por tempo de aquisição, sem suavização, padrões e cores redundantes, unidades e normalização explícitas. Codificação segue Munzner e Tufte; lacunas não são interpoladas.

## Verificação

Contraste calculado por luminância relativa sRGB: texto/superfície 14,45:1; texto secundário/superfície 5,83:1; texto secundário/fundo 5,34:1; branco/ação principal 7,05:1; aviso âmbar 6,46:1; erro 6,44:1; verde/superfície verde 6,06:1. Bordas dos campos e botões secundários usam #7a8980 (3,67:1 sobre branco); placeholders usam --text-muted (5,83:1). Pares textuais e limites de componentes passam AA.

Sintaxe, fluxo sintético, ausência de overflow global a 390 px, teclado e análise de 11 séries verificados no Chromium. As linhas e legendas usam 36 combinações distintas de cor/padrão antes de repetir. Revisão visual independente passou após as correções. Comandos de verificação e limitações no [README.md](README.md).
