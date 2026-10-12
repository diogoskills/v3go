# v3go — Seu mês financeiro

Aplicação em HTML, CSS e JavaScript puro, com visual responsivo em português do Brasil. Organiza lançamentos, fatura, recebimentos e saldos por mês e ano. Sem backend, instalação, compilação ou integração bancária.

## Abrir

Extraia `v3go web.zip` ou baixe o repositório. Mantenha `index.html`, `style.css` e `script.js` juntos na pasta `v3go web` e abra `index.html` no navegador. A imagem padrão está incorporada ao CSS: não há arquivo de imagem obrigatório nem dependência de rede.

Uma base nova não contém lançamentos, compras, pagamentos ou recebimentos confirmados. O salário aparece apenas como configuração e previsão até a confirmação. As categorias iniciais incluem Fixos, Flexíveis, Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras e Outros; a categoria Moisés, que já existia, também é mantida.

## Visão mensal e lançamentos

Selecione mês e ano no cabeçalho. A tabela permite adicionar, editar e excluir entradas e saídas, com descrição, valor, data, categoria e uma etiqueta opcional. Entradas podem ser Previstas ou Recebidas; saídas, Pendentes ou Pagas. As formas de pagamento incluem cartão de crédito, Pix, débito, dinheiro, transferência e outro.

A data de um novo lançamento começa na data atual do dispositivo, mesmo se o período selecionado for diferente. Pode ser alterada; ao salvar uma data vazia, usa-se hoje. Editar mantém os vínculos de planejamento existentes; não há mais metodologia de vincular despesas às quinzenas na interface. Metadados antigos são preservados no armazenamento para não apagar informações existentes, mas não participam dos cálculos.

Os cabeçalhos **Tipo** e **Data** são botões: Tipo alterna entradas/saídas primeiro; Data alterna mais recentes/mais antigos primeiro. A seta e o atributo acessível indicam a ordenação ativa. A ordem inicial é por data mais recente. Datas iguais preservam a ordem de criação, inclusive após editar ou recarregar; datas históricas não informadas ficam ao final. A ordenação afeta somente a consulta.

Os filtros de tipo, categoria, etiqueta e descrição afetam somente a tabela. A soma dos valores exibidos é uma consulta de valores, não um saldo líquido. A composição e a soma personalizada por categorias continuam disponíveis e consideram somente as compras no cartão que compõem a fatura.

Valores em branco ficam fora dos cálculos; uma confirmação de novo lançamento precisa de um valor. Valores negativos permitem ajustes e invertem o efeito do lançamento. Os cálculos e a formatação usam centavos inteiros, sem arredondar valores monetários intermediários.

## Regras financeiras e ausência de duplicidade

O resumo do período diferencia:

- **Entradas previstas:** lançamentos previstos mais quinzenas ainda não confirmadas.
- **Entradas recebidas:** lançamentos recebidos mais os valores reais das quinzenas confirmadas.
- **Saídas previstas:** saídas fora do cartão pendentes mais o valor ainda devido na fatura.
- **Saídas pagas:** saídas fora do cartão pagas mais o pagamento registrado da fatura, uma única vez.
- **Saldo disponível do mês:** saldo bancário de referência mais entradas recebidas menos saídas pagas, somente com data posterior à referência e até hoje.
- **Saldo previsto:** saldo de referência, movimentos realizados posteriores até a data escolhida e entradas/saídas ainda pendentes até esse dia.
- **Gastos do mês:** todas as saídas, incluindo compras no cartão uma única vez. O pagamento da fatura não é somado como outra despesa.

Uma compra no cartão entra nos gastos e na fatura, mas não desconta dinheiro disponível imediatamente. Seu status individual no cartão também não gera essa saída de dinheiro. Use o botão de pagamento da fatura para registrar a movimentação; não cadastre a mesma fatura novamente como uma despesa manual.

O pagamento pede valor e data reais e pode ser corrigido ou desfeito. O valor pago fica registrado: alterar compras depois não muda silenciosamente a saída de dinheiro já confirmada. Se houver restante positivo, o resumo inclui-o nas saídas previstas e a fatura mostra “Pagamento parcial”. Um valor acima da fatura permanece como pagamento informado, com a diferença visível para revisão. Não são gerados lançamentos duplicados de despesa.

Os saldos partem do valor bancário informado pelo usuário para o período selecionado. Não há integração bancária nem carregamento automático do saldo de outro mês. Cada registro pertence ao período selecionado, mesmo se sua data real for anterior, como em um recebimento antecipado. O salário não paga automaticamente a fatura.

A lógica financeira está separada da interface em `InvoiceMath` e `FinanceMath`; `DueCalendar` mantém as regras do calendário local.

## Saldo atual e previsão por data

Logo abaixo do cabeçalho, informe o saldo disponível no banco e sua data de referência, inicialmente hoje. Depois de salvar, o formulário recolhe para um resumo discreto com valor, data e **Editar saldo**. A previsão por data permanece acessível. O formulário fica aberto nos meses sem saldo informado; saldos já existentes aparecem recolhidos ao reabrir o site. A referência e a data de previsão são salvas por mês e ano, sem misturar períodos. Enquanto o saldo não for informado, é usado zero com um aviso claro.

A referência representa o **final do dia informado**. Movimentos realizados nessa data ou antes dela já estão incluídos no saldo e não são somados ou descontados novamente. Somente movimentos realizados em datas posteriores e até hoje alteram o saldo disponível. Se houver novas movimentações no mesmo dia da referência, atualize o saldo bancário informado; a aplicação não tem horários para distinguir movimentações dentro desse dia.

Escolha a data de previsão, igual ou posterior à referência. O saldo previsto considera os movimentos realizados após a referência até essa data e as entradas/saídas ainda pendentes com vencimento ou data prevista até ela, inclusive pendências vencidas. Considera somente o mês e ano selecionados. As quinzenas não recebidas entram como previsões, sem o salário bruto; depois da confirmação, sua entrada real substitui a previsão no cálculo.

Exemplo de verificação solicitado: referência de R$ 1.000,00 no dia 12, saída pendente de R$ 644,72 até o dia 15 e segunda quinzena prevista de R$ 750,00 nesse dia resultam em **R$ 1.105,28**. A primeira quinzena, recebida antes da referência, já está incluída nela e não entra de novo.

Movimentos sem data continuam nos registros e totais mensais, mas ficam fora dos saldos por data. O botão “?” informa essa limitação: preencha suas datas para incluí-los com segurança. A referência bancária não é recalculada ao editar registros já incluídos nela; ela permanece o valor informado pelo usuário.

## Explicações e categorias

Os indicadores têm um botão **?**, acessível por hover, foco de teclado ou toque. O pop-up mostra a fórmula curta, os itens, valores e datas considerados, e o total. Nos saldos, inclui a referência e as movimentações efetivamente usadas; explica exclusões por referência ou falta de data. Usa os mesmos itens da função financeira, evitando cálculos paralelos. Há fade suave, limites de largura/altura e rolagem interna. Mantém-se aberto durante a interação, a seta para baixo no botão “?” leva o foco à lista para rolagem pelo teclado; pode ser fechado pelo botão, Escape ou clicando fora e respeita preferência por movimento reduzido.

As categorias de filtro ficam em uma única faixa com rolagem horizontal, botões laterais e navegação por toque, sem ampliar a página. Filtros continuam afetando somente a tabela.

## Cartão visual

O cartão usa uma imagem ilustrativa com identidade Nubank, criada para a interface e incorporada ao CSS. Não é um cartão real nem uma imagem oficial fornecida pelo banco. O fundo ocupa toda a área com `cover`, proporção de cartão e posicionamento central, sem esticar. Um blur sutil é aplicado somente à camada de fundo, padrão ou personalizada. A camada de contraste e os textos permanecem nítidos. Ao lado do cartão ficam vencimento, status, a ação de pagamento e, quando necessário, a correção do pagamento. Não há controles de vinculação a quinzenas.

**Trocar imagem** aceita PNG, JPEG, WebP ou AVIF do dispositivo, até 10 MB. A imagem é validada, reduzida proporcionalmente e armazenada como JPEG para limitar o uso de espaço. **Restaurar padrão** remove somente a personalização. Não são solicitados número de cartão, código de segurança ou dados bancários.

## Salário e quinzenas

A aba tem os seguintes padrões editáveis:

| Configuração | Padrão |
| --- | --- |
| Salário bruto de referência | R$ 1.772,00 |
| Primeira quinzena prevista | R$ 866,00 — dia 05 |
| Segunda quinzena prevista | R$ 750,00 — dia 15 |

As previsões somam R$ 1.616,00. A diferença de R$ 156,00 em relação ao bruto é informativa, sem presumir descontos ou gerar despesa. O bruto não vira uma terceira entrada.

Cada quinzena tem **Marcar como recebida**, podendo receber antes da data prevista. Informe a data real e o valor efetivo. O status passa a **Recebida**, em verde, e os saldos são atualizados conforme a escolha de inclusão e a referência. **Corrigir recebimento** substitui o valor/data da mesma confirmação e entrada; **Desfazer** devolve-a a prevista e remove a entrada recebida vinculada. Editar o valor/data dessa entrada na tabela atualiza a confirmação. Alterá-la para Prevista ou excluí-la também desfaz o recebimento. A descrição, categoria e etiqueta editadas são preservadas ao corrigir o recebimento. Essas operações são independentes por quinzena, mês e ano. Uma quinzena confirmada cria ou atualiza uma única entrada vinculada na tabela, com descrição, valor e data real. Essa entrada é o mesmo recebimento, não um segundo valor.

Ao salvar a configuração de salário, ela vale para o mês selecionado e como padrão dos meses ainda não configurados. Confirmar um recebimento salva a configuração mensal completa, incluindo previsões e valores reais. Alterar padrões em outro mês não modifica essa configuração salva nem os recebimentos já confirmados.

## Recebimentos e impacto no saldo

As duas quinzenas ficam lado a lado no computador e empilhadas no celular, ordenadas pelas datas configuradas. Cada cartão reúne valor previsto ou recebido, datas, status, ações de confirmação/correção/reversão e a indicação de impacto no saldo. A previsão financeira continua baseada nas datas de entradas e saídas; não exige alocações. Listas, campos e ações de vincular compromissos foram removidos.

Em toda confirmação ou correção, escolha explicitamente:

- **Incluir no saldo:** o recebimento participa dos cálculos conforme as datas. Valores realizados na referência ou antes dela já estão no saldo informado e continuam excluídos para evitar duplicidade.
- **Apenas marcar como recebida:** o valor já está refletido no saldo informado e não é adicionado ao saldo disponível nem ao previsto, independentemente da data real. A entrada permanece no histórico e nos totais de entradas recebidas, com a indicação **Já considerado no saldo de referência**.

A escolha é independente por quinzena, mês e ano; pode ser alterada em **Corrigir recebimento**, sem criar outra entrada. Editar a entrada vinculada mantém a escolha. Desfazer/excluir mantém a sincronia com a quinzena. Em uma base antiga sem essa opção, o comportamento anterior é preservado: inclusão conforme a data de referência. Nenhum recebimento salvo é excluído automaticamente. O bruto permanece somente uma referência e não gera entrada adicional.

A ação **Corrigir pagamento da fatura** fica junto ao vencimento/status quando existe um pagamento, preservando a correção de valor e data após remover as listas de compromissos.

## Categorias, etiquetas e vencimento

Categorias e etiquetas são globais, com criação no formulário e gerenciamento nas Configurações. Nomes vazios, duplicados ou reservados são rejeitados; a comparação normaliza espaços, maiúsculas, minúsculas e acentos. Renomear atualiza os vínculos; excluir pede confirmação e permite transferir ou deixar sem classificação, preservando lançamentos e valores.

O vencimento padrão é dia 05, editável entre 1 e 31 para todos os meses. Quando o dia não existe, usa-se o último dia. A barra considera o intervalo entre os vencimentos consecutivos, com datas locais e diferenças em dias civis. Texto e cores distinguem proximidade, data passada, pagamento parcial e fatura paga.

## Armazenamento e migração

A versão atual usa `v3go.invoice.v5` em `localStorage`, contendo lançamentos mensais, categorias/etiquetas, salário padrão, configurações e recebimentos mensais (incluindo a escolha `includeInBalance` de cada quinzena), metadados de planejamento antigos preservados, pagamento da fatura, imagem personalizada, referências de saldo e datas de previsão por mês e ano. Use o mesmo navegador e endereço do site para restaurar esses dados. Não há sincronização entre dispositivos.

Versões anteriores são migradas sem apagar dados e suas chaves são mantidas como cópias de segurança:

- **v4:** preserva lançamentos, recebimentos, salário, imagem, vínculos e pagamentos. Cada quinzena já confirmada ganha uma entrada vinculada, sem ser contada novamente. Entradas manuais existentes permanecem intactas e não são mescladas por nome ou valor. A migração não cria um saldo bancário fictício; é necessário informar a referência.
- **v3/v2:** preservam cada período, lançamento, valor, categoria, etiqueta e vencimento. Como o site anterior controlava apenas fatura, os lançamentos são classificados como saídas no cartão. Categorias iniciais ausentes são adicionadas sem duplicar nomes ou substituir categorias renomeadas.
- **v3 paga:** o pagamento anterior é preservado, com valor equivalente à fatura existente durante a migração e data não informada. O usuário pode corrigir esse pagamento. Não se inventa uma data histórica.
- **v1:** a lista compartilhada permanece em outubro de 2026, conforme a migração estabelecida.
- Datas de lançamentos anteriores, que não existiam, permanecem **Não informada**. Podem ser preenchidas ao editar.
- Uma base atual válida não reimporta as cópias antigas. Uma base inválida não é sobrescrita silenciosamente: o salvamento é suspenso e há um aviso.

**Apagar dados salvos**, com confirmação, remove lançamentos, pagamentos, vínculos mensais, recebimentos de salário e referências de saldo de todos os meses. Mantém configurações globais legíveis, salário padrão e imagem. Se os dados não podem ser lidos, redefine uma base vazia com padrões. Falhas de gravação são informadas; em caso de falta de espaço, não se promete persistência das alterações da sessão.

## Visual e navegação

O redesign se inspira nas referências de dashboards claros, com luz difusa no fundo, gradientes suaves, transparência discreta e sombras leves, com saldos em destaque na primeira linha, movimentações abaixo, ícones consistentes e cartões arredondados. Os indicadores usam roxo para fatura, verde para disponível, azul para entradas recebidas, âmbar para previstas e vermelho suave para saídas. Rótulos e detalhes continuam distinguindo os valores. A navegação destaca a seção escolhida e diferencia esse estado do hover. Todos os itens ficam acessíveis também no celular. Botões, links e campos têm transições curtas, foco visível e suporte a toque; a preferência de redução de movimento é respeitada. As regras financeiras permanecem as mesmas.

## Verificações executadas

A suíte `tests/check_browser.py` verifica no Chromium:

- Base sem lançamentos, categorias sem duplicidade, salário previsto e bruto excluído dos saldos.
- Entradas/saídas, status, formas de pagamento e cálculos em centavos.
- Recebimento antecipado, correção repetida sem duplicidade e reversão das quinzenas.
- Entradas vinculadas às quinzenas, edição pelos dois caminhos, reversão, exclusão e migração sem duplicação.
- Saldo por referência e data, exclusão de movimentos já incluídos, separação entre disponível e previsto e exemplo exato de R$ 1.105,28.
- Pop-ups por mouse/teclado/toque, limites e rolagem, faixa horizontal de categorias e blur somente na imagem.
- Isolamento de meses/anos e preservação de confirmações anteriores após alterar padrões.
- Compra no cartão contada uma vez, pagamento com valor fixado, restante, correção e reversão sem duplicar gasto.
- Previsão por datas sem alocações, painel de recebimentos simplificado e ausência de controles de vinculação.
- Categorias, consultas da fatura, upload/restauração da imagem e persistência.
- Layout de computador/celular, proporção do cartão, navegação por teclado e diálogos.
- Migração de todas as versões anteriores e proteção de dados inválidos.

A suíte `tests/check_redesign.py` verifica data automática e manual, fallback de data vazia, ordenação e desempate persistente, preservação de dados ao editar, navegação ativa, cores dos resumos, duas colunas no computador e empilhamento com ações por toque no celular.

A suíte `tests/check_receipt_balance.py` verifica recolhimento/edição/persistência do saldo, escolha obrigatória em toda confirmação, inclusão/exclusão nos dois saldos, preservação das entradas históricas, correção sem duplicidade, compatibilidade dos recebimentos antigos e layout responsivo.

Para executar, use `python tests/check_browser.py`, `python tests/check_redesign.py` e `python tests/check_receipt_balance.py` em um ambiente com Python, Playwright e Chromium instalado. A suíte inicia um servidor local temporário e utiliza somente dados fictícios de teste. Esses programas não são necessários para usar o site. O navegador gerenciado do ambiente bloqueia `file://`, por isso os testes usam HTTP local.

## Arquivos

- `v3go web/index.html`, `style.css`, `script.js`: aplicação completa.
- `v3go web.zip`: cópia dos três arquivos para distribuição.
- `tests/check_browser.py`, `tests/check_redesign.py` e `tests/check_receipt_balance.py`: regressão financeira e de interface.
- `New Fatura Junho 2026.xlsx` e `prompt.txt`: referência histórica, sem importação automática.
