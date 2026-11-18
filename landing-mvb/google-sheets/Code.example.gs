const SPREADSHEET_ID = 'COLE_O_ID_DA_PLANILHA';
const HEADERS = ['Data e hora','Nome','WhatsApp','Cidade','Ambientes','Quando pretende iniciar','Orçamento','ID do envio'];
const BUDGETS = ['R$ 5.000 a R$ 10.000','R$ 10.000 a R$ 20.000','R$ 20.000 a R$ 30.000','Acima de R$ 30.000'];
const START_DATES = ['Assim que possível','Em até 3 meses','Entre 3 e 6 meses','Daqui a mais de 6 meses','Ainda não defini'];
function prepararPlanilha() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
  if (sheet.getSheetId() !== 0) throw new Error('Aba de destino divergente.');
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  const actualHeaders = sheet.getRange(1,1,1,HEADERS.length).getValues()[0];
  if (JSON.stringify(actualHeaders) !== JSON.stringify(HEADERS)) throw new Error('Os cabeçalhos da aba não correspondem ao formulário.');
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,HEADERS.length).setBackground('#f0f0f0').setFontWeight('bold').setWrap(true);
  sheet.setColumnWidths(1,4,165);
  sheet.setColumnWidths(5,3,220);
  sheet.hideColumns(8);
  if (!sheet.getFilter()) sheet.getRange(1,1,sheet.getMaxRows(),8).createFilter();
  return sheet;
}
function doPost(event) {
  let payload = {};
  let ok = false;
  try {
    const body = event && event.parameter && event.parameter.payload;
    if (!body || body.length > 10000) throw new Error('Pedido inválido.');
    payload = JSON.parse(body);
    validateLead(payload);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('Tente novamente.');
    try {
      const sheet = prepararPlanilha();
      const lastRow = sheet.getLastRow();
      const existing = lastRow > 1 && sheet.getRange(2,8,lastRow-1,1).createTextFinder(payload.requestId).matchEntireCell(true).findNext();
      if (!existing) {
        sheet.getRange(lastRow+1,1,1,8).setValues([[
          Utilities.formatDate(new Date(),'America/Sao_Paulo','dd/MM/yyyy HH:mm:ss'),
          safeCell(payload.nome),safeCell(payload.whatsapp),safeCell(payload.cidade),safeCell(payload.ambientes),
          payload.prazo,payload.orcamento,payload.requestId
        ]]);
        SpreadsheetApp.flush();
      }
      ok = true;
    } finally { lock.releaseLock(); }
  } catch (error) { console.error('Não foi possível registrar o formulário.'); }
  return receipt(payload,ok);
}
function validateLead(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(payload.requestId) || payload.website) throw new Error('Pedido inválido.');
  const limits = {nome:120,whatsapp:40,cidade:120,ambientes:2000};
  for (const key in limits) {
    if (typeof payload[key] !== 'string' || !payload[key].trim() || payload[key].length > limits[key]) throw new Error('Campo inválido.');
  }
  if (!BUDGETS.includes(payload.orcamento) || !START_DATES.includes(payload.prazo)) throw new Error('Opção inválida.');
}
function safeCell(value) {
  const text = value.trim();
  return /^[=+\-@\t\r]/.test(text) ? "'"+text : text;
}
function receipt(payload,ok) {
  payload = payload && typeof payload === 'object' ? payload : {};
  const origin = typeof payload.origin === 'string' ? payload.origin : '';
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return HtmlService.createHtmlOutput('Pedido inválido.');
  const message = JSON.stringify({type:'mvb-lead-receipt',requestId:payload.requestId,ok:ok}).replace(/</g,String.fromCharCode(92)+'u003c');
  const target = JSON.stringify(origin).replace(/</g,String.fromCharCode(92)+'u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage('+message+','+target+');</script></body></html>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
