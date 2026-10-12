"""Regressão financeira. Os lançamentos fictícios existem somente nesta suíte."""
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


ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT / "v3go web")))
threading.Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.server_close)
atexit.register(server.shutdown)
URL = f"http://127.0.0.1:{server.server_port}/index.html"
KEY = "v3go.invoice.v5"


def finance(page):
    return page.evaluate("financeFor()")


def period(page, month, year=2026):
    page.locator("#period-year").fill(str(year))
    page.locator("#period-year").dispatch_event("change")
    page.locator("#period-month").select_option(f"{month:02d}")


def view(page, tab="monthly"):
    page.locator("#tab-" + tab).click()


def add(page, description, value, kind="expense", method="credit", status="pending", category="fixed", funding="", date="2026-10-04"):
    view(page)
    page.locator("#add-record").click()
    page.locator("#description").fill(description)
    page.locator("#value").fill(value)
    page.locator("#record-type").select_option(kind)
    page.locator("#record-date").fill(date)
    if kind == "expense":
        page.locator("#payment-method").select_option(method)
    page.locator("#record-status").select_option(status)
    page.locator("#group").select_option(category)
    if kind == "expense" and method != "credit":
        page.locator("#record-funding").select_option(funding)
    page.get_by_role("button", name="Salvar lançamento", exact=True).click()
    assert not page.locator("#record-dialog").is_visible(), page.locator("#form-error").inner_text()


def receive(page, which, value, date, correct=False):
    view(page, "salary")
    prefix = "Corrigir recebimento" if correct else "Marcar como recebida"
    name = "Primeira quinzena" if which == "first" else "Segunda quinzena"
    page.get_by_role("button", name=f"{prefix}: {name}", exact=True).click()
    page.locator("#receipt-value").fill(value)
    page.locator("#receipt-date").fill(date)
    page.get_by_role("button", name="Confirmar recebimento", exact=True).click()
    assert not page.locator("#receipt-dialog").is_visible()


def pay(page, value, date="2026-10-05", edit=False):
    if edit:
        view(page, "salary")
        page.get_by_role("button", name="Corrigir pagamento da fatura", exact=True).click()
    else:
        view(page)
        page.locator("#toggle-payment").click()
    page.locator("#settlement-value").fill(value)
    page.locator("#settlement-date").fill(date)
    page.get_by_role("button", name="Confirmar pagamento", exact=True).click()
    assert not page.locator("#settlement-dialog").is_visible()
    view(page)


def set_balance(page, amount, date):
    page.locator("#bank-balance").fill(amount)
    page.locator("#balance-date").fill(date)
    page.get_by_role("button", name="Salvar saldo atual", exact=True).click()
    assert page.locator("#balance-error").is_hidden()


def link_invoice(page, funding):
    view(page, "salary")
    page.locator('select[data-commitment="invoice"]').select_option(funding)
    view(page)


def create_category(page, name, inline=False):
    page.locator("#create-category" if inline else "#manage-add-category").click()
    page.locator("#option-name").fill(name)
    page.get_by_role("button", name="Salvar opção", exact=True).click()
    return page.evaluate("name=>state.categories.find(x=>x.name===name).id", name)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=shutil.which("chromium"), headless=True, args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="America/Sao_Paulo")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.clock.install(time=datetime(2026,10,12,15))
    page.goto(URL)
    assert page.evaluate("state.version") == 5
    names = page.evaluate("state.categories.map(x=>x.name)")
    assert len(names) == len(set(names)) == 11
    assert {"Fixos", "Flexíveis", "Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Compras", "Outros", "Moisés"} == set(names)
    for month, year in [(10, 2026), (11, 2026), (10, 2027)]:
        period(page, month, year)
        f = finance(page)
        assert f["invoice"] == f["spending"] == f["incomeReceived"] == f["available"] == 0
        assert f["incomeExpected"] == f["projected"] == 161600
        assert page.locator("#records tr").count() == 0
    assert page.evaluate("Object.keys(state.invoices).length") == 0
    assert page.evaluate("InvoiceMath.sum([{cents:10},{cents:20}])") == 30
    assert page.evaluate("currency(9007199254740991)") == "R$\xa090.071.992.547.409,91"
    period(page, 10)
    view(page, "salary")
    assert page.locator("#salary-gross").input_value() == "1772,00"
    assert page.locator("#salary-net").inner_text() == "R$\xa01.616,00"
    assert page.locator("#salary-difference").inner_text() == "R$\xa0156,00"
    assert page.locator(".receipt-status.received").count() == 0
    assert page.evaluate('receiptDate("2026-02", {day:31})') == "2026-02-28"
    assert page.evaluate('receiptDate("2028-02", {day:31})') == "2028-02-29"
    assert page.evaluate('validDate("2026-02-30")') is False
    assert page.evaluate('localDateString(DueCalendar.calculate("2027-01",5).previous)') == "2026-12-05"
    print("PASS: empty ledger, all initial categories, salary only projected, gross excluded, exact cents and calendar edges")

    set_balance(page, "0,00", "2026-10-01")
    receive(page, "first", "870,00", "2026-10-03")
    f = finance(page)
    assert f["incomeReceived"] == f["available"] == 87000
    assert f["incomeExpected"] == 75000
    assert page.evaluate('salaryFor().first.actualDate') == "2026-10-03"
    assert page.locator(".receipt-status.received").count() == 1
    assert not page.evaluate('state.payments[state.period] === true')
    receive(page, "first", "870,00", "2026-10-03", correct=True)
    assert finance(page)["incomeReceived"] == 87000
    add(page, "Entrada real de teste", "100,00", kind="income", status="received")
    add(page, "Entrada prevista de teste", "200,00", kind="income", status="expected")
    add(page, "Pix pago de teste", "20,00", method="pix", status="paid", funding="first", date="2026-10-02")
    add(page, "Despesa pendente de teste", "50,00", method="debit", funding="second", date="2026-10-12")
    add(page, "Compra cartão A", "300,00", status="paid")
    add(page, "Compra cartão B", "150,00", category="transport")
    f = finance(page)
    expected = {"invoice": 45000, "invoicePaid": 0, "invoiceRemaining": 45000, "incomeReceived": 97000, "incomeExpected": 95000, "expensePaid": 2000, "expensePending": 50000, "spending": 52000, "available": 95000, "projected": 140000}
    assert {key: f[key] for key in expected} == expected, f
    assert page.locator("#records tr").count() == 7  # One linked salary entry; confirmation is not counted a second time.
    page.locator("#sum-categories").click()
    assert page.evaluate("InvoiceMath.selectedTotal(creditRecords(),customSelection)") == 45000
    page.locator("#sum-none").click()
    page.locator('[data-sum-category="fixed"]').check()
    assert page.evaluate("InvoiceMath.selectedTotal(creditRecords(),customSelection)") == 30000
    assert finance(page)["spending"] == 52000
    link_invoice(page, "first")
    pay(page, "450,00")
    f = finance(page)
    assert f["expensePaid"] == 47000 and f["expensePending"] == 5000
    assert f["available"] == 50000 and f["projected"] == 140000
    assert f["spending"] == 52000 and page.locator("#records tr").count() == 7
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    print("PASS: early first receipt, repeat correction idempotent, direct and credit flows, no doubled card expense/payment")

    receive(page, "second", "700,00", "2026-10-10")
    assert finance(page)["incomeReceived"] == 167000
    assert finance(page)["available"] == 120000
    receive(page, "first", "900,00", "2026-10-03", correct=True)
    f = finance(page)
    assert f["incomeReceived"] == 170000 and f["available"] == 123000 and f["projected"] == 138000
    assert page.evaluate('salaryFor().first.expectedCents') == 86600
    assert page.locator(".quarter-plan").first.get_by_text("Sobram R$\xa0430,00", exact=True).count() == 1
    assert page.locator(".timing-warning").count() >= 1
    commitments = page.evaluate("monthCommitments()")
    assert len(commitments) == 3 and len([x for x in commitments if x["id"] == "invoice"]) == 1
    assert sum(x["cents"] for x in commitments) == 52000
    pending = page.locator('#quarter-plans select[data-commitment]').last
    pending.select_option("first")
    assert page.locator(".quarter-plan").first.get_by_text("Sobram R$\xa0380,00", exact=True).count() == 1
    view(page)
    link_invoice(page, "balance")
    view(page, "salary")
    assert page.locator('#balance-commitments select[data-commitment="invoice"]').count() == 1
    assert "Disponível no mês" in page.locator("#balance-plan-note").inner_text()
    print("PASS: second early receipt, correction, per-quarter budgets/dates, invoice is one commitment, balance funding")

    pay(page, "200,00", edit=True)
    f = finance(page)
    assert f["expensePaid"] == 22000 and f["expensePending"] == 30000
    assert f["available"] == 148000 and f["projected"] == 138000
    assert f["spending"] == 52000
    assert page.locator("#due-message").inner_text() == "Pagamento parcial"
    pay(page, "450,00", edit=True)
    add(page, "Nova compra após pagamento", "10,00", category="shopping")
    assert finance(page)["invoice"] == 46000
    assert finance(page)["invoicePaid"] == 45000
    assert finance(page)["invoiceRemaining"] == 1000
    assert finance(page)["available"] == 123000 and finance(page)["projected"] == 137000
    assert page.locator("#due-message").inner_text() == "Pagamento parcial"
    pay(page, "460,00", edit=True)
    assert finance(page)["expensePaid"] == 48000 and finance(page)["available"] == 122000
    assert finance(page)["spending"] == 53000
    page.locator("#toggle-payment").click()
    page.locator("#confirm-ok").click()
    assert finance(page)["expensePaid"] == 2000 and finance(page)["available"] == 168000
    assert finance(page)["projected"] == 137000
    pay(page, "460,00")
    page.reload()
    assert finance(page)["available"] == 122000
    assert page.locator("#due-message").inner_text() == "Fatura paga"
    print("PASS: paid value snapshot, partial payment/residual, correction/undo, new purchases do not silently rewrite paid cash")

    old_salary = page.evaluate("salaryFor()")
    period(page, 11)
    assert finance(page)["invoice"] == finance(page)["incomeReceived"] == finance(page)["available"] == 0
    assert finance(page)["incomeExpected"] == 161600
    view(page, "salary")
    page.locator("#salary-gross").fill("1900,00")
    page.locator("#salary-first").fill("1000,00")
    page.locator("#salary-first-day").fill("20")
    page.locator("#salary-second").fill("800,00")
    page.locator("#salary-second-day").fill("3")
    page.get_by_role("button", name="Salvar configuração de salário", exact=True).click()
    assert page.locator(".receipt-heading h3").first.inner_text() == "Segunda quinzena"
    receive(page, "first", "1010,00", "2026-11-18")
    assert finance(page)["incomeReceived"] == 101000
    period(page, 10)
    assert page.evaluate("salaryFor()") == old_salary
    assert finance(page)["available"] == 122000
    assert page.evaluate('state.payments[state.period]') is True
    period(page, 10, 2027)
    assert finance(page)["incomeReceived"] == 0 and finance(page)["incomeExpected"] == 180000
    assert not page.evaluate('state.payments[state.period] === true')
    period(page, 11)
    view(page, "salary")
    page.get_by_role("button", name="Desfazer recebimento: Primeira quinzena", exact=True).click()
    page.locator("#confirm-ok").click()
    assert finance(page)["incomeReceived"] == 0 and finance(page)["incomeExpected"] == 180000
    period(page, 10)
    assert finance(page)["incomeReceived"] == 170000
    print("PASS: defaults editable, chronological ordering, confirmed past snapshots preserved, month/year isolation and undo")

    view(page)
    page.locator("#card-upload").set_input_files({"name": "bad.txt", "mimeType": "text/plain", "buffer": b"invalid"})
    assert page.locator("#card-image-error").is_visible()
    # A tiny valid PNG fixture produced by canvas, with no external dependency.
    png = page.evaluate("()=>{const c=document.createElement('canvas');c.width=400;c.height=250;const x=c.getContext('2d');x.fillStyle='#426b80';x.fillRect(0,0,400,250);return c.toDataURL('image/png').split(',')[1]}")
    import base64
    page.locator("#card-upload").set_input_files({"name": "custom.png", "mimeType": "image/png", "buffer": base64.b64decode(png)})
    page.wait_for_function("state.cardImage !== null")
    custom_image = page.evaluate("state.cardImage")
    assert custom_image.startswith("data:image/jpeg;base64,")
    assert page.locator("#credit-card").evaluate("e=>getComputedStyle(e).backgroundSize") == "cover"
    page.reload()
    assert page.evaluate("state.cardImage") == custom_image
    assert finance(page)["available"] == 122000
    page.locator("#restore-card").click()
    assert page.evaluate("state.cardImage") is None
    page.reload()
    assert page.locator("#card-background").evaluate("e=>getComputedStyle(e).backgroundImage.startsWith('url(\"data:image/jpeg;base64,')")
    assert page.evaluate("state.cardImage") is None
    print("PASS: image MIME validation, cover without stretching, upload/restore persistence and unchanged financial data")

    page.locator("#type-filter").select_option("income")
    assert page.locator("#records tr").count() == 4
    page.locator("#type-filter").select_option("credit")
    assert page.locator("#records tr").count() == 3
    page.locator("#type-filter").select_option("all")
    page.locator("#add-record").click()
    page.locator("#description").fill("Categoria criada durante lançamento")
    page.locator("#value").fill("0,10")
    extra = create_category(page, "Categoria adicional", inline=True)
    assert page.locator("#group").input_value() == extra
    page.get_by_role("button", name="Salvar lançamento", exact=True).click()
    assert finance(page)["invoice"] == 46010
    page.get_by_role("button", name="Renomear categoria Categoria adicional", exact=True).click()
    page.locator("#option-name").fill("Categoria renomeada")
    page.get_by_role("button", name="Salvar opção", exact=True).click()
    assert "Categoria renomeada" in page.locator("#combined-label").inner_text()
    page.get_by_role("button", name="Excluir categoria Categoria renomeada", exact=True).click()
    page.locator("#transfer-option").select_option("")
    page.locator("#confirm-ok").click()
    assert finance(page)["invoice"] == 46010
    assert "Sem categoria" in page.locator("#combined-label").inner_text()
    page.locator("#sum-categories").click()
    page.locator("#sum-none").click()
    page.locator('[data-sum-category="uncategorized"]').check()
    assert page.evaluate("InvoiceMath.selectedTotal(creditRecords(),customSelection)") == 10
    print("PASS: transaction type filters, inline category, rename/unassignment, personalized query only credit purchases")

    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    card = page.locator("#credit-card").bounding_box()
    assert abs(card["width"] / card["height"] - 1.586) < .02
    assert page.locator(".custom-result").bounding_box()["y"] >= page.locator(".sum-fieldset").bounding_box()["y"] + page.locator(".sum-fieldset").bounding_box()["height"]
    view(page, "salary")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.get_by_role("button", name="Corrigir recebimento: Segunda quinzena", exact=True).click()
    assert page.locator("#receipt-dialog").is_visible()
    page.keyboard.press("Escape")
    page.locator("#tab-salary").focus()
    page.keyboard.press("ArrowLeft")
    assert page.locator("#monthly-view").is_visible()
    print("PASS: desktop/mobile layouts, card aspect ratio, query placement, dialogs and keyboard tab navigation")

    # Oversubscribed allocation and nonduplicating card commitment.
    add(page, "Compromisso acima da quinzena", "1000,00", method="pix", funding="first")
    view(page, "salary")
    assert page.locator(".quarter-plan.over-budget").count() >= 1
    assert page.locator("#quarter-plans").get_by_text("Os compromissos ultrapassam o recebimento previsto.", exact=True).count() >= 1
    view(page)
    page.get_by_role("button", name="Excluir Compromisso acima da quinzena", exact=True).click()
    page.locator("#confirm-ok").click()
    assert finance(page)["invoice"] == 46010
    print("PASS: over-budget commitments flagged and record deletion preserves invoice")

    # New balance-by-date and synchronized salary scenarios in an isolated storage context.
    fresh = browser.new_context(viewport={"width":1440,"height":1000}, timezone_id="America/Sao_Paulo")
    sample = fresh.new_page()
    sample.on("pageerror", lambda error: errors.append(str(error)))
    sample.clock.install(time=datetime(2026,10,12,15))
    sample.goto(URL)
    assert sample.locator("#balance-date").input_value() == "2026-10-12"
    receive(sample,"first","866,00","2026-10-05")
    add(sample,"Saída pendente do exemplo","644,72",method="pix",date="2026-10-15")
    set_balance(sample,"1000,00","2026-10-12")
    sample.locator("#forecast-date").fill("2026-10-15")
    sample.locator("#forecast-date").dispatch_event("change")
    assert finance(sample)["available"] == 100000
    assert finance(sample)["projected"] == 110528
    assert sample.locator("#projected-balance").inner_text() == "R$\xa01.105,28"
    clean_example = sample.evaluate("JSON.parse(JSON.stringify(state))")
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource==='first').length") == 1
    stable_id = sample.evaluate("currentRecords().find(x=>x.salarySource==='first').id")
    view(sample)
    sample.locator("#type-filter").select_option("income")
    assert sample.locator("#records tr").count() == 1
    assert "05/10/2026" in sample.locator("#records tr").inner_text()
    sample.get_by_role("button",name="Editar Salário · Primeira quinzena",exact=True).click()
    assert sample.locator("#record-type").is_disabled()
    sample.locator("#description").fill("Adiantamento sincronizado")
    sample.locator("#value").fill("900,00")
    sample.get_by_role("button",name="Salvar lançamento",exact=True).click()
    assert sample.evaluate("salaryFor().first.actualCents") == 90000
    assert finance(sample)["incomeReceived"] == 90000
    assert finance(sample)["available"] == 100000  # Already included in the dated bank reference.
    receive(sample,"first","950,00","2026-10-05",correct=True)
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource==='first').length") == 1
    assert sample.evaluate("currentRecords().find(x=>x.salarySource==='first').id") == stable_id
    assert sample.evaluate("currentRecords().find(x=>x.salarySource==='first').description") == "Adiantamento sincronizado"
    assert finance(sample)["incomeReceived"] == 95000
    view(sample,"salary")
    sample.get_by_role("button",name="Desfazer recebimento: Primeira quinzena",exact=True).click()
    sample.locator("#confirm-ok").click()
    assert not sample.evaluate("salaryFor().first.received")
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource==='first').length") == 0
    assert finance(sample)["incomeReceived"] == 0
    receive(sample,"first","866,00","2026-10-05")
    view(sample)
    sample.get_by_role("button",name="Excluir Salário · Primeira quinzena",exact=True).click()
    sample.locator("#confirm-ok").click()
    assert not sample.evaluate("salaryFor().first.received")
    receive(sample,"first","866,00","2026-10-05")
    view(sample)
    sample.get_by_role("button",name="Editar Salário · Primeira quinzena",exact=True).click()
    sample.locator("#record-status").select_option("expected")
    sample.get_by_role("button",name="Salvar lançamento",exact=True).click()
    assert not sample.evaluate("salaryFor().first.received")
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource==='first').length") == 0
    receive(sample,"first","866,00","2026-10-05")
    view(sample)
    assert finance(sample)["projected"] == 110528
    print("PASS: exact 1.105,28 forecast, pre-reference salary excluded, linked entry/receipt correction and both undo paths synchronized")

    # Pop-up opens with hover/focus/touch and remains usable during interaction.
    help_button = sample.locator('.summary [data-help="projected"]')
    help_button.hover()
    sample.locator("#total-details").wait_for(state="visible")
    assert sample.locator("#total-details").get_attribute("aria-hidden") == "false"
    assert "Saldo bancário de referência" in sample.locator("#detail-items").inner_text()
    assert "Segunda quinzena" in sample.locator("#detail-items").inner_text()
    assert "644,72" in sample.locator("#detail-items").inner_text()
    assert sample.locator("#detail-total").inner_text() == "Total: R$\xa01.105,28"
    sample.locator("#detail-items").hover()
    sample.wait_for_timeout(250)
    assert sample.locator("#total-details").get_attribute("aria-hidden") == "false"
    help_button.focus()
    sample.keyboard.press("ArrowDown")
    sample.wait_for_function("document.activeElement.id==='detail-items'")
    sample.keyboard.press("Escape")
    assert sample.locator("#total-details").get_attribute("aria-hidden") == "true"
    sample.mouse.move(0,0)
    sample.locator('.summary [data-help="incomeReceived"]').focus()
    sample.locator("#total-details").wait_for(state="visible")
    assert sample.locator("#detail-items .detail-item").count() == 1
    assert "uma única" in sample.locator("#detail-formula").inner_text()
    sample.locator("#close-details").click()
    sample.mouse.move(0,0)
    # Monetary movements before/on the reference are included in it; future actual movements wait until their date.
    add(sample,"Já incluída no saldo","100,00",kind="income",status="received",date="2026-10-11")
    add(sample,"Mesmo dia da referência","100,00",kind="income",status="received",date="2026-10-12")
    add(sample,"Entrada posterior","50,00",kind="income",status="received",date="2026-10-13")
    add(sample,"Pagamento já incluído","20,00",method="pix",status="paid",date="2026-10-11")
    add(sample,"Pagamento posterior","10,00",method="pix",status="paid",date="2026-10-13")
    assert finance(sample)["available"] == 100000
    assert finance(sample)["projected"] == 114528
    sample.clock.set_system_time(datetime(2026,10,14,15))
    sample.evaluate("refreshFinancialIndicators()")
    assert finance(sample)["available"] == 104000
    assert len(finance(sample)["parts"]["available"]) == 2
    receive(sample,"second","750,00","2026-10-14")
    assert finance(sample)["available"] == 179000
    assert finance(sample)["projected"] == 114528
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource==='second').length") == 1
    sample.reload()
    assert finance(sample)["available"] == 179000
    assert finance(sample)["reference"] == {"cents":100000,"date":"2026-10-12"}
    assert finance(sample)["target"] == "2026-10-15"
    period(sample,11)
    assert not sample.evaluate("Object.hasOwn(state.balanceRefs,state.period)")
    assert sample.evaluate("currentRecords().filter(x=>x.salarySource).length") == 0
    period(sample,10)
    assert finance(sample)["available"] == 179000
    print("PASS: available/forecast use dated reference, same-day exclusion, pending-to-received not duplicated, persisted and isolated by month")

    # A long pop-up is bounded and internally scrollable; category strip stays one horizontal row.
    sample.evaluate("()=>{const c=JSON.parse(JSON.stringify(state));for(let i=0;i<35;i++)c.invoices[c.period].push({id:'detail-'+i,description:'Item fictício para rolagem '+i,type:'income',status:'received',cents:100,date:'2026-10-13',categoryId:null,labelId:null,paymentMethod:null,funding:null,salarySource:null});state=validateState(c);render()}")
    sample.locator('.summary [data-help="incomeReceived"]').hover()
    sample.locator("#total-details").wait_for(state="visible")
    assert sample.locator("#detail-items").evaluate("e=>e.scrollHeight>e.clientHeight")
    assert sample.locator("#total-details").bounding_box()["width"] <= 360
    assert sample.locator("#total-details").bounding_box()["height"] <= 430
    sample.locator("#detail-items").evaluate("e=>e.scrollTop=200")
    assert sample.locator("#total-details").get_attribute("aria-hidden") == "false"
    sample.keyboard.press("Escape")
    fresh.close()

    mobile = browser.new_context(viewport={"width":390,"height":844},timezone_id="America/Sao_Paulo",has_touch=True,is_mobile=True)
    touch = mobile.new_page()
    touch.on("pageerror",lambda error: errors.append(str(error)))
    touch.clock.install(time=datetime(2026,10,12,15))
    touch.goto(URL)
    touch.evaluate("data=>localStorage.setItem('v3go.invoice.v5',JSON.stringify(data))",clean_example)
    touch.reload()
    touch.locator('.summary [data-help="available"]').tap()
    assert touch.locator("#total-details").get_attribute("aria-hidden") == "false"
    touch.locator("#detail-items").tap()
    assert touch.locator("#total-details").get_attribute("aria-hidden") == "false"
    touch.locator("#close-details").tap()
    assert touch.locator("#total-details").get_attribute("aria-hidden") == "true"
    strip = touch.locator("#category-tabs")
    strip.scroll_into_view_if_needed()
    assert strip.evaluate("e=>getComputedStyle(e).flexWrap") == "nowrap"
    assert strip.evaluate("e=>e.scrollWidth>e.clientWidth")
    touch.locator("#categories-next").tap()
    touch.wait_for_function("document.getElementById('category-tabs').scrollLeft>100")
    touch.locator("#categories-prev").tap()
    touch.wait_for_function("document.getElementById('category-tabs').scrollLeft<2")
    assert touch.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert touch.locator("#card-background").evaluate("e=>getComputedStyle(e).filter") == "blur(1.3px)"
    assert touch.locator(".card-live").evaluate("e=>getComputedStyle(e).filter") == "none"
    assert touch.locator("#credit-card").evaluate("e=>getComputedStyle(e).filter") == "none"
    assert touch.locator("#invoice-funding").count() == 0
    assert touch.locator(".simple-due button").count() == 1
    assert touch.locator("#due-date").inner_text() == "05/10/2026"
    assert touch.locator("#projected-balance").inner_text() == "R$\xa01.105,28"
    mobile.close()
    print("PASS: pop-up pointer/keyboard/touch, bounded scrolling, horizontal categories, mobile layout and image-only blur")

    # Version 4 migration creates exactly one entry for an already confirmed quinzena.
    old = {"version":4,"period":"2026-10","dueDay":5,"categories":[{"id":"fixed","name":"Fixos","color":"#8865c3"}],"labels":[],"invoices":{"2026-10":[{"id":"salary-2026-10-first","description":"Entrada manual a preservar","cents":10000,"categoryId":None,"labelId":None,"type":"income","status":"received","date":"2026-10-10","paymentMethod":None,"funding":None}]},"payments":{},"settlements":{},"invoiceFunding":{},"salaryDefaults":{"grossCents":177200,"first":{"cents":86600,"day":5},"second":{"cents":75000,"day":15}},"salaryMonths":{"2026-10":{"grossCents":177200,"first":{"expectedCents":86600,"day":5,"received":True,"actualCents":86600,"actualDate":"2026-10-05"},"second":{"expectedCents":75000,"day":15,"received":False,"actualCents":None,"actualDate":None}}},"cardImage":None}
    page.evaluate("data=>{for(const v of ['v5','v4','v3','v2','v1'])localStorage.removeItem('v3go.invoice.'+v);localStorage.setItem('v3go.invoice.v4',JSON.stringify(data))}",old)
    page.reload()
    assert finance(page)["incomeReceived"] == 96600
    assert page.evaluate("currentRecords().filter(x=>x.salarySource==='first').length") == 1
    assert page.evaluate("currentRecords().find(x=>x.id==='salary-2026-10-first').salarySource") is None
    assert json.loads(page.evaluate("localStorage.getItem('v3go.invoice.v4')")) == old
    linked = page.evaluate("currentRecords().find(x=>x.salarySource==='first').id")
    page.reload()
    assert page.evaluate("currentRecords().find(x=>x.salarySource==='first').id") == linked
    assert finance(page)["incomeReceived"] == 96600
    print("PASS: v4 migration synchronizes confirmed salary once, preserves manual entries/id collision and leaves backup intact")

    # Legacy v3/v2/v1 bases retain values, identity, categories and months; old records become card purchases.
    original = {"version": 3, "period": "2026-10", "dueDay": 5, "categories": [{"id": "fixed", "name": "Contas fixas renomeadas", "color": "#8865c3"}, {"id": "user-transport", "name": "Transporte", "color": "#738bc6"}], "labels": [{"id": "tag", "name": "Etiqueta salva"}], "invoices": {"2026-10": [{"id": "old", "description": "Registro legado de teste", "categoryId": "fixed", "labelId": "tag", "cents": 65221}], "2026-11": [{"id": "old-other", "description": "Outro período", "categoryId": None, "labelId": None, "cents": 500}]}, "payments": {"2026-10": True}}
    page.evaluate("data=>{localStorage.removeItem('v3go.invoice.v5');localStorage.removeItem('v3go.invoice.v4');localStorage.setItem('v3go.invoice.v3',JSON.stringify(data))}", original)
    page.reload()
    assert finance(page)["invoice"] == finance(page)["spending"] == finance(page)["expensePaid"] == 65221
    assert page.evaluate("currentRecords()[0].date") is None
    assert page.evaluate("currentRecords()[0].paymentMethod") == "credit"
    assert page.evaluate("state.settlements[state.period].date") is None
    assert page.evaluate("state.categories.filter(x=>x.name==='Transporte').length") == 1
    assert page.evaluate("state.categories.find(x=>x.id==='fixed').name") == "Contas fixas renomeadas"
    assert json.loads(page.evaluate("localStorage.getItem('v3go.invoice.v3')")) == original
    period(page, 11)
    assert finance(page)["invoice"] == 500 and finance(page)["expensePaid"] == 0
    assert finance(page)["incomeReceived"] == 0
    for version in (2, 1):
        old = dict(original, version=2) if version == 2 else {"version": 1, "period": "2027-01", "records": [{"id": "v1", "description": "Teste de migração v1", "group": "fixed", "cents": 321}]}
        page.evaluate("([version,data])=>{for(const key of ['v5','v4','v3','v2','v1'])localStorage.removeItem('v3go.invoice.'+key);localStorage.setItem('v3go.invoice.v'+version,JSON.stringify(data))}", [version, old])
        page.reload()
        assert finance(page)["invoice"] == (65221 if version == 2 else 321)
    page.locator("#clear-data").click()
    page.locator("#confirm-ok").click()
    page.reload()
    assert finance(page)["invoice"] == finance(page)["incomeReceived"] == 0
    page.evaluate("localStorage.setItem('v3go.invoice.v5','bad-json')")
    page.reload()
    assert page.locator("#storage-warning").is_visible()
    assert page.evaluate("localStorage.getItem('v3go.invoice.v5')") == "bad-json"
    page.locator("#clear-data").click()
    page.locator("#confirm-ok").click()
    assert not page.locator("#storage-warning").is_visible()
    assert finance(page)["available"] == 0
    assert not errors, errors
    print("PASS: all legacy migrations, missing dates explicit, paid invoice counted once, categories deduplicated, corrupt storage protected")
    browser.close()
