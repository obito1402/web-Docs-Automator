import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileText, Download, Settings, History, Plus, Trash2, Check, RefreshCw, X, ChevronRight, Users } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { parseFile, exportToExcel } from './utils/fileParser';
import { buildDraftHpsRows, exportDraftHps } from './utils/hpsCalculator';
import HowItWorks from './components/ui/how-it-works';

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hpsFactor, setHpsFactor] = useState(1.2);
  const [hpsOverrides, setHpsOverrides] = useState({});

  const tutorialFeatures = [
    {
      title: "Upload File Pengajuan",
      description: "Unggah file Excel pengajuan barang dari setiap peneliti. Bisa satu atau banyak file sekaligus.",
      colorTheme: "blue"
    },
    {
      title: "Ubah Konfigurasi (Opsional)",
      description: "Gunakan tombol Konfigurasi di pojok kanan atas untuk menambah, menghapus, atau mengubah nama kolom tambahan sesuai kebutuhan.",
      colorTheme: "blue"
    },
    {
      title: "Pratinjau & Edit",
      description: "Periksa hasil penambahan kolom tiap peneliti pada tab terpisah. Edit langsung di tabel jika diperlukan.",
      colorTheme: "blue"
    },
    {
      title: "Unduh Final",
      description: "Ekspor menjadi satu file Excel utuh. Catatan: Gambar Picture-in-Cell di file ke-2 dst tidak akan tersalin (batas teknis).",
      colorTheme: "blue"
    }
  ];

  const [extraColumns, setExtraColumns] = useState([
    { id: 1, name: "Dokumentasi" },
    { id: 2, name: "Harga Perolehan" },
    { id: 3, name: "Invoice" },
    { id: 4, name: "BAST" },
    { id: 5, name: "Laporan BKU" }
  ]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('rpd_history_v3');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedColumns = localStorage.getItem('rpd_columns_v3');
    if (savedColumns) setExtraColumns(JSON.parse(savedColumns));
  }, []);

  const saveToHistory = (filenames, totalRows) => {
    const newEntry = {
      id: Date.now(),
      filename: filenames.join(', '),
      date: new Date().toLocaleString(),
      rows: totalRows,
      fileCount: filenames.length
    };
    const newHistory = [newEntry, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('rpd_history_v3', JSON.stringify(newHistory));
  };

  const savePreset = () => {
    localStorage.setItem('rpd_columns_v3', JSON.stringify(extraColumns));
    toast.success('Preset kolom berhasil disimpan!');
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setIsProcessing(true);

    try {
      const newFiles = [];

      for (const file of acceptedFiles) {
        const result = await parseFile(file);
        result.sheets.forEach(sheetObj => {
           newFiles.push({
             filename: `${file.name} - ${sheetObj.sheetName}`,
             parsed: {
               ...sheetObj,
               rawBuffer: result.rawBuffer,
               sheetObj: sheetObj
             }
           });
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      setActiveFileIndex(uploadedFiles.length);

      const totalRows = newFiles.reduce((sum, f) => {
        if (f.parsed.type === 'structured') {
          return sum + Math.max(0, f.parsed.dataEndRow - f.parsed.dataStartRow);
        }
        return sum + (Array.isArray(f.parsed) ? f.parsed.length - 1 : 0);
      }, 0);
      
      const originalFilenames = Array.from(new Set(acceptedFiles.map(f => f.name)));
      saveToHistory(originalFilenames, totalRows);

    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Terjadi kesalahan saat memproses file.');
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles, history]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    onDropRejected: () => {
      toast.error('Format tidak didukung! HANYA gunakan format .xlsx atau .xls');
    }
  });

  const removeFile = (index) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    if (activeFileIndex >= newFiles.length) {
      setActiveFileIndex(Math.max(0, newFiles.length - 1));
    }
  };

  const resetAll = () => {
    setUploadedFiles([]);
    setActiveFileIndex(0);
  };

  const getActiveDisplayData = () => {
    if (uploadedFiles.length === 0) return null;
    const file = uploadedFiles[activeFileIndex];
    if (!file) return null;

    const { parsed } = file;

    if (parsed.type === 'structured') {
      const { allRows, headerRowIndex, dataStartRow, dataEndRow, lastMeaningfulCol } = parsed;

      if (headerRowIndex < 0) return null;

      const headerRow = allRows[headerRowIndex] || [];
      const trimmedHeaders = headerRow.slice(0, lastMeaningfulCol);
      const extendedHeaders = [...trimmedHeaders, ...extraColumns.map(c => c.name)];

      const displayRows = [];
      for (let i = dataStartRow; i < dataEndRow; i++) {
        const row = allRows[i] || [];
        const trimmed = row.slice(0, lastMeaningfulCol);
        while (trimmed.length < lastMeaningfulCol) trimmed.push('');
        extraColumns.forEach(() => trimmed.push(''));
        displayRows.push(trimmed);
      }

      return {
        headers: extendedHeaders,
        rows: displayRows,
        originalColCount: lastMeaningfulCol,
        researcherName: parsed.researcherName || file.filename
      };
    } else {
      const rawData = Array.isArray(parsed) ? parsed : [];
      if (rawData.length === 0) return null;
      const headers = [...rawData[0], ...extraColumns.map(c => c.name)];
      const rows = rawData.slice(1).map(row => {
        const padded = [...row];
        while (padded.length < headers.length) padded.push('');
        return padded;
      });
      return { headers, rows, originalColCount: rawData[0].length, researcherName: file.filename };
    }
  };

  const handleCellChange = (rowIndex, colIndex, value) => {
    const newFiles = [...uploadedFiles];
    const file = newFiles[activeFileIndex];
    if (file.parsed.type === 'structured') {
      const actualRowIndex = file.parsed.dataStartRow + rowIndex;
      if (!file.parsed.allRows[actualRowIndex]) file.parsed.allRows[actualRowIndex] = [];
      file.parsed.allRows[actualRowIndex][colIndex] = value;
    } else {
      const rawData = Array.isArray(file.parsed) ? file.parsed : [];
      rawData[rowIndex + 1][colIndex] = value;
    }
    setUploadedFiles(newFiles);
  };

  const handleDownload = async () => {
    if (uploadedFiles.length === 0) return;
    const downloadToast = toast.loading('Sedang menyiapkan file unduhan...');
    try {
      await exportToExcel(uploadedFiles, extraColumns);
      toast.success('File berhasil diunduh!', { id: downloadToast });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengunduh file. ' + err.message, { id: downloadToast });
    }
  };

  const handleDraftHpsDownload = async () => {
    if (uploadedFiles.length === 0) return;
    const downloadToast = toast.loading('Sedang membuat Draft HPS...');
    try {
      await exportDraftHps(uploadedFiles, hpsFactor, hpsOverrides);
      toast.success('Draft HPS berhasil diunduh.', { id: downloadToast });
    } catch (err) {
      console.error(err);
      toast.error(`Gagal membuat Draft HPS. ${err.message}`, { id: downloadToast });
    }
  };

  const removeColumn = (id) => {
    setExtraColumns(extraColumns.filter(c => c.id !== id));
  };

  const addColumn = () => {
    setExtraColumns([...extraColumns, { id: Date.now(), name: 'Kolom Baru' }]);
  };

  const activeDisplay = getActiveDisplayData();
  const activeParsed = uploadedFiles[activeFileIndex]?.parsed;
  const activeOverrides = hpsOverrides[activeFileIndex] || {};
  const draftHpsRows = buildDraftHpsRows(activeParsed, hpsFactor, activeOverrides);
  const draftHpsTotal = draftHpsRows.reduce((sum, row) => sum + row.totalPrice, 0);
  const hasFiles = uploadedFiles.length > 0;

  const updateHpsOverride = (rowNumber, field, value) => {
    setHpsOverrides((current) => ({
      ...current,
      [activeFileIndex]: {
        ...(current[activeFileIndex] || {}),
        [rowNumber]: {
          ...(current[activeFileIndex]?.[rowNumber] || {}),
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="min-h-screen bg-white text-brand-navy flex font-sans selection:bg-brand-blue selection:text-white">
      <Toaster position="top-center" />

      <div className={`fixed inset-y-0 left-0 bg-white border-r border-brand-sky w-80 transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 shadow-2xl ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-serif">Riwayat</h2>
            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-brand-sky rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {history.length === 0 ? (
              <p className="text-brand-navy/60 text-sm">Belum ada dokumen yang diproses.</p>
            ) : (
              history.map(item => (
                <div key={item.id} className="p-4 border border-brand-sky rounded-xl hover:shadow-lg transition-all bg-white/30">
                  <h4 className="font-semibold truncate text-sm">{item.filename}</h4>
                  <p className="text-xs text-brand-navy/70 mt-1">{item.date}</p>
                  <div className="flex gap-2 mt-2">
                    <p className="text-xs font-medium bg-brand-sky inline-block px-2 py-1 rounded">{item.rows} Baris</p>
                    {item.fileCount && <p className="text-xs font-medium bg-brand-ocean/10 text-brand-ocean inline-block px-2 py-1 rounded">{item.fileCount} File</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col transition-all duration-500">

        <nav className="px-4 lg:px-8 py-4 lg:py-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-brand-sky/50 backdrop-blur-md sticky top-0 z-10 animate-slide-down bg-white/80">
          <div className="flex items-center gap-3 hover:scale-105 transition-transform cursor-pointer" onClick={resetAll}>
            <div className="w-10 h-10 bg-brand-navy text-white flex items-center justify-center rounded-xl shadow-lg">
              <FileText size={20} />
            </div>
            <h1 className="text-xl font-serif font-semibold tracking-wide">Docs Automator.</h1>
          </div>
          <div className="flex gap-2 lg:gap-4 flex-wrap justify-center">
            <button onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-full hover:bg-brand-sky transition-colors font-medium text-sm">
              <History size={16} /> Riwayat
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-full hover:bg-brand-sky transition-colors font-medium text-sm">
              <Settings size={16} /> Konfigurasi
            </button>
          </div>
        </nav>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col">

          {!hasFiles ? (
            <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center justify-between">
              
              <div className="flex flex-col items-center lg:items-start justify-center text-center lg:text-left">
                <div className="max-w-xl mb-12">
                  <h2 className="text-5xl lg:text-6xl font-serif leading-tight mb-6 animate-fade-up" style={{ animationDelay: '100ms' }}>
                    Otomatisasi Dokumen dengan Elegan.
                  </h2>
                  <p className="text-lg text-brand-navy/80 leading-relaxed font-light animate-fade-up" style={{ animationDelay: '250ms' }}>
                    Unggah file pengajuan barang dari setiap peneliti. Sistem akan memproses, menambahkan kolom administrasi, dan menggabungkan semuanya dalam satu file Excel.
                  </p>
                </div>

                <div
                  {...getRootProps()}
                  className={`w-full max-w-xl p-12 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-out animate-scale-up ${isDragActive ? 'border-brand-blue bg-brand-blue/5 scale-[1.02] shadow-2xl shadow-brand-blue/10' : 'border-brand-navy/20 hover:border-brand-navy/50 hover:bg-white/50 hover:shadow-xl hover:-translate-y-1'}`}
                  style={{ animationDelay: '400ms' }}
                >
                  <input {...getInputProps()} />
                  <div className="w-20 h-20 bg-white shadow-xl rounded-2xl flex items-center justify-center mb-6 text-brand-ocean">
                    <FileUp size={32} />
                  </div>
                  <h3 className="text-2xl font-serif mb-2">Tarik & Lepas Dokumen</h3>
                   <p className="text-brand-navy/60 text-sm font-medium">HANYA mendukung format .xlsx dan .xls, bisa pilih banyak file</p>
                </div>
              </div>

              <div className="hidden lg:block w-full h-full animate-fade-up" style={{ animationDelay: '500ms' }}>
                <HowItWorks features={tutorialFeatures} className="!bg-transparent !py-0 !pt-0 !px-0" />
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-6 animate-fade-up" style={{ animationDelay: '50ms' }}>
                <div>
                  <h2 className="text-3xl font-serif mb-2">Pratinjau Hasil</h2>
                  <p className="text-brand-navy/70 text-sm flex items-center gap-2">
                    <Users size={14} className="text-brand-ocean" />
                    <span className="font-semibold">{uploadedFiles.length}</span> file peneliti berhasil dimuat.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div
                    {...getRootProps()}
                    className="px-5 py-3 rounded-full border-2 border-dashed border-brand-sky hover:border-brand-navy/30 transition-colors font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-brand-sky/30"
                  >
                    <input {...getInputProps()} />
                    <Plus size={16} /> Tambah File
                  </div>
                  <button onClick={resetAll} className="px-5 py-3 rounded-full hover:bg-brand-sky transition-colors font-medium text-sm flex items-center gap-2">
                    <RefreshCw size={16} /> Mulai Ulang
                  </button>
                  <button onClick={handleDownload} className="px-8 py-3 bg-brand-navy text-white rounded-full hover:bg-brand-blue hover:-translate-y-0.5 hover:shadow-2xl transition-all font-medium text-sm flex items-center gap-2 shadow-xl shadow-brand-navy/20">
                    <Download size={16} /> Unduh Final (.xlsx)
                  </button>
                  <button onClick={handleDraftHpsDownload} className="px-6 py-3 bg-brand-ocean text-white rounded-full hover:bg-brand-blue transition-all font-medium text-sm flex items-center gap-2">
                    <Download size={16} /> Unduh Draft HPS
                  </button>
                </div>
              </div>

              {draftHpsRows.length > 0 && (
               <section className="mb-6 bg-brand-sky/20 rounded-3xl border border-brand-sky p-6 animate-fade-up" aria-labelledby="draft-hps-heading">
                 <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
                   <div>
                     <p className="text-xs font-semibold uppercase tracking-wide text-brand-ocean">Draft, belum diverifikasi</p>
                     <h3 id="draft-hps-heading" className="text-2xl font-serif">Perhitungan Draft HPS</h3>
                     <p className="text-sm text-brand-navy/70 mt-1">Isi harga dan ongkir hasil pemeriksaan admin. Kosongkan jika ingin memakai nilai RPD.</p>
                   </div>
                   <label className="flex items-center gap-3 text-sm font-medium">
                     <span>Faktor harga</span>
                     <select
                       value={hpsFactor}
                       onChange={(event) => setHpsFactor(Number(event.target.value))}
                       className="min-h-11 rounded-xl border border-brand-sky bg-white px-3 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                     >
                       <option value="1.2">1,2 (default)</option>
                       <option value="1.7">1,7</option>
                     </select>
                   </label>
                 </div>
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                     <thead>
                       <tr className="border-b border-brand-sky">
                         <th className="p-3">Barang</th>
                         <th className="p-3">Volume</th>
                         <th className="p-3">Jenis sumber</th>
                         <th className="p-3">Harga cek admin</th>
                         <th className="p-3">Ongkir</th>
                         <th className="p-3">Metode</th>
                         <th className="p-3 text-right">Total HPS</th>
                       </tr>
                     </thead>
                     <tbody>
                       {draftHpsRows.map((row) => (
                         <tr key={row.rowNumber} className="border-b border-brand-sky/60 align-top">
                           <td className="p-3 min-w-52">
                             <div className="font-medium">{row.name}</div>
                             {row.warnings.length > 0 && <div className="mt-1 text-xs text-red-700">{row.warnings.join(', ')}</div>}
                           </td>
                           <td className="p-3 whitespace-nowrap">{row.quantity || '-'} {row.unit}</td>
                           <td className="p-3">{row.sourceType}</td>
                           <td className="p-3 min-w-40">
                             <input
                               type="number"
                               min="0"
                               inputMode="decimal"
                               value={activeOverrides[row.rowNumber]?.checkedPrice ?? ''}
                               onChange={(event) => updateHpsOverride(row.rowNumber, 'checkedPrice', event.target.value)}
                               placeholder={Math.round(row.sourcePrice).toLocaleString('id-ID')}
                               className="w-36 min-h-11 rounded-lg border border-brand-sky bg-white px-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                               aria-label={`Harga hasil cek untuk ${row.name}`}
                             />
                           </td>
                           <td className="p-3 min-w-32">
                             <input
                               type="number"
                               min="0"
                               inputMode="decimal"
                               value={activeOverrides[row.rowNumber]?.shipping ?? ''}
                               onChange={(event) => updateHpsOverride(row.rowNumber, 'shipping', event.target.value)}
                               placeholder={row.shipping ? Math.round(row.shipping).toLocaleString('id-ID') : '0'}
                               className="w-28 min-h-11 rounded-lg border border-brand-sky bg-white px-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                               aria-label={`Ongkir untuk ${row.name}`}
                             />
                           </td>
                           <td className="p-3 min-w-48">
                             <select
                               value={activeOverrides[row.rowNumber]?.pricingMode ?? row.pricingMode}
                               onChange={(event) => updateHpsOverride(row.rowNumber, 'pricingMode', event.target.value)}
                               className="min-h-11 rounded-lg border border-brand-sky bg-white px-2 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
                               aria-label={`Metode harga untuk ${row.name}`}
                             >
                               <option value="factor">Harga + ongkir x 1,2</option>
                               <option value="factor-1.7">Harga + ongkir x 1,7</option>
                               <option value="vendor">Harga vendor langsung</option>
                             </select>
                           </td>
                           <td className="p-3 text-right font-semibold whitespace-nowrap">Rp {Math.round(row.totalPrice).toLocaleString('id-ID')}</td>
                         </tr>
                       ))}
                     </tbody>
                     <tfoot>
                       <tr>
                         <th colSpan="6" className="p-3 text-right">Total draft HPS</th>
                         <th className="p-3 text-right text-base">Rp {Math.round(draftHpsTotal).toLocaleString('id-ID')}</th>
                       </tr>
                     </tfoot>
                   </table>
                 </div>
               </section>
              )}

              <div className="flex gap-2 mb-4 overflow-x-auto pb-2 animate-fade-up" style={{ animationDelay: '100ms' }}>
                {uploadedFiles.map((file, index) => {
                  const name = file.parsed.type === 'structured' && file.parsed.researcherName
                    ? file.parsed.researcherName.split(' ').slice(0, 2).join(' ')
                    : file.filename.replace(/\.[^.]+$/, '').substring(0, 25);
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all whitespace-nowrap ${
                        activeFileIndex === index
                          ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20'
                          : 'bg-brand-sky/40 hover:bg-brand-sky text-brand-navy'
                      }`}
                      onClick={() => setActiveFileIndex(index)}
                    >
                      <FileText size={14} />
                      <span>{name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        className={`ml-1 p-0.5 rounded-full transition-colors ${
                          activeFileIndex === index ? 'hover:bg-white/20' : 'hover:bg-brand-navy/10'
                        }`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {activeDisplay && (
                <div className="flex-1 bg-white rounded-3xl shadow-2xl border border-brand-sky/50 overflow-hidden flex flex-col animate-scale-up" style={{ animationDelay: '200ms' }}>
                  {uploadedFiles[activeFileIndex]?.parsed?.type === 'structured' && (
                    <div className="px-6 py-3 bg-brand-sky/20 border-b border-brand-sky/50 flex items-center gap-4 text-sm">
                      <span className="font-semibold">{activeDisplay.researcherName}</span>
                      <span className="text-brand-navy/50">•</span>
                      <span className="text-brand-navy/70">{activeDisplay.rows.length} item barang</span>
                      <span className="text-brand-navy/50">•</span>
                      <span className="text-brand-navy/70">{activeDisplay.headers.length} kolom ({extraColumns.length} kolom tambahan)</span>
                    </div>
                  )}
                  <div className="overflow-x-auto overflow-y-auto flex-1 p-6">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr>
                          {activeDisplay.headers.map((header, i) => (
                            <th key={i} className={`p-4 border-b-2 border-brand-sky font-serif font-semibold whitespace-nowrap sticky top-0 bg-white z-10 ${i >= activeDisplay.originalColCount ? 'text-brand-ocean bg-brand-blue/5' : ''}`}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeDisplay.rows.slice(0, 30).map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="group hover:bg-brand-sky/10 transition-colors animate-fade-in"
                            style={{ animationDelay: `${(rowIndex * 20) + 250}ms` }}
                          >
                            {row.map((cell, colIndex) => (
                              <td key={colIndex} className={`p-0 border-b border-brand-sky/50 transition-colors ${colIndex >= activeDisplay.originalColCount ? 'bg-brand-blue/[0.02] group-hover:bg-brand-blue/[0.05]' : ''}`}>
                                <input
                                  type="text"
                                  value={cell || ''}
                                  onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                  className="w-full p-4 bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue/30 transition-all text-sm"
                                  placeholder="-"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {activeDisplay.rows.length > 30 && (
                    <div className="p-4 text-center bg-brand-sky/30 text-sm font-medium border-t border-brand-sky">
                      Menampilkan 30 baris pertama dari {activeDisplay.rows.length} baris. Keseluruhan data akan tersimpan saat diunduh.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-brand-navy/30 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-lg w-full m-4 animate-scale-up" style={{ animationDelay: '100ms' }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif">Konfigurasi Kolom</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-brand-sky rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-brand-navy/70 mb-6">
              Tentukan kolom tambahan yang akan disisipkan secara otomatis ke setiap file peneliti yang diproses.
            </p>

            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {extraColumns.map((col, index) => (
                <div key={col.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-brand-sky">
                  <div className="flex items-center gap-3">
                    <span className="text-brand-navy/40 text-sm font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                    <input 
                      type="text" 
                      value={col.name} 
                      onChange={(e) => {
                        const newCols = [...extraColumns];
                        newCols[index].name = e.target.value;
                        setExtraColumns(newCols);
                      }}
                      className="font-medium bg-transparent focus:outline-none focus:border-b border-brand-blue"
                    />
                  </div>
                  <button onClick={() => removeColumn(col.id)} className="text-brand-blue/60 hover:text-brand-blue p-2 hover:bg-brand-sky/30 rounded-full transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button onClick={addColumn} className="w-full py-4 border-2 border-dashed border-brand-sky hover:border-brand-navy/30 rounded-xl text-brand-navy/70 font-medium flex items-center justify-center gap-2 transition-colors mb-6">
              <Plus size={18} /> Tambah Kolom Khusus
            </button>

            <div className="flex gap-4 pt-4 border-t border-brand-sky">
              <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 px-4 rounded-xl hover:bg-brand-sky transition-colors font-medium">
                Tutup
              </button>
              <button onClick={savePreset} className="flex-1 py-3 px-4 bg-brand-navy text-white rounded-xl hover:bg-brand-blue transition-colors font-medium shadow-lg shadow-brand-navy/20">
                Simpan Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-brand-navy/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-scale-up">
            <div className="w-12 h-12 border-4 border-brand-sky border-t-brand-navy rounded-full animate-spin"></div>
            <p className="font-medium text-brand-navy">Memproses file...</p>
          </div>
        </div>
      )}

    </div>
  );
}
