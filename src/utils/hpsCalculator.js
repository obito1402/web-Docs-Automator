const normalizeText = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const parseAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const digits = String(value ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const normalized = digits.replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

const findColumn = (headers, patterns) => headers.findIndex((header) => {
  const normalized = normalizeText(header);
  return patterns.some((pattern) => normalized.includes(pattern));
});

const findColumns = (headers, predicate) => headers.reduce((indexes, header, index) => {
  if (predicate(normalizeText(header))) indexes.push(index);
  return indexes;
}, []);

const parseRowAmount = (row, indexes) => indexes.reduce((largest, index) => {
  const amount = parseAmount(row[index]);
  return amount > largest ? amount : largest;
}, 0);

export const getRpdColumnMap = (headers) => ({
  name: findColumn(headers, ['nama barang', 'nama bahan', 'spesifikasi']),
  specification: findColumn(headers, ['spesifikasi teknis', 'spesifikasi']),
  quantity: findColumn(headers, ['jumlah', 'volume']),
  unit: findColumn(headers, ['satuan']),
  price: findColumn(headers, ['perkiraan harga satuan', 'harga satuan', 'harga referensi']),
  shipping: findColumn(headers, ['ongkir', 'ongkos kirim', 'biaya kirim']),
  vendorPrice: findColumn(headers, ['harga vendor', 'harga penawaran', 'quotation']),
  vendorTotal: findColumns(headers, (header) => (
    header.includes('harga total')
    || header.includes('total dengan ppn')
    || header.includes('jumlah harga')
    || header.startsWith('ppn')
  )),
  source: findColumn(headers, ['link referensi', 'link pembelian', 'vendor']),
});

export const buildDraftHpsRows = (parsed, factor = 1.2, overrides = {}) => {
  if (!parsed || parsed.type !== 'structured' || parsed.headerRowIndex < 0) return [];

  const headers = parsed.allRows[parsed.headerRowIndex] || [];
  const columnMap = getRpdColumnMap(headers);
  const rows = [];

  for (let rowIndex = parsed.dataStartRow; rowIndex < parsed.dataEndRow; rowIndex += 1) {
    const row = parsed.allRows[rowIndex] || [];
    const name = row[columnMap.name] || '';
    const specification = row[columnMap.specification] || name;
    const quantity = parseAmount(row[columnMap.quantity]);
    const sourcePrice = parseAmount(row[columnMap.price]);
    const shipping = parseAmount(row[columnMap.shipping]);
    const vendorPrice = parseAmount(row[columnMap.vendorPrice]);
    const source = String(row[columnMap.source] || '');
    const isInaprocSource = /(?:^|:\/\/|www\.)inaproc\.id(?:\/|$)/i.test(source);
    const isVendorSource = isInaprocSource || /quotation|surat penawaran|invoice|vendor|penyedia/i.test(source);
    const override = overrides[rowIndex + 1] || {};
    const detectedVendorTotal = parseRowAmount(row, columnMap.vendorTotal);
    const hasData = name || specification || quantity || sourcePrice || vendorPrice || detectedVendorTotal;

    if (!hasData) continue;
    if (/^\(\d+\)$/.test(String(name).trim())) continue;

    const checkedPrice = parseAmount(override.checkedPrice);
    const checkedShipping = parseAmount(override.shipping);
    const effectiveSourcePrice = checkedPrice || sourcePrice;
    const effectiveShipping = override.shipping !== undefined ? checkedShipping : shipping;
    const directVendorPrice = detectedVendorTotal || vendorPrice || sourcePrice;
    const pricingMode = override.pricingMode || (isVendorSource ? 'vendor' : 'factor');
    const usesVendorPrice = pricingMode === 'vendor';
    const vendorAmount = usesVendorPrice ? (checkedPrice || directVendorPrice) : 0;
    const basePrice = usesVendorPrice ? vendorAmount : effectiveSourcePrice + effectiveShipping;
    const selectedFactor = pricingMode === 'factor-1.7' ? 1.7 : factor;
    const unitPrice = usesVendorPrice ? vendorAmount : basePrice * selectedFactor;
    const directPriceIsTotal = usesVendorPrice && (detectedVendorTotal > 0 || checkedPrice > 0);

    rows.push({
      rowNumber: rowIndex + 1,
      name: String(name || specification),
      specification: String(specification),
      quantity,
      unit: String(row[columnMap.unit] || ''),
      sourcePrice: effectiveSourcePrice,
      shipping: effectiveShipping,
      vendorPrice,
      sourceType: isInaprocSource ? 'INAPROC' : isVendorSource ? 'Vendor' : 'E-commerce',
      source,
      pricingMode,
      pricingMethod: usesVendorPrice ? 'Harga vendor langsung' : `Harga barang + ongkir x ${selectedFactor}`,
      unitPrice,
      totalPrice: directPriceIsTotal ? vendorAmount : unitPrice * quantity,
      warnings: [
        quantity <= 0 ? 'Jumlah belum valid' : '',
        basePrice <= 0 ? 'Harga belum tersedia' : '',
        !row[columnMap.source] ? 'Link/vendor belum tersedia' : '',
      ].filter(Boolean),
    });
  }

  return rows;
};

export const exportDraftHps = async (filesData, factor = 1.2, overridesByFile = {}) => {
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set();
  let exportedSheets = 0;

  const getSheetName = (name) => {
    const base = String(name || 'Draft HPS').replace(/[\\/*?[\]:]/g, '').slice(0, 31) || 'Draft HPS';
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `${base.slice(0, 31 - String(suffix).length - 3)} (${suffix})`;
      suffix += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };

  filesData.forEach(({ parsed }, fileIndex) => {
    const rows = buildDraftHpsRows(parsed, factor, overridesByFile[fileIndex] || {});
    if (rows.length === 0) return;

    const worksheet = workbook.addWorksheet(getSheetName(parsed.researcherName || parsed.sheetName));
    exportedSheets += 1;
    const total = rows.reduce((sum, row) => sum + row.totalPrice, 0);

    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'DRAFT HARGA PERKIRAAN SENDIRI';
    worksheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F2854' } };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = 'Belum diverifikasi oleh admin';
    worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF9C0006' } };
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.getRow(4).values = [
      'No', 'Spesifikasi', 'Jumlah', 'Satuan', 'Jenis Sumber', 'Harga Referensi',
      'Ongkir', 'Metode Harga', 'Harga Satuan HPS', 'Jumlah HPS', 'Link/Vendor',
    ];
    const header = worksheet.getRow(4);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F5A85' } };
    header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    rows.forEach((row, index) => {
      worksheet.addRow([
        index + 1,
        row.specification || row.name,
        row.quantity,
        row.unit,
        row.sourceType,
        row.pricingMode === 'vendor' ? row.unitPrice : row.sourcePrice,
        row.shipping,
        row.pricingMethod,
        row.unitPrice,
        row.totalPrice,
        row.source,
      ]);
    });

    const totalRow = worksheet.addRow(['', '', '', '', '', '', '', 'Total Draft HPS', '', total, '']);
    totalRow.font = { bold: true };
    totalRow.getCell(8).alignment = { horizontal: 'right' };

    worksheet.columns = [
      { width: 8 }, { width: 48 }, { width: 12 }, { width: 12 }, { width: 16 }, { width: 18 },
      { width: 15 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 42 },
    ];
    worksheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn(11).alignment = { wrapText: true, vertical: 'top' };
    worksheet.getColumn(6).numFmt = '#,##0';
    worksheet.getColumn(7).numFmt = '#,##0';
    worksheet.getColumn(9).numFmt = '#,##0';
    worksheet.getColumn(10).numFmt = '#,##0';
    worksheet.views = [{ state: 'frozen', ySplit: 4 }];
    worksheet.autoFilter = { from: 'A4', to: 'K4' };
  });

  if (exportedSheets === 0) {
    throw new Error('Tidak ada data RPD yang dapat dibuat menjadi Draft HPS.');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `Draft_HPS_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
