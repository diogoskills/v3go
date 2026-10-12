"""Regressão do site. Dados fictícios abaixo são exclusivos dos testes."""
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import atexit
import json
import shutil
import threading
from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root / "v3go web")))
threading.Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.server_close)
atexit.register(server.shutdown)
URL = f"http://127.0.0.1:{server.server_port}/index.html"
KEY = "v3go.invoice.v3"


def total(page):
    return page.evaluate("InvoiceMath.calculate(currentRecords(), state.categories).total")


def custom_total(page):
    return page.evaluate("InvoiceMath.selectedTotal(currentRecords(), customSelection)")


def period(page, month, year=2026):
    page.locator("#period-year").fill(str(year))
    page.locator("#period-year").dispatch_event("change")
    page.locator("#period-month").select_option(f"{month:02d}")


def add(page, description, value, category="fixed", label=""):
    page.locator("#add-record").click()
    page.locator("#description").fill(description)
    page.locator("#value").fill(value)
    page.locator("#group").select_option(category)
    page.locator("#record-label").select_option(label)
    page.get_by_role("button", name="Salvar lançamento", exact=True).click()


def create(page, name, kind="category", inline=False):
    page.locator(f"#{'create' if inline else 'manage-add'}-{kind}").click()
    page.locator("#option-name").fill(name)
    page.get_by_role("button", name="Salvar opção", exact=True).click()
    options = "categories" if kind == "category" else "labels"
    return page.evaluate("([type,name]) => state[type].find(x => x.name === name).id", [options, name])


def rename(page, name, new_name, kind="categoria"):
    page.get_by_role("button", name=f"Renomear {kind} {name}", exact=True).click()
    page.locator("#option-name").fill(new_name)
    page.get_by_role("button", name="Salvar opção", exact=True).click()


def delete(page, name, target="", kind="categoria"):
    page.get_by_role("button", name=f"Excluir {kind} {name}", exact=True).click()
    if page.locator("#transfer-field").is_visible():
        page.locator("#transfer-option").select_option(target)
    page.locator("#confirm-ok").click()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which("chromium"), headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 1050}, timezone_id="America/Sao_Paulo")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(URL)
    assert page.evaluate("state.version") == 3
    for year in (2026, 2027):
        for month in range(1, 13):
            period(page, month, year)
            assert total(page) == 0 and page.locator("#records tr").count() == 0
            assert page.locator(".category-summary").count() == 3
            assert page.locator("#due-message").inner_text() != "Fatura paga"
    page.reload()
    assert total(page) == 0
    assert page.evaluate("Object.values(state.invoices).flat().length") == 0
    assert page.evaluate("InvoiceMath.sum([{cents:10},{cents:20}])") == 30
    assert page.evaluate("currency(9007199254740991)") == "R$\xa090.071.992.547.409,91"
    assert page.evaluate('InvoiceMath.parseMoney("90071992547409,91")') == 9007199254740991
    print("PASS: new base empty for all months in two years, reload, exact cents")

    period(page, 10)
    add(page, "Registro de teste A", "10,10")
    add(page, "Registro de teste B", "20,20", "flexible")
    add(page, "Registro de teste C", "3,30", "")
    add(page, "Registro sem valor", "", "moises")
    assert total(page) == 3360
    assert page.locator("#combined-total").inner_text() == page.locator("#total").inner_text()
    assert page.locator("#combined-label").inner_text() == "Fixos + Flexíveis + Moisés + Sem categoria"
    page.locator("#sum-categories").click()
    assert custom_total(page) == 3360
    assert page.locator("#sum-options input:checked").count() == 4
    page.locator("#sum-none").click()
    assert custom_total(page) == 0
    assert page.locator("#custom-total").inner_text() == "R$\xa00,00"
    page.locator('[data-sum-category="fixed"]').check()
    assert custom_total(page) == 1010
    assert page.locator("#custom-expression").inner_text() == "Fixos"
    assert total(page) == 3360
    page.locator('[data-sum-category="uncategorized"]').check()
    assert custom_total(page) == 1340
    page.locator("#sum-all").click()
    assert custom_total(page) == 3360
    page.locator("#close-sum").click()
    page.locator("#sum-categories").click()
    assert page.locator("#sum-options input:checked").count() == 4
    print("PASS: dynamic composition, unassigned entries, empty values, custom selections, all/none and reopening defaults")

    page.locator("#sum-none").click()
    page.locator('[data-sum-category="fixed"]').check()
    period(page, 11)
    assert total(page) == 0 and custom_total(page) == 0
    add(page, "Novembro teste", "5,50")
    assert total(page) == 550 and custom_total(page) == 550
    period(page, 10)
    assert total(page) == 3360 and custom_total(page) == 1010
    page.locator("#records tr").first.locator("[data-action=edit]").click()
    page.locator("#value").fill("11,11")
    page.get_by_role("button", name="Salvar lançamento", exact=True).click()
    assert total(page) == 3461 and custom_total(page) == 1111
    period(page, 11)
    assert total(page) == 550
    page.locator("#records tr").first.locator("[data-action=delete]").click()
    page.locator("#confirm-cancel").click()
    assert total(page) == 550
    page.locator("#records tr").first.locator("[data-action=delete]").click()
    page.locator("#confirm-ok").click()
    assert total(page) == 0 and custom_total(page) == 0
    period(page, 10)
    assert total(page) == 3461
    print("PASS: custom result responds to month changes and CRUD; monthly data remains isolated")

    # Actual UI calendar, confirmed payment, undo, year isolation and persistence.
    page.clock.install(time=datetime(2026, 10, 11, 15))
    page.evaluate("renderDue()")
    assert page.locator("#due-message").inner_text() == "Vencimento há 6 dias"
    records_before = page.evaluate("JSON.stringify(state.invoices)")
    interval_before = page.locator("#due-interval").inner_text()
    page.locator("#toggle-payment").click()
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    assert page.locator("#due-message").get_attribute("data-status") == "paid"
    assert page.locator("#due-progress").get_attribute("aria-valuenow") == "100"
    assert page.locator("#due-progress").get_attribute("data-status") == "paid"
    assert page.locator("#due-interval").inner_text() == interval_before
    assert page.locator("#due-date").inner_text() == "05/10/2026"
    assert page.evaluate("JSON.stringify(state.invoices)") == records_before
    page.locator("#sum-none").click()
    assert custom_total(page) == 0 and total(page) == 3461
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    page.reload()
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    period(page, 11)
    assert page.locator("#due-message").inner_text() != "Fatura paga"
    period(page, 10, 2027)
    assert page.locator("#due-message").inner_text() != "Fatura paga"
    period(page, 10)
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    page.get_by_role("button", name="Marcar como não paga", exact=True).click()
    assert page.locator("#due-message").inner_text() == "Vencimento há 6 dias"
    page.clock.set_system_time(datetime(2026, 10, 1, 15))
    page.evaluate("renderDue()")
    expected_progress = page.locator("#due-progress").get_attribute("aria-valuenow")
    assert page.locator("#due-message").inner_text() == "Faltam 4 dias"
    page.locator("#toggle-payment").click()
    page.locator("#toggle-payment").click()
    assert page.locator("#due-message").inner_text() == "Faltam 4 dias"
    assert page.locator("#due-progress").get_attribute("aria-valuenow") == expected_progress
    page.clock.set_system_time(datetime(2026, 10, 5, 15))
    page.evaluate("renderDue()")
    assert page.locator("#due-message").inner_text() == "Vence hoje"
    page.locator("#toggle-payment").click()
    add(page, "Registro após pagamento", "0,10")
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    print("PASS: payment/undo before, on and after due date; independent months/years, unchanged values and reload persistence")

    # Inline options, duplicates, renames, transfers; queries/payment stay intact.
    page.locator("#sum-categories").click()
    page.locator("#add-record").click()
    page.locator("#description").fill("Categoria no formulário")
    page.locator("#value").fill("7,70")
    transport = create(page, "Transporte", inline=True)
    assert page.locator("#group").input_value() == transport
    assert page.locator("#description").input_value() == "Categoria no formulário"
    label = create(page, "Etiqueta teste", kind="label", inline=True)
    assert page.locator("#record-label").input_value() == label
    page.get_by_role("button", name="Salvar lançamento", exact=True).click()
    assert total(page) == 4241
    assert "Transporte" in page.locator("#combined-label").inner_text()
    assert custom_total(page) == 4241
    page.locator("#sum-none").click()
    page.locator('[data-sum-category="fixed"]').check()
    page.locator(f'[data-sum-category="{transport}"]').check()
    assert custom_total(page) == 1891 and total(page) == 4241
    assert page.locator("#custom-expression").inner_text() == "Fixos + Transporte"
    rename(page, "Transporte", "Mobilidade")
    assert page.locator("#custom-expression").inner_text() == "Fixos + Mobilidade"
    assert "Mobilidade" in page.locator("#combined-label").inner_text()
    page.locator("#manage-add-category").click()
    page.locator("#option-name").fill("  mObILiDaDe  ")
    page.get_by_role("button", name="Salvar opção", exact=True).click()
    assert "Já existe" in page.locator("#option-error").inner_text()
    page.locator("#option-cancel").click()
    rename(page, "Etiqueta teste", "Etiqueta renomeada", kind="etiqueta")
    page.locator("#label-filter").select_option(label)
    assert page.locator("#records tr").count() == 1
    delete(page, "Etiqueta renomeada", kind="etiqueta")
    delete(page, "Mobilidade", target="flexible")
    assert total(page) == 4241
    assert "Mobilidade" not in page.locator("#combined-label").inner_text()
    assert custom_total(page) == 1121
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    delete(page, "Moisés")
    page.locator("#sum-all").click()
    assert custom_total(page) == total(page)
    assert page.evaluate("currentRecords().filter(x=>x.categoryId===null).length") == 2
    print("PASS: dynamic options/composition/query after creation, rename/deletion, transfer, duplicate validation, labels and unchanged payment")

    # Calendar edge cases remain valid.
    cases = [("2026-02", 31, [2026, 1, 20], 8), ("2028-02", 31, [2028, 1, 29], 0), ("2027-01", 5, [2026, 11, 31], 5)]
    for invoice_period, day, date, remaining in cases:
        result = page.evaluate("([p,d,t])=>{const r=DueCalendar.calculate(p,d,new Date(...t));return {remaining:r.remaining,progress:r.progress}}", [invoice_period, day, date])
        assert result["remaining"] == remaining and 0 <= result["progress"] <= 100
    page.locator("#due-day").fill("31")
    page.get_by_role("button", name="Salvar vencimento", exact=True).click()
    period(page, 2)
    assert page.locator("#due-date").inner_text() == "28/02/2026"
    assert total(page) == 0 and custom_total(page) == 0
    period(page, 10)
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    page.reload()
    assert page.locator("#due-day").input_value() == "31" and total(page) == 4241

    # Mobile and many categories; panel result is below its options.
    for index in range(6):
        create(page, f"Categoria extra de teste {index}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#sum-categories").click()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert page.locator(".custom-result").bounding_box()["y"] >= page.locator(".sum-fieldset").bounding_box()["y"] + page.locator(".sum-fieldset").bounding_box()["height"]
    page.locator("#sum-none").click()
    assert custom_total(page) == 0
    page.locator("#sum-all").click()
    assert custom_total(page) == total(page)
    page.locator("#add-record").click()
    page.keyboard.press("Escape")
    assert not page.locator("#record-dialog").is_visible()
    page.locator("#toggle-payment").click()
    assert page.locator("#due-message").inner_text() != "Fatura paga"
    page.locator("#toggle-payment").click()
    page.reload()
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    print("PASS: calendar edges, configurable due day, mobile with many categories, result below selection and mobile payment persistence")

    # Migrate v2 preserving every month, names, labels, preferences and records exactly.
    saved = page.evaluate("JSON.parse(JSON.stringify(state))")
    previous = {key: value for key, value in saved.items() if key != "payments"}
    previous["version"] = 2
    previous["labels"].append({"id": "label-saved-test", "name": "Etiqueta salva de teste"})
    previous["invoices"]["2026-11"] = [{"id": "saved-other-month", "description": "Registro fictício de outro mês", "categoryId": None, "labelId": "label-saved-test", "cents": 500}]
    page.evaluate("data=>{localStorage.removeItem('v3go.invoice.v3');localStorage.setItem('v3go.invoice.v2',JSON.stringify(data))}", previous)
    page.reload()
    assert page.evaluate("state.invoices") == previous["invoices"]
    assert page.evaluate("state.categories") == previous["categories"]
    assert page.evaluate("state.labels") == previous["labels"]
    assert page.evaluate("state.period") == previous["period"]
    assert page.evaluate("state.dueDay") == previous["dueDay"]
    assert total(page) == 4241 and page.locator("#due-message").inner_text() != "Fatura paga"
    assert json.loads(page.evaluate("localStorage.getItem('v3go.invoice.v2')")) == previous
    page.reload()
    assert total(page) == 4241
    period(page, 11)
    assert total(page) == 500
    assert page.locator("#records").get_by_text("Etiqueta salva de teste", exact=True).count() == 1
    period(page, 10)
    assert total(page) == 4241
    # Single-list v1 migration keeps original edits in their established October mapping.
    legacy = {"version": 1, "period": "2027-02", "records": [{"id": "test-v1", "description": "Registro fictício legado", "group": "flexible", "cents": 12345}]}
    page.evaluate("data=>{localStorage.removeItem('v3go.invoice.v3');localStorage.removeItem('v3go.invoice.v2');localStorage.setItem('v3go.invoice.v1',JSON.stringify(data))}", legacy)
    page.reload()
    assert page.evaluate("state.period") == "2026-10" and total(page) == 12345
    period(page, 2, 2027)
    assert total(page) == 0
    period(page, 10)
    page.locator("#clear-data").click()
    page.locator("#confirm-cancel").click()
    assert total(page) == 12345
    page.locator("#clear-data").click()
    page.locator("#confirm-ok").click()
    page.reload()
    assert total(page) == 0  # Does not reimport retained legacy backups.
    page.evaluate("localStorage.setItem('v3go.invoice.v3', 'bad-json')")
    page.reload()
    assert page.locator("#storage-warning").is_visible()
    assert page.evaluate("localStorage.getItem('v3go.invoice.v3')") == "bad-json"
    assert total(page) == 0
    page.locator("#clear-data").click()
    page.locator("#confirm-ok").click()
    assert not page.locator("#storage-warning").is_visible()
    assert not errors, errors
    print("PASS: v2/v1 migrations preserve saved data, backups intact, explicit clear, corrupt data protected, no runtime errors")
    browser.close()
