# MEDBOX 1.0 — Simulador Virtual 3D

Simulador de uma caixa horizontal com quatro compartimentos, relógio, painel LCD e alertas independentes. Gire ou amplie o modelo para explorar os compartimentos vazios e a câmara eletrônica inferior.

## Desenvolvimento

Requer Node.js 22.18 ou superior.

```sh
npm install
npm run dev
npm test
npm run build
```

## Controles

- No modo normal, segure **OK** por 3 segundos para entrar no menu. Use **+ / −** para selecionar a dose e toque em **OK** para editar.
- Em edição, **+ / −** alteram o dígito atual e **OK** avança. Depois do quarto dígito, **OK** salva no navegador.
- Os horários iniciais são 08:00, 12:00, 18:00 e 22:00. O relógio usa o horário local.
- **Ativar som** permite que o navegador reproduza o alarme. Os LEDs indicam as doses pendentes. Cada botão **Confirmar dose** encerra o alerta correspondente. Um toque em **OK** no modo normal confirma apenas a dose selecionada, se estiver pendente.
- **Modo de teste** pausa o relógio em tempo real para avançar um minuto, uma hora ou até o próximo alerta. Ao sair do modo, o relógio volta ao horário local.
- Clique nas tampas ou use os botões abaixo do modelo para abri-las individualmente. A vista **Interna** desloca a bandeja para revelar a câmara inferior sem alterar a posição das tampas.

## Câmara eletrônica

Uma ESP32, um RTC DS1307 e um buzzer ficam abaixo dos compartimentos. O LCD fica embutido na faixa superior da própria caixa, atrás das tampas, com os três botões à direita. Cada tampa tem um LED próximo, na face frontal. Os cabos da vista interna representam o chicote de sinais e as ligações comuns.

| Componente | Conexão na ESP32 |
| --- | --- |
| LEDs 1–4 | GPIO18, GPIO19, GPIO17, GPIO16 |
| Buzzer | GPIO25 |
| OK / + / − | GPIO26 / GPIO32 / GPIO33 |
| LCD 16×2 e DS1307 (I²C) | SDA GPIO21, SCL GPIO22 |

A máquina de estados usa os modos `normal`, `selecionar` e `digito`. As transições seguem a descrição do projeto. Os arquivos do circuito e do firmware do Wokwi não estão no repositório.
