"""Saldo recolhido e escolha explícita de impacto; dados somente de teste."""
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'v3go web')))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/index.html'
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width':1440,'height':1000}, timezone_id='America/Sao_Paulo', locale='pt-BR')
    page = context.new_page()
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.clock.install(time=datetime(2026,10,16,15))
    page.goto(url)
    assert page.locator('#balance-editor').is_visible()
    page.locator('#bank-balance').fill('1000,00')
    page.locator('#balance-date').fill('2026-10-12')
    page.locator('#balance-form').evaluate('(form) => form.requestSubmit()')
    assert not page.locator('#balance-editor').is_visible()
    assert page.locator('#balance-summary').is_visible()
    assert '1.000,00' in page.locator('#reference-summary-value').inner_text()
    assert '12/10/2026' in page.locator('#reference-summary-date').inner_text()
    page.reload()
    assert not page.locator('#balance-editor').is_visible()
    page.locator('#edit-balance').click()
    assert page.locator('#balance-editor').is_visible()
    assert page.locator('#bank-balance').input_value()=='1000,00'
    page.locator('#balance-form').evaluate('(form) => form.requestSubmit()')
    page.locator('#forecast-date').fill('2026-10-15')
    page.locator('#forecast-date').dispatch_event('change')
    page.locator('#add-record').click()
    page.locator('#description').fill('Saída de teste')
    page.locator('#value').fill('644,72')
    page.locator('#record-date').fill('2026-10-15')
    page.locator('#payment-method').select_option('pix')
    page.locator('#record-form').evaluate('(form) => form.requestSubmit()')
    def receipt(source, value, date, choice, correction=False):
        page.locator('#tab-salary').click()
        name='Primeira quinzena' if source=='first' else 'Segunda quinzena'
        action='Corrigir recebimento' if correction else 'Marcar como recebida'
        page.get_by_role('button',name=f'{action}: {name}',exact=True).click()
        assert page.locator('input[name="receipt-impact"]:checked').count()==0
        assert page.get_by_text('Deseja incluir este recebimento nos cálculos do saldo?',exact=True).is_visible()
        page.locator('#receipt-value').fill(value)
        page.locator('#receipt-date').fill(date)
        page.locator('#receipt-form').evaluate('(form) => form.requestSubmit()')
        assert page.locator('#receipt-dialog').is_visible()
        assert 'Escolha' in page.locator('#receipt-error').inner_text()
        page.locator(f'input[name="receipt-impact"][value="{choice}"]').check()
        page.locator('#receipt-form').evaluate('(form) => form.requestSubmit()')
        assert not page.locator('#receipt-dialog').is_visible()
    receipt('first','866,00','2026-10-13','reference')
    finance=page.evaluate('financeFor()')
    assert finance['incomeReceived']==86600 and finance['available']==100000 and finance['projected']==110528
    assert page.evaluate('salaryFor().first.includeInBalance') is False
    page.locator('#tab-monthly').click()
    page.locator('#type-filter').select_option('income')
    assert page.locator('#records tr').count()==1
    assert 'Já considerado no saldo de referência' in page.locator('#records').inner_text()
    page.get_by_role('button',name='Editar Salário · Primeira quinzena',exact=True).click()
    page.locator('#value').fill('900,00')
    page.locator('#record-form').evaluate('(form) => form.requestSubmit()')
    assert page.evaluate('salaryFor().first.includeInBalance') is False
    assert page.evaluate('financeFor().available')==100000
    assert page.evaluate('financeFor().incomeReceived')==90000
    receipt('first','866,00','2026-10-13','include',True)
    assert page.evaluate('financeFor().available')==186600
    assert page.evaluate('financeFor().projected')==197128
    receipt('first','866,00','2026-10-13','reference',True)
    assert page.evaluate('financeFor().projected')==110528
    receipt('second','750,00','2026-10-15','include')
    assert page.evaluate('financeFor().available')==175000
    assert page.evaluate('financeFor().projected')==110528
    assert page.evaluate('financeFor().incomeReceived')==161600
    assert page.evaluate('currentRecords().filter(r=>r.salarySource).length')==2
    page.reload()
    assert page.evaluate('salaryFor().first.includeInBalance') is False
    assert page.evaluate('salaryFor().second.includeInBalance') is True
    assert page.evaluate('financeFor().projected')==110528
    assert page.locator('#unassigned-commitments').count()==0
    assert page.locator('select[data-commitment]').count()==0
    page.locator('#period-month').select_option('11')
    assert page.locator('#balance-editor').is_visible()
    assert page.evaluate('financeFor().incomeReceived')==0
    assert not page.evaluate('salaryFor().first.received')
    page.locator('#period-month').select_option('10')
    assert not page.locator('#balance-editor').is_visible()
    assert page.evaluate('salaryFor().first.includeInBalance') is False
    # Legacy v5 has no explicit choice; preserve the prior dated calculation.
    legacy=page.evaluate('JSON.parse(JSON.stringify(state))')
    for period in legacy['salaryMonths'].values():
        for source in ['first','second']:
            period[source].pop('includeInBalance',None)
    page.evaluate('(data)=>localStorage.setItem("v3go.invoice.v5",JSON.stringify(data))',legacy)
    page.reload()
    assert page.evaluate('salaryFor().first.includeInBalance') is True
    assert page.evaluate('financeFor().incomeReceived')==161600
    assert page.evaluate('financeFor().available')==261600
    page.locator('#edit-balance').click()
    page.locator('#balance-date').fill('2026-10-16')
    page.locator('#balance-form').evaluate('(form)=>form.requestSubmit()')
    assert page.evaluate('financeFor().available')==100000  # Even Include respects the dated reference.
    page.locator('#nav-salary').click()
    page.screenshot(path='/tmp/v3go-receipts-desktop.png',full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#nav-salary').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    boxes=page.locator('.quarter-column').evaluate_all('cards=>cards.map(c=>c.getBoundingClientRect().y)')
    assert boxes[0]<boxes[1]
    page.get_by_role('button',name='Corrigir recebimento: Primeira quinzena',exact=True).click()
    page.locator('input[name="receipt-impact"][value="reference"]').check()
    page.locator('#receipt-form').evaluate('(form)=>form.requestSubmit()')
    page.screenshot(path='/tmp/v3go-receipts-mobile.png',full_page=True)
    assert not errors,errors
    stored = context.storage_state()
    touch_context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, locale='pt-BR', timezone_id='America/Sao_Paulo', storage_state=stored)
    touch = touch_context.new_page()
    touch.on('pageerror',lambda error: errors.append(str(error)))
    touch.goto(url)
    assert touch.locator('#balance-summary').is_visible()
    touch.locator('#edit-balance').tap()
    assert touch.locator('#balance-editor').is_visible()
    touch.locator('#nav-salary').tap()
    touch.get_by_role('button',name='Corrigir recebimento: Primeira quinzena',exact=True).tap()
    touch.locator('.choice-option').last.tap()
    assert touch.locator('input[value="reference"]').is_checked()
    touch.get_by_role('button',name='Confirmar recebimento',exact=True).tap()
    assert not touch.locator('#receipt-dialog').is_visible()
    assert touch.evaluate('salaryFor().first.includeInBalance') is False
    assert touch.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    touch_context.close()
    context.close()
    browser.close()
server.shutdown()
server.server_close()
print('PASS: collapsed bank reference/edit/reload, mandatory choices, independent persisted flags, ledger sync/history, exact 1.105,28, correction and legacy compatibility, date reference respected, no allocation UI, desktop/mobile')
