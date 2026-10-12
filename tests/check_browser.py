from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import shutil
import threading
import atexit
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self, *_): pass

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root / 'v3go web')))
threading.Thread(target=server.serve_forever, daemon=True).start()
atexit.register(server.server_close)
atexit.register(server.shutdown)
BASE = f'http://127.0.0.1:{server.server_port}/index.html' 

def total(q): return q.evaluate('InvoiceMath.calculate(currentRecords(),state.categories).total')
def period(q,month,year=2026):
 q.locator('#period-year').fill(str(year));q.locator('#period-year').dispatch_event('change')
 q.locator('#period-month').select_option(f'{month:02d}')
def add(q,desc,value,category=None,label=None):
 q.locator('#add-record').click();q.locator('#description').fill(desc);q.locator('#value').fill(value)
 if category is not None:q.locator('#group').select_option(category)
 if label is not None:q.locator('#record-label').select_option(label)
 q.get_by_role('button',name='Salvar lançamento',exact=True).click()
def create_option(q,name,type='category',inline=False):
 q.locator('#create-'+type if inline else '#manage-add-'+type).click()
 q.locator('#option-name').fill(name);q.get_by_role('button',name='Salvar opção',exact=True).click()
 return q.evaluate(f'state.{"categories" if type=="category" else "labels"}.find(x=>x.name==={json.dumps(name)}).id')
def rename(q,name,new,type='categoria'):
 q.get_by_role('button',name=f'Renomear {type} {name}',exact=True).click()
 q.locator('#option-name').fill(new);q.get_by_role('button',name='Salvar opção',exact=True).click()
def delete(q,name,target='',type='categoria'):
 q.get_by_role('button',name=f'Excluir {type} {name}',exact=True).click()
 if q.locator('#transfer-field').is_visible():q.locator('#transfer-option').select_option(target)
 q.locator('#confirm-ok').click()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 context=b.new_context(viewport={'width':1440,'height':1050},timezone_id='America/Sao_Paulo')
 q=context.new_page();errors=[];q.on('pageerror',lambda e:errors.append(str(e)))
 q.goto(BASE)
 assert q.evaluate('state.period')=='2026-10'
 assert total(q)==65221 and q.locator('#records tr').count()==33
 assert q.evaluate('state.dueDay')==5
 assert q.evaluate('InvoiceMath.sum([{cents:10},{cents:20}])')==30
 assert q.evaluate('currency(9007199254740991)')=='R$\xa090.071.992.547.409,91'
 assert q.evaluate('decimalInput(9007199254740991)')=='90071992547409,91'
 assert q.evaluate('InvoiceMath.parseMoney("90071992547409,91")')==9007199254740991
 for m in (1,6,9,11,12):
  period(q,m);assert total(q)==0;assert q.locator('#records tr').count()==0
  assert q.locator('.category-summary').count()==3
  assert q.locator('#category-tabs').get_by_role('button',name='Moisés',exact=True).count()==1
 period(q,10,2027);assert total(q)==0
 print('PASS: base only in October 2026; five other months and October 2027 empty, settings preserved')
 period(q,11)
 add(q,'Novembro somente','0,10')
 assert total(q)==10
 period(q,10);assert total(q)==65221
 period(q,11)
 q.locator('#records tr').first.locator('[data-action=edit]').click()
 q.locator('#value').fill('0,30');q.get_by_role('button',name='Salvar lançamento',exact=True).click()
 assert total(q)==30
 period(q,10);assert total(q)==65221
 period(q,11)
 q.locator('#records tr').first.locator('[data-action=delete]').click();q.locator('#confirm-cancel').click();assert total(q)==30
 q.locator('#records tr').first.locator('[data-action=delete]').click();q.locator('#confirm-ok').click();assert total(q)==0
 period(q,10);assert total(q)==65221
 print('PASS: add/edit/delete are isolated to selected month; cancellation preserves record')
 # Nested category creation preserves fields and auto-selects new option.
 period(q,11)
 q.locator('#add-record').click();q.locator('#description').fill('Viagem teste');q.locator('#value').fill('12,34')
 cat=create_option(q,'Viagem',inline=True)
 assert q.locator('#group').input_value()==cat
 assert q.locator('#description').input_value()=='Viagem teste'
 assert q.locator('#value').input_value()=='12,34'
 label=create_option(q,'Pessoal',type='label',inline=True)
 assert q.locator('#record-label').input_value()==label
 q.get_by_role('button',name='Salvar lançamento',exact=True).click();assert total(q)==1234
 q.locator('#manage-add-category').click()
 q.get_by_role('button',name='Salvar opção',exact=True).click();assert q.locator('#option-error').is_visible()
 q.locator('#option-name').fill('  vIaGeM  ');q.get_by_role('button',name='Salvar opção',exact=True).click()
 assert 'Já existe' in q.locator('#option-error').inner_text();q.locator('#option-cancel').click()
 period(q,10);add(q,'Viagem outubro','1,00',cat,label);assert total(q)==65321
 period(q,12);assert total(q)==0
 assert q.locator('#category-tabs').get_by_role('button',name='Viagem',exact=True).count()==1
 rename(q,'Viagem','Passeios');rename(q,'Pessoal','Casa',type='etiqueta')
 period(q,11);assert q.locator('#records').get_by_text('Passeios',exact=True).count()==1
 assert q.locator('#records').get_by_text('Casa',exact=True).count()==1
 assert q.locator('#label-filter').select_option(label)
 assert q.locator('#records tr').count()==1
 print('PASS: inline categories/labels, auto-selection, form preservation, blank/duplicate validation, global rename and label filter')
 # Delete custom category transferring across all months, then remove label links.
 q.get_by_role('button',name='Excluir categoria Passeios',exact=True).click();q.locator('#confirm-cancel').click()
 assert q.locator('#records').get_by_text('Passeios',exact=True).count()==1
 delete(q,'Passeios',target='flexible')
 assert total(q)==1234
 assert q.evaluate('currentRecords()[0].categoryId')=='flexible'
 period(q,10);assert total(q)==65321
 assert q.evaluate('currentRecords().at(-1).categoryId')=='flexible'
 q.locator('#manage-add-label').click();q.locator('#option-name').fill('  cAsA  ')
 q.get_by_role('button',name='Salvar opção',exact=True).click();assert 'Já existe' in q.locator('#option-error').inner_text()
 q.locator('#option-cancel').click()
 replacement=create_option(q,'Trabalho',type='label')
 delete(q,'Casa',target=replacement,type='etiqueta')
 assert q.evaluate('Object.values(state.invoices).flat().filter(r=>r.labelId!==null).every(r=>r.labelId==="'+replacement+'")')
 delete(q,'Trabalho',type='etiqueta')
 assert q.evaluate('Object.values(state.invoices).flat().every(r=>r.labelId===null)')
 # Delete seed category without transfer, preserves original values.
 delete(q,'Moisés')
 assert total(q)==65321
 assert q.evaluate('currentRecords().filter(r=>r.categoryId===null).length')==5
 q.locator('#category-tabs').get_by_role('button',name='Sem categoria',exact=True).click()
 assert q.locator('#records tr').count()==5
 assert q.locator('#filtered-total').inner_text()=='R$\xa0157,49'
 q.get_by_role('button',name='Renomear categoria Flexíveis',exact=True).click();q.locator('#option-name').fill(' Fixos ')
 q.get_by_role('button',name='Salvar opção',exact=True).click();assert 'Já existe' in q.locator('#option-error').inner_text()
 q.locator('#option-cancel').click()
 rename(q,'Flexíveis','Variáveis')
 assert q.locator('#category-tabs').get_by_role('button',name='Variáveis',exact=True).count()==1
 q.reload();assert total(q)==65321
 assert q.evaluate('state.categories.some(c=>c.name==="Variáveis")')
 period(q,11);assert total(q)==1234
 assert q.locator('#records').get_by_text('Variáveis',exact=True).count()==1
 print('PASS: cross-month category transfer, label unassignment, seed category deletion/rename, preserved totals and reload')
 # Calendar: before, on, after; clamp month end, leap year, January and DST.
 cases=[('2026-10',5,[2026,9,1],4,'near'),('2026-10',5,[2026,9,5],0,'today'),('2026-10',5,[2026,9,8],-3,'past'),('2026-10',5,[2026,8,5],30,'distant'),('2026-02',31,[2026,1,20],8,'distant'),('2028-02',31,[2028,1,29],0,'today'),('2027-01',5,[2026,11,31],5,'near'),('2026-03',5,[2026,2,1],4,'near')]
 for per,day,today,remaining,status in cases:
  d=q.evaluate('''([period,day,parts])=>{const x=DueCalendar.calculate(period,day,new Date(...parts));return {...x,due:[x.due.getFullYear(),x.due.getMonth(),x.due.getDate()],previous:[x.previous.getFullYear(),x.previous.getMonth(),x.previous.getDate()]}}''',[per,day,today])
  assert d['remaining']==remaining and d['status']==status,d
  assert 0<=d['progress']<=100
  if remaining<=0:assert d['progress']==100
  if per=='2026-02':assert d['due']==[2026,1,28] and d['previous']==[2026,0,31]
 assert q.evaluate('DueCalendar.calculate("2026-10",5,new Date(2026,9,1)).progress')>q.evaluate('DueCalendar.calculate("2026-10",5,new Date(2026,8,15)).progress')
 q.locator('#due-day').fill('32');q.get_by_role('button',name='Salvar vencimento',exact=True).click();assert q.locator('#due-error').is_visible()
 q.locator('#due-day').fill('31');q.get_by_role('button',name='Salvar vencimento',exact=True).click()
 period(q,2);assert q.locator('#due-date').inner_text()=='28/02/2026'
 q.reload();assert q.locator('#due-day').input_value()=='31'
 assert q.locator('#due-date').inner_text()=='28/02/2026'
 # Control the actual UI clock as well as pure calculation.
 q.clock.install(time=__import__('datetime').datetime(2026,10,5,15))
 period(q,10);q.locator('#due-day').fill('5');q.get_by_role('button',name='Salvar vencimento',exact=True).click()
 assert q.locator('#due-message').inner_text()=='Vence hoje'
 assert q.locator('#due-progress').get_attribute('aria-valuenow')=='100'
 q.clock.set_system_time(__import__('datetime').datetime(2026,10,8,15));q.evaluate('renderDue()')
 assert q.locator('#due-message').inner_text()=='Vencimento há 3 dias'
 q.clock.set_system_time(__import__('datetime').datetime(2026,10,1,15));q.evaluate('renderDue()')
 assert q.locator('#due-message').inner_text()=='Faltam 4 dias'
 print('PASS: calendar before/on/after due date, progress, month-end clamp, leap year, January, global day preference, actual UI clock')
 # Restore only October, not November. Does not undo global names/settings.
 q.locator('#restore-source').click();q.locator('#confirm-ok').click();assert total(q)==65221
 assert q.evaluate('state.categories.some(c=>c.name==="Variáveis")')
 period(q,11);assert total(q)==1234
 # Mobile screenshot and controls.
 q.set_viewport_size({'width':390,'height':844})
 assert q.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 q.locator('#add-record').click();assert q.locator('#record-dialog').is_visible()
 q.locator('#create-category').click();q.locator('#option-name').fill('Celular');q.get_by_role('button',name='Salvar opção',exact=True).click()
 assert q.locator('#record-dialog').is_visible()
 assert q.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 q.keyboard.press('Escape');assert not q.locator('#record-dialog').is_visible()
 q.set_viewport_size({'width':1440,'height':1050});period(q,10)
 q.locator('#clear-data').click();q.locator('#confirm-cancel').click();assert total(q)==65221
 q.locator('#clear-data').click();q.locator('#confirm-ok').click();q.reload()
 assert total(q)==0
 period(q,11);assert total(q)==0
 assert q.evaluate('state.categories.some(c=>c.name==="Celular")')
 print('PASS: restore October only, mobile dialogs/layout, clear all months preserves global settings and persists')
 # Removing every seed category still preserves all records and permits unassigned entries.
 fresh=b.new_context(viewport={'width':390,'height':844},timezone_id='America/Sao_Paulo')
 other=fresh.new_page();other.goto(BASE)
 for name in ['Fixos','Flexíveis','Moisés']:delete(other,name)
 assert total(other)==65221 and other.locator('#records tr').count()==33
 assert other.evaluate('currentRecords().every(r=>r.categoryId===null)')
 other.reload();assert total(other)==65221 and other.evaluate('state.categories.length')==0
 add(other,'Sem classificação','0,20',category='')
 assert total(other)==65241
 assert other.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
 # Simulate unavailable writes and preserve in-session data while showing the warning.
 other.evaluate('() => {Storage.prototype.setItem=function(){throw new DOMException("quota", "QuotaExceededError")}}')
 add(other,'Somente na sessão','0,10',category='')
 assert total(other)==65251 and other.locator('#storage-warning').is_visible()
 fresh.close()
 print('PASS: removal of all categories preserves records, unassigned entries work, unavailable storage is reported')
 # Legacy migration modified under an arbitrary old period.
 legacy={'version':1,'period':'2027-02','records':[{'id':'user-1','description':'Minha edição','group':'flexible','cents':12345},{'id':'user-2','description':'Pendente','group':'moises','cents':None}]}
 q.evaluate('([key,data])=>{localStorage.removeItem("v3go.invoice.v2");localStorage.setItem(key,JSON.stringify(data))}', ['v3go.invoice.v1',legacy]);q.reload()
 assert q.evaluate('state.period')=='2026-10' and total(q)==12345
 assert q.locator('#records tr').count()==2
 assert json.loads(q.evaluate('localStorage.getItem("v3go.invoice.v1")'))==legacy
 period(q,2,2027);assert total(q)==0
 q.reload();assert total(q)==0
 period(q,10);assert total(q)==12345
 # Empty old state must stay empty.
 legacy['records']=[]
 q.evaluate('data=>{localStorage.removeItem("v3go.invoice.v2");localStorage.setItem("v3go.invoice.v1",JSON.stringify(data))}',legacy);q.reload();assert total(q)==0
 print('PASS: legacy migration preserves edits and blanks, ignores old period, retains legacy backup, no repeated migration, preserves intentionally empty base')
 q.evaluate('localStorage.setItem("v3go.invoice.v2","bad-json")');q.reload()
 assert q.locator('#storage-warning').is_visible()
 assert q.evaluate('localStorage.getItem("v3go.invoice.v2")')=='bad-json'
 q.locator('#restore-source').click();q.locator('#confirm-ok').click();assert total(q)==65221
 assert not q.locator('#storage-warning').is_visible()
 assert not errors,errors
 print('PASS: invalid saved data protected until confirmed reset; no JavaScript runtime errors')
 b.close()
