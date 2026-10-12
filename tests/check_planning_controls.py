"""Simulação, datas, referência no mesmo dia e histórico. Dados fictícios."""
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT/'v3go web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR',timezone_id='America/Sao_Paulo')
 page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.clock.install(time=datetime(2026,10,12,15));page.goto(url)
 assert page.locator('#invoice-due-date').input_value()=='2026-10-05'
 assert page.locator('#invoice-closing-date').input_value()=='2026-09-28'
 assert '05/10/2026' in page.locator('#invoice-dates-caption').inner_text()
 page.locator('#bank-balance').fill('500,00');page.locator('#balance-date').fill('2026-10-12');page.locator('#balance-form').evaluate('f=>f.requestSubmit()')
 page.locator('#tab-salary').click();page.get_by_role('button',name='Marcar como recebida: Primeira quinzena',exact=True).click()
 page.locator('input[name="receipt-impact"][value="reference"]').check();page.locator('#receipt-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().available')==50000
 page.get_by_role('button',name='Corrigir recebimento: Primeira quinzena',exact=True).click()
 assert page.locator('input[name="receipt-impact"][value="reference"]').is_checked()
 page.locator('input[name="receipt-impact"][value="include"]').check()
 assert 'movimenta o saldo' in page.locator('#receipt-previous-choice').inner_text()
 page.locator('#receipt-cancel').click();assert page.evaluate('salaryFor().first.includeInBalance') is False
 page.get_by_role('button',name='Corrigir recebimento: Primeira quinzena',exact=True).click()
 assert page.locator('input[name="receipt-impact"][value="reference"]').is_checked()
 page.locator('input[name="receipt-impact"][value="include"]').check();page.locator('#receipt-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().available')==136600  # Explicit inclusion on the reference day.
 page.reload();page.locator('#tab-salary').click();page.get_by_role('button',name='Corrigir recebimento: Primeira quinzena',exact=True).click()
 assert page.locator('input[name="receipt-impact"][value="include"]').is_checked()
 page.locator('input[name="receipt-impact"][value="reference"]').check();page.locator('#receipt-form').evaluate('f=>f.requestSubmit()')
 page.locator('#salary-config').evaluate('f=>f.requestSubmit()')
 assert page.locator('#salary-summary').evaluate('e=>parseFloat(getComputedStyle(e).paddingLeft)')>=20
 page.locator('#tab-monthly').click()
 def add(name,value,method,category,date='2026-10-13'):
  page.locator('#add-record').click();page.locator('#description').fill(name);page.locator('#value').fill(value)
  page.locator('#payment-method').select_option(method);page.locator('#group').select_option(category);page.locator('#record-date').fill(date)
  page.locator('#record-form').evaluate('f=>f.requestSubmit()');assert not page.locator('#record-dialog').is_visible()
 add('Despesa fixa','100,00','pix','fixed');add('Lazer','200,00','credit','leisure');add('Sem categoria','10,00','credit','')
 page.locator('#category-tabs button[data-category="fixed"]').click()
 data=page.evaluate('JSON.stringify(state)');page.locator('#view-spending').click()
 assert page.locator('#custom-panel').is_visible() and page.evaluate('selectedCategory')=='fixed'
 assert page.locator('#custom-total').inner_text()=='R$\xa0310,00'
 assert page.locator('#simulation-invoice-total').inner_text()=='R$\xa0210,00'
 page.locator('[data-sum-category="leisure"]').uncheck();assert page.locator('#custom-total').inner_text()=='R$\xa0110,00'
 assert page.evaluate('JSON.stringify(state)')==data
 page.locator('#sum-none').click();assert page.locator('#custom-total').inner_text()=='R$\xa00,00'
 page.locator('#sum-all').click();page.locator('#close-sum').click();page.locator('#nav-simulation').click()
 assert page.locator('#custom-total').inner_text()=='R$\xa0310,00'
 page.locator('#forecast-date').fill('2026-10-14');page.locator('#forecast-date').dispatch_event('change')
 assert page.evaluate('financeFor().projected')==19000
 purchases=page.evaluate('JSON.stringify(state.invoices)')
 page.locator('#invoice-closing-date').fill('2026-10-08');page.locator('#invoice-due-date').fill('2026-10-15')
 page.locator('#invoice-dates-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().projected')==40000
 assert page.evaluate('JSON.stringify(state.invoices)')==purchases
 assert '08/10/2026' in page.locator('#invoice-dates-caption').inner_text()
 page.locator('#invoice-closing-date').fill('2026-10-16');page.locator('#invoice-dates-form').evaluate('f=>f.requestSubmit()')
 assert page.locator('#invoice-dates-error').is_visible()
 assert page.evaluate('state.invoiceDates[state.period].closing')=='2026-10-08'
 page.locator('#invoice-closing-date').fill('2026-10-08')
 # Seed an existing partial payment: current flows must not overwrite it.
 page.evaluate('()=>{const c=JSON.parse(JSON.stringify(state));c.payments[c.period]=true;c.settlements[c.period]={cents:5000,date:"2026-10-11"};state=validateState(c);saveState();render()}')
 assert page.evaluate('financeFor().invoiceRemaining')==16000
 page.locator('#toggle-payment').click()
 assert page.locator('#settlement-value').get_attribute('readonly') is not None
 assert page.locator('#settlement-value').input_value()=='160,00'
 assert page.locator('#settlement-date').input_value()=='2026-10-12'
 page.locator('#settlement-value').evaluate('input=>input.value="0,01"')  # DOM tampering cannot change the locked amount.
 page.locator('#settlement-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().invoicePaid')==21000
 history=page.evaluate('state.paymentHistory[state.period]');assert len(history)==2 and history[0]['cents']==5000 and history[0]['date']=='2026-10-11'
 assert history[1]['cents']==16000
 assert page.evaluate('financeFor().available')==34000  # Only the new, same-day cash payment is subtracted.
 assert page.evaluate('financeFor().spending')==31000
 assert page.locator('#invoice-due-date').is_disabled()
 # Mark that same-day payment as already included in a newly updated reference.
 page.locator('#edit-balance').click();page.locator('#bank-balance').fill('340,00')
 page.locator(f'input[data-movement="{history[1]["id"]}"]').check();page.locator('#balance-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().available')==34000
 page.reload();assert page.evaluate('financeFor().available')==34000 and len(page.evaluate('state.paymentHistory[state.period]'))==2
 page.locator('#toggle-payment').click();page.locator('#confirm-ok').click()
 assert len(page.evaluate('state.paymentHistory[state.period]'))==2 and page.evaluate('state.paymentHistory[state.period].every(p=>!p.active)')
 assert page.evaluate('explanationData("available").items.filter(item=>item.label.includes("desfeito")).every(item=>item.effectCents===0)')
 # Search/scroll are independent of ledger filters and remain outside the list.
 page.locator('#open-settings').click();assert page.locator('#due-day').count()==0
 page.locator('#category-search').fill('SAUDE');assert page.locator('#category-list .option-row').count()==1
 page.locator('#category-search').fill('ausente');assert 'Nenhum resultado' in page.locator('#category-list').inner_text()
 page.locator('#category-search').fill('');assert page.locator('#category-list').evaluate('e=>e.scrollHeight>e.clientHeight')
 for index in range(10):
  page.locator('#manage-add-label').click();page.locator('#option-name').fill(f'Étiqueta {index}');page.locator('#option-form').evaluate('f=>f.requestSubmit()')
 assert page.locator('#label-list').evaluate('e=>e.scrollHeight>e.clientHeight')
 page.locator('#label-search').fill('ETIQUETA 9');assert page.locator('#label-list .option-row').count()==1
 page.locator('#label-search').fill('nao existe');assert 'Nenhum resultado' in page.locator('#label-list').inner_text()
 page.locator('#close-settings').click()
 page.locator('#period-month').select_option('11');assert page.evaluate('currentRecords().length')==0
 assert page.locator('#invoice-due-date').input_value()=='2026-11-05'
 page.locator('#period-month').select_option('10');assert page.locator('#invoice-due-date').input_value()=='2026-10-15'
 # With both receipts confirmed and no pending expenses, projection equals available.
 page.evaluate('()=>{const c=JSON.parse(JSON.stringify(state));c.invoices[c.period]=[];c.payments={};c.settlements={};c.paymentHistory={};const salary=salaryFor();c.salaryMonths[c.period]={...salary,first:{...salary.first,received:true,actualCents:86600,actualDate:"2026-10-10",includeInBalance:false},second:{...salary.second,received:true,actualCents:75084,actualDate:"2026-10-10",includeInBalance:false}};syncSalaryRecords(c);state=validateState(c);saveState();render()}')
 add('Pagamento no mesmo dia','20,00','pix','fixed','2026-10-12')
 page.get_by_role('button',name='Editar Pagamento no mesmo dia',exact=True).click();page.locator('#record-status').select_option('paid');page.locator('#record-form').evaluate('f=>f.requestSubmit()')
 assert page.evaluate('financeFor().available')==32000
 assert 'Sem movimentações previstas: igual ao saldo disponível.' in page.locator('#forecast-caption').inner_text()
 for key in ['available','projected']:
  detail=page.evaluate('key=>explanationData(key)',key);assert sum(item.get('effectCents',item['cents']) for item in detail['items'])==detail['amount']
 saved=context.storage_state();mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='pt-BR',storage_state=saved)
 touch=mobile.new_page();touch.on('pageerror',lambda error:errors.append(str(error)));touch.goto(url)
 touch.locator('#view-spending').tap();assert touch.locator('#custom-panel').is_visible()
 touch.locator('#sum-none').tap();assert touch.locator('#custom-total').inner_text()=='R$\xa00,00'
 assert touch.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert touch.locator('#invoice-dates-form').evaluate('e=>getComputedStyle(e).flexDirection')=='column'
 touch.screenshot(path='/tmp/v3go-planning-mobile.png',full_page=True)
 assert not errors,errors
 mobile.close();context.close();browser.close()
server.shutdown();server.server_close()
print('PASS: simulation/no mutation, locked remaining payment/history/undo, saved receipt selection/cancel, same-day choice and bank review, date validation/projection/no reassociation, search/scroll, forecast equality/details, months and mobile')
