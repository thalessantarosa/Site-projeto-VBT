# VBT Lab

Sistema local para registrar sinais de uma IMU na barra por ESP32 e Bluetooth Low Energy, organizar séries e comparar dados brutos.

## Estado atual

Repositório iniciado em 6 de novembro de 2026 com especificação proposta e glossário. Ainda não há aplicação executável, firmware ou testes implementados neste repositório.

Os documentos recebidos mencionam um MVP e testes aprovados, mas seus arquivos de código não foram fornecidos. Essas afirmações descrevem o protótipo de origem e não o estado deste projeto.

## Documentação

- [Primeira entrega proposta e critérios de aceite](docs/SPEC_MVP.md).
- [Glossário do domínio](CONTEXT.md).

As fontes são o README, o protocolo BLE, o plano de implementação e o texto recebidos nesta conversa. Seus requisitos relevantes foram sintetizados na especificação; os arquivos originais não estão copiados neste repositório.

## Direção da primeira entrega

Aplicação estática em português, sem backend e sem dependências de execução: captura BLE, demonstração sintética, IndexedDB, importação/exportação JSON e CSV, biblioteca e gráficos de sinais. Firmware ESP32 + MPU6050 como referência, sujeito à identificação da placa e validação física.

O escopo e os pontos de teste estão propostos na especificação para confirmação antes da implementação, conforme o fluxo solicitado em AGENTS.md. Nenhum commit ou troca de branch foi realizado.
