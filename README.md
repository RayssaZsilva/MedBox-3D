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
- **Ativar som** permite que o navegador reproduza o alarme. Os LEDs indicam as doses pendentes. Cada botão **Confirmar dose** encerra o alerta correspondente. Um toque em **OK** no modo normal confirma uma dose pendente. A dose selecionada tem prioridade, seguida pela primeira pendente na ordem dos compartimentos. O LCD confirma a operação por cerca de dois segundos e o navegador registra a confirmação para a data da dose.
- **Modo de teste** pausa o relógio em tempo real para avançar um minuto, uma hora ou até o próximo alerta. Ao sair do modo, o relógio volta ao horário local.
- Clique nas tampas ou use os botões abaixo do modelo para abri-las individualmente. A vista **Interna** abre a bandeja pela articulação traseira para revelar a câmara inferior sem alterar a posição das tampas.

## Câmara eletrônica

Uma ESP32, um RTC DS1307 e um buzzer ficam abaixo dos compartimentos. O LCD fica à esquerda no painel superior frontal inclinado, com os três botões à direita. Um LED vermelho sob cada tampa indica a dose pendente. Na confirmação pelo OK, apaga apenas o LED da dose confirmada. Os cabos da vista interna representam o chicote de sinais e as ligações comuns.

| Componente | Conexão na ESP32 |
| --- | --- |
| LEDs 1–4 | GPIO18, GPIO19, GPIO17, GPIO16 |
| Buzzer | GPIO25 |
| OK / + / − | GPIO26 / GPIO32 / GPIO33 |
| LCD 16×2 e DS1307 (I²C) | SDA GPIO21, SCL GPIO22 |

A máquina de estados usa os modos `normal`, `selecionar` e `digito`. As transições seguem a descrição do projeto. Os arquivos do circuito e do firmware do Wokwi não estão no repositório.


## Geometria do simulador

O corpo arredondado divide a profundidade em cerca de 72% para os compartimentos e 28% para o painel. As quatro tampas abrem a 108° e a bandeja articula pela parte traseira para expor a eletrônica. Corpo, cavidades, tampas e controles têm geometrias separadas para revisão dimensional. A malha é de visualização. Uma versão para impressão exige reconstrução ou validação das peças no CAD, com espessuras, folgas, tolerâncias e fechamento das malhas.
