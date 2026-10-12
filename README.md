# v3go — Seu mês financeiro

Aplicação em HTML, CSS e JavaScript puro, com visual responsivo em português do Brasil. Organiza lançamentos, fatura, recebimentos e compromissos por mês e ano. Sem backend, instalação, compilação ou integração bancária.

## Abrir

Extraia `v3go web.zip` ou baixe o repositório. Mantenha `index.html`, `style.css` e `script.js` juntos na pasta `v3go web` e abra `index.html` no navegador. A imagem padrão está incorporada ao CSS: não há arquivo de imagem obrigatório nem dependência de rede.

Uma base nova não contém lançamentos, compras, pagamentos ou recebimentos confirmados. O salário aparece apenas como configuração e previsão até a confirmação. As categorias iniciais incluem Fixos, Flexíveis, Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras e Outros; a categoria Moisés, que já existia, também é mantida.

## Visão mensal e lançamentos

Selecione mês e ano no cabeçalho. A tabela permite adicionar, editar e excluir entradas e saídas, com descrição, valor, data, categoria e uma etiqueta opcional. Entradas podem ser Previstas ou Recebidas; saídas, Pendentes ou Pagas. As formas de pagamento incluem cartão de crédito, Pix, débito, dinheiro, transferência e outro.

Os filtros de tipo, categoria, etiqueta e descrição afetam somente a tabela. A soma dos valores exibidos é uma consulta de valores, não um saldo líquido. A composição e a soma personalizada por categorias continuam disponíveis e consideram somente as compras no cartão que compõem a fatura.

Valores em branco ficam fora dos cálculos; uma confirmação de novo lançamento precisa de um valor. Valores negativos permitem ajustes e invertem o efeito do lançamento. Os cálculos e a formatação usam centavos inteiros, sem arredondar valores monetários intermediários.

## Regras financeiras e ausência de duplicidade

O resumo do período diferencia:

- **Entradas previstas:** lançamentos previstos mais quinzenas ainda não confirmadas.
- **Entradas recebidas:** lançamentos recebidos mais os valores reais das quinzenas confirmadas.
- **Saídas previstas:** saídas fora do cartão pendentes mais o valor ainda devido na fatura.
- **Saídas pagas:** saídas fora do cartão pagas mais o pagamento registrado da fatura, uma única vez.
- **Saldo disponível do mês:** entradas recebidas menos saídas pagas.
- **Saldo projetado:** entradas recebidas e previstas menos saídas pagas e pendentes.
- **Gastos do mês:** todas as saídas, incluindo compras no cartão uma única vez. O pagamento da fatura não é somado como outra despesa.

Uma compra no cartão entra nos gastos e na fatura, mas não desconta dinheiro disponível imediatamente. Seu status individual no cartão também não gera essa saída de dinheiro. Use o botão de pagamento da fatura para registrar a movimentação; não cadastre a mesma fatura novamente como uma despesa manual.

O pagamento pede valor e data reais e pode ser corrigido ou desfeito. O valor pago fica registrado: alterar compras depois não muda silenciosamente a saída de dinheiro já confirmada. Se houver restante positivo, o resumo inclui-o nas saídas previstas e a fatura mostra “Pagamento parcial”. Um valor acima da fatura permanece como pagamento informado, com a diferença visível para revisão. Não são gerados lançamentos duplicados de despesa.

Os saldos são do orçamento do período selecionado, não saldos bancários. Não há carregamento automático do saldo de outro mês. Cada registro pertence ao período selecionado, mesmo se sua data real for anterior, como em um recebimento antecipado. O salário não paga automaticamente a fatura.

A lógica financeira está separada da interface em `InvoiceMath` e `FinanceMath`; `DueCalendar` mantém as regras do calendário local.

## Cartão visual

O cartão usa uma imagem ilustrativa com identidade Nubank, criada para a interface e incorporada ao CSS. Não é um cartão real nem uma imagem oficial fornecida pelo banco. O fundo ocupa toda a área com `cover`, proporção de cartão e posicionamento central, sem esticar. A camada de contraste mantém período, valor e status legíveis.

**Trocar imagem** aceita PNG, JPEG, WebP ou AVIF do dispositivo, até 10 MB. A imagem é validada, reduzida proporcionalmente e armazenada como JPEG para limitar o uso de espaço. **Restaurar padrão** remove somente a personalização. Não são solicitados número de cartão, código de segurança ou dados bancários.

## Salário e quinzenas

A aba tem os seguintes padrões editáveis:

| Configuração | Padrão |
| --- | --- |
| Salário bruto de referência | R$ 1.772,00 |
| Primeira quinzena prevista | R$ 866,00 — dia 05 |
| Segunda quinzena prevista | R$ 750,00 — dia 15 |

As previsões somam R$ 1.616,00. A diferença de R$ 156,00 em relação ao bruto é informativa, sem presumir descontos ou gerar despesa. O bruto não vira uma terceira entrada.

Cada quinzena tem **Marcar como recebida**, podendo receber antes da data prevista. Informe a data real e o valor efetivo. O status passa a **Recebida**, em verde, e os saldos são atualizados. **Corrigir recebimento** substitui o valor/data da mesma confirmação; **Desfazer** devolve-a a prevista. Essas operações são independentes por quinzena, mês e ano e não criam outro lançamento na tabela.

Ao salvar a configuração de salário, ela vale para o mês selecionado e como padrão dos meses ainda não configurados. Confirmar um recebimento salva a configuração mensal completa, incluindo previsões e valores reais. Alterar padrões em outro mês não modifica essa configuração salva nem os recebimentos já confirmados.

## Planejamento pelos recebimentos

Os dois recebimentos são apresentados pelas datas configuradas, sem pressupor que representam metades exatas do calendário. Dias inexistentes usam o último dia do mês.

Saídas fora do cartão podem ser vinculadas à primeira quinzena, à segunda, ao saldo disponível ou ficar sem vínculo. O pagamento da fatura é vinculado no painel da fatura ou no planejamento. Compras individuais no cartão não aparecem novamente como compromissos: a fatura é um único compromisso agregado.

Cada quinzena mostra previsão, recebimento efetivo, compromissos e quanto sobra ou falta, usando o real quando recebida e o previsto caso contrário. Os compromissos incluem pagos e pendentes para acompanhar o orçamento daquele recebimento. Valores não definidos são informados e ficam fora do total. Compromissos acima da previsão recebem destaque, assim como despesas com data anterior à entrada prevista/real vinculada.

Há áreas separadas para compromissos ainda não vinculados e para os que usarão saldo disponível. O saldo disponível já desconta pagamentos realizados; a área informa separadamente somente os compromissos pendentes ainda a cobrir.

## Categorias, etiquetas e vencimento

Categorias e etiquetas são globais, com criação no formulário e gerenciamento nas Configurações. Nomes vazios, duplicados ou reservados são rejeitados; a comparação normaliza espaços, maiúsculas, minúsculas e acentos. Renomear atualiza os vínculos; excluir pede confirmação e permite transferir ou deixar sem classificação, preservando lançamentos e valores.

O vencimento padrão é dia 05, editável entre 1 e 31 para todos os meses. Quando o dia não existe, usa-se o último dia. A barra considera o intervalo entre os vencimentos consecutivos, com datas locais e diferenças em dias civis. Texto e cores distinguem proximidade, data passada, pagamento parcial e fatura paga.

## Armazenamento e migração

A versão atual usa `v3go.invoice.v4` em `localStorage`, contendo lançamentos mensais, categorias/etiquetas, salário padrão, configurações e recebimentos mensais, vínculos de planejamento, pagamento da fatura e imagem personalizada. Use o mesmo navegador e endereço do site para restaurar esses dados. Não há sincronização entre dispositivos.

Versões anteriores são migradas sem apagar dados e suas chaves são mantidas como cópias de segurança:

- **v3/v2:** preservam cada período, lançamento, valor, categoria, etiqueta e vencimento. Como o site anterior controlava apenas fatura, os lançamentos são classificados como saídas no cartão. Categorias iniciais ausentes são adicionadas sem duplicar nomes ou substituir categorias renomeadas.
- **v3 paga:** o pagamento anterior é preservado, com valor equivalente à fatura existente durante a migração e data não informada. O usuário pode corrigir esse pagamento. Não se inventa uma data histórica.
- **v1:** a lista compartilhada permanece em outubro de 2026, conforme a migração estabelecida.
- Datas de lançamentos anteriores, que não existiam, permanecem **Não informada**. Podem ser preenchidas ao editar.
- Uma base atual válida não reimporta as cópias antigas. Uma base inválida não é sobrescrita silenciosamente: o salvamento é suspenso e há um aviso.

**Apagar dados salvos**, com confirmação, remove lançamentos, pagamentos, vínculos mensais e recebimentos de salário de todos os meses. Mantém configurações globais legíveis, salário padrão e imagem. Se os dados não podem ser lidos, redefine uma base vazia com padrões. Falhas de gravação são informadas; em caso de falta de espaço, não se promete persistência das alterações da sessão.

## Verificações executadas

A suíte `tests/check_browser.py` verifica no Chromium:

- Base sem lançamentos, categorias sem duplicidade, salário previsto e bruto excluído dos saldos.
- Entradas/saídas, status, formas de pagamento e cálculos em centavos.
- Recebimento antecipado, correção repetida sem duplicidade e reversão das quinzenas.
- Isolamento de meses/anos e preservação de confirmações anteriores após alterar padrões.
- Compra no cartão contada uma vez, pagamento com valor fixado, restante, correção e reversão sem duplicar gasto.
- Planejamento por data, compromissos vinculados e não vinculados, saldo disponível e excesso de orçamento.
- Categorias, consultas da fatura, upload/restauração da imagem e persistência.
- Layout de computador/celular, proporção do cartão, navegação por teclado e diálogos.
- Migração de todas as versões anteriores e proteção de dados inválidos.

Para executar, use `python tests/check_browser.py` em um ambiente com Python, Playwright e Chromium instalado. A suíte inicia um servidor local temporário e utiliza somente dados fictícios de teste. Esses programas não são necessários para usar o site. O navegador gerenciado do ambiente bloqueia `file://`, por isso os testes usam HTTP local.

## Arquivos

- `v3go web/index.html`, `style.css`, `script.js`: aplicação completa.
- `v3go web.zip`: cópia dos três arquivos para distribuição.
- `tests/check_browser.py`: regressão financeira e de interface.
- `New Fatura Junho 2026.xlsx` e `prompt.txt`: referência histórica, sem importação automática.
