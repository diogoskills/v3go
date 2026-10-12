"use strict";

// Lógica financeira: independente da interface e do armazenamento.
const InvoiceMath = Object.freeze({
  parseMoney(text) {
    const value = text.trim();
    if (value === "") return null;
    // Notação brasileira: 1234,56 ou 1.234,56. Sem conversões silenciosas.
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) {
      throw new Error("Informe um valor como 49,99 ou 1.234,56, com até duas casas decimais.");
    }
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").replace(/\./g, "").split(",");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    if (!Number.isSafeInteger(cents)) throw new Error("O valor informado é grande demais para ser calculado com precisão.");
    return negative ? -cents : cents;
  },
  sum(records) {
    return records.reduce((total, record) => {
      const result = total + (record.cents ?? 0);
      if (!Number.isSafeInteger(result)) throw new Error("A soma dos valores excede o limite de cálculo preciso.");
      return result;
    }, 0);
  },
  selectedTotal(records, categoryIds) {
    return this.sum(records.filter(record => categoryIds.has(record.categoryId ?? "uncategorized")));
  },
  calculate(records, categories = []) {
    const groups = Object.create(null);
    for (const category of [...categories, { id: "uncategorized" }]) {
      groups[category.id] = this.sum(records.filter(record => (record.categoryId ?? "uncategorized") === category.id));
    }
    return { groups, total: this.sum(records) };
  }
});

const $ = id => document.getElementById(id);
const STORAGE_KEY = "v3go.invoice.v5";
const PREVIOUS_KEYS = ["v3go.invoice.v4", "v3go.invoice.v3", "v3go.invoice.v2", "v3go.invoice.v1"];
const BASE_PERIOD = "2026-10";
const DEFAULT_CATEGORIES = [
  { id: "fixed", name: "Fixos", color: "#8865c3" },
  { id: "flexible", name: "Flexíveis", color: "#66a595" },
  { id: "moises", name: "Moisés", color: "#d7a669" },
  { id: "food", name: "Alimentação", color: "#c67d98" },
  { id: "transport", name: "Transporte", color: "#738bc6" },
  { id: "housing", name: "Moradia", color: "#81945e" },
  { id: "health", name: "Saúde", color: "#66a595" },
  { id: "education", name: "Educação", color: "#8865c3" },
  { id: "leisure", name: "Lazer", color: "#d7a669" },
  { id: "shopping", name: "Compras", color: "#c67d98" },
  { id: "other", name: "Outros", color: "#738bc6" }
];
const PALETTE = ["#8865c3", "#66a595", "#d7a669", "#738bc6", "#c67d98", "#81945e"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const integerFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
function decimalInput(cents) {
  const magnitude = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${Math.floor(magnitude / 100)},${String(magnitude % 100).padStart(2, "0")}`;
}
function currency(cents) {
  const magnitude = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}R$\u00a0${integerFormat.format(Math.floor(magnitude / 100))},${String(magnitude % 100).padStart(2, "0")}`;
}
const normalizeName = name => name.trim().replace(/\s+/g, " ");
const compareName = name => normalizeName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const validPeriod = period => typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && Number(period.slice(0, 4)) >= 1;
const newId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emptyState = () => ({ version: 5, period: BASE_PERIOD, dueDay: 5, categories: DEFAULT_CATEGORIES.map(category => ({ ...category })), labels: [], invoices: {}, payments: {}, settlements: {}, invoiceFunding: {}, salaryDefaults: JSON.parse(JSON.stringify(DEFAULT_SALARY)), salaryMonths: {}, cardImage: null, balanceRefs: {}, forecastDates: {}, nextSequence: 1, recurrences: [], salaryConfigured: {} });

// Datas locais: diferenças de dias civis evitam erros de horário de verão.
const DueCalendar = Object.freeze({
  date(year, monthIndex, day) {
    const result = new Date(2000, 0, 1, 12);
    result.setFullYear(year, monthIndex, 1);
    const last = new Date(result);
    last.setMonth(last.getMonth() + 1, 0);
    result.setDate(Math.min(day, last.getDate()));
    return result;
  },
  serial(date) {
    const civil = new Date(0);
    civil.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    civil.setUTCHours(0, 0, 0, 0);
    return civil.getTime() / 86400000;
  },
  calculate(period, day, today = new Date()) {
    const [year, month] = period.split("-").map(Number);
    const due = this.date(year, month - 1, day);
    const previous = this.date(year, month - 2, day);
    const todaySerial = this.serial(today);
    const start = this.serial(previous);
    const end = this.serial(due);
    const remaining = end - todaySerial;
    const progress = Math.max(0, Math.min(100, (todaySerial - start) / (end - start) * 100));
    const status = remaining < 0 ? "past" : remaining === 0 ? "today" : remaining <= 7 ? "near" : "distant";
    const message = remaining < 0 ? `Vencimento há ${Math.abs(remaining)} ${remaining === -1 ? "dia" : "dias"}` : remaining === 0 ? "Vence hoje" : `Faltam ${remaining} ${remaining === 1 ? "dia" : "dias"}`;
    return { due, previous, remaining, progress, status, message };
  }
});
function validateOptions(options, type) {
  if (!Array.isArray(options)) throw new Error("Configurações inválidas.");
  const ids = new Set();
  const names = new Set();
  return options.map(option => {
    if (!option || typeof option.id !== "string" || !option.id || ["all", "none", "uncategorized"].includes(option.id) || ids.has(option.id) ||
        typeof option.name !== "string" || !normalizeName(option.name) || option.name.length > 60 || names.has(compareName(option.name)) ||
        compareName(option.name) === compareName(type === "categories" ? "Sem categoria" : "Sem etiqueta")) throw new Error("Opções inválidas.");
    ids.add(option.id);
    names.add(compareName(option.name));
    if (type === "categories" && !/^#[\da-f]{6}$/i.test(option.color)) throw new Error("Cor inválida.");
    return type === "categories" ? { id: option.id, name: normalizeName(option.name), color: option.color } : { id: option.id, name: normalizeName(option.name) };
  });
}
const DEFAULT_SALARY = { grossCents: 177200, first: { cents: 86600, day: 5 }, second: { cents: 75084, day: 15 } };
const METHODS = { credit: "Cartão de crédito", pix: "Pix", debit: "Débito", cash: "Dinheiro", transfer: "Transferência", other: "Outro" };
const FUNDINGS = { first: "Primeira quinzena", second: "Segunda quinzena", balance: "Saldo disponível" };
const validDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (!validPeriod(value.slice(0, 7)) || day < 1 || day > 31) return false;
  const date = DueCalendar.date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
const localDateString = date => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayDate = () => localDateString(new Date());
const defaultRecordDate = () => todayDate();
const nextCreationOrder = records => Math.max(-1, ...records.map((record, index) => record.createdOrder ?? index)) + 1;
function displayDate(value) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
const creditRecords = (records = currentRecords()) => records.filter(record => record.type === "expense" && record.paymentMethod === "credit");
function salarySnapshot(defaults) {
  return { grossCents: defaults.grossCents, ...Object.fromEntries(["first", "second"].map(id => [id, { expectedCents: defaults[id].cents, day: defaults[id].day, received: false, actualCents: null, actualDate: null, includeInBalance: true }])) };
}
function salaryFor(period = state.period) { return state.salaryMonths[period] ?? salarySnapshot(state.salaryDefaults); }
function receiptDate(period, receipt) {
  const [year, month] = period.split("-").map(Number);
  return localDateString(DueCalendar.date(year, month - 1, receipt.day));
}
function syncSalaryRecords(data) {
  for (const period of new Set([...Object.keys(data.invoices), ...Object.keys(data.salaryMonths)])) {
    const salary = data.salaryMonths[period];
    let records = (data.invoices[period] ?? []).map((record, index) => ({ ...record, createdOrder: record.createdOrder ?? index }));
    for (const source of ["first", "second"]) {
      const receipt = salary?.[source];
      const existing = records.find(record => record.salarySource === source);
      records = records.filter(record => record.salarySource !== source);
      if (receipt?.received) {
        const prefix = `salary-${period}-${source}`;
        const id = existing?.id ?? (records.some(record => record.id === prefix) ? newId() : prefix);
        records.push({ ...existing, id, labelIds: existing?.labelIds ?? (existing?.labelId ? [existing.labelId] : []), createdOrder: existing?.createdOrder ?? nextCreationOrder(records), description: existing?.description ?? `Salário · ${FUNDINGS[source]}`, categoryId: existing?.categoryId ?? null, labelId: existing?.labelId ?? null, cents: receipt.actualCents, type: "income", date: receipt.actualDate, status: "received", paymentMethod: null, funding: null, salarySource: source });
      }
    }
    if (records.length || Object.hasOwn(data.invoices, period)) data.invoices[period] = records;
  }
}
function undoSalary(data, period, source) {
  data.salaryMonths[period][source] = { ...data.salaryMonths[period][source], received: false, actualCents: null, actualDate: null };
  syncSalaryRecords(data);
}
function balanceFor(period = state.period, data = state) {
  return data.balanceRefs[period] ?? { cents: 0, date: todayDate() };
}
function forecastFor(period = state.period, data = state) {
  if (data.forecastDates[period]) return data.forecastDates[period];
  const [year, month] = period.split("-").map(Number);
  const end = localDateString(DueCalendar.date(year, month - 1, 31));
  return end > balanceFor(period, data).date ? end : balanceFor(period, data).date;
}
function financialItem(record) {
  return { label: record.description, cents: record.cents ?? 0, date: record.date, undefinedValue: record.cents === null };
}
const FinanceMath = Object.freeze({
  safe(value) { if (!Number.isSafeInteger(value)) throw new Error("O resultado excede o limite de cálculo preciso."); return value; },
  calculate(records, salary, settlement = null, options = {}) {
    const period = options.period ?? BASE_PERIOD;
    const reference = options.reference ?? { cents: 0, date: todayDate() };
    const today = options.today ?? todayDate();
    const target = options.target ?? today;
    const incomes = records.filter(record => record.type === "income");
    const expenses = records.filter(record => record.type === "expense");
    const credit = expenses.filter(record => record.paymentMethod === "credit");
    const direct = expenses.filter(record => record.paymentMethod !== "credit");
    const expectedSalary = ["first", "second"].filter(source => !salary[source].received).map(source => ({ label: `${FUNDINGS[source]} · prevista`, cents: salary[source].expectedCents, date: receiptDate(period, salary[source]) }));
    // Recebimentos confirmados já estão em incomes: não são adicionados de novo.
    const invoice = InvoiceMath.sum(credit);
    const invoicePaid = settlement?.cents ?? 0;
    const invoiceRemaining = settlement ? Math.max(this.safe(invoice - invoicePaid), 0) : invoice;
    const invoiceDate = localDateString(DueCalendar.calculate(period, options.dueDay ?? 5).due);
    const parts = {
      invoice: credit.map(financialItem),
      incomeReceived: incomes.filter(record => record.status === "received").map(record => ({ ...financialItem(record), inReference: record.includeInBalance === false || (record.salarySource !== null && salary[record.salarySource]?.includeInBalance === false) })),
      incomeExpected: [...incomes.filter(record => record.status === "expected").map(financialItem), ...expectedSalary],
      expensePaid: [...direct.filter(record => record.status === "paid").map(financialItem), ...(settlement ? [{ label: "Pagamento da fatura", cents: invoicePaid, date: settlement.date }] : [])],
      expensePending: [...direct.filter(record => record.status === "pending").map(financialItem), ...(invoiceRemaining !== 0 ? [{ label: "Fatura ainda a pagar", cents: invoiceRemaining, date: invoiceDate }] : [])],
      spending: expenses.map(financialItem)
    };
    const realized = [...parts.incomeReceived.map(item => ({ ...item, movement: "Entrada recebida" })), ...parts.expensePaid.map(item => ({ ...item, sourceCents: item.cents, cents: -item.cents, movement: "Saída paga" }))];
    const pending = [...parts.incomeExpected.map(item => ({ ...item, movement: "Entrada prevista" })), ...parts.expensePending.map(item => ({ ...item, sourceCents: item.cents, cents: -item.cents, movement: "Saída pendente" }))];
    // A referência representa o fechamento do dia: movimentos desse dia já estão incluídos.
    const realizedUntil = date => realized.filter(item => !item.inReference && item.date && item.date > reference.date && item.date <= date);
    parts.available = realizedUntil(today);
    const pendingUntilTarget = pending.filter(item => item.date && item.date <= target);
    parts.projected = [...parts.available, ...pendingUntilTarget];
    const baseline = { label: "Saldo bancário de referência", cents: reference.cents, effectCents: reference.cents, date: reference.date, effectLabel: "Ponto de partida" };
    const cashDetails = realized.map(item => {
      const included = parts.available.includes(item);
      const inReference = item.inReference || (item.date && item.date <= reference.date);
      const note = inReference ? "Já considerada no saldo de referência — não soma novamente." : !item.date ? "Sem data — não altera o saldo. Informe a data real." : item.date > today ? "Data posterior a hoje — não altera o saldo disponível." : "";
      return { ...item, inReference, effectCents: included ? item.cents : 0, effectLabel: included ? item.cents < 0 ? "Subtrai do saldo" : "Soma ao saldo" : "Não altera o resultado", note };
    });
    const pendingDetails = projected => pending.map(item => {
      const included = projected && pendingUntilTarget.includes(item);
      const income = item.movement === "Entrada prevista";
      const note = income ? "Prevista — incluída somente na projeção" : "Pendente — incluída somente na projeção";
      return { ...item, effectCents: included ? item.cents : 0, effectLabel: included ? item.cents < 0 ? "Subtrai do saldo" : "Soma ao saldo" : "Não altera o resultado", note: `${note}${!item.date ? ". Sem data: fora do cálculo." : item.date > target ? ". Após a data da projeção: fora deste cálculo." : "."}` };
    });
    parts.availableDetails = [baseline, ...cashDetails, ...pendingDetails(false)];
    parts.projectedDetails = [baseline, ...cashDetails, ...pendingDetails(true)];
    const incomeReceived = InvoiceMath.sum(parts.incomeReceived);
    const incomeExpected = InvoiceMath.sum(parts.incomeExpected);
    const expensePaid = InvoiceMath.sum(parts.expensePaid);
    const expensePending = InvoiceMath.sum(parts.expensePending);
    return { invoice, invoicePaid, invoiceRemaining, incomeReceived, incomeExpected, expensePaid, expensePending, spending: InvoiceMath.sum(expenses), available: this.safe(reference.cents + InvoiceMath.sum(parts.available)), projected: this.safe(reference.cents + InvoiceMath.sum(parts.projected)), reference, target, today, parts, undated: [...realized, ...pending].filter(item => !item.date), alreadyIncluded: realized.filter(item => item.inReference || (item.date && item.date <= reference.date)) };
  }
});
function financeFor(period = state.period, data = state) {
  const salary = data.salaryMonths[period] ?? salarySnapshot(data.salaryDefaults);
  return FinanceMath.calculate(data.invoices[period] ?? [], salary, data.payments[period] ? data.settlements[period] : null, { period, dueDay: data.dueDay, reference: balanceFor(period, data), target: forecastFor(period, data) });
}

function validateSalaryDefaults(data) {
  if (data && data.second?.cents == null) data = { ...data, second: { cents: DEFAULT_SALARY.second.cents, day: data.second?.day ?? 15 } };
  if (!data || !Number.isSafeInteger(data.grossCents) || data.grossCents < 0) throw new Error("Salário bruto inválido.");
  const result = { grossCents: data.grossCents };
  for (const id of ["first", "second"]) {
    const receipt = data[id];
    if (!receipt || !Number.isSafeInteger(receipt.cents) || receipt.cents < 0 || !Number.isInteger(receipt.day) || receipt.day < 1 || receipt.day > 31) throw new Error("Configuração de quinzena inválida.");
    result[id] = { cents: receipt.cents, day: receipt.day };
  }
  FinanceMath.safe(result.first.cents + result.second.cents);
  return result;
}
function validateSalaryMonth(data) {
  if (data && data.second?.expectedCents == null) data = { ...data, second: { received: false, actualCents: null, actualDate: null, ...data.second, expectedCents: DEFAULT_SALARY.second.cents, day: data.second?.day ?? 15 } };
  if (!data || !Number.isSafeInteger(data.grossCents) || data.grossCents < 0) throw new Error("Salário do mês inválido.");
  const result = { grossCents: data.grossCents };
  for (const id of ["first", "second"]) {
    const receipt = data[id];
    if (!receipt || !Number.isSafeInteger(receipt.expectedCents) || receipt.expectedCents < 0 || !Number.isInteger(receipt.day) || receipt.day < 1 || receipt.day > 31 || typeof receipt.received !== "boolean" ||
        (receipt.received && (!Number.isSafeInteger(receipt.actualCents) || receipt.actualCents < 0 || !validDate(receipt.actualDate))) ||
        (!receipt.received && (receipt.actualCents !== null || receipt.actualDate !== null))) throw new Error("Recebimento de quinzena inválido.");
    if (receipt.includeInBalance !== undefined && typeof receipt.includeInBalance !== "boolean") throw new Error("Escolha de impacto no saldo inválida.");
    result[id] = { expectedCents: receipt.expectedCents, day: receipt.day, received: receipt.received, actualCents: receipt.actualCents, actualDate: receipt.actualDate, includeInBalance: receipt.includeInBalance ?? true };
  }
  FinanceMath.safe(result.first.expectedCents + result.second.expectedCents);
  return result;
}
function validateState(data) {
  if (!data || data.version !== 5 || !validPeriod(data.period) || !Number.isInteger(data.dueDay) || data.dueDay < 1 || data.dueDay > 31 ||
      !data.invoices || typeof data.invoices !== "object" || Array.isArray(data.invoices)) throw new Error("Dados salvos inválidos.");
  const categories = validateOptions(data.categories, "categories");
  const labels = validateOptions(data.labels, "labels");
  const invoices = {};
  if (data.nextSequence !== undefined && (!Number.isSafeInteger(data.nextSequence) || data.nextSequence < 1)) throw new Error("Contador de IDs inválido.");
  let nextSequence = Number.isSafeInteger(data.nextSequence) && data.nextSequence > 0 ? data.nextSequence : 1;
  const sequences = new Set();
  for (const record of Object.values(data.invoices).flat()) if (record.sequenceId !== undefined) {
    if (!Number.isSafeInteger(record.sequenceId) || record.sequenceId < 1 || sequences.has(record.sequenceId)) throw new Error("ID sequencial inválido ou duplicado.");
    sequences.add(record.sequenceId);
    nextSequence = Math.max(nextSequence, record.sequenceId + 1);
  }
  for (const [period, records] of Object.entries(data.invoices)) {
    if (!validPeriod(period) || !Array.isArray(records)) throw new Error("Período inválido.");
    const ids = new Set();
    invoices[period] = records.map((record, index) => {
      const income = record?.type === "income";
      const labelIds = record?.labelIds ?? (record?.labelId ? [record.labelId] : []);
      if (!Array.isArray(labelIds) || new Set(labelIds).size !== labelIds.length || labelIds.some(id => !labels.some(label => label.id === id))) throw new Error("Etiquetas inválidas.");
      if (record.includeInBalance !== undefined && typeof record.includeInBalance !== "boolean") throw new Error("Impacto no saldo inválido.");
      if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id) ||
          typeof record.description !== "string" || !record.description.trim() || record.description.length > 200 ||
          (record.categoryId !== null && !categories.some(category => category.id === record.categoryId)) ||

          (record.cents !== null && !Number.isSafeInteger(record.cents)) || !["income", "expense"].includes(record.type) ||
          (record.date !== null && !validDate(record.date)) || !(income ? ["expected", "received"] : ["pending", "paid"]).includes(record.status) ||
          (income ? record.paymentMethod !== null : !Object.hasOwn(METHODS, record.paymentMethod)) ||
          (record.funding !== null && !Object.hasOwn(FUNDINGS, record.funding)) || (income && record.funding !== null) || ![null, "first", "second"].includes(record.salarySource)) throw new Error("Lançamento inválido.");
      ids.add(record.id);
      return { sequenceId: record.sequenceId ?? nextSequence++, labelIds, labelId: labelIds[0] ?? null, includeInBalance: record.includeInBalance ?? true, recurrenceId: record.recurrenceId ?? null, id: record.id, createdOrder: Number.isSafeInteger(record.createdOrder) && record.createdOrder >= 0 ? record.createdOrder : index, description: record.description, categoryId: record.categoryId, cents: record.cents, type: record.type, date: record.date, status: record.status, paymentMethod: record.paymentMethod, funding: record.funding, salarySource: record.salarySource };
    });
    InvoiceMath.calculate(creditRecords(invoices[period]), categories);
  }
  for (const field of ["payments", "settlements", "invoiceFunding", "salaryMonths", "balanceRefs", "forecastDates"]) if (!data[field] || typeof data[field] !== "object" || Array.isArray(data[field])) throw new Error("Configuração mensal inválida.");
  const payments = {}, settlements = {}, invoiceFunding = {}, salaryMonths = {};
  for (const [period, paid] of Object.entries(data.payments)) {
    if (!validPeriod(period) || typeof paid !== "boolean") throw new Error("Pagamento inválido.");
    payments[period] = paid;
  }
  for (const [period, payment] of Object.entries(data.settlements)) {
    if (!validPeriod(period) || !payments[period] || !payment || !Number.isSafeInteger(payment.cents) || (payment.date !== null && !validDate(payment.date))) throw new Error("Pagamento da fatura inválido.");
    settlements[period] = { cents: payment.cents, date: payment.date };
  }
  for (const [period, paid] of Object.entries(payments)) if (paid && !settlements[period]) throw new Error("Fatura paga sem registro do valor.");
  for (const [period, funding] of Object.entries(data.invoiceFunding)) {
    if (!validPeriod(period) || (funding !== null && !Object.hasOwn(FUNDINGS, funding))) throw new Error("Vínculo da fatura inválido.");
    invoiceFunding[period] = funding;
  }
  const salaryDefaults = validateSalaryDefaults(data.salaryDefaults);
  for (const [period, salary] of Object.entries(data.salaryMonths)) {
    if (!validPeriod(period)) throw new Error("Período salarial inválido.");
    salaryMonths[period] = validateSalaryMonth(salary);
  }
  if (data.cardImage !== null && (typeof data.cardImage !== "string" || data.cardImage.length > 1500000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.cardImage))) throw new Error("Imagem salva inválida.");
  const balanceRefs = {}, forecastDates = {};
  for (const [period, reference] of Object.entries(data.balanceRefs)) {
    if (!validPeriod(period) || !reference || !Number.isSafeInteger(reference.cents) || !validDate(reference.date)) throw new Error("Saldo de referência inválido.");
    balanceRefs[period] = { cents: reference.cents, date: reference.date };
  }
  for (const [period, date] of Object.entries(data.forecastDates)) {
    if (!validPeriod(period) || !validDate(date) || (balanceRefs[period] && date < balanceRefs[period].date)) throw new Error("Data de previsão inválida.");
    forecastDates[period] = date;
  }
  for (const period of new Set([...Object.keys(invoices), ...Object.keys(salaryMonths)])) {
    for (const source of ["first", "second"]) {
      const linked = (invoices[period] ?? []).filter(record => record.salarySource === source);
      const receipt = salaryMonths[period]?.[source];
      if (receipt?.received) {
        if (linked.length !== 1 || linked[0].type !== "income" || linked[0].status !== "received" || linked[0].cents !== receipt.actualCents || linked[0].date !== receipt.actualDate) throw new Error("Entrada de quinzena fora de sincronia.");
      } else if (linked.length) throw new Error("Entrada de quinzena sem confirmação.");
    }
  }
  const recurrences = validateRecurrences(data.recurrences ?? [], categories, labels);
  for (const records of Object.values(invoices)) for (const record of records) if (record.recurrenceId !== null && (!recurrences.some(item => item.id === record.recurrenceId) || record.type !== "income" || record.salarySource)) throw new Error("Entrada recorrente inválida.");
  const salaryConfigured = data.salaryConfigured ?? Object.fromEntries(Object.keys(salaryMonths).map(period => [period, true]));
  if (!salaryConfigured || typeof salaryConfigured !== "object" || Array.isArray(salaryConfigured) || Object.entries(salaryConfigured).some(([period, saved]) => !validPeriod(period) || typeof saved !== "boolean")) throw new Error("Configuração salarial inválida.");
  if (!Number.isSafeInteger(nextSequence)) throw new Error("Limite de IDs sequenciais atingido.");
  const result = { nextSequence, recurrences, salaryConfigured, version: 5, period: data.period, dueDay: data.dueDay, categories, labels, invoices, payments, settlements, invoiceFunding, salaryDefaults, salaryMonths, cardImage: data.cardImage, balanceRefs, forecastDates };
  for (const period of new Set([data.period, ...Object.keys(invoices), ...Object.keys(salaryMonths), ...Object.keys(settlements)])) financeFor(period, result);
  return result;
}
function completeCategories(categories) {
  const result = categories.map(category => ({ ...category }));
  for (const category of DEFAULT_CATEGORIES) if (!result.some(item => item.id === category.id || compareName(item.name) === compareName(category.name))) result.push({ ...category });
  return result;
}
function migratePrevious(data) {
  if (!data || ![1, 2, 3, 4].includes(data.version)) throw new Error("Versão anterior inválida.");
  if (data.version === 4) {
    const migrated = { ...data, version: 5, balanceRefs: {}, forecastDates: {} };
    if (!data.invoices || typeof data.invoices !== "object" || Array.isArray(data.invoices)) throw new Error("Base anterior inválida.");
    migrated.invoices = Object.fromEntries(Object.entries(data.invoices).map(([period, records]) => {
      if (!Array.isArray(records)) throw new Error("Lançamentos anteriores inválidos.");
      return [period, records.map(record => ({ ...record, salarySource: null }))];
    }));
    syncSalaryRecords(migrated);
    return validateState(migrated);
  }
  const migrated = emptyState();
  if (data.version === 1) {
    if (!validPeriod(data.period) || !Array.isArray(data.records)) throw new Error("Base antiga inválida.");
    migrated.invoices[BASE_PERIOD] = data.records.map(record => {
      if (!record || !["fixed", "flexible", "moises"].includes(record.group)) throw new Error("Categoria antiga inválida.");
      return { ...record, categoryId: record.group, labelId: null };
    });
  } else {
    migrated.period = data.period;
    migrated.dueDay = data.dueDay;
    migrated.categories = completeCategories(validateOptions(data.categories, "categories"));
    migrated.labels = data.labels;
    migrated.invoices = data.invoices;
    migrated.payments = data.version === 3 ? data.payments : {};
  }
  if (!migrated.invoices || typeof migrated.invoices !== "object" || Array.isArray(migrated.invoices)) throw new Error("Base mensal inválida.");
  const mapped = {};
  for (const [period, records] of Object.entries(migrated.invoices)) {
    if (!Array.isArray(records)) throw new Error("Lançamentos anteriores inválidos.");
    mapped[period] = records.map(record => ({ id: record.id, description: record.description, categoryId: record.categoryId, labelId: record.labelId, cents: record.cents, type: "expense", date: null, status: "pending", paymentMethod: "credit", funding: null, salarySource: null }));
  }
  migrated.invoices = mapped;
  if (!migrated.payments || typeof migrated.payments !== "object" || Array.isArray(migrated.payments)) throw new Error("Pagamentos anteriores inválidos.");
  for (const [period, paid] of Object.entries(migrated.payments)) if (paid === true) migrated.settlements[period] = { cents: InvoiceMath.sum(mapped[period] ?? []), date: null };
  return validateState(migrated);
}

let storageBlocked = false;
let migrationApplied = false;
function storageWarning(message) {
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
  $("save-status").textContent = "Salvamento indisponível";
}
function loadState() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current !== null) return validateState(JSON.parse(current));
    for (const key of PREVIOUS_KEYS) {
      const previous = localStorage.getItem(key);
      if (previous !== null) {
        const migrated = migratePrevious(JSON.parse(previous));
        migrationApplied = true;
        return migrated;
      }
    }
    return emptyState();
  } catch (error) {
    storageBlocked = true;
    storageWarning("Não foi possível ler os dados salvos. Uma base vazia está visível apenas nesta sessão. O salvamento está suspenso para preservar os dados existentes. “Apagar dados salvos” permite redefinir o armazenamento com confirmação.");
    return emptyState();
  }
}
let state = loadState();
let selectedCategory = "all";
let selectedLabel = "all";
let editingId = null;
let editingPeriod = null;
let receiptEditing = null;
let settlementPeriod = null;
let currentView = "monthly";
let editingBalancePeriod = null;
let editingSalaryPeriod = null;
let recordSort = { key: "date", direction: "descending" };
let optionEditor = null;
let confirmationAction = null;
let toastTimer;
let customSelection = new Set();
let customAvailable = new Set();
const currentRecords = () => state.invoices[state.period] ?? [];
const optionName = (type, id) => state[type].find(option => option.id === id)?.name ?? (type === "categories" ? "Sem categoria" : "Sem etiqueta");
const categoryColor = id => state.categories.find(category => category.id === id)?.color ?? "#8e8998";
function notify(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4200);
}
function saveState() {
  if (storageBlocked) { notify("Alteração aplicada apenas nesta sessão. O salvamento está suspenso."); return false; }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("storage-warning").hidden = true;
    $("save-status").textContent = "Salvo neste navegador";
    return true;
  } catch (error) {
    storageWarning("Não foi possível salvar no navegador. As alterações permanecem nesta sessão e podem ser perdidas ao fechar. Verifique as permissões e o espaço de armazenamento.");
    notify("Não foi possível salvar no navegador.");
    return false;
  }
}
function periodLabel(period) {
  const [year, month] = period.split("-").map(Number);
  return `${MONTHS[month - 1]} de ${year}`;
}
function resetFilters() {
  selectedCategory = "all";
  selectedLabel = "all";
  $("search").value = "";
  $("type-filter").value = "all";
}
function selectOptions(element, options, emptyLabel, selected = "", includeAll = false) {
  element.replaceChildren();
  const add = (value, label) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    element.append(option);
  };
  if (includeAll) add("all", "Todas as etiquetas");
  add("", emptyLabel);
  options.forEach(option => add(option.id, option.name));
  element.value = [...element.options].some(option => option.value === selected) ? selected : "";
}
function selectedRecordLabels() { return [...$("record-label").querySelectorAll("input:checked")].map(input => input.value); }
function renderFormOptions(category = $("group").value, labelIds = selectedRecordLabels()) {
  selectOptions($("group"), state.categories, "Sem categoria", category);
  $("record-label").replaceChildren();
  for (const option of state.labels) {
    const label = document.createElement("label"); label.className = "label-choice";
    const input = document.createElement("input"); input.type = "checkbox"; input.value = option.id; input.checked = labelIds.includes(option.id);
    label.append(input, document.createTextNode(option.name)); $("record-label").append(label);
  }
  if (!state.labels.length) $("record-label").textContent = "Nenhuma etiqueta cadastrada. Crie uma para começar.";
}
function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  cell.className = className;
  return cell;
}
function renderRow(record) {
  const row = document.createElement("tr");
  const description = makeCell("", "description-cell");
  const symbol = document.createElement("span");
  symbol.className = "record-symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = record.description.charAt(0).toLocaleUpperCase("pt-BR");
  description.append(symbol, document.createTextNode(record.description));
  if (record.includeInBalance === false || (record.salarySource && salaryFor()[record.salarySource].includeInBalance === false)) {
    const note = document.createElement("small");
    note.className = "reference-receipt-note";
    note.textContent = "Já considerado no saldo de referência";
    description.append(note);
  }
  const category = makeCell("");
  const badge = document.createElement("span");
  badge.className = `badge category-badge ${["fixed", "flexible", "moises"].includes(record.categoryId) ? record.categoryId : ""}`;
  badge.style.setProperty("--category-color", categoryColor(record.categoryId));
  badge.textContent = optionName("categories", record.categoryId);
  category.append(badge);
  const type = makeCell(record.type === "income" ? "Entrada" : "Saída", `type-cell ${record.type}`);
  const date = makeCell(displayDate(record.date), "date-cell");
  const statusText = record.status === "received" ? "Recebida" : record.status === "expected" ? "Prevista" : record.status === "paid" ? "Paga" : "Pendente";
  const status = makeCell(statusText, `status-cell ${record.status}`);
  if (record.paymentMethod) {
    const method = document.createElement("small");
    method.textContent = METHODS[record.paymentMethod];
    status.append(method);
  }
  const label = makeCell("", "label-cell");
  for (const id of record.labelIds) { const tag = document.createElement("span"); tag.className = "label-badge"; tag.textContent = optionName("labels", id); label.append(tag); }
  if (!record.labelIds.length) label.textContent = "Sem etiqueta";
  row.append(makeCell(String(record.sequenceId), "sequence-cell"), type, date, description, status, category, label, makeCell(record.cents === null ? "Sem valor" : currency(record.cents), record.cents === null ? "numeric pending" : "numeric"));
  const actions = makeCell("");
  const wrapper = document.createElement("div");
  wrapper.className = "row-actions";
  for (const [action, icon, text] of [["edit", "✎", "Editar"], ["delete", "×", "Excluir"]]) {
    const button = document.createElement("button");
    button.className = `icon-button ${action}-record`;
    button.type = "button";
    button.textContent = icon;
    button.dataset.action = action;
    button.dataset.id = record.id;
    button.setAttribute("aria-label", `${text} ${record.description}`);
    button.title = `${text} lançamento`;
    wrapper.append(button);
  }
  if (record.type === "income" && record.status === "expected") {
    const receive = document.createElement("button"); receive.className = "text-button"; receive.type = "button"; receive.textContent = "Receber";
    receive.setAttribute("aria-label", `Marcar como recebida ${record.description}`);
    receive.addEventListener("click", () => { openRecord(record); $("record-status").value = "received"; $("record-date").value = todayDate(); updateIncomeOptions(); });
    wrapper.append(receive);
  }
  actions.append(wrapper);
  row.append(actions);
  return row;
}
function renderDue() {
  const info = DueCalendar.calculate(state.period, state.dueDay);
  $("due-date").textContent = displayDate(localDateString(info.due));
  const confirmed = state.payments[state.period] === true;
  const finance = financeFor();
  const partial = confirmed && finance.invoiceRemaining > 0;
  const paid = confirmed && !partial;
  const message = partial ? "Pagamento parcial" : paid ? "Fatura paga" : info.message;
  const status = partial ? "partial" : paid ? "paid" : info.status;
  $("due-message").textContent = message;
  $("due-message").dataset.status = status;
  $("toggle-payment").textContent = partial ? "Desfazer pagamento" : paid ? "Marcar como não paga" : "Marcar como paga";
  $("toggle-payment").setAttribute("aria-pressed", String(confirmed));
  $("correct-payment").hidden = !confirmed;
  $("invoice-summary-status").textContent = partial ? "Pagamento parcial" : paid ? "Paga" : "Em aberto";
  $("invoice-summary-status").dataset.status = partial ? "partial" : paid ? "paid" : "open";
  $("visual-card-period").textContent = periodLabel(state.period);
  $("visual-card-total").textContent = currency(finance.invoice);
  $("visual-card-status").textContent = partial ? "Pagamento parcial" : paid ? "Fatura paga" : "Fatura em aberto";
  $("card-background").style.backgroundImage = state.cardImage ? `url("${state.cardImage}")` : "";
}
function renderManagement() {
  for (const type of ["categories", "labels"]) {
    const list = $(type === "categories" ? "category-list" : "label-list");
    list.replaceChildren();
    if (!state[type].length) {
      const empty = document.createElement("p");
      empty.textContent = type === "categories" ? "Nenhuma categoria cadastrada." : "Nenhuma etiqueta cadastrada.";
      list.append(empty);
    }
    for (const option of state[type]) {
      const row = document.createElement("div");
      row.className = "option-row";
      const name = document.createElement("span");
      name.textContent = option.name;
      if (type === "categories") name.style.setProperty("--category-color", option.color);
      const actions = document.createElement("div");
      for (const [action, label] of [["rename", "Renomear"], ["delete", "Excluir"]]) {
        const button = document.createElement("button");
        button.className = "option-action";
        button.textContent = label;
        button.dataset.type = type;
        button.dataset.id = option.id;
        button.dataset.action = action;
        button.setAttribute("aria-label", `${label} ${type === "categories" ? "categoria" : "etiqueta"} ${option.name}`);
        actions.append(button);
      }
      row.append(name, actions);
      list.append(row);
    }
  }
}
function render() {
  ensureRecurringMonth();
  $("category-popover").hidden = true;
  const records = currentRecords();
  const credit = creditRecords(records);
  const totals = InvoiceMath.calculate(credit, state.categories);
  const finance = financeFor();
  $("period-month").value = state.period.slice(5);
  $("period-year").value = Number(state.period.slice(0, 4));
  $("due-day").value = state.dueDay;
  $("total").textContent = currency(totals.total);
  $("total-caption").textContent = periodLabel(state.period);
  refreshFinancialIndicators();
  document.querySelectorAll(".category-summary").forEach(card => card.remove());
  const categories = [...state.categories];
  if (credit.some(record => record.categoryId === null)) categories.push({ id: "uncategorized", name: "Sem categoria", color: "#8e8998" });
  $("composition-bar").replaceChildren();
  $("composition-rows").replaceChildren();
  const showDistribution = totals.total > 0 && categories.every(category => totals.groups[category.id] >= 0);
  for (const category of categories) {
    const subset = credit.filter(record => (record.categoryId ?? "uncategorized") === category.id);
    const pending = subset.filter(record => record.cents === null).length;
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = category.color;
    const segment = document.createElement("div");
    segment.className = "bar-segment";
    segment.style.background = category.color;
    segment.style.width = `${showDistribution ? totals.groups[category.id] / totals.total * 100 : 0}%`;
    $("composition-bar").append(segment);
    const row = document.createElement("div");
    row.className = "composition-row";
    const rowLabel = document.createElement("span");
    const rowDot = dot.cloneNode();
    rowLabel.append(rowDot, document.createTextNode(category.name));
    const value = document.createElement("strong");
    value.textContent = currency(totals.groups[category.id]);
    row.append(rowLabel, value);
    $("composition-rows").append(row);
  }
  $("composition-bar").hidden = !showDistribution;
  $("composition-note").textContent = showDistribution ? "Somente compras no cartão compõem a fatura." : "Valores somados acima. A distribuição visual exige total positivo e subtotais não negativos.";
  $("combined-label").textContent = categories.length ? categories.map(category => category.name).join(" + ") : "Nenhuma categoria cadastrada";
  $("combined-total").textContent = currency(totals.total);
  if (selectedCategory !== "all" && selectedCategory !== "none" && !state.categories.some(category => category.id === selectedCategory)) selectedCategory = "all";
  if (selectedLabel !== "all" && selectedLabel !== "" && !state.labels.some(label => label.id === selectedLabel)) selectedLabel = "all";
  const categoryScroll = $("category-tabs").scrollLeft;
  $("category-tabs").replaceChildren();
  for (const category of [{ id: "all", name: "Todos" }, ...state.categories, { id: "none", name: "Sem categoria" }]) {
    const button = document.createElement("button");
    button.className = `tab${selectedCategory === category.id ? " selected" : ""}`;
    button.dataset.category = category.id;
    button.textContent = category.name;
    button.setAttribute("aria-pressed", String(selectedCategory === category.id));
    $("category-tabs").append(button);
  }
  $("category-tabs").scrollLeft = categoryScroll;
  requestAnimationFrame(updateCategoryNavigation);
  selectOptions($("label-filter"), state.labels, "Sem etiqueta", selectedLabel, true);
  const query = compareName($("search").value);
  const selectedType = $("type-filter").value;
  const visible = records.filter(record => (selectedType === "all" || record.type === selectedType || (selectedType === "credit" && record.type === "expense" && record.paymentMethod === "credit")) && (selectedCategory === "all" || (record.categoryId ?? "none") === selectedCategory) &&
    (selectedLabel === "all" || (selectedLabel === "" ? !record.labelIds.length : record.labelIds.includes(selectedLabel))) && compareName(record.description).includes(query));
  visible.sort((a, b) => {
    const byDate = direction => {
      if (!a.date && b.date) return 1;
      if (a.date && !b.date) return -1;
      return ((a.date ?? "").localeCompare(b.date ?? "") || a.sequenceId - b.sequenceId) * direction;
    };
    if (recordSort.key === "date") return byDate(recordSort.direction === "ascending" ? 1 : -1);
    const typeOrder = ((a.type === "income" ? 0 : 1) - (b.type === "income" ? 0 : 1)) * (recordSort.direction === "ascending" ? 1 : -1);
    return typeOrder || byDate(-1);
  });
  for (const key of ["type", "date"]) {
    const button = $("sort-" + key);
    const active = recordSort.key === key;
    button.parentElement.setAttribute("aria-sort", active ? recordSort.direction : "none");
    button.querySelector("span").textContent = active ? (recordSort.direction === "ascending" ? "↑" : "↓") : "↕";
    const orderLabel = key === "type" ? (recordSort.direction === "ascending" ? "entradas primeiro" : "saídas primeiro") : (recordSort.direction === "ascending" ? "mais antigos primeiro" : "mais recentes primeiro");
    button.title = active ? `Ordem atual: ${orderLabel}. Clique para inverter.` : `Ordenar por ${key === "type" ? "tipo" : "data"}.`;
  }
  $("records").replaceChildren(...visible.map(renderRow));
  $("filtered-total").textContent = currency(InvoiceMath.sum(visible));
  $("record-count").textContent = `${records.length} ${records.length === 1 ? "lançamento" : "lançamentos"} · ${periodLabel(state.period)}${visible.length !== records.length ? ` · ${visible.length} exibidos` : ""}`;
  $("empty-state").hidden = visible.length > 0;
  $("table-note").hidden = visible.length === 0;
  document.querySelector(".table-wrap").hidden = visible.length === 0;
  $("empty-title").textContent = records.length ? "Nenhum resultado encontrado" : "Uma fatura de página nova";
  $("empty-message").textContent = records.length ? "Tente outra busca, categoria ou etiqueta." : `${periodLabel(state.period)} ainda não tem lançamentos. Adicione o primeiro para começar.`;
  $("empty-action").textContent = records.length ? "Limpar filtros" : "Novo lançamento";
  renderFormOptions();
  renderManagement();
  renderRecurrenceSettings();
  renderDue();
  renderCustomSum();
  renderSalary();
  renderBalanceControls();
  refreshExplanation();
}
function openRecord(record = null) {
  editingId = record?.id ?? null;
  editingPeriod = state.period;
  $("record-form").reset();
  $("form-error").hidden = true;
  for (const id of ["description", "value", "record-date", "recurring-day", "record-impact-include"]) $(id).removeAttribute("aria-invalid");
  $("dialog-title").textContent = record ? "Editar lançamento" : "Novo lançamento";
  $("record-period-note").textContent = `Este lançamento pertence a ${periodLabel(editingPeriod)}. O resumo é atualizado automaticamente.`;
  $("description").value = record?.description ?? "";
  const defaultCategory = ["all", "none"].includes(selectedCategory) ? (selectedCategory === "none" ? "" : state.categories[0]?.id ?? "") : selectedCategory;
  renderFormOptions(record ? record.categoryId ?? "" : defaultCategory, record?.labelIds ?? []);
  $("value").value = record?.cents == null ? "" : decimalInput(record.cents);
  $("record-type").value = record?.type ?? "expense";
  $("record-type").disabled = !!record?.salarySource;
  $("record-date").value = record ? record.date ?? "" : defaultRecordDate(state.period);
  $("payment-method").value = record?.paymentMethod ?? "credit";
  const recurring = state.recurrences.find(item => item.id === record?.recurrenceId);
  $("record-recurring").checked = recurring?.active ?? false;
  $("recurring-day").value = recurring?.day ?? Number(todayDate().slice(-2));
  updateRecordFields(record?.status ?? "pending");
  $("record-dialog").showModal();
  $("description").focus();
}
function confirmAction(title, message, label, action, transfer = null) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  $("confirm-ok").textContent = label;
  $("transfer-field").hidden = !transfer;
  if (transfer) selectOptions($("transfer-option"), transfer.options, transfer.emptyLabel);
  confirmationAction = action;
  $("confirm-dialog").showModal();
  $("confirm-cancel").focus();
}
function openOption(type, id = null, fromRecord = false) {
  optionEditor = { type, id, fromRecord };
  $("option-form").reset();
  $("option-error").hidden = true;
  $("option-name").removeAttribute("aria-invalid");
  $("option-title").textContent = `${id ? "Renomear" : "Criar"} ${type === "categories" ? "categoria" : "etiqueta"}`;
  $("option-name").value = id ? state[type].find(option => option.id === id).name : "";
  $("option-dialog").showModal();
  $("option-name").focus();
}
function deleteOption(type, id) {
  const option = state[type].find(option => option.id === id);
  const field = type === "categories" ? "categoryId" : "labelId";
  const count = Object.values(state.invoices).flat().filter(record => type === "labels" ? record.labelIds.includes(id) : record[field] === id).length;
  const singular = type === "categories" ? "categoria" : "etiqueta";
  confirmAction(`Excluir ${singular}?`, `“${option.name}” será excluída em todos os meses. ${count ? `${count} lançamento(s) usam esta opção. Escolha para onde transferir os vínculos; os lançamentos e valores serão preservados.` : "Nenhum lançamento está vinculado. Os demais dados serão preservados."}`, "Excluir opção", () => {
    const target = count ? $("transfer-option").value || null : null;
    const candidate = JSON.parse(JSON.stringify(state));
    for (const records of Object.values(candidate.invoices)) {
      for (const record of records) {
        if (type === "labels" && record.labelIds.includes(id)) { record.labelIds = [...new Set(record.labelIds.flatMap(label => label === id ? target ? [target] : [] : [label]))]; record.labelId = record.labelIds[0] ?? null; }
        else if (type === "categories" && record[field] === id) record[field] = target;
      }
    }
    for (const template of candidate.recurrences) {
      if (type === "labels") template.labelIds = [...new Set(template.labelIds.flatMap(label => label === id ? target ? [target] : [] : [label]))];
      else if (template.categoryId === id) template.categoryId = target;
    }
    candidate[type] = candidate[type].filter(item => item.id !== id);
    try {
      state = validateState(candidate);
    } catch (error) {
      notify("Não foi possível transferir os vínculos: " + error.message);
      return;
    }
    const saved = saveState();
    render();
    if (saved) notify(`${singular === "categoria" ? "Categoria" : "Etiqueta"} excluída. Lançamentos preservados.`);
  }, count ? { options: state[type].filter(item => item.id !== id), emptyLabel: type === "categories" ? "Sem categoria" : "Sem etiqueta" } : null);
}
// Consulta temporária: a seleção não faz parte dos dados financeiros persistidos.
function availableSumCategories() {
  const categories = [...state.categories];
  if (creditRecords().some(record => record.categoryId === null)) categories.push({ id: "uncategorized", name: "Sem categoria", color: "#8e8998" });
  return categories;
}
function renderCustomResult() {
  const categories = availableSumCategories();
  $("custom-period").textContent = periodLabel(state.period);
  try {
    $("custom-total").textContent = currency(InvoiceMath.selectedTotal(creditRecords(), customSelection));
    $("custom-error").hidden = true;
  } catch (error) {
    $("custom-total").textContent = "—";
    $("custom-error").textContent = error.message;
    $("custom-error").hidden = false;
  }
  const chosen = categories.filter(category => customSelection.has(category.id));
  $("custom-expression").textContent = chosen.length ? chosen.map(category => category.name).join(" + ") : "Nenhuma categoria selecionada";
}
function renderCustomSum() {
  if ($("custom-panel").hidden) return;
  const categories = availableSumCategories();
  const available = new Set(categories.map(category => category.id));
  for (const id of available) if (!customAvailable.has(id)) customSelection.add(id);
  // “Sem categoria” pode desaparecer em um mês vazio e reaparecer em outro.
  // Preserve a escolha enquanto a consulta está aberta, sem selecioná-la de novo.
  const registered = new Set([...state.categories.map(category => category.id), "uncategorized"]);
  for (const id of customSelection) if (!registered.has(id)) customSelection.delete(id);
  customAvailable = new Set([...customAvailable, ...available].filter(id => registered.has(id)));
  const focusedId = document.activeElement?.dataset.sumCategory;
  $("sum-options").replaceChildren();
  const totals = InvoiceMath.calculate(creditRecords(), state.categories);
  for (const category of categories) {
    const label = document.createElement("label");
    label.className = "sum-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.sumCategory = category.id;
    checkbox.checked = customSelection.has(category.id);
    const name = document.createElement("span");
    name.textContent = category.name;
    const subtotal = document.createElement("strong");
    subtotal.textContent = currency(totals.groups[category.id]);
    label.append(checkbox, name, subtotal);
    $("sum-options").append(label);
    if (category.id === focusedId) checkbox.focus();
  }
  $("sum-empty").hidden = categories.length > 0;
  renderCustomResult();
  refreshExplanation();
}
$("toggle-payment").addEventListener("click", () => {
  if (!state.payments[state.period]) { openSettlement(); return; }
  const period = state.period;
  confirmAction("Desfazer pagamento da fatura?", "O registro de saída de dinheiro será desfeito somente para este mês. As compras permanecem intactas.", "Marcar como não paga", () => {
    state.payments[period] = false;
    delete state.settlements[period];
    const saved = saveState();
    render();
    if (saved) notify("Pagamento desfeito para este mês.");
  });
});
$("sum-categories").addEventListener("click", () => {
  customAvailable = new Set(availableSumCategories().map(category => category.id));
  customSelection = new Set(customAvailable);
  $("custom-panel").hidden = false;
  $("sum-categories").setAttribute("aria-expanded", "true");
  renderCustomSum();
  $("custom-panel").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  $("custom-title").focus({ preventScroll: true });
});
$("close-sum").addEventListener("click", () => {
  $("custom-panel").hidden = true;
  $("sum-categories").setAttribute("aria-expanded", "false");
  $("sum-categories").focus();
});
$("sum-options").addEventListener("change", event => {
  const checkbox = event.target.closest("input[data-sum-category]");
  if (!checkbox) return;
  if (checkbox.checked) customSelection.add(checkbox.dataset.sumCategory);
  else customSelection.delete(checkbox.dataset.sumCategory);
  renderCustomResult();
  refreshExplanation();
});
for (const [id, select] of [["sum-all", true], ["sum-none", false]]) $(id).addEventListener("click", () => {
  customSelection = select ? new Set(availableSumCategories().map(category => category.id)) : new Set();
  renderCustomSum();
});
MONTHS.forEach((name, index) => {
  const option = document.createElement("option");
  option.value = String(index + 1).padStart(2, "0");
  option.textContent = name;
  $("period-month").append(option);
});
$("add-record").addEventListener("click", () => openRecord());
$("empty-action").addEventListener("click", () => { if (currentRecords().length) { resetFilters(); render(); } else openRecord(); });
for (const id of ["close-dialog", "cancel-dialog"]) $(id).addEventListener("click", () => $("record-dialog").close());
$("record-form").addEventListener("submit", event => {
  event.preventDefault();
  $("form-error").hidden = true;
  for (const id of ["description", "value", "record-date", "recurring-day", "record-impact-include"]) $(id).removeAttribute("aria-invalid");
  let invalidField = "description";
  try {
    const description = $("description").value.trim();
    if (!description) throw new Error("Preencha a descrição do lançamento.");
    if (description.length > 200) throw new Error("A descrição deve ter até 200 caracteres.");
    invalidField = "value";
    const cents = InvoiceMath.parseMoney($("value").value);
    const categoryId = $("group").value || null;
    const labelIds = selectedRecordLabels();
    const labelId = labelIds[0] ?? null;
    if (categoryId && !state.categories.some(category => category.id === categoryId)) throw new Error("Selecione uma categoria válida.");
    if (labelId && !state.labels.some(label => label.id === labelId)) throw new Error("Selecione uma etiqueta válida.");
    const type = $("record-type").value;
    const date = $("record-date").value || todayDate();
    const previousRecord = (state.invoices[editingPeriod] ?? []).find(item => item.id === editingId);
    invalidField = "record-date";
    if (!validDate(date)) throw new Error("Preencha uma data válida para o lançamento.");
    const status = $("record-status").value;
    if (["received", "paid"].includes(status) && cents === null) { invalidField = "value"; throw new Error("Um valor confirmado precisa ser preenchido."); }
    const paymentMethod = type === "expense" ? $("payment-method").value : null;
    const funding = type === "expense" && paymentMethod !== "credit" ? previousRecord?.funding ?? null : null;
    const record = { id: editingId ?? newId(), createdOrder: previousRecord?.createdOrder ?? nextCreationOrder(state.invoices[editingPeriod] ?? []), description, categoryId, labelId, labelIds, sequenceId: previousRecord?.sequenceId, includeInBalance: previousRecord?.includeInBalance ?? true, recurrenceId: previousRecord?.recurrenceId ?? null, cents, type, date, status, paymentMethod, funding, salarySource: previousRecord?.salarySource ?? null };
    const previous = state.invoices[editingPeriod] ?? [];
    const records = editingId ? previous.map(item => item.id === editingId ? record : item) : [...previous, record];
    const candidate = JSON.parse(JSON.stringify(state));
    if (type === "income" && status === "received" && !record.salarySource) {
      invalidField = "record-impact-include";
      const choice = document.querySelector('input[name="record-impact"]:checked')?.value;
      if (!choice) throw new Error("Escolha se deseja incluir esta entrada nos cálculos do saldo.");
      record.includeInBalance = choice === "include";
    }
    if (type === "income" && !record.salarySource) {
      let recurring = candidate.recurrences.find(item => item.id === record.recurrenceId);
      if ($("record-recurring").checked) {
        invalidField = "value";
        if (cents === null || cents < 0) throw new Error("Uma entrada recorrente precisa de valor não negativo.");
        invalidField = "recurring-day";
        const day = validDayInput($("recurring-day").value);
        if (!recurring) { recurring = { id: newId(), startPeriod: editingPeriod }; candidate.recurrences.push(recurring); record.recurrenceId = recurring.id; }
        Object.assign(recurring, { active: true, description, categoryId, labelIds, cents: status === "received" && previousRecord?.recurrenceId ? recurring.cents : cents, day });
      } else if (recurring) recurring.active = false;
    } else if (record.recurrenceId) throw new Error("Uma entrada recorrente não pode ser transformada em saída.");
    candidate.invoices[editingPeriod] = records;
    if (record.salarySource) {
      const receipt = candidate.salaryMonths[editingPeriod][record.salarySource];
      if (status === "expected") undoSalary(candidate, editingPeriod, record.salarySource);
      else {
        if (type !== "income" || cents === null || cents < 0 || !validDate(date)) throw new Error("Uma quinzena recebida precisa de valor não negativo e data válida.");
        candidate.salaryMonths[editingPeriod][record.salarySource] = { ...receipt, received: true, actualCents: cents, actualDate: date };
        syncSalaryRecords(candidate);
      }
    }
    state = validateState(candidate);
    const saved = saveState();
    $("record-dialog").close();
    render();
    if (saved) notify(editingId ? "Lançamento atualizado." : "Lançamento adicionado.");
  } catch (error) {
    $("form-error").textContent = error.message;
    $("form-error").hidden = false;
    $(invalidField).setAttribute("aria-invalid", "true");
    $(invalidField).focus();
  }
});
$("records").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const record = currentRecords().find(item => item.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === "edit") openRecord(record);
  else {
    const period = state.period;
    confirmAction("Excluir lançamento?", `“${record.description}” será removido somente de ${periodLabel(period)}.${record.salarySource ? " A confirmação desta quinzena também será desfeita." : ""}`, "Excluir lançamento", () => {
      if (record.salarySource) undoSalary(state, period, record.salarySource);
      else {
        if (record.recurrenceId) { const template = state.recurrences.find(item => item.id === record.recurrenceId); template.skippedPeriods = [...new Set([...template.skippedPeriods, period])]; }
        state.invoices[period] = state.invoices[period].filter(item => item.id !== record.id);
      }
      const saved = saveState();
      render();
      if (saved) notify("Lançamento excluído deste mês.");
      $("add-record").focus();
    });
  }
});
$("category-tabs").addEventListener("click", event => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  render();
});
$("label-filter").addEventListener("change", () => { selectedLabel = $("label-filter").value; render(); });
$("search").addEventListener("input", render);
function changePeriod() {
  const year = $("period-year").value;
  const period = `${year.padStart(4, "0")}-${$("period-month").value}`;
  if (!/^\d{1,4}$/.test(year) || !validPeriod(period)) { render(); notify("Selecione um mês e um ano entre 1 e 9999."); return; }
  state.period = period;
  // Nenhuma importação nem cópia: um mês ainda inexistente é uma lista vazia.
  resetFilters();
  saveState();
  render();
}
$("period-month").addEventListener("change", changePeriod);
$("period-year").addEventListener("change", changePeriod);
$("due-form").addEventListener("submit", event => {
  event.preventDefault();
  const raw = $("due-day").value;
  const day = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(day) || day < 1 || day > 31) {
    $("due-error").textContent = "Informe um dia entre 1 e 31.";
    $("due-error").hidden = false;
    $("due-day").setAttribute("aria-invalid", "true");
    $("due-day").focus();
    return;
  }
  $("due-error").hidden = true;
  $("due-day").removeAttribute("aria-invalid");
  state.dueDay = day;
  const saved = saveState();
  render();
  if (saved) notify("Dia de vencimento atualizado para todos os meses.");
});
for (const [id, type, fromRecord] of [["create-category", "categories", true], ["create-label", "labels", true], ["manage-add-category", "categories", false], ["manage-add-label", "labels", false]]) {
  $(id).addEventListener("click", () => openOption(type, null, fromRecord));
}
for (const id of ["option-close", "option-cancel"]) $(id).addEventListener("click", () => $("option-dialog").close());
$("option-form").addEventListener("submit", event => {
  event.preventDefault();
  const { type, id, fromRecord } = optionEditor;
  const name = normalizeName($("option-name").value);
  const emptyLabel = type === "categories" ? "Sem categoria" : "Sem etiqueta";
  let message = "";
  if (!name) message = "Preencha o nome da opção.";
  else if (name.length > 60) message = "Use um nome com até 60 caracteres.";
  else if (compareName(name) === compareName(emptyLabel)) message = `“${emptyLabel}” é uma opção reservada.`;
  else if (state[type].some(option => option.id !== id && compareName(option.name) === compareName(name))) message = "Já existe uma opção com este nome.";
  if (message) {
    $("option-error").textContent = message;
    $("option-error").hidden = false;
    $("option-name").setAttribute("aria-invalid", "true");
    $("option-name").focus();
    return;
  }
  const optionId = id ?? newId();
  if (id) state[type].find(option => option.id === id).name = name;
  else state[type].push({ id: optionId, name, ...(type === "categories" ? { color: PALETTE[state.categories.length % PALETTE.length] } : {}) });
  const saved = saveState();
  $("option-dialog").close();
  render();
  if (fromRecord) {
    if (type === "categories") $("group").value = optionId;
    else renderFormOptions($("group").value, [...selectedRecordLabels(), optionId]);
  }
  if (saved) notify(id ? "Nome atualizado em todos os meses." : `${type === "categories" ? "Categoria criada" : "Etiqueta criada"}.`);
});
for (const id of ["category-list", "label-list"]) $(id).addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "rename") openOption(button.dataset.type, button.dataset.id);
  else deleteOption(button.dataset.type, button.dataset.id);
});
$("confirm-cancel").addEventListener("click", () => $("confirm-dialog").close());
$("confirm-ok").addEventListener("click", () => {
  const action = confirmationAction;
  confirmationAction = null;
  $("confirm-dialog").close();
  action?.();
});
$("confirm-dialog").addEventListener("cancel", () => { confirmationAction = null; });
$("clear-data").addEventListener("click", () => confirmAction("Apagar os dados salvos?", `Todos os lançamentos, pagamentos, recebimentos de salário e saldos de referência de TODOS os meses serão apagados. Categorias, etiquetas, salário padrão, imagem e dia de vencimento serão preservados.${storageBlocked ? " Os dados ilegíveis serão redefinidos após esta confirmação." : ""}`, "Apagar dados", () => {
  if (storageBlocked) state = emptyState();
  state.invoices = {};
  state.payments = {};
  state.settlements = {};
  state.invoiceFunding = {};
  state.salaryMonths = {};
  state.balanceRefs = {};
  state.recurrences = [];
  state.salaryConfigured = {};
  state.forecastDates = {};
  storageBlocked = false;
  const saved = saveState();
  resetFilters();
  render();
  if (saved) notify("Lançamentos e pagamentos de todos os meses apagados. Configurações preservadas.");
}));
function updateRecordFields(preferredStatus = $("record-status").value) {
  const income = $("record-type").value === "income";
  const credit = !income && $("payment-method").value === "credit";
  $("payment-method-field").hidden = income;
  $("credit-method-note").hidden = !credit;
  const options = income ? [["expected", "Prevista"], ["received", "Recebida"]] : [["pending", "Pendente"], ["paid", credit ? "Paga no cartão (sem saída de dinheiro)" : "Paga"]];
  $("record-status").replaceChildren();
  for (const [value, name] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = name;
    $("record-status").append(option);
  }
  $("record-status").value = options.some(([value]) => value === preferredStatus) ? preferredStatus : options[0][0];
  updateIncomeOptions();
}
function setActiveNavigation(href) {
  document.querySelectorAll(".nav-link").forEach(link => {
    const active = link.getAttribute("href") === href;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}
function setView(view) {
  setActiveNavigation(view === "salary" ? "#salario" : "#inicio");
  currentView = view;
  for (const id of ["monthly", "salary"]) {
    const active = id === view;
    $(id + "-view").hidden = !active;
    $("tab-" + id).setAttribute("aria-selected", String(active));
    $("tab-" + id).tabIndex = active ? 0 : -1;
  }
}
function nonnegativeMoney(text, label) {
  const cents = InvoiceMath.parseMoney(text);
  if (cents === null || cents < 0) throw new Error(`Preencha ${label} com um valor maior ou igual a zero.`);
  return cents;
}
function validDayInput(value) {
  if (!/^\d{1,2}$/.test(value) || Number(value) < 1 || Number(value) > 31) throw new Error("Os dias devem estar entre 1 e 31.");
  return Number(value);
}
function renderSalary() {
  const salary = salaryFor();
  const collapsed = !!state.salaryConfigured[state.period] && editingSalaryPeriod !== state.period;
  $("salary-config").hidden = collapsed;
  $("salary-summary").hidden = !collapsed;
  $("edit-salary").setAttribute("aria-expanded", String(!collapsed));
  $("salary-summary-values").textContent = `${currency(salary.first.expectedCents)} + ${currency(salary.second.expectedCents)}`;
  $("salary-summary-dates").textContent = `Dias ${salary.first.day} e ${salary.second.day} · bruto ${currency(salary.grossCents)}`;
  $("salary-period").textContent = `${periodLabel(state.period)} · Configuração e recebimentos deste período`;
  $("salary-gross").value = decimalInput(salary.grossCents);
  for (const id of ["first", "second"]) {
    $("salary-" + id).value = decimalInput(salary[id].expectedCents);
    $("salary-" + id + "-day").value = salary[id].day;
  }
  const expected = FinanceMath.safe(salary.first.expectedCents + salary.second.expectedCents);
  $("salary-net").textContent = currency(expected);
  $("salary-difference").textContent = currency(FinanceMath.safe(salary.grossCents - expected));
  $("quarter-plans").replaceChildren();
  const ordered = ["first", "second"].sort((a, b) => salary[a].day - salary[b].day);
  for (const id of ordered) {
    const receipt = salary[id];
    const card = document.createElement("section");
    card.className = "panel receipt-card";
    const heading = document.createElement("div");
    heading.className = "receipt-heading";
    const name = document.createElement("h3");
    name.textContent = FUNDINGS[id];
    const status = document.createElement("span");
    status.className = `receipt-status ${receipt.received ? "received" : "expected"}`;
    status.textContent = receipt.received ? "Recebida" : "Prevista";
    heading.append(name, status);
    const expectedValue = document.createElement("p");
    expectedValue.className = "receipt-date";
    expectedValue.textContent = `Recebimento previsto em ${displayDate(receiptDate(state.period, receipt))}`;
    const actual = document.createElement("div");
    actual.className = "amount";
    actual.textContent = currency(receipt.received ? receipt.actualCents : receipt.expectedCents);
    const date = document.createElement("p");
    date.className = "small-note";
    date.textContent = receipt.received ? `Recebida em ${displayDate(receipt.actualDate)}` : "Ainda não recebida. Você pode confirmar antes da data prevista.";
    const actions = document.createElement("div");
    actions.className = "receipt-actions";
    const confirm = document.createElement("button");
    confirm.className = "button primary";
    confirm.dataset.receipt = id;
    confirm.textContent = receipt.received ? "Corrigir recebimento" : "Marcar como recebida";
    confirm.setAttribute("aria-label", `${confirm.textContent}: ${FUNDINGS[id]}`);
    actions.append(confirm);
    if (receipt.received) {
      const undo = document.createElement("button");
      undo.className = "button secondary";
      undo.dataset.undoReceipt = id;
      undo.textContent = "Desfazer";
      undo.setAttribute("aria-label", `Desfazer recebimento: ${FUNDINGS[id]}`);
      actions.append(undo);
    }
    const receiptHelp = document.createElement("button");
    receiptHelp.className = "help-button";
    receiptHelp.dataset.help = `receipt-${id}`;
    receiptHelp.textContent = "?";
    receiptHelp.setAttribute("aria-label", `Detalhes do recebimento de ${FUNDINGS[id]}`);
    receiptHelp.setAttribute("aria-expanded", "false");
    receiptHelp.setAttribute("aria-controls", "total-details");
    const amountLine = document.createElement("div");
    amountLine.className = "indicator-line";
    amountLine.append(actual, receiptHelp);
    card.append(heading, expectedValue, amountLine, date, actions);
    const impact = document.createElement("div");
    impact.className = "receipt-impact-note";
    impact.textContent = !receipt.received ? "Escolha o impacto no saldo ao confirmar o recebimento." : receipt.includeInBalance === false ? "Já considerada no saldo de referência — não soma novamente." : "Incluído nos cálculos do saldo · respeita a data de referência";
    if (receipt.received) date.textContent += ` · Previsão original: ${currency(receipt.expectedCents)}`;
    card.classList.add("quarter-column");
    card.append(impact);
    $("quarter-plans").append(card);
  }
}

function openReceipt(id) {
  receiptEditing = { id, period: state.period };
  const receipt = salaryFor()[id];
  $("receipt-title").textContent = receipt.received ? "Corrigir recebimento" : "Confirmar recebimento";
  $("receipt-context").textContent = `${FUNDINGS[id]} · ${periodLabel(state.period)}. Você pode confirmar um recebimento antecipado, sem mudar a data prevista.`;
  $("receipt-value").value = decimalInput(receipt.received ? receipt.actualCents : receipt.expectedCents);
  $("receipt-date").value = receipt.received ? receipt.actualDate : todayDate();
  document.querySelectorAll('input[name="receipt-impact"]').forEach(input => { input.checked = false; });
  $("receipt-previous-choice").hidden = !receipt.received;
  $("receipt-previous-choice").textContent = receipt.includeInBalance === false ? "Escolha atual: apenas marcar como recebida. Selecione a opção desejada para confirmar." : "Escolha atual: incluir no saldo. Selecione a opção desejada para confirmar.";
  $("receipt-error").hidden = true;
  $("receipt-dialog").showModal();
  $("receipt-value").focus();
}
function openSettlement() {
  settlementPeriod = state.period;
  const existing = state.settlements[state.period];
  $("settlement-context").textContent = `${periodLabel(state.period)} · Fatura atual ${currency(financeFor().invoice)}. Este pagamento sai do saldo sem gerar uma segunda despesa.`;
  $("settlement-value").value = decimalInput(existing?.cents ?? financeFor().invoice);
  $("settlement-date").value = existing?.date ?? todayDate();
  $("settlement-error").hidden = true;
  $("settlement-dialog").showModal();
  $("settlement-value").focus();
}
for (const view of ["monthly", "salary"]) {
  $("tab-" + view).addEventListener("click", () => setView(view));
  $("tab-" + view).addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "monthly" : event.key === "End" ? "salary" : currentView === "salary" ? "monthly" : "salary";
    setView(next);
    $("tab-" + next).focus();
  });
}
$("nav-salary").addEventListener("click", event => { event.preventDefault(); setView("salary"); $("tab-salary").scrollIntoView({ block: "start" }); });
document.querySelector('.nav-link[href="#lancamentos"]').addEventListener("click", () => setView("monthly"));
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => {
  if (link.getAttribute("href") === "#inicio") setView("monthly");
  setActiveNavigation(link.getAttribute("href"));
}));
for (const key of ["type", "date"]) $("sort-" + key).addEventListener("click", () => {
  recordSort = { key, direction: recordSort.key === key ? (recordSort.direction === "ascending" ? "descending" : "ascending") : key === "date" ? "descending" : "ascending" };
  render();
});
$("record-type").addEventListener("change", () => updateRecordFields());
$("payment-method").addEventListener("change", () => updateRecordFields());
$("type-filter").addEventListener("change", render);
$("salary-config").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const defaults = validateSalaryDefaults({ grossCents: nonnegativeMoney($("salary-gross").value, "o salário bruto"), first: { cents: nonnegativeMoney($("salary-first").value, "a primeira quinzena"), day: validDayInput($("salary-first-day").value) }, second: { cents: nonnegativeMoney($("salary-second").value, "a segunda quinzena"), day: validDayInput($("salary-second-day").value) } });
    const candidate = JSON.parse(JSON.stringify(state));
    const current = salaryFor();
    candidate.salaryMonths[state.period] = { grossCents: defaults.grossCents, first: { ...current.first, expectedCents: defaults.first.cents, day: defaults.first.day }, second: { ...current.second, expectedCents: defaults.second.cents, day: defaults.second.day } };
    candidate.salaryDefaults = defaults;
    candidate.salaryConfigured[state.period] = true;
    state = validateState(candidate);
    $("salary-config-error").hidden = true;
    const saved = saveState();
    if (saved) editingSalaryPeriod = null;
    render();
    if (saved) notify("Configuração salva para este mês e para os próximos ainda não configurados.");
  } catch (error) {
    $("salary-config-error").textContent = error.message;
    $("salary-config-error").hidden = false;
  }
});
$("quarter-plans").addEventListener("click", event => {
  const confirm = event.target.closest("button[data-receipt]");
  if (confirm) { openReceipt(confirm.dataset.receipt); return; }
  const undo = event.target.closest("button[data-undo-receipt]");
  if (!undo) return;
  const period = state.period, id = undo.dataset.undoReceipt;
  confirmAction("Desfazer recebimento?", `Somente ${FUNDINGS[id]} de ${periodLabel(period)} voltará a ser prevista. A fatura não será alterada.`, "Desfazer recebimento", () => {
    undoSalary(state, period, id);
    const saved = saveState();
    render();
    if (saved) notify("Confirmação de recebimento desfeita.");
  });
});
$("receipt-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const value = nonnegativeMoney($("receipt-value").value, "o valor recebido");
    const date = $("receipt-date").value;
    if (!validDate(date)) throw new Error("Informe uma data real de recebimento válida.");
    const choice = document.querySelector('input[name="receipt-impact"]:checked')?.value;
    if (!choice) throw new Error("Escolha se deseja incluir o recebimento nos cálculos do saldo.");
    const { id, period } = receiptEditing;
    const candidate = JSON.parse(JSON.stringify(state));
    const salary = salaryFor(period);
    candidate.salaryMonths[period] = { ...salary, [id]: { ...salary[id], received: true, actualCents: value, actualDate: date, includeInBalance: choice === "include" } };
    syncSalaryRecords(candidate);
    state = validateState(candidate);
    const saved = saveState();
    $("receipt-dialog").close();
    render();
    if (saved) notify("Quinzena recebida. Saldo atualizado sem duplicar a entrada.");
  } catch (error) {
    $("receipt-error").textContent = error.message;
    $("receipt-error").hidden = false;
  }
});
$("settlement-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const cents = InvoiceMath.parseMoney($("settlement-value").value);
    if (cents === null) throw new Error("Preencha o valor pago.");
    const date = $("settlement-date").value;
    if (!validDate(date)) throw new Error("Informe uma data válida para o pagamento.");
    const candidate = JSON.parse(JSON.stringify(state));
    candidate.payments[settlementPeriod] = true;
    candidate.settlements[settlementPeriod] = { cents, date };
    state = validateState(candidate);
    const saved = saveState();
    $("settlement-dialog").close();
    render();
    if (saved) notify("Pagamento da fatura registrado sem criar outra despesa.");
  } catch (error) {
    $("settlement-error").textContent = error.message;
    $("settlement-error").hidden = false;
  }
});
for (const [dialog, prefix] of [["receipt-dialog", "receipt"], ["settlement-dialog", "settlement"]]) for (const suffix of ["close", "cancel"]) $(prefix + "-" + suffix).addEventListener("click", () => $(dialog).close());
$("card-upload-button").addEventListener("keydown", event => {
  if (!["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  $("card-upload").click();
});
$("card-upload").addEventListener("change", async () => {
  const file = $("card-upload").files?.[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("A imagem ultrapassa o tamanho máximo de 2 MB. Escolha um arquivo menor. A imagem anterior foi mantida.");
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) throw new Error("Formato incompatível. Envie uma imagem PNG, JPEG, WebP ou AVIF de até 2 MB.");
    const url = URL.createObjectURL(file);
    const image = new Image();
    try {
      image.src = url;
      try { await image.decode(); } catch { throw new Error("Não foi possível ler esta imagem. Use um arquivo PNG, JPEG, WebP ou AVIF válido."); }
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000) throw new Error("A imagem é grande demais. Use uma versão com até 40 megapixels.");
      const scale = Math.min(1, 1280 / image.naturalWidth, 1280 / image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      context.fillStyle = "#302343";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/jpeg", .85);
      if (encoded.length > 1500000) throw new Error("A imagem não coube no armazenamento. Envie uma imagem menor.");
      if (storageBlocked) throw new Error("O salvamento está suspenso. Recupere o armazenamento antes de personalizar o cartão.");
      const previous = state.cardImage;
      state.cardImage = encoded;
      if (!saveState()) { state.cardImage = previous; throw new Error("Não foi possível salvar a imagem. Os dados financeiros foram preservados."); }
      $("card-image-error").hidden = true;
      renderDue();
      notify("Imagem do cartão salva neste navegador.");
    } finally { URL.revokeObjectURL(url); }
  } catch (error) {
    $("card-image-error").textContent = error.message;
    $("card-image-error").hidden = false;
  }
  $("card-upload").value = "";
});
$("restore-card").addEventListener("click", () => {
  const previous = state.cardImage;
  state.cardImage = null;
  if (!saveState()) { state.cardImage = previous; return; }
  $("card-image-error").hidden = true;
  renderDue();
  notify("Imagem padrão restaurada.");
});

function refreshFinancialIndicators() {
  const finance = financeFor();
  for (const [id, value] of [["income-expected", finance.incomeExpected], ["income-received", finance.incomeReceived], ["expense-pending", finance.expensePending], ["expense-paid", finance.expensePaid], ["available-balance", finance.available], ["projected-balance", finance.projected], ["monthly-spending", finance.spending]]) {
    $(id).textContent = currency(value);
    $(id).classList.toggle("negative-value", value < 0);
  }
  refreshExplanation();
}
function renderBalanceControls() {
  const reference = balanceFor();
  const collapsed = !!state.balanceRefs[state.period] && editingBalancePeriod !== state.period;
  $("balance-editor").hidden = collapsed;
  document.querySelector(".balance-reference").classList.toggle("is-collapsed", collapsed);
  $("balance-summary").hidden = !collapsed;
  $("edit-balance").setAttribute("aria-expanded", String(!collapsed));
  $("reference-summary-value").textContent = currency(reference.cents);
  $("reference-summary-date").textContent = `Referência: ${displayDate(reference.date)}`;
  $("bank-balance").value = decimalInput(reference.cents);
  $("balance-date").value = reference.date;
  $("forecast-date").value = forecastFor();
  $("forecast-date").min = reference.date;
  $("forecast-caption").textContent = `Para ${displayDate(forecastFor())}`;
  $("forecast-period-note").textContent = `Somente movimentos de ${periodLabel(state.period)}.`;
  $("balance-reference-note").textContent = `${state.balanceRefs[state.period] ? "Referência salva para este período." : "Saldo ainda não informado: usando zero como ponto de partida."} O saldo inclui movimentos realizados até o final da data informada. Movimentos posteriores são considerados uma vez.`;
}
$("edit-balance").addEventListener("click", () => {
  editingBalancePeriod = state.period;
  renderBalanceControls();
  $("bank-balance").focus();
});
$("correct-payment").addEventListener("click", openSettlement);
$("balance-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const cents = InvoiceMath.parseMoney($("bank-balance").value);
    const date = $("balance-date").value;
    if (cents === null) throw new Error("Preencha o saldo atual disponível no banco.");
    if (!validDate(date)) throw new Error("Informe uma data de referência válida.");
    if (date > todayDate()) throw new Error("O saldo atual deve ter referência em hoje ou em uma data anterior.");
    const candidate = JSON.parse(JSON.stringify(state));
    candidate.balanceRefs[state.period] = { cents, date };
    if (candidate.forecastDates[state.period] && candidate.forecastDates[state.period] < date) candidate.forecastDates[state.period] = date;
    state = validateState(candidate);
    $("balance-error").hidden = true;
    $("forecast-error").hidden = true;
    const saved = saveState();
    if (saved) editingBalancePeriod = null;
    render();
    if (saved) $("edit-balance").focus();
    if (saved) notify("Saldo atual e referência salvos para este mês e ano.");
  } catch (error) {
    $("balance-error").textContent = error.message;
    $("balance-error").hidden = false;
  }
});
$("forecast-date").addEventListener("change", () => {
  const date = $("forecast-date").value;
  if (!validDate(date) || date < balanceFor().date) {
    $("forecast-error").textContent = "Escolha uma data válida, igual ou posterior à referência do saldo.";
    $("forecast-error").hidden = false;
    return;
  }
  const candidate = JSON.parse(JSON.stringify(state));
  candidate.forecastDates[state.period] = date;
  try {
    state = validateState(candidate);
    $("forecast-error").hidden = true;
    saveState();
    render();
  } catch (error) {
    $("forecast-error").textContent = error.message;
    $("forecast-error").hidden = false;
  }
});
function updateCategoryNavigation() {
  const strip = $("category-tabs");
  $("categories-prev").disabled = strip.scrollLeft <= 1;
  $("categories-next").disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
}
for (const [id, direction] of [["categories-prev", -1], ["categories-next", 1]]) $(id).addEventListener("click", () => {
  const strip = $("category-tabs");
  strip.scrollBy({ left: direction * Math.max(150, strip.clientWidth * .75), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
});
$("category-tabs").addEventListener("scroll", updateCategoryNavigation);
window.addEventListener("resize", updateCategoryNavigation);

// Os pop-ups usam os mesmos itens que a função de cálculo, sem fórmulas paralelas.
const HELP_TITLES = { invoice: "Total da fatura", incomeExpected: "Entradas previstas", incomeReceived: "Entradas recebidas", expensePending: "Saídas previstas", expensePaid: "Saídas pagas", available: "Saldo disponível agora", projected: "Saldo previsto", spending: "Gastos do mês", custom: "Soma das categorias selecionadas", salaryExpected: "Previsão das quinzenas", salaryDifference: "Diferença do salário" };
document.querySelectorAll(".summary .help-button").forEach(button => button.setAttribute("aria-label", `Detalhes de ${HELP_TITLES[button.dataset.help]}`));
let explanationButton = null;
let explanationPinned = false;
let explanationTimer;
let suppressExplanationFocus = false;
function explanationData(key) {
  const finance = financeFor();
  const basic = { invoiceStatus: key === "invoice" ? (state.payments[state.period] ? finance.invoiceRemaining > 0 ? "Pagamento parcial" : "Paga" : "Em aberto") : null, title: HELP_TITLES[key] ?? "Detalhes do indicador", amount: finance[key], items: finance.parts[key] ?? [], note: `Período: ${periodLabel(state.period)}.` };
  const formulas = {
    invoice: "Soma das compras no cartão. O pagamento da fatura não é outra compra.",
    incomeExpected: "Entradas previstas e quinzenas ainda não recebidas. O salário bruto não entra na soma.",
    incomeReceived: "Entradas recebidas, incluindo uma única entrada para cada quinzena confirmada. Este total histórico é preservado mesmo quando o recebimento já está considerado no saldo de referência.",
    expensePending: "Saídas fora do cartão ainda pendentes e valor da fatura ainda a pagar.",
    expensePaid: "Saídas pagas fora do cartão e pagamento registrado da fatura, uma única vez.",
    spending: "Todas as despesas do mês. Compras no cartão entram uma vez; o pagamento da fatura não é somado de novo."
  };
  if (key === "available" || key === "projected") {
    basic.items = finance.parts[key === "available" ? "availableDetails" : "projectedDetails"];
    basic.formula = key === "available" ? `Referência + entradas recebidas − saídas pagas, posteriores a ${displayDate(finance.reference.date)} e até ${displayDate(finance.today)}.` : `Saldo disponível agora + entradas previstas − saídas pendentes até ${displayDate(finance.target)}. Itens com impacto zero ficam visíveis para explicar as exclusões.`;
    basic.note += ` ${finance.alreadyIncluded.length} movimento(s) já considerados no saldo de referência estão incluídos nele e não são somados de novo. A referência considera o fim do dia. Recebimentos marcados como já considerados nela também ficam fora dos saldos, independentemente da data real.`;
    if (finance.undated.length) basic.note += ` ${finance.undated.length} movimento(s) sem data ficam fora dos saldos. Preencha as datas para incluí-los com segurança.`;
    if (!state.balanceRefs[state.period]) basic.note += " Saldo bancário ainda não informado: referência inicial zero.";
  } else if (key === "custom") {
    const totals = InvoiceMath.calculate(creditRecords(), state.categories);
    basic.items = availableSumCategories().filter(category => customSelection.has(category.id)).map(category => ({ label: category.name, cents: totals.groups[category.id], date: null }));
    basic.amount = InvoiceMath.selectedTotal(creditRecords(), customSelection);
    basic.formula = "Soma dos subtotais das categorias marcadas, apenas nas compras no cartão. Não altera a fatura.";
  } else if (key === "salaryExpected" || key === "salaryDifference") {
    const salary = salaryFor();
    basic.items = ["first", "second"].map(id => ({ label: `${FUNDINGS[id]} · prevista`, cents: key === "salaryDifference" ? -salary[id].expectedCents : salary[id].expectedCents, date: receiptDate(state.period, salary[id]) }));
    if (key === "salaryDifference") basic.items.unshift({ label: "Salário bruto de referência", cents: salary.grossCents, date: null });
    basic.amount = InvoiceMath.sum(basic.items);
    basic.formula = key === "salaryDifference" ? "Salário bruto menos as duas previsões. Diferença apenas informativa; não gera despesa." : "Soma das duas previsões. Recebimentos reais podem ter outros valores.";
  } else if (key.startsWith("receipt-")) {
    const source = key.slice(8);
    const receipt = salaryFor()[source];
    basic.title = `${FUNDINGS[source]} · recebida`;
    basic.items = receipt.received ? [{ label: `${FUNDINGS[source]} · entrada vinculada`, cents: receipt.actualCents, date: receipt.actualDate }] : [];
    basic.amount = receipt.received ? receipt.actualCents : 0;
    basic.formula = `Valor efetivamente recebido. A mesma entrada aparece na tabela e é contada uma vez. ${receipt.includeInBalance === false ? "Já considerado no saldo de referência: preserva o histórico de entradas e não soma aos saldos." : "Participa dos saldos somente após a data de referência."}`;
  } else basic.formula = formulas[key] ?? "Soma dos itens indicados.";
  return basic;
}
function positionExplanation() {
  if (!explanationButton?.isConnected) { closeExplanation(); return; }
  const popup = $("total-details");
  const anchor = explanationButton.getBoundingClientRect();
  const width = Math.min(360, innerWidth - 24);
  popup.style.width = `${width}px`;
  popup.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, anchor.right - width))}px`;
  const height = popup.offsetHeight;
  const below = anchor.bottom + 8;
  popup.style.top = `${below + height <= innerHeight - 12 ? below : Math.max(12, Math.min(innerHeight - height - 12, anchor.top - height - 8))}px`;
}
function refreshExplanation() {
  if (!explanationButton) return;
  if (!explanationButton.isConnected) { closeExplanation(); return; }
  let data;
  try { data = explanationData(explanationButton.dataset.help); }
  catch (error) { data = { title: "Consulta fora do limite", formula: error.message, items: [], amount: null, note: "Os dados financeiros permanecem intactos." }; }
  $("detail-title").textContent = data.title;
  $("detail-invoice-status").hidden = !data.invoiceStatus;
  $("detail-invoice-status").textContent = data.invoiceStatus ?? "";
  $("detail-invoice-status").dataset.status = data.invoiceStatus === "Paga" ? "paid" : data.invoiceStatus === "Pagamento parcial" ? "partial" : "open";
  $("detail-formula").textContent = data.formula;
  $("detail-items").replaceChildren();
  for (const item of data.items) {
    const row = document.createElement("div");
    row.className = "detail-item";
    const description = document.createElement("span");
    description.textContent = item.label;
    const date = document.createElement("small");
    date.textContent = `${item.date ? displayDate(item.date) : "Sem data"}${item.movement ? ` · ${item.movement}` : ""}${item.undefinedValue ? " · valor não definido" : ""}`;
    const value = document.createElement("strong");
    const impact = item.effectCents ?? item.cents;
    value.textContent = currency(impact);
    value.classList.toggle("negative-value", impact < 0);
    if (item.effectLabel) date.textContent += ` · ${item.effectLabel} · valor informado: ${currency(item.sourceCents ?? item.cents)}`;
    row.append(description, value, date);
    if (item.note || item.inReference) { const notice = document.createElement("small"); notice.className = "reference-receipt-note"; notice.textContent = item.note || "Já considerada no saldo de referência — não soma novamente. O valor permanece no histórico recebido."; row.append(notice); }
    $("detail-items").append(row);
  }
  if (!data.items.length) $("detail-items").textContent = "Nenhum item considerado neste total.";
  $("detail-total").textContent = data.amount === null ? "—" : `Total: ${currency(data.amount)}`;
  $("detail-note").textContent = data.note;
  positionExplanation();
}
function openExplanation(button, pin = false) {
  clearTimeout(explanationTimer);
  if (explanationButton && explanationButton !== button) explanationButton.setAttribute("aria-expanded", "false");
  if (explanationButton !== button) explanationPinned = false;
  explanationButton = button;
  explanationPinned ||= pin;
  button.setAttribute("aria-expanded", "true");
  $("total-details").setAttribute("aria-hidden", "false");
  $("total-details").classList.add("is-open");
  refreshExplanation();
}
function closeExplanation(returnFocus = false) {
  clearTimeout(explanationTimer);
  const button = explanationButton;
  button?.setAttribute("aria-expanded", "false");
  explanationButton = null;
  explanationPinned = false;
  $("total-details").classList.remove("is-open");
  $("total-details").setAttribute("aria-hidden", "true");
  if (returnFocus && button?.isConnected) {
    suppressExplanationFocus = true;
    button.focus({ preventScroll: true });
    setTimeout(() => { suppressExplanationFocus = false; }, 0);
  }
}
function scheduleExplanationClose() {
  clearTimeout(explanationTimer);
  explanationTimer = setTimeout(() => {
    if (!explanationPinned && !$("total-details").matches(":hover") && !explanationButton?.matches(":hover") && !$("total-details").contains(document.activeElement) && document.activeElement !== explanationButton) closeExplanation();
  }, 180);
}
document.addEventListener("pointerover", event => {
  const button = event.target.closest(".help-button");
  if (button && event.pointerType !== "touch") openExplanation(button);
});
document.addEventListener("pointerout", event => { if (event.target.closest(".help-button")) scheduleExplanationClose(); });
document.addEventListener("focusin", event => {
  const button = event.target.closest(".help-button");
  if (button && !suppressExplanationFocus) openExplanation(button);
  else if (!$("total-details").contains(event.target) && event.target !== explanationButton) closeExplanation();
});
document.addEventListener("click", event => {
  const button = event.target.closest(".help-button");
  if (!button) return;
  if (explanationButton === button && explanationPinned) closeExplanation();
  else openExplanation(button, true);
});
document.addEventListener("pointerdown", event => {
  if (explanationButton && !event.target.closest(".help-button") && !$("total-details").contains(event.target)) closeExplanation();
});
$("total-details").addEventListener("pointerenter", () => clearTimeout(explanationTimer));
$("total-details").addEventListener("pointerleave", scheduleExplanationClose);
$("total-details").addEventListener("focusout", scheduleExplanationClose);
$("close-details").addEventListener("click", () => closeExplanation(true));
document.addEventListener("keydown", event => {
  const button = event.target.closest(".help-button");
  if (event.key === "ArrowDown" && button) {
    event.preventDefault();
    openExplanation(button, true);
    requestAnimationFrame(() => $("detail-items").focus({ preventScroll: true }));
  } else if (event.key === "Escape" && explanationButton) {
    event.preventDefault();
    closeExplanation(true);
  }
});
window.addEventListener("resize", () => { if (explanationButton) positionExplanation(); });
window.addEventListener("scroll", () => { if (explanationButton) positionExplanation(); }, true);

// Normalização incremental: IDs e associações legadas permanecem intactos.
function validateRecurrences(items, categories, labels) {
  if (!Array.isArray(items)) throw new Error("Recorrências inválidas.");
  const ids = new Set();
  return items.map(item => {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.active !== "boolean" || !validPeriod(item.startPeriod) || typeof item.description !== "string" || !item.description.trim() || item.description.length > 200 || !Number.isSafeInteger(item.cents) || item.cents < 0 || !Number.isInteger(item.day) || item.day < 1 || item.day > 31 || (item.categoryId !== null && !categories.some(category => category.id === item.categoryId)) || !Array.isArray(item.labelIds) || new Set(item.labelIds).size !== item.labelIds.length || item.labelIds.some(id => !labels.some(label => label.id === id))) throw new Error("Configuração de entrada recorrente inválida.");
    const skippedPeriods = item.skippedPeriods ?? [];
    if (!Array.isArray(skippedPeriods) || skippedPeriods.some(period => !validPeriod(period))) throw new Error("Períodos de recorrência inválidos.");
    ids.add(item.id);
    return { ...item, skippedPeriods: [...new Set(skippedPeriods)] };
  });
}
function ensureRecurringMonth() {
  const pending = state.recurrences.filter(item => item.active && state.period >= item.startPeriod && !item.skippedPeriods.includes(state.period) && !currentRecords().some(record => record.recurrenceId === item.id));
  if (!pending.length) return;
  try {
    const candidate = JSON.parse(JSON.stringify(state));
    const records = candidate.invoices[state.period] ?? [];
    for (const template of pending) {
      const [year, month] = state.period.split("-").map(Number);
      records.push({ id: newId(), createdOrder: nextCreationOrder(records), description: template.description, categoryId: template.categoryId, labelId: template.labelIds[0] ?? null, labelIds: [...template.labelIds], cents: template.cents, type: "income", date: localDateString(DueCalendar.date(year, month - 1, template.day)), status: "expected", paymentMethod: null, funding: null, salarySource: null, recurrenceId: template.id, includeInBalance: true });
    }
    candidate.invoices[state.period] = records;
    state = validateState(candidate);
    saveState();
  } catch (error) { notify("Não foi possível gerar a previsão recorrente: " + error.message); }
}
function updateIncomeOptions() {
  const income = $("record-type").value === "income";
  const linkedSalary = (state.invoices[editingPeriod] ?? []).find(item => item.id === editingId)?.salarySource;
  $("income-options").hidden = !income || !!linkedSalary;
  $("income-impact").hidden = !income || $("record-status").value !== "received" || !!linkedSalary;
  $("recurring-day-field").hidden = !income || !$("record-recurring").checked || !!linkedSalary;
}
$("record-status").addEventListener("change", updateIncomeOptions);
$("record-recurring").addEventListener("change", updateIncomeOptions);
$("edit-salary").addEventListener("click", () => { editingSalaryPeriod = state.period; renderSalary(); $("salary-gross").focus(); });
$("open-settings").addEventListener("click", () => { renderRecurrenceSettings(); $("settings-dialog").showModal(); });
$("close-settings").addEventListener("click", () => $("settings-dialog").close());
$("settings-dialog").addEventListener("click", event => {
  const rect = $("settings-dialog").getBoundingClientRect();
  if (event.target === $("settings-dialog") && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $("settings-dialog").close();
});
function renderRecurrenceSettings() {
  $("recurrence-list").replaceChildren();
  const active = state.recurrences.filter(item => item.active);
  if (!active.length) $("recurrence-list").textContent = "Nenhuma entrada recorrente ativa. Configure no formulário de lançamento.";
  for (const template of active) {
    const row = document.createElement("div"); row.className = "option-row";
    const text = document.createElement("span"); text.textContent = `${template.description} · dia ${template.day} · ${currency(template.cents)}`;
    const stop = document.createElement("button"); stop.className = "button secondary"; stop.textContent = "Parar recorrência";
    stop.addEventListener("click", () => confirmAction("Parar recorrência?", "Nenhuma previsão nova será gerada. Os lançamentos existentes serão preservados.", "Parar", () => { template.active = false; saveState(); renderRecurrenceSettings(); render(); }));
    row.append(text, stop); $("recurrence-list").append(row);
  }
}
function categorySummary(button) {
  const id = button.dataset.category;
  if (!id || id === "all") return;
  const type = $("type-filter").value;
  const query = compareName($("search").value);
  const records = currentRecords().filter(record => (record.categoryId ?? "none") === id && (type === "all" || record.type === type || (type === "credit" && record.type === "expense" && record.paymentMethod === "credit")) && (selectedLabel === "all" || (selectedLabel === "" ? !record.labelIds.length : record.labelIds.includes(selectedLabel))) && compareName(record.description).includes(query));
  if (!records.some(record => record.cents !== null)) return;
  const popup = $("category-popover");
  popup.textContent = `${button.textContent} · ${records.length} ${records.length === 1 ? "lançamento" : "lançamentos"} · ${currency(InvoiceMath.sum(records))}`;
  popup.hidden = false;
  button.setAttribute("aria-describedby", "category-popover");
  const rect = button.getBoundingClientRect();
  popup.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - popup.offsetWidth - 12))}px`;
  popup.style.top = `${Math.max(12, rect.top - popup.offsetHeight - 8)}px`;
}
$("category-tabs").addEventListener("pointerover", event => { const button = event.target.closest("button[data-category]"); if (button) categorySummary(button); });
$("category-tabs").addEventListener("pointerout", () => { $("category-popover").hidden = true; });
$("category-tabs").addEventListener("focusin", event => { const button = event.target.closest("button[data-category]"); if (button) categorySummary(button); });
$("category-tabs").addEventListener("focusout", () => { $("category-popover").hidden = true; });
window.addEventListener("scroll", () => { $("category-popover").hidden = true; }, true);

render();
if (!storageBlocked) {
  const saved = saveState();
  if (saved && migrationApplied) notify("Dados salvos preservados na nova versão.");
}
// Recalcula quando a aba volta ao primeiro plano e atravessa a meia-noite local.
setInterval(() => { renderDue(); refreshFinancialIndicators(); }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderDue(); refreshFinancialIndicators(); } });
