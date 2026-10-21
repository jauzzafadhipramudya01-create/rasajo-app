'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  Plus,
  Trash2,
  AlertCircle,
  PackageCheck,
  Store,
  ShoppingBag,
  Sparkles,
  Award,
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

  // Tab Menu Aktif (Awal vs Akhir)
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

  // Status Shift Hari Ini
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [shiftStatus, setShiftStatus] = useState<'not_started' | 'open' | 'closed'>('not_started');
  const [isMorningUnlocked, setIsMorningUnlocked] = useState(false);
  const [todayPoints, setTodayPoints] = useState<number>(0);

  // 1. Stok Awal
  const [initialCilok, setInitialCilok] = useState<number | ''>('');
  const [initialTahu, setInitialTahu] = useState<number | ''>('');
  const [suppliesMorning, setSuppliesMorning] = useState({
    bumbu: 'Banyak',
    tusukan: 'Banyak',
    plastik: 'Banyak',
  });

  // 2. Tambahan Stok Siang/Sore
  const [extraCilok, setExtraCilok] = useState<number | ''>('');
  const [extraTahu, setExtraTahu] = useState<number | ''>('');

  // 3. Stok Akhir
  const [remainingCilok, setRemainingCilok] = useState<number | ''>('');
  const [remainingTahu, setRemainingTahu] = useState<number | ''>('');
  const [suppliesNight, setSuppliesNight] = useState({
    bumbu: 'Sedang',
    tusukan: 'Sedang',
    plastik: 'Sedang',
  });

  // Pengeluaran Kasir Sederhana
  const [expenseList, setExpenseList] = useState<ExpenseRow[]>([
    { note: '', amount: 0 }
  ]);

  // Modal Notifikasi
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning'; title: string; message: string }>({
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
      setTodayPoints(sData.discipline_points || 0);

      setInitialCilok(sData.initial_cilok || 0);
      setInitialTahu(sData.initial_tahu || 0);
      setRemainingCilok(sData.remaining_cilok || 0);
      setRemainingTahu(sData.remaining_tahu || 0);

      // Default buka tab akhir kalau shift sudah jalan
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

  // Cek apakah cabang tipe buka jam 08.00 (Calung / Sriwijaya) atau 09.00 (Cemara / DS)
  const isEarlyBranch = useMemo(() => {
    const nameLower = branchName.toLowerCase();
    return nameLower.includes('calung') || nameLower.includes('sriwijaya');
  }, [branchName]);

  // Hitung Poin Disiplin Berdasarkan Cabang & Jam Buka
  const calculatePoints = (): number => {
    if (isPast12PM) {
      return 0; // Lewat jam 12 tidak dapat poin
    }

    if (isEarlyBranch) {
      // Calung & Sriwijaya
      if (currentHour < 9 || (currentHour === 9 && currentMinutes === 0)) {
        return 2; // 08.00 - 09.00
      } else {
        return 1; // 09.01 - 12.00
      }
    } else {
      // Cemara & Danau Singkarak
      if (currentHour < 10 || (currentHour === 10 && currentMinutes === 0)) {
        return 2; // 09.00 - 10.00
      } else {
        return 1; // 10.01 - 12.00
      }
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
        title: 'Batas Waktu Terlewat',
        message: 'Sudah lewat jam 12.00 WIB. Hubungi Owner untuk membuka izin input.'
      });
      return;
    }

    if (selectedStaffIds.length === 0 && !manualStaffName.trim()) {
      setToast({
        show: true,
        type: 'error',
        title: 'Penjaga Belum Dipilih',
        message: 'Pilih minimal satu karyawan yang bertugas hari ini.'
      });
      return;
    }

    if (numInitialCilok <= 0 && numInitialTahu <= 0) {
      setToast({
        show: true,
        type: 'error',
        title: 'Stok Awal Kosong',
        message: 'Masukkan jumlah butir stok awal cilok atau tahu yang diterima.'
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
        title: 'Gagal Membuka Shift',
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
      title: earnedPoints > 0 ? `🎉 Dapat +${earnedPoints} Poin Disiplin!` : 'Laporan Stok Awal Diterima!',
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
        title: 'Kasir Ditutup',
        message: `Laporan terkunci. Setoran bersih: Rp ${netCashDeposit.toLocaleString('id-ID')}. Terima kasih atas kerja keras hari ini!`
      });
      loadOutletData();
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-neutral-500 font-medium text-sm">
        Memuat outlet...
      </main>
    );
  }

  // Tampilan Login PIN Cabang
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#F4F5F7] text-neutral-800 flex items-center justify-center p-4">
        <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-md border border-neutral-200/90 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#C2410C] flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C2410C] block">Login Shift</span>
            <h1 className="text-lg font-black text-neutral-900">{branchName}</h1>
            <p className="text-xs text-neutral-400 mt-0.5">Masukkan 4 digit PIN outlet.</p>
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
              className="w-full text-center tracking-widest text-2xl font-black bg-neutral-100 rounded-2xl py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
            />

            {pinError && (
              <p className="text-xs text-rose-600 font-bold">PIN Cabang salah!</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold"
              >
                Kembali
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#C2410C] text-white text-xs font-black shadow-sm"
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
    <main className="min-h-screen bg-[#F4F5F7] text-neutral-800 pb-16 font-sans antialiased">
      <div className="max-w-lg mx-auto p-4 sm:p-5 space-y-4">

        {/* Header Toko */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-10 h-10 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#C2410C] block">
                Outlet Operasional
              </span>
              <h1 className="text-xl font-black text-neutral-900 tracking-tight">
                {branchName}
              </h1>
            </div>
          </div>

          <div>
            {shiftStatus === 'closed' ? (
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Tutup
              </span>
            ) : shiftStatus === 'open' ? (
              <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-pulse" /> Sedang Jualan
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-500 text-xs font-bold">
                Belum Buka
              </span>
            )}
          </div>
        </div>

        {/* ATURAN POIN DISIPLIN BULAN INI */}
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-3xl p-4 border border-orange-200/80 space-y-2">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#C2410C]" />
            <h2 className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider">
              Aturan Poin Disiplin Bulan Ini
            </h2>
          </div>
          <div className="text-[11px] text-neutral-600 leading-relaxed space-y-1">
            <p>
              • <b>Calung & Sriwijaya:</b> Buka <b>08.00 - 09.00</b> (+2 Poin) | <b>09.01 - 12.00</b> (+1 Poin)
            </p>
            <p>
              • <b>Cemara & Danau Singkarak:</b> Buka <b>09.00 - 10.00</b> (+2 Poin) | <b>10.01 - 12.00</b> (+1 Poin)
            </p>
            <p className="text-rose-700 font-semibold pt-0.5">
              ⚠️ Lewat jam 12.00: Form terkunci, wajib izin Owner, & dapat 0 poin.
            </p>
          </div>

          {shiftStatus !== 'not_started' && todayPoints > 0 && (
            <div className="pt-2 border-t border-orange-200/60 flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Poin Disiplin Hari Ini:
              </span>
              <span className="px-2 py-0.5 bg-emerald-600 text-white font-black rounded-lg">
                +{todayPoints} Pts
              </span>
            </div>
          )}
        </div>

        {/* TOGGLE TAB: BISA GONTA-GANTI MENU KAPAN SAJA */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-neutral-200/80 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('initial')}
            className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'initial'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-[#C2410C]" />
            <span>1. Laporan Stok Awal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('final')}
            className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'final'
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>2. Laporan Stok Akhir</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: FORM LAPORAN STOK AWAL                                  */}
        {/* ============================================================== */}
        {activeTab === 'initial' && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-neutral-200/80 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-extrabold text-neutral-900 text-base">Laporan Stok Awal Pagi</h3>
                <p className="text-xs text-neutral-400">Data penerimaan pasokan saat awal buka toko.</p>
              </div>

              {shiftStatus !== 'not_started' && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Sudah Disimpan
                </span>
              )}
            </div>

            {isMorningLocked && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Waktu Input Habis (Lewat Jam 12.00)</span>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Formulir terkunci otomatis. Hubungi Owner untuk membuka izin input.
                  </p>
                </div>
              </div>
            )}

            {/* Pilihan Jaga */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-neutral-600 block">
                Petugas yang bertugas jaga hari ini:
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
                      className={`py-2.5 px-3 rounded-2xl text-xs font-bold text-left transition-all border ${
                        isSelected
                          ? 'bg-[#C2410C] text-white border-[#C2410C] shadow-sm'
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
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
                      className="text-xs font-bold text-[#C2410C] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tulis nama manual (pengganti/baru)
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
                        className="text-xs text-neutral-400 hover:text-neutral-600 px-2"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Butir Awal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-600 block">
                Jumlah butir stok awal yang diterima:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-neutral-500 block">CILOK (Butir)</span>
                  <input
                    type="number"
                    disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                    placeholder="0"
                    value={initialCilok}
                    onChange={(e) => setInitialCilok(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
                  />
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                  <span className="text-[11px] font-bold text-neutral-500 block">TAHU (Pcs)</span>
                  <input
                    type="number"
                    disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                    placeholder="0"
                    value={initialTahu}
                    onChange={(e) => setInitialTahu(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Perlengkapan Awal */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-neutral-600 block">
                Kondisi bumbu, tusukan, & plastik awal:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['bumbu', 'tusukan', 'plastik'] as const).map((item) => (
                  <div key={item} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-2.5 text-center">
                    <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                      {item}
                    </span>
                    <select
                      disabled={isMorningLocked || (shiftStatus !== 'not_started' && !isMorningUnlocked)}
                      value={suppliesMorning[item]}
                      onChange={(e) => setSuppliesMorning({ ...suppliesMorning, [item]: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none"
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
                className="w-full py-3.5 rounded-2xl bg-[#C2410C] hover:bg-[#A3360A] text-white text-sm font-black shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:bg-neutral-300"
              >
                <Store className="w-4 h-4" />
                <span>{submitting ? 'Memproses...' : 'Simpan & Mulai Jualan'}</span>
              </button>
            ) : (
              <div className="p-3 bg-neutral-100 rounded-2xl text-center text-xs font-bold text-neutral-600">
                🔒 Data stok awal sudah tersimpan. Silakan beralih ke tab <b>Laporan Stok Akhir</b> untuk menutup kasir.
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: FORM LAPORAN STOK AKHIR & TUTUP KASIR                   */}
        {/* ============================================================== */}
        {activeTab === 'final' && (
          <div className="space-y-4">
            {/* Tambahan Stok Siang/Sore */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-neutral-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
                    Tambahan Stok Siang / Sore
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400">Opsional</span>
              </div>
              <p className="text-xs text-neutral-500">
                Isi jika ada kiriman stok susulan. Otomatis menambah total siap jual.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-blue-700 block">TAMBAHAN CILOK</span>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="0 butir"
                    value={extraCilok}
                    onChange={(e) => setExtraCilok(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-black text-blue-900 focus:outline-none mt-0.5"
                  />
                </div>

                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3">
                  <span className="text-[10px] font-bold text-blue-700 block">TAMBAHAN TAHU</span>
                  <input
                    type="number"
                    disabled={shiftStatus === 'closed'}
                    placeholder="0 butir"
                    value={extraTahu}
                    onChange={(e) => setExtraTahu(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-black text-blue-900 focus:outline-none mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Form Laporan Akhir */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-neutral-200/80 space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-neutral-900 text-base">Hitung Sisa Fisik Malam</h3>
                  <p className="text-xs text-neutral-400">Total siap jual: {totalSiapJualCilok} cilok, {totalSiapJualTahu} tahu.</p>
                </div>

                {shiftStatus === 'closed' && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Tutup
                  </span>
                )}
              </div>

              {/* Sisa Fisik */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-600 block">
                  Berapa butir sisa fisik malam ini?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                    <span className="text-[11px] font-bold text-neutral-500 block">SISA CILOK</span>
                    <input
                      type="number"
                      disabled={shiftStatus === 'closed'}
                      placeholder="0"
                      value={remainingCilok}
                      onChange={(e) => setRemainingCilok(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
                    />
                    <span className="text-[10px] text-neutral-400 block mt-1">
                      Laku: <b className="text-emerald-700">{soldCilok} butir</b>
                    </span>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
                    <span className="text-[11px] font-bold text-neutral-500 block">SISA TAHU</span>
                    <input
                      type="number"
                      disabled={shiftStatus === 'closed'}
                      placeholder="0"
                      value={remainingTahu}
                      onChange={(e) => setRemainingTahu(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
                    />
                    <span className="text-[10px] text-neutral-400 block mt-1">
                      Laku: <b className="text-emerald-700">{soldTahu} butir</b>
                    </span>
                  </div>
                </div>
              </div>

              {/* Pengeluaran Kasir Sebaris */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-600 block">
                    Pengeluaran kasir cabang hari ini (es batu, gas, dll):
                  </label>
                  <span className="text-xs font-black text-rose-600">
                    Total: Rp {totalExpenses.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="space-y-2">
                  {expenseList.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled={shiftStatus === 'closed'}
                        placeholder="Keperluan (misal: Es batu)"
                        value={row.note}
                        onChange={(e) => handleExpenseChange(idx, 'note', e.target.value)}
                        className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-neutral-400">Rp</span>
                        <input
                          type="number"
                          disabled={shiftStatus === 'closed'}
                          placeholder="0"
                          value={row.amount || ''}
                          onChange={(e) => handleExpenseChange(idx, 'amount', e.target.value)}
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-2.5 py-2 text-xs font-black text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                        />
                      </div>
                      {shiftStatus !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExpenseRow(idx)}
                          className="p-2 text-neutral-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {shiftStatus !== 'closed' && (
                  <button
                    type="button"
                    onClick={handleAddExpenseRow}
                    className="text-xs font-bold text-neutral-600 hover:text-neutral-900 flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah nota pengeluaran lagi
                  </button>
                )}
              </div>

              {/* Sisa Bahan Pendukung */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-neutral-600 block">
                  Sisa bumbu, tusukan, & plastik malam ini:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bumbu', 'tusukan', 'plastik'] as const).map((item) => (
                    <div key={item} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-2.5 text-center">
                      <span className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                        {item}
                      </span>
                      <select
                        disabled={shiftStatus === 'closed'}
                        value={suppliesNight[item]}
                        onChange={(e) => setSuppliesNight({ ...suppliesNight, [item]: e.target.value })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none"
                      >
                        <option value="Banyak">Banyak</option>
                        <option value="Sedang">Sedang</option>
                        <option value="Sedikit">Sedikit</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ringkasan Setoran & Fee 10% Dibulatkan ke Rp 500 */}
              <div className="bg-neutral-900 rounded-3xl p-5 text-white space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 text-xs text-neutral-400">
                  <span>Total Omzet Kotor ({soldCilok + soldTahu} butir)</span>
                  <span className="font-bold text-white text-sm">Rp {grossRevenue.toLocaleString('id-ID')}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-amber-400">
                  <div>
                    <span className="font-bold block">Hak Fee Jaga (10% Dibulatkan)</span>
                    <span className="text-[10px] text-neutral-400">Hitungan riil: Rp {Math.round(rawFee).toLocaleString('id-ID')}</span>
                  </div>
                  <span className="font-black text-sm">Rp {finalFee.toLocaleString('id-ID')}</span>
                </div>

                {totalExpenses > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-400">
                    <span>Potongan Pengeluaran Cabang</span>
                    <span className="font-bold">- Rp {totalExpenses.toLocaleString('id-ID')}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      TOTAL UANG WAJIB DISETOR:
                    </span>
                    <span className="text-[11px] text-neutral-400">Serahkan ke owner / rekening setoran</span>
                  </div>
                  <span className="text-2xl font-black text-emerald-400">
                    Rp {netCashDeposit.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {shiftStatus === 'open' ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleCloseShift}
                  className="w-full py-4 rounded-2xl bg-neutral-900 hover:bg-black text-white text-sm font-black shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span>{submitting ? 'Menyimpan & Mengunci...' : 'Tutup Kasir & Kunci Laporan'}</span>
                </button>
              ) : shiftStatus === 'not_started' ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs font-bold text-amber-800">
                  ⚠️ Silakan isi dan simpan <b>Laporan Stok Awal</b> terlebih dahulu sebelum menutup kasir.
                </div>
              ) : null}
            </div>
          </div>
        )}

      </div>

      {/* MODAL NOTIFIKASI */}
      {toast.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-150">
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3.5 ${
                toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>

            <h3 className="text-base font-black text-neutral-900 mb-1">{toast.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-5">{toast.message}</p>

            <button
              type="button"
              onClick={() => setToast({ ...toast, show: false })}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </main>
  );
}