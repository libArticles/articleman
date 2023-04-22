// @ts-ignore
global.onOpen = function onOpen() {
  // start the user interface as a dialog in google sheets
  let sheet = SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.getUi()
  .createMenu('Articleman')
    .addItem('Open Articleman...', 'showSidebar')
    .addItem('Open help...', 'showHelp')
    .addToUi();
}

// @ts-ignore
global.onSelectionChange = () => {
  const sheet = SpreadsheetApp.getActiveSheet();
  const row = sheet.getActiveCell().getRow();
  const column = sheet.getActiveCell().getColumn();
  const cache = CacheService.getUserCache();
  cache.put('currentRow', JSON.stringify({
    row: row,
    column: column,
    sheet: sheet.getName(),
  }), 21600);
}

// @ts-ignore
global.showSidebar = () => {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('frontend').setTitle('Articleman'));

}

// @ts-ignore
global.showHelp = () => {
  CacheService.getUserCache().put('help', 'true', 20); // @ts-ignore
  global.showSidebar();
}