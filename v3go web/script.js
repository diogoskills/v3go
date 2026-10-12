"use strict";

// Dados reais de Planilha1. Valores em centavos; null preserva células vazias.
const SOURCE_RECORDS = [
  {
    "id": "source-fixed-7",
    "description": "Amazon Martkeplace 12/12",
    "group": "fixed",
    "cents": 7374
  },
  {
    "id": "source-fixed-8",
    "description": "Amazon",
    "group": "fixed",
    "cents": 4999
  },
  {
    "id": "source-fixed-9",
    "description": "Mp*Ptisk",
    "group": "fixed",
    "cents": 5699
  },
  {
    "id": "source-fixed-10",
    "description": "Amazon * Btcgvarej",
    "group": "fixed",
    "cents": 5390
  },
  {
    "id": "source-fixed-11",
    "description": "Nitro Discord",
    "group": "fixed",
    "cents": 2607
  },
  {
    "id": "source-fixed-12",
    "description": "99Food",
    "group": "fixed",
    "cents": 3742
  },
  {
    "id": "source-fixed-13",
    "description": "JimCom",
    "group": "fixed",
    "cents": 3800
  },
  {
    "id": "source-fixed-14",
    "description": "Claro Flex",
    "group": "fixed",
    "cents": 3999
  },
  {
    "id": "source-flexible-7",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 633
  },
  {
    "id": "source-flexible-8",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 393
  },
  {
    "id": "source-flexible-9",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-10",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 891
  },
  {
    "id": "source-flexible-11",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 590
  },
  {
    "id": "source-flexible-12",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 416
  },
  {
    "id": "source-flexible-13",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-14",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-15",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 300
  },
  {
    "id": "source-flexible-16",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 590
  },
  {
    "id": "source-flexible-17",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-18",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 492
  },
  {
    "id": "source-flexible-19",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 490
  },
  {
    "id": "source-flexible-20",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-21",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 491
  },
  {
    "id": "source-flexible-22",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 691
  },
  {
    "id": "source-flexible-23",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 490
  },
  {
    "id": "source-flexible-24",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 2257
  },
  {
    "id": "source-flexible-25",
    "description": "DI * Uberrides",
    "group": "flexible",
    "cents": 592
  },
  {
    "id": "source-flexible-26",
    "description": "Iof",
    "group": "flexible",
    "cents": 91
  },
  {
    "id": "source-moises-6",
    "description": "Shopee * TechTudo",
    "group": "moises",
    "cents": 4899
  },
  {
    "id": "source-moises-7",
    "description": "Shopee * Docegarimpodec",
    "group": "moises",
    "cents": 3500
  },
  {
    "id": "source-moises-8",
    "description": "Shopee * Brinka Festa Sh 1/2",
    "group": "moises",
    "cents": 2351
  },
  {
    "id": "source-moises-9",
    "description": "Shopee * Casa e Decoracao",
    "group": "moises",
    "cents": 4999
  },
  {
    "id": "source-moises-10",
    "description": "Mochila",
    "group": "moises",
    "cents": null
  }
];

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
  calculate(records, categories = []) {
    const groups = Object.create(null);
    for (const category of [...categories, { id: "uncategorized" }]) {
      groups[category.id] = this.sum(records.filter(record => (record.categoryId ?? "uncategorized") === category.id));
    }
    return { groups, total: this.sum(records), combined: this.sum(records.filter(record => ["fixed", "flexible"].includes(record.categoryId))) };
  }
});

const $ = id => document.getElementById(id);
const STORAGE_KEY = "v3go.invoice.v2";
const LEGACY_KEY = "v3go.invoice.v1";
const BASE_PERIOD = "2026-10";
const DEFAULT_CATEGORIES = [
  { id: "fixed", name: "Fixos", color: "#8865c3" },
  { id: "flexible", name: "Flexíveis", color: "#66a595" },
  { id: "moises", name: "Moisés", color: "#d7a669" }
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
const importRecord = record => ({ id: record.id, description: record.description, categoryId: record.group, labelId: null, cents: record.cents });
const sourceState = () => ({ version: 2, period: BASE_PERIOD, dueDay: 5, categories: DEFAULT_CATEGORIES.map(category => ({ ...category })), labels: [], invoices: { [BASE_PERIOD]: SOURCE_RECORDS.map(importRecord) } });

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
function validateState(data) {
  if (!data || data.version !== 2 || !validPeriod(data.period) || !Number.isInteger(data.dueDay) || data.dueDay < 1 || data.dueDay > 31 ||
      !data.invoices || typeof data.invoices !== "object" || Array.isArray(data.invoices)) throw new Error("Dados salvos inválidos.");
  const categories = validateOptions(data.categories, "categories");
  const labels = validateOptions(data.labels, "labels");
  const invoices = {};
  for (const [period, records] of Object.entries(data.invoices)) {
    if (!validPeriod(period) || !Array.isArray(records)) throw new Error("Período inválido.");
    const ids = new Set();
    invoices[period] = records.map(record => {
      if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id) ||
          typeof record.description !== "string" || !record.description.trim() || record.description.length > 200 ||
          (record.categoryId !== null && !categories.some(category => category.id === record.categoryId)) ||
          (record.labelId !== null && !labels.some(label => label.id === record.labelId)) ||
          (record.cents !== null && !Number.isSafeInteger(record.cents))) throw new Error("Lançamento inválido.");
      ids.add(record.id);
      return { id: record.id, description: record.description, categoryId: record.categoryId, labelId: record.labelId, cents: record.cents };
    });
    InvoiceMath.calculate(invoices[period], categories);
  }
  return { version: 2, period: data.period, dueDay: data.dueDay, categories, labels, invoices };
}
function migrateLegacy(data) {
  if (!data || data.version !== 1 || !validPeriod(data.period) || !Array.isArray(data.records)) throw new Error("Base antiga inválida.");
  const migrated = sourceState();
  // A versão anterior tinha só uma lista compartilhada, não históricos mensais.
  migrated.invoices[BASE_PERIOD] = data.records.map(record => {
    if (!record || !DEFAULT_CATEGORIES.some(category => category.id === record.group)) throw new Error("Categoria antiga inválida.");
    return importRecord(record);
  });
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
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const migrated = migrateLegacy(JSON.parse(legacy));
      migrationApplied = true;
      return migrated;
    }
    return sourceState();
  } catch (error) {
    storageBlocked = true;
    storageWarning("Não foi possível ler os dados salvos. A base original está visível apenas nesta sessão. O salvamento está suspenso para preservar os dados existentes. “Restaurar base em outubro de 2026” ou “Apagar dados salvos” permite redefinir a base com confirmação.");
    return sourceState();
  }
}
let state = loadState();
let selectedCategory = "all";
let selectedLabel = "all";
let editingId = null;
let editingPeriod = null;
let optionEditor = null;
let confirmationAction = null;
let toastTimer;
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
function renderFormOptions(category = $("group").value, label = $("record-label").value) {
  selectOptions($("group"), state.categories, "Sem categoria", category);
  selectOptions($("record-label"), state.labels, "Sem etiqueta", label);
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
  const category = makeCell("");
  const badge = document.createElement("span");
  badge.className = `badge category-badge ${["fixed", "flexible", "moises"].includes(record.categoryId) ? record.categoryId : ""}`;
  badge.style.setProperty("--category-color", categoryColor(record.categoryId));
  badge.textContent = optionName("categories", record.categoryId);
  category.append(badge);
  const label = makeCell(optionName("labels", record.labelId), "label-cell");
  row.append(description, category, label, makeCell(record.cents === null ? "Sem valor" : currency(record.cents), record.cents === null ? "numeric pending" : "numeric"));
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
  actions.append(wrapper);
  row.append(actions);
  return row;
}
function renderDue() {
  const info = DueCalendar.calculate(state.period, state.dueDay);
  const format = date => new Intl.DateTimeFormat("pt-BR").format(date);
  $("due-date").textContent = format(info.due);
  $("due-message").textContent = info.message;
  $("due-message").dataset.status = info.status;
  $("due-progress").dataset.status = info.status;
  $("due-progress").setAttribute("aria-valuenow", String(Math.round(info.progress)));
  $("due-progress").setAttribute("aria-valuetext", `${info.message}. ${Math.round(info.progress)}% do intervalo entre vencimentos.`);
  $("due-fill").style.width = `${info.progress}%`;
  $("due-interval").textContent = `Intervalo: ${format(info.previous)} → ${format(info.due)}`;
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
  const records = currentRecords();
  const totals = InvoiceMath.calculate(records, state.categories);
  $("period-month").value = state.period.slice(5);
  $("period-year").value = Number(state.period.slice(0, 4));
  $("due-day").value = state.dueDay;
  $("total").textContent = currency(totals.total);
  $("total-caption").textContent = periodLabel(state.period);
  document.querySelectorAll(".category-summary").forEach(card => card.remove());
  const categories = [...state.categories];
  if (records.some(record => record.categoryId === null)) categories.push({ id: "uncategorized", name: "Sem categoria", color: "#8e8998" });
  $("composition-bar").replaceChildren();
  $("composition-rows").replaceChildren();
  const showDistribution = totals.total > 0 && categories.every(category => totals.groups[category.id] >= 0);
  for (const category of categories) {
    const subset = records.filter(record => (record.categoryId ?? "uncategorized") === category.id);
    const pending = subset.filter(record => record.cents === null).length;
    const card = document.createElement("article");
    card.className = "card category-summary";
    card.dataset.category = category.id;
    const label = document.createElement("div");
    label.className = "card-label";
    const dot = document.createElement("i");
    dot.className = "dot";
    dot.style.background = category.color;
    label.append(dot, document.createTextNode(category.name.toLocaleUpperCase("pt-BR")));
    const amount = document.createElement("div");
    amount.className = "amount";
    amount.textContent = currency(totals.groups[category.id]);
    const foot = document.createElement("div");
    foot.className = "card-foot";
    foot.textContent = `${subset.length} ${subset.length === 1 ? "lançamento" : "lançamentos"}${pending ? ` · ${pending} sem valor` : ""}`;
    card.append(label, amount, foot);
    document.querySelector(".summary").append(card);
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
  $("composition-note").textContent = showDistribution ? "Todos os lançamentos deste mês compõem o total." : "Valores somados acima. A distribuição visual exige total positivo e subtotais não negativos.";
  const fixed = state.categories.find(category => category.id === "fixed");
  const flexible = state.categories.find(category => category.id === "flexible");
  $("combined-row").hidden = !fixed || !flexible;
  if (fixed && flexible) $("combined-label").textContent = `${fixed.name} + ${flexible.name}`;
  $("combined-total").textContent = currency(totals.combined);
  if (selectedCategory !== "all" && selectedCategory !== "none" && !state.categories.some(category => category.id === selectedCategory)) selectedCategory = "all";
  if (selectedLabel !== "all" && selectedLabel !== "" && !state.labels.some(label => label.id === selectedLabel)) selectedLabel = "all";
  $("category-tabs").replaceChildren();
  for (const category of [{ id: "all", name: "Todos" }, ...state.categories, { id: "none", name: "Sem categoria" }]) {
    const button = document.createElement("button");
    button.className = `tab${selectedCategory === category.id ? " selected" : ""}`;
    button.dataset.category = category.id;
    button.textContent = category.name;
    button.setAttribute("aria-pressed", String(selectedCategory === category.id));
    $("category-tabs").append(button);
  }
  selectOptions($("label-filter"), state.labels, "Sem etiqueta", selectedLabel, true);
  const query = compareName($("search").value);
  const visible = records.filter(record => (selectedCategory === "all" || (record.categoryId ?? "none") === selectedCategory) &&
    (selectedLabel === "all" || (record.labelId ?? "") === selectedLabel) && compareName(record.description).includes(query));
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
  renderDue();
}
function openRecord(record = null) {
  editingId = record?.id ?? null;
  editingPeriod = state.period;
  $("record-form").reset();
  $("form-error").hidden = true;
  for (const id of ["description", "value"]) $(id).removeAttribute("aria-invalid");
  $("dialog-title").textContent = record ? "Editar lançamento" : "Novo lançamento";
  $("record-period-note").textContent = `Este lançamento pertence a ${periodLabel(editingPeriod)}. O resumo é atualizado automaticamente.`;
  $("description").value = record?.description ?? "";
  const defaultCategory = ["all", "none"].includes(selectedCategory) ? (selectedCategory === "none" ? "" : state.categories[0]?.id ?? "") : selectedCategory;
  renderFormOptions(record ? record.categoryId ?? "" : defaultCategory, record?.labelId ?? "");
  $("value").value = record?.cents == null ? "" : decimalInput(record.cents);
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
  const count = Object.values(state.invoices).flat().filter(record => record[field] === id).length;
  const singular = type === "categories" ? "categoria" : "etiqueta";
  confirmAction(`Excluir ${singular}?`, `“${option.name}” será excluída em todos os meses. ${count ? `${count} lançamento(s) usam esta opção. Escolha para onde transferir os vínculos; os lançamentos e valores serão preservados.` : "Nenhum lançamento está vinculado. Os demais dados serão preservados."}`, "Excluir opção", () => {
    const target = count ? $("transfer-option").value || null : null;
    const candidate = JSON.parse(JSON.stringify(state));
    for (const records of Object.values(candidate.invoices)) {
      for (const record of records) if (record[field] === id) record[field] = target;
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
  for (const id of ["description", "value"]) $(id).removeAttribute("aria-invalid");
  let invalidField = "description";
  try {
    const description = $("description").value.trim();
    if (!description) throw new Error("Preencha a descrição do lançamento.");
    if (description.length > 200) throw new Error("A descrição deve ter até 200 caracteres.");
    invalidField = "value";
    const cents = InvoiceMath.parseMoney($("value").value);
    const categoryId = $("group").value || null;
    const labelId = $("record-label").value || null;
    if (categoryId && !state.categories.some(category => category.id === categoryId)) throw new Error("Selecione uma categoria válida.");
    if (labelId && !state.labels.some(label => label.id === labelId)) throw new Error("Selecione uma etiqueta válida.");
    const record = { id: editingId ?? newId(), description, categoryId, labelId, cents };
    const previous = state.invoices[editingPeriod] ?? [];
    const records = editingId ? previous.map(item => item.id === editingId ? record : item) : [...previous, record];
    InvoiceMath.calculate(records, state.categories);
    state.invoices[editingPeriod] = records;
    const saved = saveState();
    $("record-dialog").close();
    resetFilters();
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
    confirmAction("Excluir lançamento?", `“${record.description}” será removido somente de ${periodLabel(period)}.`, "Excluir lançamento", () => {
      state.invoices[period] = state.invoices[period].filter(item => item.id !== record.id);
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
  renderDue();
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
  if (fromRecord) $(type === "categories" ? "group" : "record-label").value = optionId;
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
$("restore-source").addEventListener("click", () => confirmAction("Restaurar base em outubro?", `Os lançamentos de outubro de 2026 serão substituídos pelos 33 registros originais. Outros meses e suas configurações serão preservados.${storageBlocked ? " Os dados ilegíveis serão redefinidos após esta confirmação." : ""}`, "Restaurar base", () => {
  if (storageBlocked) state = sourceState();
  const mapping = {};
  for (const category of DEFAULT_CATEGORIES) {
    let existing = state.categories.find(item => item.id === category.id) ?? state.categories.find(item => compareName(item.name) === compareName(category.name));
    if (!existing) { existing = { ...category }; state.categories.push(existing); }
    mapping[category.id] = existing.id;
  }
  state.invoices[BASE_PERIOD] = SOURCE_RECORDS.map(record => ({ ...importRecord(record), categoryId: mapping[record.group] }));
  state.period = BASE_PERIOD;
  storageBlocked = false;
  const saved = saveState();
  resetFilters();
  render();
  if (saved) notify("Base restaurada em outubro de 2026.");
}));
$("clear-data").addEventListener("click", () => confirmAction("Apagar os dados salvos?", `Todos os lançamentos de TODOS os meses serão apagados. Categorias, etiquetas e dia de vencimento serão preservados.${storageBlocked ? " Os dados ilegíveis serão redefinidos após esta confirmação." : ""} Você poderá restaurar a base de outubro depois.`, "Apagar lançamentos", () => {
  if (storageBlocked) state = sourceState();
  state.invoices = {};
  storageBlocked = false;
  const saved = saveState();
  resetFilters();
  render();
  if (saved) notify("Lançamentos de todos os meses apagados. Configurações preservadas.");
}));
render();
if (!storageBlocked) {
  const saved = saveState();
  if (saved && migrationApplied) notify("Dados anteriores preservados em outubro de 2026. Outros meses começam vazios.");
}
// Recalcula quando a aba volta ao primeiro plano e atravessa a meia-noite local.
setInterval(renderDue, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderDue(); });
