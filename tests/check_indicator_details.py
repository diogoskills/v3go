"""Conferência dos efeitos dos detalhes, status e limite de imagens. Dados fictícios."""
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'v3go web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR',timezone_id='America/Sao_Paulo')
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.clock.install(time=datetime(2026,10,12,15));page.goto(url)
    assert page.locator('#open-settings').inner_text()=='Configurações'
    page.locator('#open-settings').click();assert page.locator('#settings-dialog').is_visible();page.keyboard.press('Escape')
    page.locator('#bank-balance').fill('855,56');page.locator('#balance-date').fill('2026-10-09');page.locator('#balance-form').evaluate('f=>f.requestSubmit()')
    page.locator('#forecast-date').fill('2026-10-15');page.locator('#forecast-date').dispatch_event('change')
    page.locator('#tab-salary').click();page.get_by_role('button',name='Marcar como recebida: Primeira quinzena',exact=True).click()
    page.locator('#receipt-date').fill('2026-10-10');page.locator('input[name="receipt-impact"][value="reference"]').check();page.locator('#receipt-form').evaluate('f=>f.requestSubmit()')
    assert 'Já considerada no saldo de referência — não soma novamente.' in page.locator('.receipt-impact-note').first.inner_text()
    assert page.evaluate('financeFor().incomeReceived')==86600
    assert page.evaluate('financeFor().available')==85556
    assert page.evaluate('financeFor().projected')==160640
    assert page.locator('#projected-balance').inner_text()=='R$\xa01.606,40'
    def audit():
        for key in ['invoice','incomeExpected','incomeReceived','expensePending','expensePaid','available','projected']:
            data=page.evaluate('key=>explanationData(key)',key)
            assert sum(item.get('effectCents',item['cents']) for item in data['items'])==data['amount'],(key,data)
            page.clock.run_for(250)
            page.locator(f'.summary [data-help="{key}"]').focus();page.keyboard.press('ArrowDown');page.clock.run_for(50);page.locator('#total-details').wait_for(state='visible')
            assert page.locator('#detail-total').inner_text()==page.evaluate('cents=>"Total: "+currency(cents)',data['amount']),(key,page.locator('#detail-total').inner_text(),data['amount'])
            page.locator('#close-details').click()
    audit()
    data=page.evaluate('explanationData("projected")')
    first=next(item for item in data['items'] if item['label'].startswith('Salário'))
    second=next(item for item in data['items'] if 'Segunda quinzena' in item['label'])
    assert first['effectCents']==0 and first['cents']==86600
    assert second['effectCents']==75084 and 'Prevista — incluída somente na projeção' in second['note']
    page.locator('#tab-monthly').click()
    def add(name,kind,value,date,status='pending',method='pix'):
        page.locator('#add-record').click();page.locator('#description').fill(name);page.locator('#record-type').select_option(kind)
        page.locator('#value').fill(value);page.locator('#record-date').fill(date)
        if kind=='expense':page.locator('#payment-method').select_option(method)
        page.locator('#record-status').select_option(status)
        if kind=='income' and status=='received':page.locator('input[name="record-impact"][value="include"]').check()
        page.locator('#record-form').evaluate('f=>f.requestSubmit()');assert not page.locator('#record-dialog').is_visible()
    add('Entrada considerada','income','100,00','2026-10-11','received')
    add('Saída paga','expense','40,00','2026-10-11','paid')
    add('Saída pendente','expense','30,00','2026-10-14')
    add('Confirmada com data futura','income','500,00','2026-10-20','received')
    assert page.evaluate('financeFor().incomeReceived')==146600
    assert page.evaluate('financeFor().available')==91556
    assert page.evaluate('financeFor().projected')==163640
    audit()
    page.locator('#forecast-date').fill('2026-10-10');page.locator('#forecast-date').dispatch_event('change')
    assert page.evaluate('financeFor().projected')==91556  # Starts from available now, even for an earlier target.
    audit()
    page.locator('#forecast-date').fill('2026-10-25');page.locator('#forecast-date').dispatch_event('change')
    assert page.evaluate('financeFor().projected')==163640  # A future dated confirmed entry is not received now.
    add('Compra no cartão','expense','250,00','2026-10-11',method='credit')
    page.locator('#toggle-payment').click();page.locator('#settlement-value').fill('250,00');page.locator('#settlement-date').fill('2026-10-12');page.locator('#settlement-form').evaluate('f=>f.requestSubmit()')
    assert page.locator('#invoice-summary-status').inner_text()=='Paga'
    assert page.locator('#invoice-summary-status').get_attribute('data-status')=='paid'
    assert page.locator('#total').inner_text()=='R$\xa0250,00'
    page.clock.run_for(250)
    page.locator('.summary [data-help="invoice"]').focus();page.keyboard.press('ArrowDown');page.clock.run_for(50)
    page.locator('#total-details').wait_for(state='visible')
    assert page.locator('#detail-invoice-status').inner_text()=='Paga'
    page.locator('#close-details').click();audit()
    page.locator('#toggle-payment').click();page.locator('#confirm-ok').click()
    assert page.locator('#invoice-summary-status').inner_text()=='Em aberto'
    assert page.evaluate('explanationData("invoice").invoiceStatus')=='Em aberto'
    assert page.locator('#total').inner_text()=='R$\xa0250,00'
    assert page.locator('.pending-expense-card').evaluate('c=>getComputedStyle(c).color')!=page.locator('#expense-paid').evaluate('c=>getComputedStyle(c.parentElement).color')
    # Valid image, then size/format/decode failures must preserve that image and all finance data.
    png=page.evaluate("()=>{const c=document.createElement('canvas');c.width=50;c.height=30;return c.toDataURL('image/png').split(',')[1]}")
    page.locator('#card-upload').set_input_files({'name':'ok.png','mimeType':'image/png','buffer':base64.b64decode(png)})
    page.wait_for_function('state.cardImage!==null');image=page.evaluate('state.cardImage');before=page.evaluate('financeFor()')
    page.evaluate('()=>{window.objectURLCount=0;window.originalURL=URL.createObjectURL.bind(URL);URL.createObjectURL=(...args)=>{objectURLCount++;return originalURL(...args)}}')
    page.locator('#card-upload').set_input_files({'name':'large.png','mimeType':'image/png','buffer':b'x'*(2*1024*1024+1)})
    assert '2 MB' in page.locator('#card-image-error').inner_text()
    assert page.evaluate('objectURLCount')==0
    assert page.evaluate('state.cardImage')==image and page.evaluate('financeFor()')==before
    page.locator('#card-upload').set_input_files({'name':'boundary.png','mimeType':'image/png','buffer':base64.b64decode(png).ljust(2*1024*1024,b'\x00')})
    page.wait_for_function('document.getElementById("card-image-error").hidden')
    assert page.evaluate('objectURLCount')==1
    page.locator('#card-upload').set_input_files({'name':'unsafe.svg','mimeType':'image/svg+xml','buffer':b'<svg></svg>'})
    assert 'Formato incompatível' in page.locator('#card-image-error').inner_text()
    page.locator('#card-upload').set_input_files({'name':'broken.png','mimeType':'image/png','buffer':b'not-image'})
    page.wait_for_function('document.getElementById("card-image-error").textContent.includes("Não foi possível ler")')
    assert page.evaluate('state.cardImage')==image
    assert page.locator('#card-background').evaluate('e=>getComputedStyle(e).filter')=='blur(2px)'
    assert page.locator('.card-live').evaluate('e=>getComputedStyle(e).filter')=='none'
    page.reload();assert page.evaluate('state.cardImage')==image
    stored=context.storage_state();mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='pt-BR',storage_state=stored)
    touch=mobile.new_page();touch.on('pageerror',lambda error:errors.append(str(error)));touch.goto(url)
    touch.locator('#open-settings').tap();assert touch.locator('#settings-dialog').is_visible();touch.locator('#close-settings').tap()
    touch.locator('.summary [data-help="projected"]').tap();assert touch.locator('#total-details').get_attribute('aria-hidden')=='false'
    touch.locator('#close-details').tap()
    touch.locator('#card-upload').set_input_files({'name':'mobile-large.png','mimeType':'image/png','buffer':b'x'*(2*1024*1024+1)})
    assert '2 MB' in touch.locator('#card-image-error').inner_text() and touch.evaluate('state.cardImage')==image
    assert touch.evaluate('document.documentElement.scrollWidth<=innerWidth')
    touch.screenshot(path='/tmp/v3go-indicator-mobile.png',full_page=True)
    assert not errors,errors
    mobile.close();context.close();browser.close()
server.shutdown();server.server_close()
print('PASS: exact 1.606,40, each detail sums to its card, zero-impact receipts and predictions, available-based projection, paid/undo status, amber outgoing predictions, 2 MB rejection before decode, formats/persistence/blur, desktop/mobile')
