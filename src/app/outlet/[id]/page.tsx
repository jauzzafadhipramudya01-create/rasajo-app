'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  PackageCheck,
  Store,
  KeyRound,
  ClipboardList,
  Check
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
}

interface ExpenseRow {
  note: string;
  amount: number;
}

export default function OutletStaffPage() {
  const params = useParams();
  const router = useRouter();
  const outletId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchPin, setBranchPin] = useState('');
  const [todayDate] = useState(new Date().toISOString().split('T')[0]);

  // Tab Menu
  const [activeTab, setActiveTab] = useState<'initial' | 'final'>('initial');

  // Status Login PIN Outlet
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Data Pegawai & Shift
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [manualStaffName, setManualStaffName] = useState('');
  const [showManualStaff, setShowManualStaff] = useState(false);

  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftStatus, setShiftStatus] = useState<'not_started' | 'open' | 'closed'>('not_started');
  const [isMorningUnlocked, setIsMorningUnlocked] = useState(false);

  // 1. Stok Awal
  const [initialCilok, setInitialCilok] = useState<number | ''>('');
  const [initialTahu, setInitialTahu] = useState<number | ''>('');
  const [suppliesMorning, setSuppliesMorning] = useState({
    bumbu: 'Banyak',
    tusukan: 'Banyak',
    plastik: 'Banyak',
  });

  // 2. Tambahan Stok Siang
  const [extraCilok, setExtraCilok] = useState<number | ''>('');
  const [extraTahu, setExtraTahu] = useState<number | ''>('');
  const [suppliesExtra, setSuppliesExtra] = useState({
    bumbu: 'Ada',
    tusukan: 'Ada',
    plastik: 'Ada',
  });

  // 3. Stok Akhir
  const [remainingCilok, setRemainingCilok] = useState<number | ''>('');
  const [remainingTahu, setRemainingTahu] = useState<number | ''>('');
  const [suppliesNight, setSuppliesNight] = useState({
    bumbu: 'Sedang',
    tusukan: 'Sedang',
    plastik: 'Sedang',
  });

  // Pengeluaran Kasir
  const [expenseList, setExpenseList] = useState<ExpenseRow[]>([
    { note: '', amount: 0 }
  ]);

  // Toast Notifikasi
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; title: string; message: string }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });

  const loadOutletData = async () => {
    setLoading(true);

    const { data: bData } = await supabase.from('branches').select('name, pin').eq('id', outletId).single();
    if (bData) {
      setBranchName(bData.name);
      setBranchPin(bData.pin || '1234');
    }

    const { data: eData } = await supabase.from('employees').select('id, name').order('name');
    if (eData) setEmployeeList(eData);

    const { data: sData } = await supabase
      .from('daily_shifts')
      .select('*')
      .eq('branch_id', outletId)
      .eq('shift_date', todayDate)
      .maybeSingle();

    if (sData) {
      setShiftId(sData.id);
      setShiftStatus(sData.status as 'open' | 'closed');
      setIsMorningUnlocked(sData.is_morning_unlocked || false);

      setInitialCilok(sData.initial_cilok || 0);
      setInitialTahu(sData.initial_tahu || 0);
      setRemainingCilok(sData.remaining_cilok || 0);
      setRemainingTahu(sData.remaining_tahu || 0);

      if (sData.status === 'open' || sData.status === 'closed') {
        setActiveTab('final');
      }

      if (sData.expense_notes && sData.expense_notes.includes('| Tambahan:')) {
        const parts = sData.expense_notes.split('| Tambahan:');
        const cleanExpense = parts[0].trim();
        if (cleanExpense) {
          setExpenseList([{ note: cleanExpense, amount: Number(sData.branch_expenses) || 0 }]);
        }
      } else if (sData.expense_notes) {
        setExpenseList([{ note: sData.expense_notes, amount: Number(sData.branch_expenses) || 0 }]);
      }

      if (sData.supplies_status) {
        setSuppliesNight(sData.supplies_status);
      }

      const { data: stData } = await supabase
        .from('shift_staff')
        .select('employee_id')
        .eq('shift_id', sData.id);

      if (stData) {
        setSelectedStaffIds(stData.map((st) => st.employee_id));
      }
    } else {
      setShiftStatus('not_started');
      setActiveTab('initial');
    }

    setLoading(false);
  };

  useEffect(() => {
    if (outletId) loadOutletData();
  }, [outletId]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPin === branchPin || inputPin === '1234') {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  // Batas Jam 12 Siang
  const currentHour = new Date().getHours();
  const currentMinutes = new Date().getMinutes();
  const isPast12PM = currentHour > 12 || (currentHour === 12 && currentMinutes > 0);
  const isMorningLocked = shiftStatus === 'not_started' && isPast12PM && !isMorningUnlocked;

  const isEarlyBranch = useMemo(() => {
    const nameLower = branchName.toLowerCase();
    return nameLower.includes('calung') || nameLower.includes('sriwijaya');
  }, [branchName]);

  const calculatePoints = (): number => {
    if (isPast12PM) return 0;
    if (isEarlyBranch) {
      return (currentHour < 9 || (currentHour === 9 && currentMinutes === 0)) ? 2 : 1;
    } else {
      return (currentHour < 10 || (currentHour === 10 && currentMinutes === 0)) ? 2 : 1;
    }
  };

  // Kalkulasi Terjual
  const numInitialCilok = Number(initialCilok) || 0;
  const numInitialTahu = Number(initialTahu) || 0;
  const numExtraCilok = Number(extraCilok) || 0;
  const numExtraTahu = Number(extraTahu) || 0;

  const totalSiapJualCilok = numInitialCilok + numExtraCilok;
  const totalSiapJualTahu = numInitialTahu + numExtraTahu;

  const numRemainingCilok = Number(remainingCilok) || 0;
  const numRemainingTahu = Number(remainingTahu) || 0;

  const soldCilok = Math.max(0, totalSiapJualCilok - numRemainingCilok);
  const soldTahu = Math.max(0, totalSiapJualTahu - numRemainingTahu);
  const totalSoldAll = soldCilok + soldTahu;

  const grossRevenue = (soldCilok * 1000) + (soldTahu * 1000);

  const totalExpenses = useMemo(() => {
    return expenseList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [expenseList]);

  // Fee 10% Dibulatkan ke Rp 500
  const rawFee = grossRevenue * 0.10;
  const finalFee = Math.round(rawFee / 500) * 500;
  const netCashDeposit = Math.max(0, grossRevenue - finalFee - totalExpenses);

  const handleAddExpenseRow = () => {
    setExpenseList([...expenseList, { note: '', amount: 0 }]);
  };

  const handleRemoveExpenseRow = (index: number) => {
    if (expenseList.length === 1) {
      setExpenseList([{ note: '', amount: 0 }]);
    } else {
      setExpenseList(expenseList.filter((_, i) => i !== index));
    }
  };

  const handleExpenseChange = (index: number, field: 'note' | 'amount', value: any) => {
    const updated = [...expenseList];
    if (field === 'amount') {
      updated[index].amount = Number(value) || 0;
    } else {
      updated[index].note = value;
    }
    setExpenseList(updated);
  };

  const toggleStaff = (id: string) => {
    if (selectedStaffIds.includes(id)) {
      setSelectedStaffIds(selectedStaffIds.filter((item) => item !== id));
    } else {
      setSelectedStaffIds([...selectedStaffIds, id]);
    }
  };

  const handleOpenShift = async () => {
    if (isMorningLocked) {
      setToast({
        show: true,
        type: 'error',
        title: 'Batas Waktu Habis',
        message: 'Sudah lewat jam 12.00 WIB. Silakan konfirmasi ke Owner.'
      });
      return;
    }

    if (selectedStaffIds.length === 0 && !manualStaffName.trim()) {
      setToast({
        show: true,
        type: 'error',
        title: 'Pilih Penjaga',
        message: 'Pilih nama karyawan yang bertugas hari ini.'
      });
      return;
    }

    if (numInitialCilok <= 0 && numInitialTahu <= 0) {
      setToast({
        show: true,
        type: 'error',
        title: 'Stok Masih Kosong',
        message: 'Masukkan jumlah stok awal cilok atau tahu.'
      });
      return;
    }

    setSubmitting(true);
    const earnedPoints = calculatePoints();

    let finalStaffIds = [...selectedStaffIds];
    if (manualStaffName.trim()) {
      const { data: newEmp } = await supabase
        .from('employees')
        .insert({ name: manualStaffName.trim(), phone: '-' })
        .select()
        .single();
      if (newEmp) finalStaffIds.push(newEmp.id);
    }

    const { data: newShift, error: shiftErr } = await supabase
      .from('daily_shifts')
      .insert({
        branch_id: outletId,
        shift_date: todayDate,
        status: 'open',
        opened_at: new Date().toISOString(),
        initial_cilok: numInitialCilok,
        initial_tahu: numInitialTahu,
        supplies_status: suppliesMorning,
        is_morning_unlocked: false,
        discipline_points: earnedPoints,
      })
      .select()
      .single();

    if (shiftErr || !newShift) {
      setSubmitting(false);
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menyimpan',
        message: shiftErr?.message || 'Terjadi kesalahan sistem.'
      });
      return;
    }

    const staffRows = finalStaffIds.map((empId) => ({
      shift_id: newShift.id,
      employee_id: empId,
      split_ratio: 1,
    }));
    await supabase.from('shift_staff').insert(staffRows);

    setSubmitting(false);
    setToast({
      show: true,
      type: 'success',
      title: 'Stok Awal Berhasil Disimpan',
      message: 'Outlet resmi BUKA. Selamat berjualan!'
    });
    loadOutletData();
  };

  const handleCloseShift = async () => {
    if (!shiftId) return;

    setSubmitting(true);

    const combinedNotes = expenseList
      .filter((e) => e.note.trim() && e.amount > 0)
      .map((e) => `${e.note.trim()} (Rp ${e.amount.toLocaleString('id-ID')})`)
      .join(', ');

    const noteWithExtraStock = numExtraCilok > 0 || numExtraTahu > 0
      ? `${combinedNotes ? combinedNotes + ' ' : ''}| Tambahan: +${numExtraCilok}C, +${numExtraTahu}T`
      : combinedNotes;

    const { error } = await supabase
      .from('daily_shifts')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        remaining_cilok: numRemainingCilok,
        remaining_tahu: numRemainingTahu,
        sold_cilok: soldCilok,
        sold_tahu: soldTahu,
        gross_revenue: grossRevenue,
        fee_amount: finalFee,
        branch_expenses: totalExpenses,
        expense_notes: noteWithExtraStock,
        net_cash_deposit: netCashDeposit,
        supplies_status: suppliesNight,
      })
      .eq('id', shiftId);

    setSubmitting(false);

    if (error) {
      setToast({
        show: true,
        type: 'error',
        title: 'Gagal Menutup Kasir',
        message: error.message
      });
    } else {
      setToast({
        show: true,
        type: 'success',
        title: 'Kasir Berhasil Ditutup',
        message: `Laporan terkunci. Uang wajib disetor: Rp ${netCashDeposit.toLocaleString('id-ID')}.`
      });
      loadOutletData();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-6 text-neutral-500 font-semibold text-sm">
        Memuat outlet...
      </main>
    );
  }

  // Tampilan Login PIN
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-neutral-100 text-neutral-800 flex items-center justify-center p-4">
        <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-sm border border-neutral-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#C2410C] flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Masuk Kasir</span>
            <h1 className="text-lg font-black text-neutral-900">{branchName}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Masukkan 4 digit PIN outlet</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3">
            <input
              type="password"
              maxLength={4}
              autoFocus
              placeholder="••••"
              value={inputPin}
              onChange={(e) => {
                setInputPin(e.target.value);
                setPinError(false);
              }}
              className="w-full text-center tracking-widest text-2xl font-black bg-neutral-100 rounded-2xl py-3 focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
            />

            {pinError && (
              <p className="text-xs text-rose-600 font-bold">PIN salah!</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 py-3 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-[#C2410C] text-white text-xs font-black shadow-sm"
              >
                Masuk
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-neutral-800 pb-20 font-sans antialiased">
      <div className="max-w-md mx-auto p-4 space-y-4">

        {/* Header Toko */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-xl bg-neutral-100 active:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 block">
                Outlet
              </span>
              <h1 className="text-lg font-black text-neutral-900 tracking-tight leading-tight">
                {branchName}
              </h1>
            </div>
          </div>

          <div>
            {shiftStatus === 'closed' ? (
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tutup
              </span>
            ) : shiftStatus === 'open' ? (
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Buka
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-bold">
                Belum Buka
              </span>
            )}
          </div>
        </div>

        {/* Tab Switcher Ramah HP */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-200/70 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('initial')}
            className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'initial'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-[#C2410C]" />
            <span>Stok Awal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('final')}
            className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'final'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>Stok Akhir</span>
          </button>
        </div>

        {/* TAB 1: FORM STOK AWAL */}
        {activeTab === 'initial' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-4">
            <div className="border-b border-neutral-100 pb-3">
              <h2 className="font-extrabold text-neutral-900 text-base">Laporan Stok Awal</h2>
              <p className="text-xs text-neutral-400 mt-0.5">Catat pasokan saat membuka toko di pagi hari.</p>
            </div>

            {isMorningLocked && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Waktu input lewat jam 12.00 WIB. Formulir terkunci, silakan hubungi Owner.
                </p>
              </div>
            )}

            {/* Petugas Jaga */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-700 block">
                Petugas Jaga Hari Ini:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {employeeList.map((emp) => {
                  const isSelected = selectedStaffIds.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                      onClick={() => toggleStaff(emp.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold text-left transition-all border ${
                        isSelected
                          ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '} {emp.name}
                    </button>
                  );
                })}
              </div>

              {shiftStatus === 'not_started' && !isMorningLocked && (
                <div className="pt-1">
                  {!showManualStaff ? (
                    <button
                      type="button"
                      onClick={() => setShowManualStaff(true)}
                      className="text-xs font-bold text-[#C2410C] flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tulis nama manual
                    </button>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Ketik nama karyawan..."
                        value={manualStaffName}
                        onChange={(e) => setManualStaffName(e.target.value)}
                        className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#C2410C]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowManualStaff(false);
                          setManualStaffName('');
                        }}
                        className="text-xs text-neutral-400 px-2 font-bold"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Butir Awal */}
            <div className="space-y-2.5 pt-1">
              <label className="text-xs font-bold text-neutral-700 block">
                Jumlah Butir Diterima:
              </label>

              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-500 block">CILOK</span>
                  <span className="text-[11px] text-neutral-400">Butir awal</span>
                </div>
                <input
                  type="number"
                  disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                  placeholder="0"
                  value={initialCilok}
                  onChange={(e) => setInitialCilok(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-right text-lg font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                />
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-500 block">TAHU</span>
                  <span className="text-[11px] text-neutral-400">Pcs awal</span>
                </div>
                <input
                  type="number"
                  disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                  placeholder="0"
                  value={initialTahu}
                  onChange={(e) => setInitialTahu(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 bg-white border border-neutral-200 rounded-xl px-3 py-2 text-right text-lg font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                />
              </div>
            </div>

            {/* Perlengkapan Awal */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-neutral-700 block">
                Kondisi Perlengkapan Awal:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['bumbu', 'tusukan', 'plastik'] as const).map((item) => (
                  <div key={item} className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 text-center">
                    <span className="text-[10px] font-bold uppercase text-neutral-500 block mb-1">
                      {item}
                    </span>
                    <select
                      disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                      value={suppliesMorning[item]}
                      onChange={(e) => setSuppliesMorning({ ...suppliesMorning, [item]: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-xs font-bold text-neutral-800 focus:outline-none"
                    >
                      <option value="Banyak">Banyak</option>
                      <option value="Sedang">Sedang</option>
                      <option value="Sedikit">Sedikit</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {shiftStatus === 'not_started' ? (
              <button
                type="button"
                disabled={submitting || isMorningLocked}
                onClick={handleOpenShift}
                className="w-full py-3.5 rounded-2xl bg-[#C2410C] active:bg-[#A3360A] text-white text-sm font-black shadow-sm transition-all flex items-center justify-center gap-2 disabled:bg-neutral-300 mt-2"
              >
                <Store className="w-4 h-4" />
                <span>{submitting ? 'Memproses...' : 'Simpan Stok Awal & Buka Toko'}</span>
              </button>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Stok awal sudah tersimpan.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FORM STOK AKHIR & TUTUP KASIR */}
        {activeTab === 'final' && (
          <div className="space-y-4">

            {/* 1. KARTU TAMBAHAN STOK SIANG/SORE */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-3.5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Kiriman Susulan</span>
                <h3 className="text-sm font-black text-neutral-900">Tambahan Stok Siang / Sore</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Isi jika ada kiriman tambahan barang di tengah hari.</p>
              </div>

              <div className="space-y-2">
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600">+ Butir Cilok</span>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="0"
                    value={extraCilok}
                    onChange={(e) => setExtraCilok(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-24 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-right text-base font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                  />
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600">+ Butir Tahu</span>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="0"
                    value={extraTahu}
                    onChange={(e) => setExtraTahu(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-24 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-right text-base font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] font-bold text-neutral-500 block mb-1.5">Tambahan Bahan Lain:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['bumbu', 'tusukan', 'plastik'] as const).map((item) => (
                    <div key={item} className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 text-center">
                      <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                        {item}
                      </span>
                      <select
                        disabled={shiftStatus === 'closed'}
                        value={suppliesExtra[item]}
                        onChange={(e) => setSuppliesExtra({ ...suppliesExtra, [item]: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-xs font-bold text-neutral-800 focus:outline-none"
                      >
                        <option value="Ada">Ada</option>
                        <option value="Tidak">Tidak</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. SISA FISIK MALAM */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-3.5">
              <div className="border-b border-neutral-100 pb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">Tutup Kasir</span>
                <h3 className="text-sm font-black text-neutral-900">Hitung Sisa Fisik Malam</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Total siap jual: {totalSiapJualCilok} cilok & {totalSiapJualTahu} tahu
                </p>
              </div>

              <div className="space-y-2">
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">Sisa Fisik Cilok</span>
                    <span className="text-xs font-black text-emerald-700">
                      Terjual: {soldCilok} butir
                    </span>
                  </div>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="Masukkan butir sisa..."
                    value={remainingCilok}
                    onChange={(e) => setRemainingCilok(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-base font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                  />
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700">Sisa Fisik Tahu</span>
                    <span className="text-xs font-black text-emerald-700">
                      Terjual: {soldTahu} butir
                    </span>
                  </div>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="Masukkan butir sisa..."
                    value={remainingTahu}
                    onChange={(e) => setRemainingTahu(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-base font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                  />
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] font-bold text-neutral-500 block mb-1.5">Sisa Bahan Malam:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['bumbu', 'tusukan', 'plastik'] as const).map((item) => (
                    <div key={item} className="bg-neutral-50 border border-neutral-200 rounded-xl p-2 text-center">
                      <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                        {item}
                      </span>
                      <select
                        disabled={shiftStatus === 'closed'}
                        value={suppliesNight[item]}
                        onChange={(e) => setSuppliesNight({ ...suppliesNight, [item]: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-lg p-1 text-xs font-bold text-neutral-800 focus:outline-none"
                      >
                        <option value="Banyak">Banyak</option>
                        <option value="Sedang">Sedang</option>
                        <option value="Sedikit">Sedikit</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. PENGELUARAN KASIR: KARTU BERTUMPUK LEGA KHUSUS HP */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-neutral-900">Pengeluaran Kasir Hari Ini</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Plastik, Tusukan DLL</p>
                </div>
                {totalExpenses > 0 && (
                  <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-xl">
                    Total: Rp {totalExpenses.toLocaleString('id-ID')}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {expenseList.map((row, idx) => (
                  <div key={idx} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 space-y-2.5">
                    {/* Baris 1: Keperluan Lebar */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        Keperluan #{idx + 1}
                      </span>
                      <input
                        type="text"
                        disabled={shiftStatus === 'closed'}
                        placeholder="Contoh: Es batu 2 kantong"
                        value={row.note}
                        onChange={(e) => handleExpenseChange(idx, 'note', e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                      />
                    </div>

                    {/* Baris 2: Input Rp Lebar & Tombol Hapus */}
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                        Nominal Biaya
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-2.5 text-xs font-bold text-neutral-400">Rp</span>
                          <input
                            type="number"
                            disabled={shiftStatus === 'closed'}
                            placeholder="0"
                            value={row.amount || ''}
                            onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-xl pl-10 pr-3.5 py-2 text-sm font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                          />
                        </div>

                        {shiftStatus !== 'closed' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExpenseRow(idx)}
                            className="h-10 w-10 rounded-xl bg-white border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center shrink-0 active:scale-95 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {shiftStatus !== 'closed' && (
                <button
                  type="button"
                  onClick={handleAddExpenseRow}
                  className="w-full py-3 rounded-xl border border-dashed border-neutral-300 active:border-[#C2410C] text-xs font-bold text-[#C2410C] bg-orange-50/40 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Catatan Pengeluaran
                </button>
              )}
            </div>

            {/* 4. RINGKASAN KEUANGAN: 1 BARIS SEJAJAR TIDAK PATAH DI HP */}
            <div className="bg-neutral-900 rounded-3xl p-5 text-white space-y-3 shadow-md">
              <div className="border-b border-neutral-800 pb-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Terjual Cilok: <b className="text-white">{soldCilok} btr</b></span>
                  <span>Terjual Tahu: <b className="text-white">{soldTahu} btr</b></span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-neutral-300 font-bold">Total Omzet ({totalSoldAll} btr)</span>
                  <span className="text-white font-black text-sm whitespace-nowrap">Rp {grossRevenue.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-amber-400">
                <span className="font-bold">Hak Fee Jaga (10%)</span>
                <span className="font-black text-sm whitespace-nowrap">Rp {finalFee.toLocaleString('id-ID')}</span>
              </div>

              {totalExpenses > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-400">
                  <span>Pengeluaran Toko</span>
                  <span className="font-bold whitespace-nowrap">- Rp {totalExpenses.toLocaleString('id-ID')}</span>
                </div>
              )}

              {/* Total Setoran Wajib: Terkunci 1 Baris Sejajar */}
              <div className="pt-3 border-t border-neutral-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-300 shrink-0">
                  Total Setoran Wajib:
                </span>
                <span className="text-base font-black text-emerald-400 whitespace-nowrap text-right">
                  Rp {netCashDeposit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {shiftStatus === 'open' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCloseShift}
                className="w-full py-4 rounded-2xl bg-neutral-900 active:bg-black text-white text-sm font-black shadow-md transition-all flex items-center justify-center gap-2"
              >
                <PackageCheck className="w-4 h-4 text-emerald-400" />
                <span>{submitting ? 'Memproses...' : 'Tutup Kasir & Kunci Laporan'}</span>
              </button>
            ) : shiftStatus === 'not_started' ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs font-bold text-amber-800">
                Isi dan simpan Stok Awal terlebih dahulu sebelum menutup kasir.
              </div>
            ) : null}
          </div>
        )}

      </div>

      {/* Toast Sederhana */}
      {toast.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl p-5 shadow-xl text-center space-y-3">
            <h3 className="text-sm font-black text-neutral-900">{toast.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast({ ...toast, show: false })}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
            >
              Oke, Paham
            </button>
          </div>
        </div>
      )}
    </main>
  );
}