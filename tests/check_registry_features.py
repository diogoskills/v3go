"""IDs, etiquetas, filtros, recorrências e modais com dados fictícios."""
from datetime import datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*_): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT/'v3go web')))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/index.html'
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},locale='pt-BR',timezone_id='America/Sao_Paulo')
    page=context.new_page(); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.clock.install(time=datetime(2026,10,12,15))
    page.goto(url)
    assert page.evaluate('state.salaryDefaults.second.cents')==75084
    assert page.evaluate('validateSalaryDefaults({...state.salaryDefaults,second:{day:15,cents:null}}).second.cents')==75084
    assert page.evaluate('validateSalaryDefaults({...state.salaryDefaults,second:{day:15,cents:0}}).second.cents')==0
    assert page.locator('.nav-link[href="#configuracoes"]').count()==0
    page.locator('#open-settings').click()
    assert page.locator('#settings-dialog').is_visible()
    assert 'blur' in page.locator('#settings-dialog').evaluate('d=>getComputedStyle(d,"::backdrop").backdropFilter')
    for name in ['Empresa @ Ação_01, mensal','Benefício']:
        page.locator('#manage-add-label').click();page.locator('#option-name').fill(name)
        page.locator('#option-form').evaluate('f=>f.requestSubmit()')
    labels=page.evaluate('state.labels.map(x=>x.id)')
    page.keyboard.press('Escape');assert not page.locator('#settings-dialog').is_visible()
    page.locator('#open-settings').click();page.mouse.click(4,4)
    assert not page.locator('#settings-dialog').is_visible()
    def add(name,kind='expense',value='10,00',category='fixed',tags=(),recurring=False):
        page.locator('#add-record').click();page.locator('#description').fill(name);page.locator('#value').fill(value)
        page.locator('#record-date').fill('2026-10-12');page.locator('#record-type').select_option(kind)
        page.locator('#group').select_option(category)
        for tag in tags: page.locator(f'#record-label input[value="{tag}"]').check()
        if recurring: page.locator('#record-recurring').check();page.locator('#recurring-day').fill('31')
        page.locator('#record-form').evaluate('f=>f.requestSubmit()')
        assert not page.locator('#record-dialog').is_visible(),page.locator('#form-error').inner_text()
    add('Primeira @ entrada_texto, ação','income',tags=labels,recurring=True)
    add('<img src=x onerror="window.injected=true">','expense',category='flexible',tags=labels[:1])
    add('Terceiro','expense',tags=labels[1:])
    assert not page.evaluate('window.injected===true')
    def sequences(): return page.locator('#records .sequence-cell').all_text_contents()
    assert sequences()==['3','2','1']
    page.locator('#sort-date').click();assert sequences()==['1','2','3']
    page.locator('#sort-type').click();assert sequences()==['1','3','2']
    page.locator('#sort-type').click();assert sequences()==['3','2','1']
    page.locator('#category-tabs button[data-category="fixed"]').click()
    page.locator('#label-filter').select_option(labels[0])
    order=page.evaluate('JSON.stringify(recordSort)')
    add('Quarto','expense',tags=labels[:1])
    assert page.locator('#label-filter').input_value()==labels[0]
    assert page.evaluate('selectedCategory')=='fixed' and page.evaluate('JSON.stringify(recordSort)')==order
    assert sequences()==['4','1']
    page.locator('#category-tabs button[data-category="flexible"]').hover()
    page.clock.run_for(200)
    assert page.locator('#category-popover').is_visible()
    assert '1 lançamento' in page.locator('#category-popover').inner_text()
    assert '10,00' in page.locator('#category-popover').inner_text()
    assert page.evaluate('selectedCategory')=='fixed'
    page.get_by_role('button',name='Marcar como recebida Primeira @ entrada_texto, ação',exact=True).click()
    page.locator('#record-form').evaluate('f=>f.requestSubmit()')
    assert page.locator('#record-dialog').is_visible()
    assert 'Escolha' in page.locator('#form-error').inner_text()
    assert page.locator('#record-impact-include').evaluate('input=>input===document.activeElement')
    page.locator('input[name="record-impact"][value="reference"]').check()
    page.locator('#record-form').evaluate('f=>f.requestSubmit()')
    assert page.evaluate('financeFor().incomeReceived')==1000
    assert page.evaluate('financeFor().available')==0
    assert page.evaluate('currentRecords().find(r=>r.type==="income").sequenceId')==1
    assert page.evaluate('currentRecords().find(r=>r.type==="income").labelIds.length')==2
    page.locator('[data-help="incomeReceived"]').focus()
    page.locator('#total-details').wait_for(state='visible')
    assert 'Já considerado no saldo de referência — não soma novamente ao saldo.' in page.locator('#detail-items').inner_text(), (page.locator('#detail-items').inner_text(),page.evaluate('financeFor().parts.incomeReceived'),page.evaluate('explanationData("incomeReceived")'))
    page.locator('#close-details').click()
    page.locator('#period-month').select_option('11')
    recurring=page.evaluate('currentRecords().filter(r=>r.recurrenceId)')
    assert len(recurring)==1 and recurring[0]['status']=='expected' and recurring[0]['date']=='2026-11-30'
    rid=recurring[0]['sequenceId'];page.reload()
    assert page.evaluate('currentRecords().filter(r=>r.recurrenceId).length')==1
    assert page.evaluate('currentRecords()[0].sequenceId')==rid
    assert page.evaluate('financeFor().incomeReceived')==0
    page.get_by_role('button',name='Excluir Primeira @ entrada_texto, ação',exact=True).click();page.locator('#confirm-ok').click();page.reload()
    assert page.evaluate('currentRecords().length')==0
    page.locator('#period-year').fill('2027');page.locator('#period-year').dispatch_event('change')
    assert page.evaluate('currentRecords().filter(r=>r.recurrenceId).length')==1
    assert page.evaluate('currentRecords()[0].status')=='expected'
    page.locator('#period-year').fill('2026');page.locator('#period-year').dispatch_event('change')
    assert page.evaluate('currentRecords().length')==0
    page.locator('#period-month').select_option('10')
    page.locator('#category-tabs button[data-category="fixed"]').click();page.locator('#label-filter').select_option(labels[0])
    page.get_by_role('button',name='Excluir Quarto',exact=True).click();page.locator('#confirm-ok').click()
    assert page.evaluate('selectedCategory')=='fixed' and page.locator('#label-filter').input_value()==labels[0]
    add('Sem reutilizar ID','expense',tags=labels[:1])
    assert page.evaluate('Math.max(...currentRecords().map(r=>r.sequenceId))')>rid
    page.locator('#tab-salary').click()
    assert page.locator('#salary-config').is_visible()
    page.locator('#salary-second').fill('725,43');page.locator('#salary-config').evaluate('f=>f.requestSubmit()')
    assert not page.locator('#salary-config').is_visible()
    assert '725,43' in page.locator('#salary-summary').inner_text()
    page.reload();page.locator('#tab-salary').click();assert not page.locator('#salary-config').is_visible()
    page.locator('#edit-salary').click();assert page.locator('#salary-second').input_value()=='725,43'
    page.locator('#salary-first-day').fill('1.5');page.locator('#salary-config').evaluate('f=>f.requestSubmit()')
    assert page.locator('#salary-config-error').is_visible() and page.locator('#salary-second').input_value()=='725,43'
    page.locator('#salary-first-day').fill('5');page.locator('#salary-config').evaluate('f=>f.requestSubmit()')
    page.locator('#open-settings').click()
    page.get_by_role('button',name='Excluir etiqueta Empresa @ Ação_01, mensal',exact=True).click()
    page.locator('#transfer-option').select_option(labels[1]);page.locator('#confirm-ok').click()
    assert page.evaluate('currentRecords().find(r=>r.type==="income").labelIds.length')==1
    assert page.evaluate('financeFor().incomeReceived')==1000
    page.get_by_role('button',name='Parar recorrência',exact=True).click();page.locator('#confirm-ok').click();page.locator('#close-settings').click()
    page.locator('#period-month').select_option('12');assert page.evaluate('currentRecords().length')==0
    # Migration keeps legacy IDs, one-label associations and customized salary values.
    legacy=page.evaluate('JSON.parse(JSON.stringify(state))')
    legacy.pop('nextSequence');legacy.pop('salaryConfigured');legacy['recurrences']=[]
    for rows in legacy['invoices'].values():
        for record in rows: record.pop('sequenceId',None);record.pop('labelIds',None);record['recurrenceId']=None
    page.evaluate('data=>localStorage.setItem("v3go.invoice.v5",JSON.stringify(data))',legacy);page.reload()
    assert page.evaluate('state.salaryDefaults.second.cents')==72543
    assert page.evaluate('Object.values(state.invoices).flat().every(r=>r.labelIds.length === (r.labelId ? 1 : 0))')
    numbers=page.evaluate('Object.values(state.invoices).flat().map(r=>r.sequenceId)');assert len(numbers)==len(set(numbers))
    stored=context.storage_state()
    mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='pt-BR',storage_state=stored)
    touch=mobile.new_page();touch.on('pageerror',lambda error:errors.append(str(error)));touch.goto(url)
    touch.locator('#open-settings').tap();assert touch.locator('#settings-dialog').is_visible()
    assert touch.evaluate('document.documentElement.scrollWidth<=innerWidth')
    touch.locator('#close-settings').tap();touch.locator('#add-record').tap()
    touch.locator('#record-label input').first.check();assert touch.locator('#record-label input').first.is_checked()
    touch.screenshot(path='/tmp/v3go-new-form-mobile.png')
    assert not errors,errors
    mobile.close();context.close();browser.close()
server.shutdown();server.server_close()
print('PASS: settings modal/Esc/backdrop, unique IDs and sorting, filters preserved, multi-label migration/deletion, scoped category hover, historical receipt warning, salary collapse/custom defaults, monthly recurrence/idempotence/stop, text safety and validation, mobile touch')
