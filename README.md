# v3go — Controle de fatura

Aplicação em HTML, CSS e JavaScript puro, com visual responsivo em português do Brasil, baseada em `New Fatura Junho 2026.xlsx`. Não exige backend, serviços externos, instalação nem compilação.

## Abrir e usar

1. Baixe o repositório ou extraia `v3go web.zip`.
2. Mantenha os três arquivos de `v3go web` juntos e abra `index.html` no navegador.
3. Selecione o mês e o ano. Adicione, edite, exclua e filtre lançamentos por categoria, etiqueta ou descrição.
4. Em **Configurações**, gerencie categorias e etiquetas e altere o dia de vencimento.

Os dados são salvos automaticamente em `localStorage`, no mesmo navegador e endereço do arquivo. Falhas de leitura ou gravação são informadas na interface. Não há sincronização entre dispositivos.

## Meses independentes e migração

- Na primeira abertura, **outubro de 2026** recebe os 33 lançamentos da base padrão, com total de **R$ 652,21**. A fonte continua sendo a planilha de junho; o período de uso foi alterado por solicitação.
- Os demais meses e anos começam vazios. Trocar o seletor não copia nem renomeia lançamentos. Cada fatura usa uma chave `AAAA-MM`.
- Ao atualizar da versão anterior, toda a lista que estava salva, incluindo edições, lançamentos adicionados, exclusões e valores vazios, é preservada em outubro de 2026. O período antigo não era um histórico: era só um rótulo de uma lista compartilhada.
- A nova base usa `v3go.invoice.v2`: período selecionado, configurações globais e lançamentos por mês. A chave antiga `v3go.invoice.v1` fica intacta como cópia de segurança e não é reutilizada depois que a nova base existe.
- Categorias, etiquetas e dia de vencimento são globais; lançamentos e totais são mensais. Uma fatura esvaziada pelo usuário não é preenchida automaticamente ao reabrir.
- **Restaurar base em outubro de 2026** substitui somente os lançamentos de outubro pela planilha original. Mantém os outros meses e as configurações; se uma categoria original foi removida, recupera a classificação necessária. Pede confirmação.
- **Apagar dados salvos** apaga os lançamentos de todos os meses, preservando categorias, etiquetas e vencimento. Pede confirmação. Quando a base salva é ilegível, a redefinição explícita recupera as configurações padrão porque as configurações antigas não podem ser lidas com segurança.

## Categorias e etiquetas

Fixos, Flexíveis e Moisés permanecem **categorias**, como os grupos originais do site. A etiqueta é uma marcação adicional e opcional; cada lançamento aceita uma etiqueta. Não há etiquetas iniciais inventadas.

É possível criar categorias e etiquetas no formulário, sem perder o lançamento que está sendo preenchido. A nova opção é selecionada automaticamente e fica disponível em todos os meses. As opções também podem ser criadas, renomeadas ou excluídas em Configurações, inclusive as iniciais.

Nomes vazios, duplicados e nomes reservados (“Sem categoria”/“Sem etiqueta”) são rejeitados. A comparação normaliza maiúsculas, minúsculas, espaços extras e acentos. Os vínculos usam identificadores estáveis: renomear uma opção atualiza sua exibição em todos os meses. Excluir pede confirmação e permite transferir os vínculos para outra opção ou deixá-los sem classificação. Lançamentos e valores são preservados. Registros sem categoria também entram no total.

## Vencimento

- Dia padrão: **05**, alterável entre 1 e 31, compartilhado por todos os meses.
- Se o dia não existir no mês, usa o último dia, incluindo fevereiro de anos bissextos.
- A barra representa o intervalo entre o vencimento do mês anterior e o do mês selecionado: 0% antes do intervalo, avanço proporcional e 100% na data ou depois dela.
- Datas e diferenças de dias seguem o calendário local do usuário. As diferenças são calculadas em dias civis para evitar desvios de horário de verão.
- Mensagens distinguem data distante, próxima (até 7 dias), hoje e passada, com texto e cores. A data passada não é apresentada como atraso de pagamento: não há informação de pagamento nesta aplicação.
- O indicador se atualiza ao mudar de período, alterar o dia, voltar à aba e a cada minuto.

## Cálculos preservados

A planilha tem uma aba, `Planilha1`. Os valores financeiros são armazenados e somados em **centavos inteiros**. `InvoiceMath` mantém os cálculos separados da interface; `DueCalendar` concentra as regras do calendário.

| Resultado da base original | Fórmula no Excel | Valor conferido |
| --- | --- | --- |
| Fixos | `D36 = SUM(D7:D35)` | R$ 376,10 |
| Flexíveis | `G36 = SUM(G7:G35)` | R$ 118,62 |
| Moisés | `L6 = SUM(J6:J17)` | R$ 157,49 |
| Fixos + flexíveis | `D39 = B39+C39` | R$ 494,72 |
| Total da fatura | `F39 = SUM(D39,L6)` | R$ 652,21 |

O total soma todos os lançamentos do mês selecionado, independentemente dos filtros, categorias ou etiquetas. O subtotal da tabela acompanha os filtros. O resumo adicional de Fixos + Flexíveis permanece enquanto essas duas categorias existirem e acompanha seus nomes atualizados.

Valores vazios não entram na soma; “Mochila” permanece sem valor. Entradas aceitam notação brasileira, como `49,99` e `1.234,56`, com até duas casas decimais. Parcelas nas descrições (“12/12”, “1/2”) não geram nem multiplicam lançamentos futuros. “Iof” é apenas um valor preenchido, sem fórmula tributária. A seção “Mãe”, vazia, foi omitida. Não há regras automáticas de juros ou descontos. O vencimento e as etiquetas são recursos adicionados por solicitação, não fórmulas do Excel.

A aplicação não relê automaticamente o Excel; os dados originais ficam incorporados em `script.js`. O ZIP é uma cópia dos três arquivos atuais do site.

## Validação

Verificados no Chromium: totais da base, meses e anos independentes, inclusão/edição/exclusão isoladas, criação de opções no formulário, seleção automática, nomes duplicados, renomeação global, exclusão com transferência ou sem classificação, persistência, migração da versão anterior (incluindo base vazia), recuperação explícita de dados inválidos, vencimento antes/no dia/depois, progresso, fim de mês, ano bissexto, virada de ano e layout móvel de 390 px. Sem erros de JavaScript nos cenários executados.

O navegador gerenciado do ambiente bloqueia `file://`; os testes usam um servidor local temporário. O site continua independente desse servidor.

A suíte de regressão está em `tests/check_browser.py`. Para executá-la em um ambiente de desenvolvimento com Python e Playwright, rode `python tests/check_browser.py`. Ela usa Chromium instalado no sistema ou um navegador instalado pelo Playwright e sobe seu próprio servidor local. Essas ferramentas são necessárias somente para a suíte; para usar o site basta abrir o HTML.

## Arquivos

- `v3go web/index.html`: estrutura e controles.
- `v3go web/style.css`: identidade visual e layout responsivo.
- `v3go web/script.js`: dados da base, migração, cálculos, calendário, interface e armazenamento.
- `v3go web.zip`: pacote completo do site.
- `tests/check_browser.py`: regressão de interface e persistência.
- `New Fatura Junho 2026.xlsx`: referência original.
- `prompt.txt`: pedido inicial.
