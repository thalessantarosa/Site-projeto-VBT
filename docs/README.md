# VBT Lab — protótipo inicial ESP32 + Web Bluetooth

**Prova de conceito funcional da camada web e firmware de referência.** Não usar os gráficos brutos como medida de velocidade ou 1RM. A compilação e o comportamento do firmware dependem da placa e do sensor físico.

## Conteúdo

```text
vbt_mvp/
├── README.md
├── PLANO_IMPLEMENTACAO.md
├── PROTOCOL.md
├── package.json
├── tests/core.test.mjs
├── firmware/vbt_esp32/vbt_esp32.ino
└── web/
    ├── index.html
    ├── styles.css
    ├── icon.svg
    ├── manifest.webmanifest
    ├── sw.js
    └── js/
        ├── app.js
        ├── bluetooth.js
        ├── core.js
        └── storage.js
```

## Testar a interface imediatamente (sem ESP32)

1. No terminal, entre na pasta `web`.
2. Execute `python3 -m http.server 8000` (ou extensão Live Server no VS Code).
3. Abra **http://localhost:8000** no Chrome/Edge.
4. Pressione **Criar série de demonstração**; vá para **Biblioteca**, marque a série e clique em **Ver gráficos**.
5. Teste **Exportar JSON / CSV**, exclua ou importe o arquivo e confirme a restauração.

Dados sintéticos são rotulados como tal. O app não exige Node nem bibliotecas externas para rodar.

## Gravando com ESP32 e MPU6050

1. Na Arduino IDE, instale o pacote de placas **esp32 (Espressif)**, a biblioteca **NimBLE-Arduino série 2.x**, **Adafruit MPU6050** e dependências **Adafruit Unified Sensor / Adafruit BusIO**.
2. Selecione a placa correta. O exemplo foi pensado para ESP32 ou ESP32-C3 com GPIO4/GPIO5 disponíveis. Ajuste as constantes `I2C_SDA` e `I2C_SCL` em `firmware/vbt_esp32/vbt_esp32.ino` de acordo com **a pinagem real da sua placa**.
3. Na montagem de referência, conecte VCC da IMU em 3V3, GND comum, SDA no GPIO4 e SCL no GPIO5 **apenas se estes pinos estiverem disponíveis e forem adequados na sua placa**. O ESP32 usa lógica de 3,3 V; nunca alimente pinos de sinal com 5 V.
4. Faça upload, abra o monitor serial a 115200 baud e confira `Advertising as VBT-ESP32`.
5. No computador ou celular com navegador Web Bluetooth compatível, abra a aplicação em `https://...` ou `http://localhost:8000` **no próprio dispositivo**; localhost do computador não é localhost do telefone.
6. Clique em **Conectar ESP32**, selecione `VBT-ESP32`, informe exercício/carga e use **Iniciar série** → **Finalizar série**.
7. Selecione **Ambos** para manter o dado no navegador e baixar arquivo JSON. Compare os sinais na biblioteca.

**Limitações atuais do firmware:** é um exemplo a validar na placa real; faz streaming, não grava em flash nem retransmite pacotes. A taxa de 100 Hz é nominal e deve ser verificada. A qualidade de movimento depende de calibração, fixação e processamento posteriores.

## Publicar sem pagar

1. Crie um repositório público no GitHub, por exemplo `vbt-lab`.
2. Envie o conteúdo **da pasta `web/` para a raiz do repositório**; não envie dados pessoais de treino se o repositório for público.
3. Em **Settings → Pages**, configure publicação da branch `main`, pasta `/ (root)`.
4. Acesse `https://SEU-USUARIO.github.io/vbt-lab/` no smartphone ou computador com navegador compatível.
5. A hospedagem é estática: os registros de treino ficam no IndexedDB do aparelho e os downloads ficam no armazenamento escolhido pelo sistema/navegador.

Sempre que atualizar arquivos offline, altere a string de versão do cache em `web/sw.js` (ex.: `vbt-lab-static-v2`) para evitar arquivos antigos.

## Validar o código JavaScript

Em `vbt_mvp`, com Node 18+ disponível, rode:

```sh
npm test
```

Inclui testes do pacote BLE, perdas sequenciais, JSON/CSV, arquivos com múltiplas séries e validação de formatos. O Node é necessário apenas para executar testes, não para hospedar a aplicação.

## Próximas prioridades

1. Descobrir modelo exato de ESP32 e IMU utilizados e adaptar drivers/pinos.
2. Validar recepção real a 100 Hz e medir lacunas/instabilidade de timestamps.
3. Implementar captura lossless em memória flash do ESP e transferência pós-série com ACK/reenvio.
4. Calibrar e validar processamento biomecânico com referência externa.
5. Implementar detecção de repetições, VMC, perfis carga–velocidade e eventos sonoros.

Consulte [PLANO_IMPLEMENTACAO.md](./PLANO_IMPLEMENTACAO.md) para especificação completa e [PROTOCOL.md](./PROTOCOL.md) para contrato binário BLE.
