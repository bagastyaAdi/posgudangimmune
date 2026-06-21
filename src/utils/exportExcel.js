import * as XLSX from 'xlsx-js-style';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

const rp = (n) => Number(n || 0).toLocaleString('id-ID');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd MMMM yyyy', { locale: id });
  } catch (e) {
    return dateStr;
  }
};

// Helper to check if date is valid
const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

// Helper to trigger download in browser
const saveAs = (buffer, filename) => {
  try {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("saveAs error:", err);
  }
};

// Styling Constants
const BORDER_ALL = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' }
};

const STYLE_HEADER = {
  fill: { fgColor: { rgb: "EFEFEF" } }, // Light gray
  font: { bold: true },
  border: BORDER_ALL,
  alignment: { horizontal: 'center', vertical: 'center' }
};

const STYLE_DEFAULT = {
  border: BORDER_ALL,
  alignment: { vertical: 'center' }
};

const STYLE_BOLD = {
  font: { bold: true },
  border: BORDER_ALL,
  alignment: { vertical: 'center' }
};

// Internal Helper to create the Sales Table structure
const createSalesSheetData = (data, branchName, isConsolidated = false) => {
  const wsData = [];

  const shiftLabel = isConsolidated ? 'Gabungan' : `Shift ${data.shift || '-'}`;

  // Identitas Header
  wsData.push([
    { v: 'Outlet', s: STYLE_BOLD }, { v: branchName, s: STYLE_DEFAULT },
    { v: 'Jam Kerja', s: STYLE_BOLD }, { v: shiftLabel, s: STYLE_DEFAULT }
  ]);
  wsData.push([
    { v: 'Tanggal', s: STYLE_BOLD }, { v: formatDate(data.date), s: STYLE_DEFAULT },
    { v: 'Petugas', s: STYLE_BOLD }, { v: data.staffName || '-', s: STYLE_DEFAULT }
  ]);
  wsData.push([]); // Spacer

  // Table Headers
  wsData.push([
    { v: 'No', s: STYLE_HEADER }, { v: 'Nama Produk', s: STYLE_HEADER },
    { v: 'Ori', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Premi', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Nama Produk', s: STYLE_HEADER },
    { v: 'Ori', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Premi', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }
  ]);
  wsData.push([
    { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Jumlah', s: STYLE_HEADER }, { v: 'Total', s: STYLE_HEADER },
    { v: 'Jumlah', s: STYLE_HEADER }, { v: 'Total', s: STYLE_HEADER },
    { v: '', s: STYLE_HEADER },
    { v: 'Jumlah', s: STYLE_HEADER }, { v: 'Total', s: STYLE_HEADER },
    { v: 'Jumlah', s: STYLE_HEADER }, { v: 'Total', s: STYLE_HEADER }
  ]);

  // Grouping for the 2-column layout
  const grouped = {};
  (data.products || []).forEach(prod => {
    if (!grouped[prod.name]) grouped[prod.name] = { name: prod.name, category: prod.category || 'Lainnya' };
    const variant = (prod.variant || 'Standar').toLowerCase();
    // Default to 'ori' for everything that isn't explicitly 'premi'
    const targetKey = variant.includes('premi') ? 'premi' : 'ori';

    if (grouped[prod.name][targetKey]) {
      grouped[prod.name][targetKey].qty += (parseInt(prod.qty) || 0);
    } else {
      grouped[prod.name][targetKey] = { ...prod, qty: parseInt(prod.qty) || 0 };
    }
  });

  // Split into left and right based on display_order
  const leftSide = [];
  const rightSide = [];

  Object.values(grouped).forEach(item => {
    // If the item (or its variants) has display_order <= 22, put it on the left
    const minOrder = Math.min(
      item.ori?.display_order || 999,
      item.premi?.display_order || 999
    );

    if (minOrder <= 22) {
      leftSide.push(item);
    } else {
      rightSide.push(item);
    }
  });

  // Sort each side by display_order just to be extra sure
  const sortByOrder = (a, b) => {
    const orderA = Math.min(a.ori?.display_order || 999, a.premi?.display_order || 999);
    const orderB = Math.min(b.ori?.display_order || 999, b.premi?.display_order || 999);
    return orderA - orderB;
  };
  leftSide.sort(sortByOrder);
  rightSide.sort(sortByOrder);

  let totalCups = 0;
  let totalSalesRp = 0;

  // Render at least 22 rows to match the look
  const rowCount = Math.max(leftSide.length, 22);

  for (let i = 0; i < rowCount; i++) {
    const left = leftSide[i];
    const right = rightSide[i];
    const row = [];

    // Left Side
    if (left) {
      row.push({ v: i + 1, s: STYLE_DEFAULT });
      row.push({ v: left.name, s: STYLE_DEFAULT });

      const lOri = left.ori?.qty || 0;
      const lOriP = left.ori ? (left.ori.price || 0) * lOri : 0;
      row.push({ v: lOri > 0 ? lOri : '', s: STYLE_DEFAULT }); row.push({ v: lOriP > 0 ? rp(lOriP) : '', s: STYLE_DEFAULT });

      const lPremi = left.premi?.qty || 0;
      const lPremiP = left.premi ? (left.premi.price || 0) * lPremi : 0;
      row.push({ v: lPremi > 0 ? lPremi : '', s: STYLE_DEFAULT }); row.push({ v: lPremiP > 0 ? rp(lPremiP) : '', s: STYLE_DEFAULT });

      // Topping tidak dihitung sebagai cup
      if (left.category !== 'Topping') totalCups += (lOri + lPremi);
      totalSalesRp += (lOriP + lPremiP);
    } else {
      row.push({ v: i + 1, s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT });
    }

    // Right Side
    if (right) {
      row.push({ v: right.name, s: STYLE_DEFAULT });
      const rOri = right.ori?.qty || 0;
      const rOriP = right.ori ? (right.ori.price || 0) * rOri : 0;
      row.push({ v: rOri > 0 ? rOri : '', s: STYLE_DEFAULT }); row.push({ v: rOriP > 0 ? rp(rOriP) : '', s: STYLE_DEFAULT });

      const rPremi = right.premi?.qty || 0;
      const rPremiP = right.premi ? (right.premi.price || 0) * rPremi : 0;
      row.push({ v: rPremi > 0 ? rPremi : '', s: STYLE_DEFAULT }); row.push({ v: rPremiP > 0 ? rp(rPremiP) : '', s: STYLE_DEFAULT });

      // Topping tidak dihitung sebagai cup
      if (right.category !== 'Topping') totalCups += (rOri + rPremi);
      totalSalesRp += (rOriP + rPremiP);
    } else {
      row.push({ v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT });
    }
    wsData.push(row);
  }

  wsData.push([]); // Empty row 

  // EXPENSES
  let totalExpenses = 0;
  const expenseRows = [];
  (data.expenses || []).forEach(exp => {
    const amount = parseInt(exp.amount) || 0;
    if (amount > 0) {
      totalExpenses += amount;
      expenseRows.push([exp.name, amount]);
    }
  });

  // PENGELUARAN row
  wsData.push([
    { v: '', s: STYLE_DEFAULT }, 
    { v: 'PENGELUARAN', s: STYLE_BOLD }, 
    { v: 'TOTAL', s: STYLE_BOLD }, 
    { v: rp(totalSalesRp), s: STYLE_DEFAULT },
    { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
  ]);

  expenseRows.forEach(exp => {
    wsData.push([
      { v: '', s: STYLE_DEFAULT }, 
      { v: exp[0], s: STYLE_DEFAULT }, 
      { v: '', s: STYLE_DEFAULT }, 
      { v: rp(exp[1]), s: STYLE_DEFAULT },
      { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
    ]);
  });

  if (expenseRows.length === 0) {
    wsData.push([]); // empty row if no expenses, to space things out
  }

  wsData.push([
    { v: '', s: STYLE_DEFAULT }, 
    { v: '', s: STYLE_DEFAULT }, 
    { v: 'TOTAL CUP', s: STYLE_BOLD }, 
    { v: totalCups, s: STYLE_DEFAULT },
    { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
  ]);
  
  wsData.push([
    { v: '', s: STYLE_DEFAULT }, 
    { v: '', s: STYLE_DEFAULT }, 
    { v: 'Cash Awal', s: STYLE_BOLD }, 
    { v: rp(data.cashAwal), s: STYLE_DEFAULT },
    { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // No
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nama Produk L
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }, // Ori L
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } }, // Premi L
    { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // Nama Produk R
    { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, // Ori R
    { s: { r: 0, c: 9 }, e: { r: 0, c: 10 } } // Premi R
  ];

  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 7 }, { wch: 10 }, { wch: 7 }, { wch: 10 },
    { wch: 22 }, { wch: 7 }, { wch: 10 }, { wch: 7 }, { wch: 10 }
  ];

  return ws;
};

// Internal Helper to create the Detailed Consolidated Stock Form (22 Columns)
const createDetailedStockSheetData = (data, branchName) => {
  const wsData = [];

  // Metadata Headers
  wsData.push([
    { v: 'FORM STOK BARANG', s: STYLE_HEADER }, 
    ...Array(21).fill({ v: '', s: STYLE_HEADER })
  ]);
  
  wsData.push([
    { v: 'Tanggal', s: STYLE_BOLD }, { v: format(new Date(data.date || new Date()), 'dd MMMM yyyy', { locale: id }), s: STYLE_DEFAULT },
    { v: 'Outlet', s: STYLE_BOLD }, { v: branchName, s: STYLE_DEFAULT },
    { v: 'Petugas', s: STYLE_BOLD }, { v: `${data.staff1 || '-'} / ${data.staff2 || '-'}`, s: STYLE_DEFAULT },
    ...Array(15).fill({ v: '', s: STYLE_DEFAULT })
  ]);
  wsData.push([]); // Spacer

  // Main Headers (Row 4)
  wsData.push([
    { v: 'No', s: STYLE_HEADER }, { v: 'Nama Produk', s: STYLE_HEADER },
    { v: 'SHIFT 1', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'SHIFT 2', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'STOK', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'STOK AKHIR', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }
  ]);

  // Sub Headers (Row 5)
  wsData.push([
    { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Awal', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Tambah', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Penjualan', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Sisa', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Awal', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Tambah', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Penjualan', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Sisa', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }
  ]);

  // O/P Headers (Row 6)
  const opRow = [{ v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }];
  for (let i = 0; i < 10; i++) {
    opRow.push({ v: 'O', s: STYLE_HEADER }, { v: 'P', s: STYLE_HEADER });
  }
  wsData.push(opRow);

  // --- DATA PROCESSING ---
  
  // Calculate total Ori vs Premi sales to distribute operational items usage
  let s1TotalO = 0, s1TotalP = 0;
  let s2TotalO = 0, s2TotalP = 0;

  Object.entries(data.shift1Map || {}).forEach(([key, qty]) => {
    if (key.toLowerCase().includes('premi')) s1TotalP += qty;
    else s1TotalO += qty;
  });
  (data.products || []).forEach(p => {
    const qty = parseInt(p.qty) || 0;
    if (p.variant?.toLowerCase().includes('premi')) s2TotalP += qty;
    else s2TotalO += qty;
  });

  const getRatio = (o, p) => {
    const total = o + p;
    return total > 0 ? { o: o / total, p: p / total } : { o: 1, p: 0 };
  };
  const s1Ratio = getRatio(s1TotalO, s1TotalP);
  const s2Ratio = getRatio(s2TotalO, s2TotalP);

  // Group all unique item names
  const itemNames = new Set();
  const productsByName = {};
  (data.products || []).forEach(p => {
    itemNames.add(p.name);
    if (!productsByName[p.name]) productsByName[p.name] = {};
    const variant = p.variant?.toLowerCase().includes('premi') ? 'premi' : 'ori';
    productsByName[p.name][variant] = p;
  });
  
  const stocksByName = {};
  (data.stocks || []).forEach(s => {
    itemNames.add(s.name);
    stocksByName[s.name] = s;
  });

  // Sort: Products first (by display_order if possible), then Stocks
  const sortedNames = Array.from(itemNames).sort((a, b) => {
    const orderA = productsByName[a]?.ori?.display_order || productsByName[a]?.premi?.display_order || 999;
    const orderB = productsByName[b]?.ori?.display_order || productsByName[b]?.premi?.display_order || 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  let idx = 1;
  sortedNames.forEach(name => {
    const row = [];
    row.push({ v: idx++, s: STYLE_DEFAULT });
    row.push({ v: name, s: STYLE_DEFAULT });

    // Final Stock (O & P)
    const stockTotal = data.inventoryMap?.[name] ?? 0;
    // For drinks, we might have separate inventory for variants if they are tracked separately, 
    // but usually they share the same base name in inventoryMap if it's a physical item.
    // If it's a product, it might be in inventoryMap as "Name" or "Name Variant".
    
    const getVal = (m, n) => m?.[n] ?? 0;
    
    // For drinks, check if variants are tracked separately in inventoryMap
    const s2SisaO = getVal(data.inventoryMap, name); // Default to base name
    const s2SisaP = getVal(data.inventoryMap, `${name} Premi`) || 0; // Check if there's a Premi-specific entry
    
    // S2 Penjualan
    const s2PenjO = productsByName[name]?.ori?.qty || (stocksByName[name] ? (stocksByName[name].used || 0) * s2Ratio.o : 0);
    const s2PenjP = productsByName[name]?.premi?.qty || (stocksByName[name] ? (stocksByName[name].used || 0) * s2Ratio.p : 0);
    
    // S2 Awal = Sisa + Penjualan (assuming no Tambah for now)
    const s2AwalO = s2SisaO + s2PenjO;
    const s2AwalP = s2SisaP + s2PenjP;
    
    // S1 Sisa = S2 Awal
    const s1SisaO = s2AwalO;
    const s1SisaP = s2AwalP;
    
    // S1 Penjualan
    const s1PenjO = (data.shift1Map?.[name] || 0) + (data.shift1OpMap?.[name] ? data.shift1OpMap[name] * s1Ratio.o : 0);
    const s1PenjP = (data.shift1Map?.[`${name} Premi`] || 0) + (data.shift1OpMap?.[name] ? data.shift1OpMap[name] * s1Ratio.p : 0);
    
    // S1 Awal = Sisa + Penjualan
    const s1AwalO = s1SisaO + s1PenjO;
    const s1AwalP = s1SisaP + s1PenjP;

    const fmt = (v) => v > 0 ? (v % 1 === 0 ? v : v.toFixed(1)) : '-';

    // SHIFT 1
    row.push({ v: fmt(s1AwalO), s: STYLE_DEFAULT }, { v: fmt(s1AwalP), s: STYLE_DEFAULT }); // Awal
    row.push({ v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT }); // Tambah
    row.push({ v: fmt(s1PenjO), s: STYLE_DEFAULT }, { v: fmt(s1PenjP), s: STYLE_DEFAULT }); // Penjualan
    row.push({ v: fmt(s1SisaO), s: STYLE_BOLD }, { v: fmt(s1SisaP), s: STYLE_BOLD }); // Sisa

    // SHIFT 2
    row.push({ v: fmt(s2AwalO), s: STYLE_DEFAULT }, { v: fmt(s2AwalP), s: STYLE_DEFAULT }); // Awal
    row.push({ v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT }); // Tambah
    row.push({ v: fmt(s2PenjO), s: STYLE_DEFAULT }, { v: fmt(s2PenjP), s: STYLE_DEFAULT }); // Penjualan
    row.push({ v: fmt(s2SisaO), s: STYLE_BOLD }, { v: fmt(s2SisaP), s: STYLE_BOLD }); // Sisa

    // STOK & STOK AKHIR
    row.push({ v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT }); // Stok (Addition)
    row.push({ v: fmt(s2SisaO), s: STYLE_BOLD }, { v: fmt(s2SisaP), s: STYLE_BOLD }); // Stok Akhir

    wsData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } }, // Title
    { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, // Tanggal val
    { s: { r: 1, c: 5 }, e: { r: 1, c: 7 } }, // Outlet val
    { s: { r: 1, c: 9 }, e: { r: 1, c: 12 } }, // Petugas val

    { s: { r: 3, c: 0 }, e: { r: 5, c: 0 } }, // No
    { s: { r: 3, c: 1 }, e: { r: 5, c: 1 } }, // Nama Produk
    
    // SHIFT 1 Merges
    { s: { r: 3, c: 2 }, e: { r: 3, c: 9 } }, // SHIFT 1 label
    { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } }, // Awal S1
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } }, // Tambah S1
    { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } }, // Penjualan S1
    { s: { r: 4, c: 8 }, e: { r: 4, c: 9 } }, // Sisa S1

    // SHIFT 2 Merges
    { s: { r: 3, c: 10 }, e: { r: 3, c: 17 } }, // SHIFT 2 label
    { s: { r: 4, c: 10 }, e: { r: 4, c: 11 } }, // Awal S2
    { s: { r: 4, c: 12 }, e: { r: 4, c: 13 } }, // Tambah S2
    { s: { r: 4, c: 14 }, e: { r: 4, c: 15 } }, // Penjualan S2
    { s: { r: 4, c: 16 }, e: { r: 4, c: 17 } }, // Sisa S2

    { s: { r: 3, c: 18 }, e: { r: 4, c: 19 } }, // STOK label
    { s: { r: 3, c: 20 }, e: { r: 4, c: 21 } }, // STOK AKHIR label
  ];

  ws['!merges'] = merges;
  
  // Set column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 25 },
    ...Array(20).fill({ wch: 4.5 }) // Narrow columns for O/P
  ];

  return ws;
};

// Internal Helper to create the Stock Card structure (Single Vertical List with Ori/Premi columns)
const createStockSheetData = (data, branchName, isConsolidated = false) => {
  const wsData = [];

  // Headers: No | Nama Item | --- ORI --- | --- PREMI ---
  // Sub-headers: No | Nama Item | Awal | Keluar | Sisa | Awal | Keluar | Sisa
  const title = isConsolidated ? 'KARTU STOK GABUNGAN (Shift 1 + Shift 2)' : 'KARTU STOK AKHIR SHIFT';

  wsData.push([{ v: title, s: STYLE_HEADER }, ...Array(7).fill({ v: '', s: STYLE_HEADER })]);
  wsData.push([
    { v: 'Tanggal', s: STYLE_BOLD }, { v: format(new Date(data.date || new Date()), 'dd MMMM yyyy', { locale: id }), s: STYLE_DEFAULT },
    { v: 'Outlet', s: STYLE_BOLD }, { v: branchName, s: STYLE_DEFAULT },
    { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
  ]);

  if (isConsolidated) {
    wsData.push([
      { v: 'Staff S1', s: STYLE_BOLD }, { v: data.staff1 || '-', s: STYLE_DEFAULT },
      { v: 'Staff S2', s: STYLE_BOLD }, { v: data.staff2 || '-', s: STYLE_DEFAULT },
      { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
    ]);
  } else {
    wsData.push([
      { v: 'Staff', s: STYLE_BOLD }, { v: data.staffName || '-', s: STYLE_DEFAULT },
      { v: 'Shift', s: STYLE_BOLD }, { v: data.shift || '-', s: STYLE_DEFAULT },
      { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }
    ]);
  }
  wsData.push([]); // Empty row

  // Table Headers
  wsData.push([
    { v: 'No', s: STYLE_HEADER }, { v: 'Nama Item', s: STYLE_HEADER },
    { v: 'VARIAN ORI', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'VARIAN PREMI', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }
  ]);
  wsData.push([
    { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER },
    { v: 'Awal', s: STYLE_HEADER }, { v: 'Keluar', s: STYLE_HEADER }, { v: 'Sisa', s: STYLE_HEADER },
    { v: 'Awal', s: STYLE_HEADER }, { v: 'Keluar', s: STYLE_HEADER }, { v: 'Sisa', s: STYLE_HEADER }
  ]);

  // Grouping products by name to get Ori and Premi together
  const grouped = {};
  (data.products || []).forEach(prod => {
    if (!grouped[prod.name]) grouped[prod.name] = { name: prod.name };
    const variant = (prod.variant || 'Standar').toLowerCase();
    const targetKey = variant.includes('premi') ? 'premi' : 'ori';

    const stockKey = prod.variant && prod.variant !== 'Standar' ? `${prod.name} ${prod.variant}` : prod.name;
    const currentStock = data.inventoryMap?.[stockKey] ?? 0;
    const terjual = isConsolidated
      ? (data.shift1Map?.[stockKey] || 0) + (parseInt(prod.qty) || 0)
      : (parseInt(prod.qty) || 0);
    const stokAwal = currentStock + terjual;

    if (grouped[prod.name][targetKey]) {
      // If somehow multiple variants map to the same category, sum them
      grouped[prod.name][targetKey].awal += stokAwal;
      grouped[prod.name][targetKey].keluar += terjual;
      grouped[prod.name][targetKey].sisa += currentStock;
    } else {
      grouped[prod.name][targetKey] = { awal: stokAwal, keluar: terjual, sisa: currentStock };
    }
  });

  let idx = 1;
  Object.values(grouped).forEach(item => {
    const row = [];
    row.push({ v: idx++, s: STYLE_DEFAULT });
    row.push({ v: item.name, s: STYLE_DEFAULT });

    // Ori columns
    if (item.ori) {
      row.push({ v: item.ori.awal, s: STYLE_DEFAULT });
      row.push({ v: item.ori.keluar || '-', s: STYLE_DEFAULT });
      row.push({ v: item.ori.sisa, s: STYLE_BOLD });
    } else {
      row.push({ v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT });
    }

    // Premi columns
    if (item.premi) {
      row.push({ v: item.premi.awal, s: STYLE_DEFAULT });
      row.push({ v: item.premi.keluar || '-', s: STYLE_DEFAULT });
      row.push({ v: item.premi.sisa, s: STYLE_BOLD });
    } else {
      row.push({ v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT }, { v: '-', s: STYLE_DEFAULT });
    }
    wsData.push(row);
  });

  // Operational items
  if (data.stocks && data.stocks.length > 0) {
    wsData.push([]);
    wsData.push([{ v: 'BAHAN & OPERASIONAL', s: STYLE_BOLD }, ...Array(7).fill({ v: '', s: STYLE_DEFAULT })]);
    let opIdx = 1;
    data.stocks.forEach(stock => {
      const sisaStock = data.inventoryMap?.[stock.name] ?? 0;
      let usedQty = parseFloat(stock.used !== undefined ? stock.used : stock.qty) || 0;
      
      if (isConsolidated) {
        usedQty += (data.shift1OpMap?.[stock.name] || 0);
      }
      
      const stokAwal = sisaStock + usedQty;

      wsData.push([
        { v: opIdx++, s: STYLE_DEFAULT },
        { v: stock.name, s: STYLE_DEFAULT },
        { v: 'Awal:', s: STYLE_DEFAULT }, { v: stokAwal, s: STYLE_DEFAULT },
        { v: 'Keluar:', s: STYLE_DEFAULT }, { v: usedQty > 0 ? usedQty : '-', s: STYLE_DEFAULT },
        { v: 'Sisa:', s: STYLE_DEFAULT }, { v: sisaStock, s: STYLE_BOLD }
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Title
    { s: { r: 4, c: 2 }, e: { r: 4, c: 4 } }, // VARIAN ORI header
    { s: { r: 4, c: 5 }, e: { r: 4, c: 7 } }, // VARIAN PREMI header
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // No
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }  // Nama Item
  ];
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
  ];

  return ws;
};

export const exportShiftToExcel = (formData, branchName) => {
  try {
    const wb = XLSX.utils.book_new();
    const isShift2 = String(formData.shift) === '2' && formData.shift1Report;
    const shift1Report = formData.shift1Report;

    // 1. GENERATE SHIFT 1 SHEET (IF SHIFT 2)
    if (isShift2) {
      // Build map of shift 1 sold details
      const s1Map = {};
      if (shift1Report?.details) {
        shift1Report.details.forEach(d => {
          const key = d.variant && d.variant !== 'Standar' ? `${d.name} ${d.variant}` : d.name;
          s1Map[key] = d;
        });
      }
      
      // Map over formData.products (master list) to include all menus with Shift 1 qty
      const s1Products = (formData.products || []).map(prod => {
        const variant = prod.variant || 'Standar';
        const key = variant !== 'Standar' ? `${prod.name} ${variant}` : prod.name;
        const soldDetail = s1Map[key];
        return {
          ...prod,
          qty: soldDetail ? (soldDetail.qty || 0) : 0,
          price: soldDetail ? (soldDetail.price || prod.price) : prod.price
        };
      });

      const s1Data = {
        date: shift1Report.date,
        staffName: shift1Report.staff_name,
        cashAwal: shift1Report.cash_awal || 0,
        products: s1Products,
        expenses: shift1Report.expenses || []
      };
      const wsS1 = createSalesSheetData(s1Data, branchName);
      XLSX.utils.book_append_sheet(wb, wsS1, 'Shift 1');
    }

    // 2. GENERATE CONSOLIDATED SHEET (PENJUALAN)
    // Build consolidated product list
    const shift1DetailsMap = {};
    if (isShift2 && shift1Report?.details) {
      shift1Report.details.forEach(d => {
        const key = d.variant && d.variant !== 'Standar' ? `${d.name} ${d.variant}` : d.name;
        shift1DetailsMap[key] = (shift1DetailsMap[key] || 0) + (d.qty || 0);
      });
    }

    const consolidatedProducts = (formData.products || []).map(prod => {
      const variant = prod.variant || 'Standar';
      const key = variant !== 'Standar' ? `${prod.name} ${variant}` : prod.name;
      const s1Qty = isShift2 ? (shift1DetailsMap[key] || 0) : 0;
      return { ...prod, qty: (parseInt(prod.qty) || 0) + s1Qty };
    });

    const consolidatedExpenses = [...(formData.expenses || [])];
    if (isShift2 && shift1Report?.expenses) {
      shift1Report.expenses.forEach(exp => {
        consolidatedExpenses.push({ name: `(S1) ${exp.name}`, amount: exp.amount });
      });
    }

    const consolidatedData = {
      date: formData.date,
      staffName: isShift2 ? `${shift1Report.staff_name} / ${formData.staffName}` : formData.staffName,
      cashAwal: isShift2 ? (shift1Report.cash_awal || 0) : (parseInt(formData.cashAwal) || 0),
      products: consolidatedProducts,
      expenses: consolidatedExpenses
    };

    const wsConsolidated = createSalesSheetData(consolidatedData, branchName, true);
    XLSX.utils.book_append_sheet(wb, wsConsolidated, isShift2 ? 'Gabungan S1+S2' : 'Penjualan');

    // ── KARTU STOK SHEET ──
    if (!formData.skipKartuStok) {
      const shift1Map = {};
      if (shift1Report?.details) {
        shift1Report.details.forEach(d => {
          const key = d.variant && d.variant !== 'Standar' ? `${d.name} ${d.variant}` : d.name;
          shift1Map[key] = (shift1Map[key] || 0) + (d.qty || 0);
        });
      }

      const shift1OpMap = {};
      if (shift1Report?.stocks) {
        shift1Report.stocks.forEach(s => {
          shift1OpMap[s.name] = parseFloat(s.used !== undefined ? s.used : s.qty) || 0;
        });
      }

      const stockData = {
        date: formData.date,
        products: formData.products,
        stocks: formData.stocks,
        inventoryMap: formData.inventoryMap,
        shift1Map: shift1Map,
        shift1OpMap: shift1OpMap,
        staff1: shift1Report?.staff_name,
        staff2: formData.staffName,
        shift: formData.shift
      };

      const wsStock = isShift2 
        ? createDetailedStockSheetData(stockData, branchName)
        : createStockSheetData(stockData, branchName, false);
        
      XLSX.utils.book_append_sheet(wb, wsStock, 'Kartu Stok');
    }

    const fileNameRaw = `Laporan_${branchName || 'Gudang Immune'}_Shift${formData.shift || 'X'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    const fileName = fileNameRaw.replace(/[^a-zA-Z0-9._ -]/g, '_');

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(out, fileName);

  } catch (err) {
    console.error('Error in exportShiftToExcel:', err);
    alert('Maaf, terjadi kesalahan saat membuat file Excel: ' + err.message);
  }
};

export const exportKartuStok = (formData, branchName) => {
  try {
    const wb = XLSX.utils.book_new();
    const stockData = {
      products: formData.products,
      stocks: formData.stocks,
      inventoryMap: formData.inventoryMap,
      staffName: formData.staffName,
      shift: formData.shift
    };

    const ws = createStockSheetData(stockData, branchName, false);
    XLSX.utils.book_append_sheet(wb, ws, 'Kartu Stok');

    const fileNameRaw = `KartuStok_${branchName || 'Gudang Immune'}_Shift${formData.shift || 'X'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    const fileName = fileNameRaw.replace(/[^a-zA-Z0-9._ -]/g, '_');

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(out, fileName);

  } catch (err) {
    console.error('Error in exportKartuStok:', err);
    alert('Maaf, terjadi kesalahan saat membuat file Kartu Stok: ' + err.message);
  }
};

export const exportMultipleShiftsToExcel = (reports) => {
  try {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [{ v: 'REKAPITULASI PENJUALAN KESELURUHAN', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }, { v: '', s: STYLE_HEADER }],
      [{ v: 'Tanggal Export', s: STYLE_BOLD }, { v: format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id }), s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }, { v: '', s: STYLE_DEFAULT }],
      [],
      [{ v: 'ID', s: STYLE_HEADER }, { v: 'Tanggal Laporan', s: STYLE_HEADER }, { v: 'Cabang', s: STYLE_HEADER }, { v: 'Shift', s: STYLE_HEADER }, { v: 'Staff', s: STYLE_HEADER }, { v: 'Total Pemasukan (Rp)', s: STYLE_HEADER }, { v: 'Total Pengeluaran (Rp)', s: STYLE_HEADER }, { v: 'Sisa Cash Setor (Rp)', s: STYLE_HEADER }]
    ];

    if (Array.isArray(reports)) {
      reports.forEach(report => {
        wsData.push([
          { v: report.id, s: STYLE_DEFAULT },
          {
            v: (() => {
              const d = new Date(report.created_at || report.date);
              return isValidDate(d) ? format(d, 'dd MMMM yyyy HH:mm', { locale: id }) : '-';
            })(), s: STYLE_DEFAULT
          },
          { v: report.branch_name, s: STYLE_DEFAULT },
          { v: report.shift, s: STYLE_DEFAULT },
          { v: report.staff_name, s: STYLE_DEFAULT },
          { v: rp(report.total_revenue), s: STYLE_DEFAULT },
          { v: rp(report.total_expense), s: STYLE_DEFAULT },
          { v: rp(report.cash_akhir), s: STYLE_DEFAULT }
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 10 },
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Penjualan');
    const fileName = `Rekap_Seluruh_Penjualan_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(out, fileName);

  } catch (err) {
    console.error('Error in exportMultipleShiftsToExcel:', err);
  }
};
