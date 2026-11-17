# MEDBOX 1.0 — Simulador Virtual 3D

Simulador de uma caixa horizontal com quatro compartimentos, relógio, painel LCD e alertas independentes. O modelo pode ser girado e ampliado e a vista interna mostra uma representação dos componentes eletrônicos.

## Desenvolvimento

Requer Node.js 22.18 ou superior.

```sh
npm install
npm run dev
npm test
npm run build
```

## Controles

- **+ / −** selecionam uma dose. **OK** abre a edição do horário.
- Em edição, **+ / −** alteram o dígito atual e **OK** avança. Depois do quarto dígito, **OK** salva no navegador.
- Os horários iniciais são 08:00, 12:00, 18:00 e 22:00. O relógio usa o horário local.
- **Ativar som** permite que o navegador reproduza o alarme. Os LEDs indicam as doses pendentes. Cada botão **Confirmar dose** encerra o alerta correspondente.
- **Modo de teste** pausa o relógio em tempo real para avançar um minuto, uma hora ou até o próximo alerta. Ao sair do modo, o relógio volta ao horário local.
- Clique nas tampas ou use os botões abaixo do modelo para abri-las individualmente. A vista **Interna** abre todas e exibe a eletrônica.

O firmware do Wokwi não acompanha o repositório. As transições de configuração foram implementadas conforme o fluxo descrito para o simulador.
