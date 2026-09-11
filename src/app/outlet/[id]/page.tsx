'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  Lock, 
  AlertCircle, 
  ReceiptText, 
  X, 
  Save, 
  Unlock 
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
}

type SupplyLevel = 'Banyak' | 'Sedang' | 'Sedikit';

export default function OutletOpsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const branchId = resolvedParams.id;

  const [branchName, setBranchName] = useState('Outlet Rasajo');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'pagi' | 'malam'>('pagi');
  const [loading, setLoading] = useState(true);

  // Status Shift Hari Ini
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftStatus, setShiftStatus] = useState<'none' | 'open' | 'closed'>('none');
  const [isMorningUnlocked, setIsMorningUnlocked] = useState<boolean>(false);

  // Form Shift Pagi
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [initialCilok, setInitialCilok] = useState<number>(0);
  const [initialTahu, setInitialTahu] = useState<number>(0);

  // Tambahan Stok Siang/Sore
  const [additionalCilok, setAdditionalCilok] = useState<number>(0);
  const [additionalTahu, setAdditionalTahu] = useState<number>(0);

  // Form Setoran Malam
  const [remainingCilok, setRemainingCilok] = useState<number>(0);
  const [remainingTahu, setRemainingTahu] = useState<number>(0);
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  const [supplies, setSupplies] = useState<Record<string, SupplyLevel>>({
    saos: 'Banyak',
    kecap: 'Banyak',
    plastik: 'Banyak',
    tusukan: 'Banyak',
  });

  // State Modal Custom UI
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalType, setModalType] = useState<'open_shift' | 'close_shift'>('open_shift');
  const [feedbackModal, setFeedbackModal] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const today = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    setLoading(true);

    const { data: bData } = await supabase
      .from('branches')
      .select('name')
      .eq('id', branchId)
      .single();
    if (bData) setBranchName(bData.name);

    const { data: empData } = await supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true);
    if (empData) setEmployees(empData);

    const { data: sData } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('branch_id', branchId)
      .eq('shift_date', today)
      .maybeSingle();

    if (sData) {
      setShiftId(sData.id);
      setShiftStatus(sData.status as 'open' | 'closed');
      setIsMorningUnlocked(Boolean(sData.is_morning_unlocked));
      setInitialCilok(sData.initial_cilok || 0);
      setInitialTahu(sData.initial_tahu || 0);
      setAdditionalCilok(sData.additional_cilok || 0);
      setAdditionalTahu(sData.additional_tahu || 0);
      setRemainingCilok(sData.remaining_cilok || 0);
      setRemainingTahu(sData.remaining_tahu || 0);
      setExpenseAmount(Number(sData.branch_expenses) || 0);
      setExpenseNotes(sData.expense_notes || '');

      if (sData.supplies_status) {
        setSupplies(sData.supplies_status);
      }

      const { data: staffData } = await supabase
        .from('shift_staff')
        .select('employee_id')
        .eq('shift_id', sData.id);
      if (staffData) {
        setSelectedStaff(staffData.map((s) => s.employee_id));
      }

      if (sData.status === 'open') {
        setActiveTab('malam');
      }
    } else {
      setShiftId(null);
      setShiftStatus('none');
      setIsMorningUnlocked(false);
      setSelectedStaff([]);
      setInitialCilok(0);
      setInitialTahu(0);
      setActiveTab('pagi');
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [branchId, today]);

  // Kalkulasi Keuangan
  const hargaCilok = 1000;
  const hargaTahu = 1000;

  const totalStokCilok = Number(initialCilok) + Number(additionalCilok);
  const totalStokTahu = Number(initialTahu) + Number(additionalTahu);

  const soldCilok = Math.max(0, totalStokCilok - Number(remainingCilok));
  const soldTahu = Math.max(0, totalStokTahu - Number(remainingTahu));

  const grossRevenue = soldCilok * hargaCilok + soldTahu * hargaTahu;
  const feeKaryawan = grossRevenue * 0.1;
  const netCashDeposit = Math.max(0, grossRevenue - feeKaryawan - Number(expenseAmount));

  // Kunci form pagi: Hanya bisa diedit jika belum buka shift ATAU jika owner sengaja membuka gembok
  const canEditMorning = shiftStatus === 'none' || isMorningUnlocked;

  const handleToggleStaff = (empId: string) => {
    if (!canEditMorning) return;
    setSelectedStaff((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const cycleSupplyLevel = (item: string) => {
    if (shiftStatus === 'closed') return;
    const levels: SupplyLevel[] = ['Banyak', 'Sedang', 'Sedikit'];
    const current = supplies[item] || 'Banyak';
    const next = levels[(levels.indexOf(current) + 1) % levels.length];
    setSupplies((prev) => ({ ...prev, [item]: next }));
  };

  const triggerOpenShift = () => {
    if (selectedStaff.length === 0) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Karyawan Belum Dipilih',
        message: 'Pilih minimal satu karyawan yang bertugas menjaga outlet hari ini.',
      });
      return;
    }
    if (initialCilok <= 0 && initialTahu <= 0) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Stok Awal Kosong',
        message: 'Masukkan jumlah stok awal cilok atau tahu yang diterima pagi ini.',
      });
      return;
    }

    setModalType('open_shift');
    setShowConfirmModal(true);
  };

  const triggerCloseShift = () => {
    if (!shiftId) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Shift Belum Aktif',
        message: 'Shift pagi belum dibuka, tidak bisa melakukan tutup kasir.',
      });
      return;
    }

    if (expenseAmount > 0 && !expenseNotes.trim()) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Keterangan Diperlukan',
        message: 'Kamu memasukkan nominal pengeluaran. Tuliskan keterangannya (misal: beli es batu).',
      });
      return;
    }

    setModalType('close_shift');
    setShowConfirmModal(true);
  };

  // Simpan/Update Shift Pagi
  const executeOpenShift = async () => {
    setShowConfirmModal(false);

    if (shiftId) {
      // Owner membuka gembok pagi -> karyawan menyimpan revisi -> gembok pagi dikunci kembali otomatis
      const { error } = await supabase
        .from('daily_shifts')
        .update({
          initial_cilok: initialCilok,
          initial_tahu: initialTahu,
          is_morning_unlocked: false,
        })
        .eq('id', shiftId);

      if (!error) {
        await supabase.from('shift_staff').delete().eq('shift_id', shiftId);
        const staffInserts = selectedStaff.map((empId) => ({
          shift_id: shiftId,
          employee_id: empId,
          split_ratio: 1.0 / selectedStaff.length,
        }));
        await supabase.from('shift_staff').insert(staffInserts);

        setIsMorningUnlocked(false);
        setFeedbackModal({
          show: true,
          type: 'success',
          title: 'Revisi Pagi Tersimpan',
          message: 'Data personil dan stok awal berhasil diperbarui dan dikunci kembali.',
        });
      }
      return;
    }

    // Buka shift pertama kali
    const { data: newShift, error } = await supabase
      .from('daily_shifts')
      .insert({
        branch_id: branchId,
        shift_date: today,
        status: 'open',
        initial_cilok: initialCilok,
        initial_tahu: initialTahu,
        is_morning_unlocked: false,
      })
      .select()
      .single();

    if (error) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Gagal Membuka Shift',
        message: error.message,
      });
      return;
    }

    const staffInserts = selectedStaff.map((empId) => ({
      shift_id: newShift.id,
      employee_id: empId,
      split_ratio: 1.0 / selectedStaff.length,
    }));
    await supabase.from('shift_staff').insert(staffInserts);

    setShiftId(newShift.id);
    setShiftStatus('open');
    setIsMorningUnlocked(false);
    setActiveTab('malam');

    setFeedbackModal({
      show: true,
      type: 'success',
      title: 'Shift Berhasil Dibuka',
      message: `Selamat bertugas! Data stok awal cabang ${branchName} telah tersimpan dan dikunci.`,
    });
  };

  // Simpan Tutup Kasir Malam
  const executeCloseShift = async () => {
    setShowConfirmModal(false);

    const { error } = await supabase
      .from('daily_shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        additional_cilok: additionalCilok,
        additional_tahu: additionalTahu,
        remaining_cilok: remainingCilok,
        remaining_tahu: remainingTahu,
        sold_cilok: soldCilok,
        sold_tahu: soldTahu,
        gross_revenue: grossRevenue,
        fee_amount: feeKaryawan,
        branch_expenses: expenseAmount,
        expense_notes: expenseNotes,
        net_cash_deposit: netCashDeposit,
        supplies_status: supplies,
      })
      .eq('id', shiftId);

    if (error) {
      setFeedbackModal({
        show: true,
        type: 'error',
        title: 'Gagal Menutup Kasir',
        message: error.message,
      });
      return;
    }

    setShiftStatus('closed');
    setFeedbackModal({
      show: true,
      type: 'success',
      title: 'Kasir Berhasil Ditutup',
      message: `Setoran bersih sebesar Rp ${netCashDeposit.toLocaleString('id-ID')} telah tercatat aman.`,
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
        <p className="text-neutral-500 font-medium">Memuat data cabang...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl border border-neutral-200 min-h-[720px] flex flex-col justify-between p-6 relative">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1 pr-10">
              <span className="text-[11px] font-bold text-[#C2410C] uppercase tracking-wider block">
                Operasional Cabang
              </span>
              <h1 className="text-xl font-black text-neutral-900 leading-tight">{branchName}</h1>
            </div>
          </div>

          {/* Tab Menu */}
          <div className="grid grid-cols-2 bg-neutral-100 p-1 rounded-2xl mb-5 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('pagi')}
              className={`py-2 rounded-xl transition-all ${
                activeTab === 'pagi' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              1. Shift Pagi
            </button>
            <button
              onClick={() => setActiveTab('malam')}
              className={`py-2 rounded-xl transition-all ${
                activeTab === 'malam' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              2. Setoran Malam
            </button>
          </div>

          {/* TAB 1: SHIFT PAGI */}
          {activeTab === 'pagi' && (
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-2">
                  Siapa yang jaga hari ini?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {employees.map((emp) => {
                    const isSelected = selectedStaff.includes(emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        disabled={!canEditMorning}
                        onClick={() => handleToggleStaff(emp.id)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'border-[#C2410C] bg-[#FFF7ED] text-[#C2410C]'
                            : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                        } disabled:opacity-75 disabled:cursor-not-allowed`}
                      >
                        {emp.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-2">
                  Stok Awal Diterima (Pagi)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
                    <span className="text-xs font-medium text-neutral-500 block">Cilok (Butir)</span>
                    <input
                      type="number"
                      disabled={!canEditMorning}
                      value={initialCilok || ''}
                      onChange={(e) => setInitialCilok(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-transparent text-xl font-black text-neutral-900 focus:outline-none disabled:text-neutral-500 mt-1"
                    />
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
                    <span className="text-xs font-medium text-neutral-500 block">Tahu (Pcs)</span>
                    <input
                      type="number"
                      disabled={!canEditMorning}
                      value={initialTahu || ''}
                      onChange={(e) => setInitialTahu(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-transparent text-xl font-black text-neutral-900 focus:outline-none disabled:text-neutral-500 mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Status Banner Pagi */}
              {shiftStatus !== 'none' && !isMorningUnlocked && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Shift pagi sudah aktif terkunci. Silakan lanjut jualan!</span>
                </div>
              )}

              {shiftStatus !== 'none' && isMorningUnlocked && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-blue-800 text-xs font-semibold animate-in fade-in">
                  <Unlock className="w-5 h-5 text-blue-600 shrink-0" />
                  <span>Owner membuka gembok pagi. Silakan ubah data personil/stok lalu simpan revisi.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SETORAN MALAM */}
          {activeTab === 'malam' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-1">
                  Tambahan Stok Siang/Sore (Opsional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    value={additionalCilok || ''}
                    onChange={(e) => setAdditionalCilok(Number(e.target.value))}
                    placeholder="+ Tambah Cilok"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#C2410C] disabled:bg-neutral-100"
                  />
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    value={additionalTahu || ''}
                    onChange={(e) => setAdditionalTahu(Number(e.target.value))}
                    placeholder="+ Tambah Tahu"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#C2410C] disabled:bg-neutral-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-1">
                  Sisa Fisik Stok Malam (Belum Terjual)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
                    <span className="text-[11px] font-medium text-neutral-500 block">Sisa Cilok</span>
                    <input
                      type="number"
                      disabled={shiftStatus === 'closed'}
                      value={remainingCilok || ''}
                      onChange={(e) => setRemainingCilok(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-transparent text-lg font-black text-neutral-900 focus:outline-none disabled:text-neutral-500 mt-0.5"
                    />
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
                    <span className="text-[11px] font-medium text-neutral-500 block">Sisa Tahu</span>
                    <input
                      type="number"
                      disabled={shiftStatus === 'closed'}
                      value={remainingTahu || ''}
                      onChange={(e) => setRemainingTahu(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-transparent text-lg font-black text-neutral-900 focus:outline-none disabled:text-neutral-500 mt-0.5"
                    />
                  </div>
                </div>
              </div>

              {/* Rekap Card */}
              <div className="bg-neutral-900 text-white rounded-2xl p-4 text-xs space-y-1.5 shadow-md">
                <div className="flex justify-between text-neutral-300">
                  <span>Terjual ({soldCilok} Cilok, {soldTahu} Tahu)</span>
                  <span className="font-semibold text-white">Rp {grossRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-medium">
                  <span>Fee Karyawan (10%)</span>
                  <span>- Rp {feeKaryawan.toLocaleString('id-ID')}</span>
                </div>
                {expenseAmount > 0 && (
                  <div className="flex justify-between text-rose-400 font-medium">
                    <span>Pengeluaran ({expenseNotes || 'Biaya'})</span>
                    <span>- Rp {Number(expenseAmount).toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-neutral-800 flex justify-between items-center text-sm font-black">
                  <span>UANG SETORAN BERSIH</span>
                  <span className="text-emerald-400 text-base">
                    Rp {netCashDeposit.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Input Pengeluaran */}
              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-1">
                  Pengeluaran Cabang Hari Ini (Jika Ada)
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    value={expenseAmount || ''}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    placeholder="Nominal pengeluaran (misal: 10000)"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#C2410C] disabled:bg-neutral-100"
                  />
                  <input
                    type="text"
                    disabled={shiftStatus === 'closed'}
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    placeholder="Keterangan pengeluaran (misal: beli es batu, gas)"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-[#C2410C] disabled:bg-neutral-100"
                  />
                </div>
              </div>

              {/* Status Bahan */}
              <div>
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wide block mb-1">
                  Kondisi Bahan Pendukung (Klik untuk ganti)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(supplies).map(([item, level]) => {
                    const badgeColor =
                      level === 'Banyak'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : level === 'Sedang'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-rose-100 text-rose-800 border-rose-200';

                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={shiftStatus === 'closed'}
                        onClick={() => cycleSupplyLevel(item)}
                        className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs font-bold capitalize hover:bg-neutral-100 disabled:opacity-75"
                      >
                        <span className="text-neutral-800">{item}</span>
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${badgeColor}`}>
                          {level}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {shiftStatus === 'closed' && (
                <div className="p-3.5 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center gap-2 text-neutral-700 text-xs font-semibold">
                  <Lock className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>Shift malam sudah disetor & dikunci. Hubungi Owner untuk membuka gembok.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Tombol */}
        <div className="pt-4 border-t border-neutral-100">
          {activeTab === 'pagi' ? (
            <button
              onClick={triggerOpenShift}
              disabled={!canEditMorning}
              className="w-full py-3.5 px-4 bg-[#C2410C] hover:bg-[#A3360A] disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              {shiftStatus === 'none' ? (
                <>
                  <Clock className="w-4 h-4" /> Buka Shift Pagi
                </>
              ) : isMorningUnlocked ? (
                <>
                  <Save className="w-4 h-4" /> Simpan Revisi Shift Pagi
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" /> Shift Pagi Sudah Terkunci
                </>
              )}
            </button>
          ) : (
            <button
              onClick={triggerCloseShift}
              disabled={shiftStatus !== 'open'}
              className="w-full py-3.5 px-4 bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              {shiftStatus === 'open' ? (
                <>
                  <DollarSign className="w-4 h-4 text-emerald-400" /> Simpan & Setor Kasir Malam
                </>
              ) : shiftStatus === 'closed' ? (
                <>
                  <Lock className="w-4 h-4" /> Shift Sudah Ditutup
                </>
              ) : (
                'Buka Shift Pagi Dulu'
              )}
            </button>
          )}
        </div>

        {/* Modal Konfirmasi */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200">
              <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 flex items-center justify-center text-[#C2410C] mb-4">
                {modalType === 'open_shift' ? <Clock className="w-7 h-7" /> : <ReceiptText className="w-7 h-7" />}
              </div>

              <h3 className="text-lg font-black text-neutral-900 mb-1">
                {modalType === 'open_shift' ? 'Konfirmasi Data Shift Pagi' : 'Konfirmasi Setoran Kasir'}
              </h3>
              
              <p className="text-xs text-neutral-500 mb-5">
                {modalType === 'open_shift'
                  ? 'Pastikan fisik stok awal dan personil jaga sudah sesuai.'
                  : 'Pastikan uang kasir sesuai dengan angka setoran bersih di bawah ini:'}
              </p>

              {modalType === 'close_shift' && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 mb-5 text-left text-xs space-y-1.5">
                  <div className="flex justify-between text-neutral-600">
                    <span>Penjualan Kotor</span>
                    <span className="font-bold text-neutral-900">Rp {grossRevenue.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Fee Karyawan (10%)</span>
                    <span className="font-semibold text-amber-600">- Rp {feeKaryawan.toLocaleString('id-ID')}</span>
                  </div>
                  {expenseAmount > 0 && (
                    <div className="flex justify-between text-neutral-600">
                      <span>Pengeluaran Toko</span>
                      <span className="font-semibold text-rose-600">- Rp {expenseAmount.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-neutral-200 flex justify-between items-center text-sm font-black">
                    <span className="text-neutral-900">Uang Disetor:</span>
                    <span className="text-emerald-600 text-base">
                      Rp {netCashDeposit.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="py-3 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={modalType === 'open_shift' ? executeOpenShift : executeCloseShift}
                  className="py-3 px-4 rounded-xl bg-[#C2410C] hover:bg-[#A3360A] text-xs font-bold text-white shadow-md"
                >
                  {modalType === 'open_shift' ? 'Ya, Simpan' : 'Ya, Setor & Kunci'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Feedback */}
        {feedbackModal.show && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200 relative">
              <button
                onClick={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
              >
                <X className="w-4 h-4" />
              </button>

              <div
                className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}
              >
                {feedbackModal.type === 'success' ? <CheckCircle2 className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
              </div>

              <h3 className="text-base font-black text-neutral-900 mb-1.5">{feedbackModal.title}</h3>
              <p className="text-xs text-neutral-500 leading-relaxed mb-6">{feedbackModal.message}</p>

              <button
                type="button"
                onClick={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
                className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold shadow-md"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}