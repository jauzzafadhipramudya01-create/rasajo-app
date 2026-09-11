'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Calendar,
  Download,
  Share2,
  TrendingUp,
  DollarSign,
  Users,
  Receipt,
  Store,
  Check,
  Award,
  ChefHat,
  Wallet,
  Building2,
  ArrowRight
} from 'lucide-react';

interface ShiftRecord {
  id: string;
  shift_date: string;
  branch_id: string;
  branch_name: string;
  sold_cilok: number;
  sold_tahu: number;
  remaining_cilok: number;
  remaining_tahu: number;
  gross_revenue: number;
  fee_amount: number;
  branch_expenses: number;
  expense_notes?: string;
  net_cash_deposit: number;
  status: string;
}

interface StaffShare {
  shift_id: string;
  employee_id: string;
  employee_name: string;
  split_ratio: number;
}

interface ProductionSummary {
  id: string;
  batch_date: string;
  produced_cilok: number;
  produced_tahu: number;
  total_labor_cost: number;
  total_raw_material_cost: number;
  grand_total_cost: number;
}

interface BranchItem {
  id: string;
  name: string;
}

type QuickRangeType = 'today' | '7days' | 'this_month' | 'custom';

export default function OwnerReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Filter Tanggal
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = todayStr.slice(0, 8) + '01';

  const [activeRange, setActiveRange] = useState<QuickRangeType>('this_month');
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);

  // Filter Tab Cabang
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<BranchItem[]>([]);

  // State Data
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [staffShares, setStaffShares] = useState<StaffShare[]>([]);
  const [productions, setProductions] = useState<ProductionSummary[]>([]);

  const fetchReportData = async () => {
    setLoading(true);

    const { data: branchData } = await supabase.from('branches').select('id, name').order('name');
    const branchMap: Record<string, string> = {};
    if (branchData) {
      setBranches(branchData);
      branchData.forEach((b) => {
        branchMap[b.id] = b.name;
      });
    }

    const { data: shiftData } = await supabase
      .from('daily_shifts')
      .select('*')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .eq('status', 'closed')
      .order('shift_date', { ascending: false });

    const { data: staffData } = await supabase
      .from('shift_staff')
      .select('shift_id, employee_id, split_ratio, employees(name)');

    const { data: prodData } = await supabase
      .from('production_batches')
      .select('*')
      .gte('batch_date', startDate)
      .lte('batch_date', endDate)
      .order('batch_date', { ascending: false });

    if (shiftData) {
      const formattedShifts: ShiftRecord[] = shiftData.map((s) => ({
        id: s.id,
        shift_date: s.shift_date,
        branch_id: s.branch_id,
        branch_name: branchMap[s.branch_id] || 'Cabang',
        sold_cilok: s.sold_cilok || 0,
        sold_tahu: s.sold_tahu || 0,
        remaining_cilok: s.remaining_cilok || 0,
        remaining_tahu: s.remaining_tahu || 0,
        gross_revenue: Number(s.gross_revenue) || 0,
        fee_amount: Number(s.fee_amount) || 0,
        branch_expenses: Number(s.branch_expenses) || 0,
        expense_notes: s.expense_notes || '',
        net_cash_deposit: Number(s.net_cash_deposit) || 0,
        status: s.status,
      }));
      setShifts(formattedShifts);
    }

    if (staffData) {
      const formattedStaff: StaffShare[] = staffData.map((st: any) => ({
        shift_id: st.shift_id,
        employee_id: st.employee_id,
        employee_name: st.employees?.name || 'Staff',
        split_ratio: Number(st.split_ratio) || 1,
      }));
      setStaffShares(formattedStaff);
    }

    if (prodData) {
      const formattedProd: ProductionSummary[] = prodData.map((p) => ({
        id: p.id,
        batch_date: p.batch_date,
        produced_cilok: p.produced_cilok || 0,
        produced_tahu: p.produced_tahu || 0,
        total_labor_cost: Number(p.total_labor_cost) || 0,
        total_raw_material_cost: Number(p.total_raw_material_cost) || 0,
        grand_total_cost: Number(p.grand_total_cost) || 0,
      }));
      setProductions(formattedProd);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  // Fungsi Shortcut Tanggal (Tombol Aktif Berubah Warna)
  const handleQuickRange = (range: QuickRangeType) => {
    setActiveRange(range);
    if (range === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (range === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (range === 'this_month') {
      setStartDate(firstDayOfMonth);
      setEndDate(todayStr);
    }
  };

  // Filter Shifts berdasarkan Tab Cabang yang dipilih
  const filteredShifts = useMemo(() => {
    if (selectedBranchId === 'all') return shifts;
    return shifts.filter((s) => s.branch_id === selectedBranchId);
  }, [shifts, selectedBranchId]);

  // Kalkulasi Keuangan Toko (Mengikuti Filter Cabang yang aktif)
  const totalGross = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.gross_revenue, 0), [filteredShifts]);
  const totalFees = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.fee_amount, 0), [filteredShifts]);
  const totalBranchExpenses = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.branch_expenses, 0), [filteredShifts]);
  const totalNetDeposit = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.net_cash_deposit, 0), [filteredShifts]);
  const totalSoldCilok = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.sold_cilok, 0), [filteredShifts]);
  const totalSoldTahu = useMemo(() => filteredShifts.reduce((acc, s) => acc + s.sold_tahu, 0), [filteredShifts]);

  // Biaya Dapur Produksi (Hanya muncul/dihitung kalau filter cabang 'all')
  const totalKitchenCost = useMemo(() => productions.reduce((acc, p) => acc + p.grand_total_cost, 0), [productions]);
  const totalLaborKitchen = useMemo(() => productions.reduce((acc, p) => acc + p.total_labor_cost, 0), [productions]);
  const totalMaterialsKitchen = useMemo(() => productions.reduce((acc, p) => acc + p.total_raw_material_cost, 0), [productions]);

  // Sisa Uang Bersih Bisnis
  const finalNetProfit = totalNetDeposit - (selectedBranchId === 'all' ? totalKitchenCost : 0);

  // Rekap Cabang (Untuk tabel ranking)
  const branchSummary = useMemo(() => {
    const summary: Record<string, { id: string; name: string; gross: number; net: number; cilok: number; tahu: number; count: number; expenses: number }> = {};
    shifts.forEach((s) => {
      if (!summary[s.branch_id]) {
        summary[s.branch_id] = { id: s.branch_id, name: s.branch_name, gross: 0, net: 0, cilok: 0, tahu: 0, count: 0, expenses: 0 };
      }
      summary[s.branch_id].gross += s.gross_revenue;
      summary[s.branch_id].net += s.net_cash_deposit;
      summary[s.branch_id].cilok += s.sold_cilok;
      summary[s.branch_id].tahu += s.sold_tahu;
      summary[s.branch_id].expenses += s.branch_expenses;
      summary[s.branch_id].count += 1;
    });
    return Object.values(summary).sort((a, b) => b.gross - a.gross);
  }, [shifts]);

  // Rekap Fee Karyawan Toko
  const employeeSalary = useMemo(() => {
    const salaryMap: Record<string, { name: string; totalFee: number; totalCilok: number; totalTahu: number; shiftsCount: number }> = {};

    filteredShifts.forEach((s) => {
      const shiftStaff = staffShares.filter((st) => st.shift_id === s.id);
      const staffCount = shiftStaff.length || 1;

      shiftStaff.forEach((st) => {
        if (!salaryMap[st.employee_id]) {
          salaryMap[st.employee_id] = {
            name: st.employee_name,
            totalFee: 0,
            totalCilok: 0,
            totalTahu: 0,
            shiftsCount: 0,
          };
        }
        salaryMap[st.employee_id].totalFee += Math.round(s.fee_amount / staffCount);
        salaryMap[st.employee_id].totalCilok += Math.round(s.sold_cilok / staffCount);
        salaryMap[st.employee_id].totalTahu += Math.round(s.sold_tahu / staffCount);
        salaryMap[st.employee_id].shiftsCount += 1;
      });
    });

    return Object.values(salaryMap).sort((a, b) => b.totalFee - a.totalFee);
  }, [filteredShifts, staffShares]);

  // Salin Format WA
  const handleCopyWhatsApp = () => {
    const selectedBranchName = selectedBranchId === 'all' 
      ? 'GABUNGAN SEMUA CABANG' 
      : branches.find(b => b.id === selectedBranchId)?.name || 'CABANG';

    const text = `*LAPORAN KEUANGAN RASAJO (${selectedBranchName})*
Periode: ${startDate} s/d ${endDate}
----------------------------------------
*1. HASIL PENJUALAN OUTLET:*
- Omzet Kotor: Rp ${totalGross.toLocaleString('id-ID')}
- Butir Terjual: ${totalSoldCilok.toLocaleString('id-ID')} Cilok | ${totalSoldTahu.toLocaleString('id-ID')} Tahu
- Hak Fee Karyawan (10%): Rp ${totalFees.toLocaleString('id-ID')}
- Pengeluaran Kasir Cabang: Rp ${totalBranchExpenses.toLocaleString('id-ID')}
- *Uang Masuk / Setoran Bersih: Rp ${totalNetDeposit.toLocaleString('id-ID')}*

${selectedBranchId === 'all' ? `*2. BIAYA DAPUR PUSAT:*
- Belanja Bahan Mentah/Bumbu: Rp ${totalMaterialsKitchen.toLocaleString('id-ID')}
- Upah Tenaga Masak & Cuci: Rp ${totalLaborKitchen.toLocaleString('id-ID')}
- Total Beban Dapur: Rp ${totalKitchenCost.toLocaleString('id-ID')}
----------------------------------------
*LABA BERSIH OWNER: Rp ${finalNetProfit.toLocaleString('id-ID')}*` : ''}
----------------------------------------
Laporan digenerate dari Portal Rasajo.`;

    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 3000);
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const headers = ['Tanggal', 'Cabang', 'Cilok Terjual', 'Tahu Terjual', 'Omzet', 'Fee Karyawan', 'Biaya Cabang', 'Setoran Bersih'];
    const rows = filteredShifts.map((s) => [
      s.shift_date,
      s.branch_name,
      s.sold_cilok,
      s.sold_tahu,
      s.gross_revenue,
      s.fee_amount,
      s.branch_expenses,
      s.net_cash_deposit,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Rasajo_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header Atas */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/owner')}
              className="w-10 h-10 rounded-2xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-bold text-[#C2410C] tracking-wider uppercase block">
                Owner Analytics
              </span>
              <h1 className="text-xl font-black text-neutral-900">Rekap Laporan & Performa Toko</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              {copiedMsg ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedMsg ? 'Tersalin ke WA!' : 'Salin Format WA'}</span>
            </button>
            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel/CSV</span>
            </button>
          </div>
        </div>

        {/* 1. FILTER RENTANG WAKTU (Tombol Shortcut Diperbaiki) */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#C2410C]" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Periode Waktu:</span>
            </div>

            {/* Tombol Shortcut dengan Active State Warna Oranye Terang */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickRange('today')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeRange === 'today'
                    ? 'bg-[#C2410C] text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange('7days')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeRange === '7days'
                    ? 'bg-[#C2410C] text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => handleQuickRange('this_month')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  activeRange === 'this_month'
                    ? 'bg-[#C2410C] text-white shadow-sm'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                Bulan Ini
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 block mb-1">Dari Tanggal:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActiveRange('custom');
                }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#C2410C]"
              />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-neutral-500 block mb-1">Sampai Tanggal:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActiveRange('custom');
                }}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 focus:outline-none focus:border-[#C2410C]"
              />
            </div>
          </div>
        </div>

        {/* 2. TAB PECAH CABANG (Pilih Semua atau Toko Tertentu) */}
        <div className="bg-white p-3 sm:p-4 rounded-3xl border border-neutral-200 shadow-sm">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-2 px-1">
            Pilih Tampilan Toko / Cabang:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedBranchId('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedBranchId === 'all'
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Semua Toko (Gabungan)</span>
            </button>

            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranchId(b.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedBranchId === b.id
                    ? 'bg-[#C2410C] text-white shadow-md'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. ALUR FINANSIAL JELAS & MUDAH DIPAHAMI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Kotak 1: Arus Kas Masuk dari Outlet */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#C2410C]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                    {selectedBranchId === 'all' ? '1. Hasil Penjualan Outlet' : `1. Penjualan Cabang ${branches.find(b => b.id === selectedBranchId)?.name}`}
                  </h3>
                </div>
                <span className="text-[11px] text-neutral-400 font-semibold">{filteredShifts.length} shift selesai</span>
              </div>

              <div className="space-y-2 pt-3 text-xs">
                <div className="flex justify-between items-center text-neutral-600">
                  <span>Total Omzet Kotor ({totalSoldCilok} Cilok, {totalSoldTahu} Tahu)</span>
                  <span className="font-bold text-neutral-900">Rp {totalGross.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-amber-600">
                  <span>Hak Fee Karyawan Toko (10%)</span>
                  <span className="font-bold">- Rp {totalFees.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600">
                  <span>Pengeluaran Kasir (Es, Gas, Printilan Toko)</span>
                  <span className="font-bold">- Rp {totalBranchExpenses.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-dashed border-neutral-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">SETORAN BERSIH KASIR</span>
                <span className="text-xs text-neutral-500">Uang tunai disetor cabang</span>
              </div>
              <span className="text-xl font-black text-emerald-600">
                Rp {totalNetDeposit.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Kotak 2: Pengeluaran Dapur Pusat (Hanya tampil penuh kalau filter 'all', atau info edukatif jika cabang tunggal) */}
          <div className="bg-white p-5 rounded-3xl border border-neutral-200 shadow-sm space-y-3 flex flex-col justify-between">
            {selectedBranchId === 'all' ? (
              <>
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <ChefHat className="w-4 h-4 text-purple-600" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                        2. Biaya Dapur Produksi Pusat
                      </h3>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-semibold">{productions.length} batch masak</span>
                  </div>

                  <div className="space-y-2 pt-3 text-xs">
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Belanja Bahan Mentah (Daging, Tepung, Bumbu)</span>
                      <span className="font-bold text-rose-600">- Rp {totalMaterialsKitchen.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-600">
                      <span>Upah Tenaga Masak (Tukang bikin, cuci & makan)</span>
                      <span className="font-bold text-rose-600">- Rp {totalLaborKitchen.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-400 text-[11px]">
                      <span>Rata-rata HPP per butir batch</span>
                      <span>Sesuai catatan batch</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-neutral-200 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase block">TOTAL BEBAN PRODUKSI</span>
                    <span className="text-xs text-neutral-500">Bahan + upah tim dapur</span>
                  </div>
                  <span className="text-xl font-black text-rose-600">
                    Rp {totalKitchenCost.toLocaleString('id-ID')}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-neutral-100 pb-2.5">
                    <Award className="w-4 h-4 text-[#C2410C]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                      Performa & Rata-rata Toko
                    </h3>
                  </div>
                  <div className="pt-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Rata-rata Omzet / Hari:</span>
                      <span className="font-bold text-neutral-900">
                        Rp {filteredShifts.length > 0 ? Math.round(totalGross / filteredShifts.length).toLocaleString('id-ID') : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Rata-rata Terjual / Hari:</span>
                      <span className="font-bold text-neutral-900">
                        {filteredShifts.length > 0 ? Math.round((totalSoldCilok + totalSoldTahu) / filteredShifts.length) : 0} butir
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Total Pengeluaran Toko:</span>
                      <span className="font-bold text-rose-600">Rp {totalBranchExpenses.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-2xl text-[11px] text-neutral-500 border border-neutral-100 mt-3">
                  💡 Biaya dapur pusat dicatat di level gabungan (Semua Toko) karena diproduksi 1x seminggu untuk membagi stok ke 4 cabang.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kotak Ringkasan Sisa Kas Bersih (Hanya muncul jika Semua Toko) */}
        {selectedBranchId === 'all' && (
          <div className="bg-neutral-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
                HASIL AKHIR: SISA KAS USAHA DI KANTONG OWNER
              </span>
              <p className={`text-3xl sm:text-4xl font-black mt-1 ${finalNetProfit >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                Rp {finalNetProfit.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-neutral-300 mt-1">
                = (Setoran Masuk Kasir Rp {totalNetDeposit.toLocaleString('id-ID')}) dikurangi (Modal Dapur Rp {totalKitchenCost.toLocaleString('id-ID')})
              </p>
            </div>

            <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-2xl flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-[10px] text-neutral-400 font-bold block">STATUS KAS</span>
                <span className="text-xs font-black text-white">
                  {finalNetProfit >= 0 ? 'Surplus / Untung Bersih' : 'Modal Belanja Tertutup Sebagian'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. DETAIL RIWAYAT SHIFT CABANG (Tabel Harian Khusus Toko) */}
        {selectedBranchId !== 'all' && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-base font-black text-neutral-900 flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#C2410C]" /> Riwayat Shift Harian: {branches.find(b => b.id === selectedBranchId)?.name}
                </h2>
                <p className="text-xs text-neutral-500">Pantau progres perkembangan penjualan hari ke hari.</p>
              </div>
              <span className="text-xs font-bold bg-neutral-100 text-neutral-700 px-3 py-1 rounded-xl">
                {filteredShifts.length} Hari Jualan
              </span>
            </div>

            {filteredShifts.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-6">Belum ada shift jualan di rentang tanggal ini.</p>
            ) : (
              <div className="space-y-2.5">
                {filteredShifts.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-extrabold text-neutral-900 block text-sm">{s.shift_date}</span>
                      <span className="text-neutral-500 block mt-0.5">
                        Terjual: <b>{s.sold_cilok}</b> Cilok &bull; <b>{s.sold_tahu}</b> Tahu (Sisa: {s.remaining_cilok} C / {s.remaining_tahu} T)
                      </span>
                      {s.branch_expenses > 0 && (
                        <span className="text-[11px] text-rose-600 block mt-0.5">
                          Biaya: Rp {s.branch_expenses.toLocaleString('id-ID')} ({s.expense_notes || 'Pengeluaran outlet'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-bold">OMZET KOTOR</span>
                        <span className="text-sm font-black text-neutral-900">
                          Rp {s.gross_revenue.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="border-l border-neutral-200 pl-4">
                        <span className="text-[10px] text-neutral-400 block font-bold">SETOR BERSIH</span>
                        <span className="text-sm font-black text-emerald-600">
                          Rp {s.net_cash_deposit.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. DUA TABEL REKAP: FEE KARYAWAN & RANKING CABANG */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* TABEL 1: Hak Gaji Karyawan Toko */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-neutral-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#C2410C]" /> Rekap Hak Fee Karyawan Toko
              </h2>
              <span className="text-xs text-neutral-400 font-medium">Acuan slip gaji</span>
            </div>

            {loading ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Menghitung akumulasi fee...</p>
            ) : employeeSalary.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Belum ada data shift di rentang ini.</p>
            ) : (
              <div className="space-y-2.5">
                {employeeSalary.map((emp, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-[#C2410C] font-extrabold flex items-center justify-center text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-neutral-900 text-xs">{emp.name}</h3>
                        <p className="text-[11px] text-neutral-500">
                          {emp.shiftsCount} shift &bull; {emp.totalCilok + emp.totalTahu} butir
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block font-bold">TOTAL FEE 10%</span>
                      <span className="text-sm font-black text-emerald-700">
                        Rp {emp.totalFee.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* TABEL 2: Ranking Omzet Cabang (Bisa diklik untuk langsung filter ke cabang itu) */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-neutral-900 flex items-center gap-2">
                <Store className="w-5 h-5 text-[#C2410C]" /> Ranking Omzet Cabang
              </h2>
              <span className="text-xs text-neutral-400 font-medium">Klik untuk lihat detail</span>
            </div>

            {loading ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Memuat performa cabang...</p>
            ) : branchSummary.length === 0 ? (
              <p className="text-xs text-neutral-400 py-6 text-center">Belum ada data shift di rentang ini.</p>
            ) : (
              <div className="space-y-2.5">
                {branchSummary.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedBranchId(b.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group ${
                      selectedBranchId === b.id
                        ? 'border-[#C2410C] bg-orange-50/60'
                        : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-900 text-white font-extrabold flex items-center justify-center text-xs">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-neutral-900 text-xs flex items-center gap-1.5">
                          {b.name}
                          <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                        </h3>
                        <p className="text-[11px] text-neutral-500">
                          {b.count} shift &bull; {b.cilok + b.tahu} butir terjual
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block font-bold">TOTAL OMZET</span>
                      <span className="text-sm font-black text-neutral-900">
                        Rp {b.gross.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}