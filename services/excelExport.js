const ExcelJS = require('exceljs');

function safeCell(value) {
    if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
    return value ?? '';
}

async function createWorkbookBuffer(sheets) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DataXtract Mini';
    for (const { name, rows, headers } of sheets) {
        if (!rows.length && !headers?.length) continue;
        const worksheet = workbook.addWorksheet(name);
        const keys = headers?.length ? headers : Object.keys(rows[0] || {});
        worksheet.columns = keys.map(key => ({ header: key, key, width: Math.min(50, Math.max(14, key.length + 2)) }));
        worksheet.addRows(rows.map(row => Object.fromEntries(keys.map(key => [key, safeCell(row[key])]))));
        worksheet.getRow(1).font = { bold: true };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = { createWorkbookBuffer };
