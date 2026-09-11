'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  LogOut,
  Settings,
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle,
  Clock,
  Store,
  Users,
  Unlock,
  RotateCcw,
  Sun,
  AlertTriangle,
  CheckCircle2,
  X,
  ChefHat,
  BarChart3
} from 'lucide-react';

interface BranchReport {
  id: string;
  name: string;
  pin: string;
  shiftStatus: 'none' | 'open' | 'closed';
  shiftId?: string;
  openedAt?: string;
  closedAt?: string;
  staffNames: string[];
  soldCilok: number;
  soldTahu: number;
  grossRevenue: number;
  feeAmount: number;
  branchExpenses: number;
  expenseNotes: string;
  netCashDeposit: number;
  isPickedUp: boolean;
  supplies: Record<string, string>;
  remainingCilok: number;
  remainingTahu: number;
}

interface EmployeeStat {
  name: string;
  totalSoldCilok: number;
  totalSoldTahu: number;
  shiftsCount: number;
}

type ActionType = 'unlock_night' | 'unlock_morning' | 'reset_shift';

const BRANCH_ORDER = ['Calung', 'Cemara', 'Danau Singkarak', 'Sriwijaya'];

export default function OwnerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const [reports, setReports] = useState<BranchReport[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStat[]>([]);

  // State Modal Konfirmasi & Notifikasi Custom
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: ActionType;
    shiftId: string;
    branchName: string;
  }>({
    show: false,
    type: 'unlock_night',
    shiftId: '',
    branchName: '',
  });

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

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const fetchDashboardData = async (dateStr: string) => {
    setLoading(true);

    const { data: branchesData } = await supabase.from('branches').select('*');
    const { data: shiftsData } = await supabase.from('daily_shifts').select('*').eq('shift_date', dateStr);
    const { data: staffData } = await supabase.from('shift_staff').select('shift_id, employee_id, employees(name)');
    const { data: empData } = await supabase.from('employees').select('*').order('name');

    if (branchesData) {
      const compiledReports: BranchReport[] = branchesData.map((branch) => {
        const shift = shiftsData?.find((s) => s.branch_id === branch.id);

        if (!shift) {
          return {
            id: branch.id,
            name: branch.name,
            pin: branch.pin,
            shiftStatus: 'none',
            staffNames: [],
            soldCilok: 0,
            soldTahu: 0,
            grossRevenue: 0,
            feeAmount: 0,
            branchExpenses: 0,
            expenseNotes: '',
            netCashDeposit: 0,
            isPickedUp: false,
            supplies: { saos: '-', kecap: '-', plastik: '-', tusukan: '-' },
            remainingCilok: 0,
            remainingTahu: 0,
          };
        }

        const relatedStaff = staffData
          ?.filter((st) => st.shift_id === shift.id)
          .map((st: any) => st.employees?.name || 'Staff') || [];

        return {
          id: branch.id,
          name: branch.name,
          pin: branch.pin,
          shiftStatus: shift.status as 'open' | 'closed',
          shiftId: shift.id,
          openedAt: shift.opened_at,
          closedAt: shift.closed_at,
          staffNames: relatedStaff,
          soldCilok: shift.sold_cilok || 0,
          soldTahu: shift.sold_tahu || 0,
          grossRevenue: Number(shift.gross_revenue) || 0,
          feeAmount: Number(shift.fee_amount) || 0,
          branchExpenses: Number(shift.branch_expenses) || 0,
          expenseNotes: shift.expense_notes || '',
          netCashDeposit: Number(shift.net_cash_deposit) || 0,
          isPickedUp: shift.is_picked_up || false,
          supplies: shift.supplies_status || {},
          remainingCilok: shift.remaining_cilok || 0,
          remainingTahu: shift.remaining_tahu || 0,
        };
      });

      compiledReports.sort((a, b) => {
        const iA = BRANCH_ORDER.indexOf(a.name);
        const iB = BRANCH_ORDER.indexOf(b.name);
        return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
      });

      setReports(compiledReports);
    }

    if (empData && shiftsData && staffData) {
      const statsMap: Record<string, EmployeeStat> = {};
      empData.forEach((e) => {
        statsMap[e.id] = { name: e.name, totalSoldCilok: 0, totalSoldTahu: 0, shiftsCount: 0 };
      });

      shiftsData.forEach((shift) => {
        const staffInShift = staffData.filter((st) => st.shift_id === shift.id);
        const count = staffInShift.length || 1;
        staffInShift.forEach((st) => {
          if (statsMap[st.employee_id]) {
            statsMap[st.employee_id].shiftsCount += 1;
            statsMap[st.employee_id].totalSoldCilok += Math.round((shift.sold_cilok || 0) / count);
            statsMap[st.employee_id].totalSoldTahu += Math.round((shift.sold_tahu || 0) / count);
          }
        });
      });

      setEmployeeStats(Object.values(statsMap));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData(selectedDate);
  }, [selectedDate]);

  const handleTogglePickup = async (shiftId?: string, currentStatus?: boolean) => {
    if (!shiftId) return;
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from('daily_shifts')
      .update({ is_picked_up: nextStatus })
      .eq('id', shiftId);

    if (!error) {
      setReports((prev) =>
        prev.map((r) => (r.shiftId === shiftId ? { ...r, isPickedUp: nextStatus } : r))
      );
    }
  };

  // Buka Modal Konfirmasi Custom
  const triggerActionModal = (type: ActionType, shiftId?: string, branchName?: string) => {
    if (!shiftId || !branchName) return;
    setConfirmModal({
      show: true,
      type,
      shiftId,
      branchName,
    });
  };

  // Eksekusi Aksi Gembok & Reset
  const executeModalAction = async () => {
    const { type, shiftId, branchName } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, show: false }));

    if (type === 'unlock_night') {
      const { error } = await supabase
        .from('daily_shifts')
        .update({ status: 'open' })
        .eq('id', shiftId);

      if (error) {
        setFeedbackModal({
          show: true,
          type: 'error',
          title: 'Gagal Membuka Gembok',
          message: error.message,
        });
      } else {
        setFeedbackModal({
          show: true,
          type: 'success',
          title: 'Gembok Malam Dibuka',
          message: `Kasir cabang ${branchName} berhasil dibuka kembali. Minta karyawan me-refresh HP-nya untuk merevisi data setoran.`,
        });
        fetchDashboardData(selectedDate);
      }
    } else if (type === 'unlock_morning') {
      // SAKELAR ON: Mengizinkan form shift pagi diedit kembali
      const { error } = await supabase
        .from('daily_shifts')
        .update({ is_morning_unlocked: true })
        .eq('id', shiftId);

      if (error) {
        setFeedbackModal({
          show: true,
          type: 'error',
          title: 'Gagal Membuka Gembok',
          message: error.message,
        });
      } else {
        setFeedbackModal({
          show: true,
          type: 'success',
          title: 'Gembok Pagi Dibuka',
          message: `Izin edit form pagi cabang ${branchName} aktif. Karyawan sekarang bisa merevisi personil & stok awal di HP-nya.`,
        });
        fetchDashboardData(selectedDate);
      }
    } else if (type === 'reset_shift') {
      const { error } = await supabase
        .from('daily_shifts')
        .delete()
        .eq('id', shiftId);

      if (error) {
        setFeedbackModal({
          show: true,
          type: 'error',
          title: 'Gagal Mereset Shift',
          message: error.message,
        });
      } else {
        setFeedbackModal({
          show: true,
          type: 'success',
          title: 'Shift Direset Bersih',
          message: `Seluruh laporan harian ${branchName} telah dihapus. Status cabang kembali ke "Belum buka" dari nol.`,
        });
        fetchDashboardData(selectedDate);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('rasajo_owner_logged_in');
    router.push('/');
  };

  const totalGross = reports.reduce((acc, r) => acc + r.grossRevenue, 0);
  const totalFees = reports.reduce((acc, r) => acc + r.feeAmount, 0);
  const totalExpenses = reports.reduce((acc, r) => acc + r.branchExpenses, 0);
  const totalNetCash = reports.reduce((acc, r) => acc + r.netCashDeposit, 0);
  const totalPickedUpCash = reports
    .filter((r) => r.isPickedUp)
    .reduce((acc, r) => acc + r.netCashDeposit, 0);

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Navbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200 shadow-sm">
          <div>
            <span className="text-[11px] font-bold text-[#C2410C] tracking-wider uppercase block">
              Rasajo Owner Dashboard
            </span>
            <h1 className="text-xl font-black text-neutral-900">Pusat Kendali Bisnis</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500">Tanggal:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#C2410C]"
              />
            </div>

            {/* Tombol ke Modul Dapur & Produksi */}
            <button
              onClick={() => router.push('/owner/production')}
              className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <ChefHat className="w-4 h-4 text-[#C2410C]" />
              <span className="hidden sm:inline">Dapur & Produksi</span>
            </button>

            {/* Tombol ke Rekap Laporan & Analytics */}
            <button
              onClick={() => router.push('/owner/reports')}
              className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <BarChart3 className="w-4 h-4 text-neutral-600" />
              <span className="hidden sm:inline">Rekap Laporan</span>
            </button>

            {/* Tombol ke Pengaturan */}
            <button
              onClick={() => router.push('/owner/settings')}
              className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <Settings className="w-4 h-4 text-neutral-600" />
              <span className="hidden sm:inline">Pengaturan</span>
            </button>

            {/* Tombol Logout */}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* 4 Kartu Metrik Keuangan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Omzet Kotor</span>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-neutral-900">
              Rp {totalGross.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-400 mt-1 block">Penjualan cilok & tahu</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Fee Karyawan</span>
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-neutral-900">
              Rp {totalFees.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-400 mt-1 block">10% hak jaga shift</span>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between text-neutral-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pengeluaran Cabang</span>
              <Receipt className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-neutral-900">
              Rp {totalExpenses.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-400 mt-1 block">Es, gas, & belanja harian</span>
          </div>

          <div className="bg-neutral-900 p-5 rounded-3xl text-white shadow-md">
            <div className="flex items-center justify-between text-neutral-300 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Setoran Bersih</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">
              Rp {totalNetCash.toLocaleString('id-ID')}
            </p>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Sudah Diambil: Rp {totalPickedUpCash.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Monitoring 4 Cabang */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-[#C2410C]" /> Operasional 4 Cabang
            </h2>
            <span className="text-xs text-neutral-500">
              {reports.filter((r) => r.shiftStatus === 'closed').length} dari {reports.length} sudah tutup kasir
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-neutral-400 font-medium bg-white rounded-3xl border border-neutral-200">
              Memuat data laporan...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((branch) => (
                <div
                  key={branch.id}
                  className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Header Cabang */}
                    <div className="flex items-start justify-between border-b border-neutral-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-neutral-900 text-lg">{branch.name}</h3>
                          <span className="text-[10px] font-mono bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-600">
                            PIN: {branch.pin}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Penjaga:{' '}
                          <span className="font-semibold text-neutral-700">
                            {branch.staffNames.length > 0 ? branch.staffNames.join(', ') : '-'}
                          </span>
                        </p>

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] font-medium text-neutral-500">
                          <span>Buka: <b className="text-neutral-800">{formatTime(branch.openedAt)}</b></span>
                          <span>&bull;</span>
                          <span>Tutup: <b className="text-neutral-800">{formatTime(branch.closedAt)}</b></span>
                        </div>
                      </div>

                      <div className="text-right">
                        {branch.shiftStatus === 'closed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3.5 h-3.5" /> Sudah Tutup
                          </span>
                        ) : branch.shiftStatus === 'open' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                            <Clock className="w-3.5 h-3.5" /> Buka / Jualan
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500">
                            Belum Buka
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Penjualan */}
                    <div className="grid grid-cols-3 gap-2 py-3 text-center border-b border-neutral-100 text-xs">
                      <div className="bg-neutral-50 p-2 rounded-xl">
                        <span className="text-[10px] text-neutral-400 block font-medium">Terjual</span>
                        <span className="font-bold text-neutral-800">
                          {branch.soldCilok} C / {branch.soldTahu} T
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2 rounded-xl">
                        <span className="text-[10px] text-neutral-400 block font-medium">Sisa Fisik</span>
                        <span className="font-bold text-neutral-800">
                          {branch.remainingCilok} C / {branch.remainingTahu} T
                        </span>
                      </div>
                      <div className="bg-neutral-50 p-2 rounded-xl">
                        <span className="text-[10px] text-neutral-400 block font-medium">Pengeluaran</span>
                        <span className="font-bold text-rose-600">
                          Rp {branch.branchExpenses.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {branch.expenseNotes && (
                      <div className="text-[11px] text-neutral-600 bg-rose-50/70 border border-rose-100 p-2 rounded-xl">
                        <span className="font-bold text-rose-800">Ket. Biaya:</span> {branch.expenseNotes}
                      </div>
                    )}

                    {/* Bahan Pendukung */}
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                        Kondisi Bahan Pendukung
                      </span>
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {Object.entries(branch.supplies).map(([item, level]) => (
                          <div
                            key={item}
                            className={`p-1.5 rounded-lg border text-[10px] font-bold capitalize ${
                              level === 'Banyak'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : level === 'Sedang'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : level === 'Sedikit'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                            }`}
                          >
                            <span className="block text-[9px] text-neutral-500">{item}</span>
                            {level}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Panel Aksi Setoran & Gembok */}
                  <div className="space-y-3 pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-bold">SETORAN BERSIH</span>
                        <span className="text-base font-black text-emerald-700">
                          Rp {branch.netCashDeposit.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {branch.shiftStatus === 'closed' && (
                        <button
                          type="button"
                          onClick={() => handleTogglePickup(branch.shiftId, branch.isPickedUp)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                            branch.isPickedUp
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300'
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {branch.isPickedUp ? 'Uang Diambil' : 'Tandai Diambil'}
                        </button>
                      )}
                    </div>

                    {/* 3 AKSES KONTROL OWNER */}
                    {branch.shiftStatus !== 'none' && (
                      <div className="pt-2 border-t border-dashed border-neutral-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                          Kontrol Gembok Owner:
                        </span>
                        
                        <div className="flex flex-wrap items-center gap-1.5">
                          {branch.shiftStatus === 'closed' && (
                            <button
                              type="button"
                              onClick={() => triggerActionModal('unlock_night', branch.shiftId, branch.name)}
                              className="flex-1 min-w-[120px] py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                            >
                              <Unlock className="w-3.5 h-3.5" /> Buka Gembok Malam
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => triggerActionModal('unlock_morning', branch.shiftId, branch.name)}
                            className="flex-1 min-w-[120px] py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                          >
                            <Sun className="w-3.5 h-3.5" /> Buka Gembok Pagi
                          </button>

                          <button
                            type="button"
                            onClick={() => triggerActionModal('reset_shift', branch.shiftId, branch.name)}
                            className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset Hari Ini
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performa Karyawan */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-neutral-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#C2410C]" /> Performa Penjualan Karyawan
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {employeeStats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3 text-center space-y-1"
              >
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#C2410C] font-extrabold mx-auto flex items-center justify-center text-xs">
                  {stat.name[0]}
                </div>
                <h4 className="font-bold text-neutral-900 text-xs">{stat.name}</h4>
                <p className="text-[11px] font-black text-neutral-700">
                  {stat.totalSoldCilok + stat.totalSoldTahu} <span className="text-[9px] font-normal text-neutral-400">butir</span>
                </p>
                <span className="text-[10px] text-neutral-400 block">
                  {stat.shiftsCount} shift aktif
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* MODAL 1: KONFIRMASI AKSI OWNER */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200">
            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                confirmModal.type === 'unlock_night'
                  ? 'bg-amber-100 text-amber-600'
                  : confirmModal.type === 'unlock_morning'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              {confirmModal.type === 'unlock_night' ? (
                <Unlock className="w-7 h-7" />
              ) : confirmModal.type === 'unlock_morning' ? (
                <Sun className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-lg font-black text-neutral-900 mb-1.5">
              {confirmModal.type === 'unlock_night'
                ? `Buka Kasir ${confirmModal.branchName}?`
                : confirmModal.type === 'unlock_morning'
                ? `Buka Form Pagi ${confirmModal.branchName}?`
                : `Reset Total ${confirmModal.branchName}?`}
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              {confirmModal.type === 'unlock_night'
                ? 'Status kasir malam akan kembali dibuka sehingga karyawan dapat merevisi hitungan sisa atau nota pengeluaran.'
                : confirmModal.type === 'unlock_morning'
                ? 'Form pagi akan dibuka kembali agar karyawan dapat mengganti personil jaga atau memperbarui stok awal cilok/tahu.'
                : 'Tindakan ini akan menghapus seluruh rekapan shift hari ini. Outlet akan kembali ke status "Belum buka" dari awal.'}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
                className="py-3 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeModalAction}
                className={`py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all ${
                  confirmModal.type === 'unlock_night'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : confirmModal.type === 'unlock_morning'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmModal.type === 'unlock_night'
                  ? 'Ya, Buka Kasir'
                  : confirmModal.type === 'unlock_morning'
                  ? 'Ya, Buka Pagi'
                  : 'Ya, Reset Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: NOTIFIKASI BERHASIL / GAGAL */}
      {feedbackModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                feedbackModal.type === 'success'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-rose-100 text-rose-600'
              }`}
            >
              {feedbackModal.type === 'success' ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-base font-black text-neutral-900 mb-1.5">
              {feedbackModal.title}
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              {feedbackModal.message}
            </p>

            <button
              type="button"
              onClick={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

    </main>
  );
}