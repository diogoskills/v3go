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
  calculate(records) {
    const groups = {};
    for (const group of ["fixed", "flexible", "moises"]) {
      groups[group] = this.sum(records.filter(record => record.group === group));
    }
    return { ...groups, combined: this.sum(records.filter(record => record.group !== "moises")), total: this.sum(records) };
  }
});

const GROUPS = { fixed: "Fixos", flexible: "Flexíveis", moises: "Moisés" };
const STORAGE_KEY = "v3go.invoice.v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = id => document.getElementById(id);
const currency = cents => money.format(cents / 100);
const sourceState = () => ({ version: 1, period: "2026-06", records: SOURCE_RECORDS.map(record => ({ ...record })) });
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
MONTHS.forEach((name, index) => {
  const option = document.createElement("option");
  option.value = String(index + 1).padStart(2, "0");
  option.textContent = name;
  $("period-month").append(option);
});
const validPeriod = period => typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && Number(period.slice(0, 4)) >= 1;
function validateState(data) {
  if (!data || data.version !== 1 || !validPeriod(data.period) || !Array.isArray(data.records)) throw new Error("Dados salvos inválidos.");
  const ids = new Set();
  const records = data.records.map(record => {
    if (!record || typeof record.id !== "string" || !record.id || ids.has(record.id) ||
        typeof record.description !== "string" || !record.description.trim() || record.description.length > 200 ||
        !Object.hasOwn(GROUPS, record.group) || (record.cents !== null && !Number.isSafeInteger(record.cents))) {
      throw new Error("Dados salvos inválidos.");
    }
    ids.add(record.id);
    return { id: record.id, description: record.description, group: record.group, cents: record.cents };
  });
  InvoiceMath.calculate(records);
  return { version: 1, period: data.period, records };
}
let storageBlocked = false;
function showStorageWarning(message) {
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
  $("save-status").textContent = "Salvamento indisponível";
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? sourceState() : validateState(JSON.parse(raw));
  } catch (error) {
    storageBlocked = true;
    showStorageWarning("Não foi possível ler os dados salvos. A planilha original está visível, mas o salvamento está suspenso para preservar seus dados. Use “Restaurar dados da planilha” ou “Apagar dados salvos” para redefinir; se o navegador bloqueia o armazenamento, permita-o para este arquivo.");
    return sourceState();
  }
}
let state = loadState();
let selectedGroup = "all";
let editingId = null;
let confirmationAction = null;
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 4200);
}
function saveState() {
  if (storageBlocked) {
    notify("Alteração aplicada apenas nesta sessão. O salvamento está suspenso.");
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $("storage-warning").hidden = true;
    $("save-status").textContent = "Salvo neste navegador";
    return true;
  } catch (error) {
    showStorageWarning("Não foi possível salvar. As alterações permanecem nesta sessão, mas podem ser perdidas ao fechar. Verifique as permissões e o espaço de armazenamento do navegador.");
    notify("Não foi possível salvar no navegador.");
    return false;
  }
}
function periodLabel(period) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(2000, month - 1, 1);
  date.setFullYear(year);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function matchesFilter(record) {
  const normalize = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return (selectedGroup === "all" || record.group === selectedGroup) && normalize(record.description).includes(normalize($("search").value.trim()));
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
  row.append(description);
  const group = makeCell("");
  const badge = document.createElement("span");
  badge.className = `badge ${record.group}`;
  badge.textContent = GROUPS[record.group];
  group.append(badge);
  row.append(group, makeCell(record.cents === null ? "Sem valor" : currency(record.cents), record.cents === null ? "numeric pending" : "numeric"));
  const actions = makeCell("");
  const wrapper = document.createElement("div");
  wrapper.className = "row-actions";
  for (const [action, icon, label] of [["edit", "✎", "Editar"], ["delete", "×", "Excluir"]]) {
    const button = document.createElement("button");
    button.className = `icon-button ${action}-record`;
    button.type = "button";
    button.textContent = icon;
    button.dataset.action = action;
    button.dataset.id = record.id;
    button.setAttribute("aria-label", `${label} ${record.description}`);
    button.title = `${label} lançamento`;
    wrapper.append(button);
  }
  actions.append(wrapper);
  row.append(actions);
  return row;
}
function render() {
  const totals = InvoiceMath.calculate(state.records);
  $("period-month").value = state.period.slice(5);
  $("period-year").value = Number(state.period.slice(0, 4));
  $("total").textContent = currency(totals.total);
  $("total-caption").textContent = periodLabel(state.period);
  $("combined-total").textContent = currency(totals.combined);
  $("composition-bar").replaceChildren();
  $("composition-rows").replaceChildren();
  const showDistribution = totals.total > 0 && Object.keys(GROUPS).every(group => totals[group] >= 0);
  for (const group of Object.keys(GROUPS)) {
    const records = state.records.filter(record => record.group === group);
    const pending = records.filter(record => record.cents === null).length;
    $(group + "-total").textContent = currency(totals[group]);
    $(group + "-count").textContent = `${records.length} ${records.length === 1 ? "lançamento" : "lançamentos"}${pending ? ` · ${pending} sem valor` : ""}`;
    const segment = document.createElement("div");
    segment.className = `bar-segment ${group}`;
    segment.style.width = `${showDistribution ? (totals[group] / totals.total) * 100 : 0}%`;
    $("composition-bar").append(segment);
    const row = document.createElement("div");
    row.className = "composition-row";
    const label = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = `dot ${group}`;
    label.append(dot, document.createTextNode(GROUPS[group]));
    const value = document.createElement("strong");
    value.textContent = currency(totals[group]);
    row.append(label, value);
    $("composition-rows").append(row);
  }
  $("composition-bar").hidden = !showDistribution;
  $("composition-note").textContent = showDistribution ? "Os três grupos compõem o total da fatura." : "Os valores estão somados acima. A distribuição visual exige total positivo e subtotais não negativos.";
  const visible = state.records.filter(matchesFilter);
  $("records").replaceChildren(...visible.map(renderRow));
  $("filtered-total").textContent = currency(InvoiceMath.sum(visible));
  $("record-count").textContent = `${state.records.length} ${state.records.length === 1 ? "lançamento na fatura" : "lançamentos na fatura"}${visible.length !== state.records.length ? ` · ${visible.length} exibidos` : ""}`;
  $("empty-state").hidden = visible.length > 0;
  document.querySelector(".table-wrap").hidden = visible.length === 0;
  if (!visible.length) {
    const hasData = state.records.length > 0;
    $("empty-title").textContent = hasData ? "Nenhum resultado encontrado" : "Uma fatura de página nova";
    $("empty-message").textContent = hasData ? "Tente outra busca ou escolha um grupo diferente." : "Adicione seu primeiro lançamento para começar.";
    $("empty-action").textContent = hasData ? "Limpar filtros" : "Novo lançamento";
  }
  document.querySelectorAll(".tab").forEach(tab => {
    const selected = tab.dataset.group === selectedGroup;
    tab.classList.toggle("selected", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
}
function resetFilters() {
  selectedGroup = "all";
  $("search").value = "";
}
function openRecord(record = null) {
  editingId = record?.id ?? null;
  $("record-form").reset();
  $("form-error").hidden = true;
  for (const id of ["description", "value"]) $(id).removeAttribute("aria-invalid");
  $("dialog-title").textContent = record ? "Editar lançamento" : "Novo lançamento";
  $("description").value = record?.description ?? "";
  $("group").value = record?.group ?? (selectedGroup === "all" ? "fixed" : selectedGroup);
  $("value").value = record?.cents == null ? "" : (record.cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  $("record-dialog").showModal();
  $("description").focus();
}
function confirmAction(title, message, label, action) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  $("confirm-ok").textContent = label;
  confirmationAction = action;
  $("confirm-dialog").showModal();
  $("confirm-cancel").focus();
}
$("add-record").addEventListener("click", () => openRecord());
$("empty-action").addEventListener("click", () => {
  if (state.records.length) { resetFilters(); render(); } else openRecord();
});
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
    const group = $("group").value;
    if (!Object.hasOwn(GROUPS, group)) throw new Error("Selecione um grupo válido.");
    const record = { id: editingId ?? (globalThis.crypto?.randomUUID?.() || `record-${Date.now()}-${Math.random().toString(36).slice(2)}`), description, group, cents };
    const records = editingId ? state.records.map(item => item.id === editingId ? record : item) : [...state.records, record];
    InvoiceMath.calculate(records); // Rejeita estouro numérico antes de alterar o estado.
    state.records = records;
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
  const record = state.records.find(item => item.id === button.dataset.id);
  if (!record) return;
  if (button.dataset.action === "edit") openRecord(record);
  else confirmAction("Excluir lançamento?", `“${record.description}” será removido desta fatura.`, "Excluir lançamento", () => {
    state.records = state.records.filter(item => item.id !== record.id);
    const saved = saveState();
    render();
    if (saved) notify("Lançamento excluído.");
    $("add-record").focus();
  });
});
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => { selectedGroup = tab.dataset.group; render(); }));
$("search").addEventListener("input", render);
function changePeriod() {
  const year = $("period-year").value;
  const period = `${year.padStart(4, "0")}-${$("period-month").value}`;
  if (!/^\d{1,4}$/.test(year) || !validPeriod(period)) {
    render();
    notify("Selecione um mês e um ano entre 1 e 9999.");
    return;
  }
  state.period = period;
  saveState();
  render();
}
$("period-month").addEventListener("change", changePeriod);
$("period-year").addEventListener("change", changePeriod);
$("confirm-cancel").addEventListener("click", () => $("confirm-dialog").close());
$("confirm-ok").addEventListener("click", () => {
  const action = confirmationAction;
  $("confirm-dialog").close();
  confirmationAction = null;
  action?.();
});
$("confirm-dialog").addEventListener("close", () => { confirmationAction = null; });
$("restore-source").addEventListener("click", () => confirmAction("Restaurar a planilha?", "Isso substituirá todos os lançamentos e o período pelos dados originais de junho de 2026. Suas alterações atuais serão apagadas.", "Restaurar dados", () => {
  state = sourceState();
  storageBlocked = false;
  const saved = saveState();
  resetFilters();
  render();
  if (saved) notify("Dados originais da planilha restaurados.");
}));
$("clear-data").addEventListener("click", () => confirmAction("Apagar os dados salvos?", "Todos os lançamentos serão apagados deste navegador. A fatura ficará vazia, inclusive ao reabrir. Você poderá restaurar a planilha original depois.", "Apagar dados", () => {
  // Persiste uma fatura vazia para não reimportar automaticamente ao reabrir.
  state = { version: 1, period: state.period, records: [] };
  storageBlocked = false;
  const saved = saveState();
  resetFilters();
  render();
  if (saved) notify("Dados apagados. Sua fatura está vazia.");
}));
render();
if (!storageBlocked) saveState();
