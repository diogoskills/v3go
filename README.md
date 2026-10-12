# v3go — Controle de fatura

Site em HTML, CSS e JavaScript puro, com interface responsiva em português do Brasil. Funciona sem backend, instalação, compilação ou serviços externos.

## Abrir

Extraia `v3go web.zip` ou baixe o repositório. Mantenha `index.html`, `style.css` e `script.js` juntos na pasta `v3go web` e abra `index.html` no navegador.

## Faturas por mês e ano

Uma base nova começa **sem lançamentos e com valores zerados em todos os meses, inclusive outubro de 2026**. Permanecem somente as categorias iniciais, as configurações e o dia de vencimento padrão (05). Nenhum dado da planilha é importado automaticamente.

O seletor usa mês e ano. Cada período tem seus próprios lançamentos e status de pagamento; adicionar, editar ou excluir um lançamento não modifica os outros meses. Categorias, etiquetas e dia de vencimento são compartilhados.

As alterações são salvas em `localStorage`, no mesmo navegador e endereço do site. Não há sincronização entre dispositivos. Falhas de leitura ou gravação são informadas.

## Pagamento e vencimento

No intervalo da fatura, **Marcar como paga** registra uma confirmação manual exclusivamente para o período selecionado. A mensagem passa a ser **Fatura paga**, em verde, com indicador completo. A data de vencimento e o intervalo permanecem visíveis. **Marcar como não paga** desfaz a confirmação e restaura a mensagem e a barra segundo a data atual. Essas ações não alteram lançamentos nem valores.

O dia de vencimento pode ser alterado nas Configurações, entre 1 e 31, para todos os meses. Quando o dia não existe, usa-se o último dia do mês. A barra de proximidade considera o intervalo entre os vencimentos do mês anterior e do mês selecionado, usando o calendário local e diferenças em dias civis. Texto e cores distinguem data distante, próxima, hoje, passada e pagamento confirmado.

## Composição e soma personalizada

O total geral soma todos os lançamentos do período, uma única vez cada. A composição apresenta o subtotal de cada categoria, inclusive zero para categorias vazias, e inclui **Sem categoria** quando houver registros nessa condição. A expressão acompanha a criação, renomeação e exclusão de categorias.

**Somar categorias** abre uma consulta com caixas de seleção, subtotais e o resultado **Soma das categorias selecionadas**. Ao abrir, todas as opções disponíveis ficam selecionadas. É possível selecionar ou desmarcar todas; nenhuma seleção resulta em zero. A expressão mostra quais categorias entram na consulta.

Com o painel aberto, a seleção acompanha alterações nos lançamentos e a troca de período. Categorias novas entram na consulta e categorias removidas deixam a seleção. A escolha de “Sem categoria” é preservada mesmo quando se passa por um mês sem esses lançamentos. Reabrir o painel seleciona todas novamente. Essa seleção é temporária: não altera o total geral, os registros nem o pagamento. No celular, o resultado fica abaixo das opções.

Valores em branco não entram na soma. A lógica financeira trabalha em centavos inteiros e é separada da interface no objeto `InvoiceMath`. Etiquetas não mudam os cálculos. Não há fórmulas automáticas de juros, descontos ou parcelamento.

## Categorias e etiquetas

Categorias classificam lançamentos; cada registro pode ter uma etiqueta opcional. É possível criar opções no formulário sem perder o preenchimento, com seleção automática da nova opção. Nas Configurações, todas as opções podem ser criadas, renomeadas e excluídas, inclusive as iniciais.

Nomes vazios, duplicados ou reservados são rejeitados; a comparação normaliza espaços, maiúsculas, minúsculas e acentos. A renomeação usa identificadores estáveis e aparece em todos os meses. A exclusão pede confirmação e permite transferir vínculos ou deixá-los sem categoria/etiqueta, preservando lançamentos, valores e pagamentos.

## Atualização e preservação dos dados

A versão atual salva em `v3go.invoice.v3`. Ao abrir uma instalação existente:

- A versão mensal anterior (`v3go.invoice.v2`) é migrada preservando todos os períodos, lançamentos, categorias, etiquetas, vencimento e período selecionado. Faturas sem informação de pagamento começam sem confirmação.
- A primeira versão (`v3go.invoice.v1`), que tinha uma única lista compartilhada, mantém essa lista em outubro de 2026, conforme a migração estabelecida anteriormente.
- As chaves anteriores ficam intactas como cópias de segurança. Depois que a versão atual existe, não são importadas novamente.
- Dados existentes **não são apagados para aplicar a inicialização vazia**. Mesmo registros anteriormente importados são preservados, pois não é possível distingui-los com segurança de registros que o usuário decidiu manter.
- Uma base inválida não é sobrescrita silenciosamente. O salvamento é suspenso e o usuário recebe um aviso.

**Apagar dados salvos**, com confirmação, remove lançamentos e status de pagamento de todos os meses, mantendo as configurações legíveis. Quando os dados não podem ser lidos, essa ação redefine uma base vazia com configurações padrão. A função antiga de restaurar lançamentos preenchidos da planilha foi retirada para adequar a produção à base vazia solicitada.

## Verificações

A suíte `tests/check_browser.py` verifica no Chromium: inicialização vazia nos 24 meses de dois anos, isolamento mensal, cálculos exatos, composição dinâmica, inclusão de registros sem categoria, soma personalizada e ações de seleção, atualização da consulta após edição e troca de mês, categorias/etiquetas, pagamento e reversão antes/no dia/depois do vencimento, persistência, migração das versões anteriores, proteção de dados inválidos, datas de fim de mês, ano bissexto, virada de ano e layout móvel com várias categorias.

Para executar a suíte em um ambiente de desenvolvimento com Python, Playwright e Chromium disponível, use `python tests/check_browser.py`. Ela inicia seu próprio servidor local temporário e usa apenas dados fictícios de teste. Essas ferramentas não são necessárias para abrir o site. O navegador gerenciado do ambiente bloqueia `file://`, por isso os testes de interface usam HTTP local.

## Arquivos

- `v3go web/index.html`: estrutura, formulários e controles.
- `v3go web/style.css`: visual e layout responsivo.
- `v3go web/script.js`: cálculos, calendário, pagamento, migração, consulta e armazenamento.
- `v3go web.zip`: cópia atualizada dos três arquivos.
- `tests/check_browser.py`: suíte de regressão.
- `New Fatura Junho 2026.xlsx` e `prompt.txt`: referência histórica do projeto.
