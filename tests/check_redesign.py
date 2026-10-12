"""Interações do redesign com dados fictícios isolados do usuário."""
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
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='America/Sao_Paulo', locale='pt-BR')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.clock.install(time=datetime(2026, 10, 12, 15))
    page.goto(url)
    page.locator('#period-month').select_option('11')
    def add(description, kind, date=None):
        page.locator('#add-record').click()
        assert page.locator('#record-date').input_value() == '2026-10-12'
        assert page.locator('#record-funding').count() == 0
        page.locator('#description').fill(description)
        page.locator('#value').fill('10,00')
        page.locator('#record-type').select_option(kind)
        if kind == 'expense':
            page.locator('#payment-method').select_option('pix')
        if date is not None:
            page.locator('#record-date').fill(date)
        page.get_by_role('button', name='Salvar lançamento', exact=True).click()
        assert not page.locator('#record-dialog').is_visible()
    add('Primeiro criado', 'expense', '')
    add('Segundo criado', 'income', '2026-10-12')
    add('Mais antigo', 'expense', '2026-10-01')
    add('Mais recente', 'income', '2026-10-20')
    def names():
        return page.locator('#records .description-cell').evaluate_all('cells => cells.map(cell => cell.lastChild.textContent)')
    assert names() == ['Mais recente', 'Segundo criado', 'Primeiro criado', 'Mais antigo']
    assert page.locator('#sort-date').locator('..').get_attribute('aria-sort') == 'descending'
    page.locator('#sort-date').click()
    assert names() == ['Mais antigo', 'Primeiro criado', 'Segundo criado', 'Mais recente']
    page.locator('#sort-type').click()
    assert names() == ['Mais recente', 'Segundo criado', 'Primeiro criado', 'Mais antigo']
    page.locator('#sort-type').click()
    assert names() == ['Primeiro criado', 'Mais antigo', 'Mais recente', 'Segundo criado']
    before = page.evaluate('financeFor()')
    # Preserve a planning link while editing in the simplified form.
    rid = page.evaluate('currentRecords()[0].id')
    page.locator('#nav-salary').click()
    assert page.locator('#nav-salary').get_attribute('aria-current') == 'location'
    assert page.locator("select[data-commitment]").count() == 0
    boxes = page.locator('.quarter-column').evaluate_all('cards => cards.map(c => ({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y}))')
    assert boxes[0]['y'] == boxes[1]['y'] and boxes[0]['x'] < boxes[1]['x']
    page.locator('#tab-monthly').click()
    page.get_by_role('button', name='Editar Primeiro criado', exact=True).click()
    page.locator('#record-date').fill('')
    page.get_by_role('button', name='Salvar lançamento', exact=True).click()
    record = page.evaluate('currentRecords()[0]')
    assert record['date'] == '2026-10-12' and record['funding'] is None and record['createdOrder'] == 0
    assert page.evaluate('financeFor()') == before
    page.reload()
    assert names() == ['Mais recente', 'Segundo criado', 'Primeiro criado', 'Mais antigo']
    assert page.evaluate('currentRecords().map(r => r.createdOrder)') == [0,1,2,3]
    for href in ['#lancamentos', '#regras', '#inicio']:
        page.locator(f'.nav-link[href="{href}"]').click()
        assert page.locator('.nav-link.active').count() == 1
        assert page.locator('.nav-link.active').get_attribute('href') == href
    # Semantic indicator backgrounds and financial behavior remain unchanged.
    colors = page.locator('.summary .card').evaluate_all('cards => cards.map(c => getComputedStyle(c).color)')
    assert len(set(colors)) == 7
    assert 'rgb(48, 35, 67)' in page.locator('.total-card').evaluate('card => getComputedStyle(card).backgroundImage')
    page.locator('#bank-balance').focus()
    focus = page.locator('#bank-balance').evaluate('(input) => ({border:getComputedStyle(input).borderColor,shadow:getComputedStyle(input).boxShadow})')
    assert focus['shadow'] != 'none'
    overview = page.locator('.nav-link[href="#inicio"]')
    overview.focus()
    page.keyboard.press("Tab")
    page.keyboard.press("Shift+Tab")
    assert overview.evaluate('link => getComputedStyle(link).outlineWidth') == '2px'
    page.locator('#nav-salary').click()
    page.get_by_role('button', name='Marcar como recebida: Primeira quinzena', exact=True).click()
    page.locator('#receipt-value').fill('866,00')
    page.locator('#receipt-date').fill('2026-10-12')
    page.locator('input[name="receipt-impact"][value="include"]').check()
    page.locator('#receipt-form').evaluate('(form) => form.requestSubmit()')
    linked = page.evaluate('currentRecords().find(r => r.salarySource === "first")')
    assert linked['createdOrder'] == 4
    page.get_by_role('button', name='Corrigir recebimento: Primeira quinzena', exact=True).click()
    page.locator('#receipt-value').fill('860,00')
    page.locator('input[name="receipt-impact"][value="include"]').check()
    page.locator('#receipt-form').evaluate('(form) => form.requestSubmit()')
    assert page.evaluate('currentRecords().filter(r => r.salarySource === "first").length') == 1
    assert page.evaluate('currentRecords().find(r => r.salarySource === "first").createdOrder') == 4
    page.reload()
    assert page.evaluate('currentRecords().find(r => r.salarySource === "first").createdOrder') == 4
    page.locator('#nav-salary').click()
    page.screenshot(path='/tmp/v3go-redesign-desktop.png', full_page=True)
    page.locator('.page-heading').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/v3go-redesign-desktop-top.png')
    context.close()
    mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, timezone_id='America/Sao_Paulo', locale='pt-BR')
    page = mobile.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url)
    page.locator('#nav-salary').tap()
    boxes = page.locator('.quarter-column').evaluate_all('cards => cards.map(c => ({x:c.getBoundingClientRect().x,y:c.getBoundingClientRect().y}))')
    assert boxes[0]['x'] == boxes[1]['x'] and boxes[0]['y'] < boxes[1]['y']
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.nav-link:visible').count() == 4
    page.get_by_role('button', name='Marcar como recebida: Primeira quinzena', exact=True).tap()
    assert page.locator('#receipt-dialog').is_visible()
    page.locator('#receipt-dialog').evaluate('(dialog) => dialog.close()')
    page.screenshot(path='/tmp/v3go-redesign-mobile.png', full_page=True)
    page.locator('.page-heading').scroll_into_view_if_needed()
    page.screenshot(path='/tmp/v3go-redesign-mobile-top.png')
    assert not errors, errors
    mobile.close()
    browser.close()
server.shutdown()
server.server_close()
print('PASS: date defaults/fallback, manual date, both sort toggles and creation ties, preserved data and simplified receipts, navigation states, semantic colors, desktop columns and touch/mobile without overflow')
