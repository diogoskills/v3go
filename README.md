# v3go — Controle de fatura

Aplicação de gerenciamento de fatura em HTML, CSS e JavaScript puro, baseada na planilha `New Fatura Junho 2026.xlsx`. Interface responsiva em português do Brasil, sem backend, serviços externos ou ferramentas de compilação.

## Como abrir

1. Baixe o repositório ou extraia `v3go web.zip`.
2. Mantenha `index.html`, `style.css` e `script.js` juntos na pasta `v3go web`.
3. Abra `v3go web/index.html` no navegador. Não é necessário instalar dependências.

## Como usar

- Adicione lançamentos com descrição, grupo e valor em reais. O valor pode ficar vazio.
- Edite ou exclua registros pelos botões da tabela; a exclusão pede confirmação.
- Use os filtros de grupo e a busca por descrição. O subtotal dos resultados acompanha os filtros; o total da fatura inclui todos os registros.
- Altere o mês e o ano para identificar a fatura. Isso não cria outra fatura nem gera parcelas.
- As alterações ficam em `localStorage` neste navegador. Use o mesmo navegador e endereço do arquivo para recuperá-las. Se o armazenamento estiver bloqueado, a aplicação exibe um aviso.
- “Apagar dados salvos” deixa a fatura vazia, inclusive ao reabrir. “Restaurar dados da planilha” repõe os 33 lançamentos originais e junho de 2026. Ambas as ações pedem confirmação.

## Regras preservadas

A planilha possui uma aba, `Planilha1`, com três grupos. Descrição e valor são entradas; os subtotais e totais são calculados automaticamente.

| Resultado | Fórmula original | Valor conferido |
| --- | --- | --- |
| Itens fixos | `D36 = SUM(D7:D35)` | R$ 376,10 |
| Itens flexíveis | `G36 = SUM(G7:G35)` | R$ 118,62 |
| Moisés | `L6 = SUM(J6:J17)` | R$ 157,49 |
| Fixos + flexíveis | `D39 = B39+C39` | R$ 494,72 |
| Total da fatura | `F39 = SUM(D39,L6)` | R$ 652,21 |

Os valores são armazenados e somados em centavos inteiros para evitar erros de arredondamento. A lógica financeira está separada da interface no objeto `InvoiceMath`, em `script.js`. A entrada monetária aceita a notação brasileira, por exemplo `49,99` e `1.234,56`, com até duas casas decimais.

## Simplificações e limites

- Os três blocos da planilha viraram uma tabela com grupos e quantidade livre de lançamentos.
- “Mochila” permanece sem valor e não entra na soma.
- Parcelas como “12/12” e “1/2” permanecem nas descrições. A coluna “Parcelas” está vazia; nenhuma multiplicação ou geração de parcelas futuras foi inventada.
- A seção “Mãe” está vazia e não possui fórmula; foi omitida.
- “Iof” é apenas um lançamento preenchido, sem cálculo automático de imposto. Não há regras de vencimentos, juros ou descontos.
- Junho de 2026 foi obtido do nome do arquivo; o período é uma identificação editável.
- Os dados iniciais são reais, importados da planilha, e não exemplos fictícios. A aplicação não relê o Excel quando ele é alterado.
- Os dados ficam somente no navegador: não há sincronização entre dispositivos. O ZIP contém uma cópia dos três arquivos da aplicação.

## Validação realizada

Os cinco resultados acima coincidiram com os valores das fórmulas salvos no Excel. Foram testados no Chromium: inclusão e edição, exclusão e limpeza com confirmação, filtros e busca, valores vazios, validação de casas decimais, persistência ao recarregar, restauração da planilha, recuperação de armazenamento inválido e layout móvel de 390 px, sem erros de JavaScript.

O navegador de testes bloqueou `file://` por política do ambiente; os testes funcionais usaram um servidor local temporário. Os arquivos da aplicação não dependem desse servidor, de rede ou de bibliotecas externas.

## Arquivos

- `v3go web/index.html`: estrutura e controles.
- `v3go web/style.css`: identidade visual e adaptação para celular.
- `v3go web/script.js`: dados iniciais, cálculos, interação e armazenamento.
- `v3go web.zip`: pacote pronto para extrair e abrir.
- `New Fatura Junho 2026.xlsx`: referência original dos cálculos.
- `prompt.txt`: pedido original.
