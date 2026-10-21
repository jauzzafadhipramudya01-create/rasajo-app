'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Store,
  ChevronRight,
  ShieldAlert,
  Flame,
  Award,
  Zap,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface StaffLeaderboard {
  id: string;
  name: string;
  totalSold: number;
  totalPoints: number;
  shiftsCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sales' | 'discipline'>('sales');
  const [leaderboard, setLeaderboard] = useState<StaffLeaderboard[]>([]);

  // Modal PIN Owner
  const [showPinModal, setShowPinModal] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);

    // 1. Ambil 4 Cabang
    const { data: bData } = await supabase.from('branches').select('id, name').order('name');
    if (bData) setBranches(bData);

    // 2. Ambil Rekap Shift Bulan Ini
    const today = new Date();
    const firstDayOfMonth = today.toISOString().slice(0, 8) + '01';
    const todayStr = today.toISOString().split('T')[0];

    const { data: shiftData } = await supabase
      .from('daily_shifts')
      .select('id, sold_cilok, sold_tahu, discipline_points, status')
      .gte('shift_date', firstDayOfMonth)
      .lte('shift_date', todayStr)
      .eq('status', 'closed');

    const { data: staffData } = await supabase
      .from('shift_staff')
      .select('shift_id, employee_id, employees(id, name)');

    if (shiftData && staffData) {
      const staffMap: Record<string, StaffLeaderboard> = {};

      shiftData.forEach((s) => {
        const assignedStaff = staffData.filter((st) => st.shift_id === s.id);
        const count = assignedStaff.length || 1;
        const soldPerPerson = Math.round(((s.sold_cilok || 0) + (s.sold_tahu || 0)) / count);
        const pointsPerPerson = s.discipline_points || 0;

        assignedStaff.forEach((st: any) => {
          const empId = st.employees?.id || st.employee_id;
          const empName = st.employees?.name || 'Karyawan';

          if (!staffMap[empId]) {
            staffMap[empId] = {
              id: empId,
              name: empName,
              totalSold: 0,
              totalPoints: 0,
              shiftsCount: 0,
            };
          }

          staffMap[empId].totalSold += soldPerPerson;
          staffMap[empId].totalPoints += pointsPerPerson;
          staffMap[empId].shiftsCount += 1;
        });
      });

      setLeaderboard(Object.values(staffMap));
    }

    setLoading(false);
  };

  const sortedSales = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.totalSold - a.totalSold);
  }, [leaderboard]);

  const sortedDiscipline = useMemo(() => {
    return [...leaderboard].sort((a, b) => b.totalPoints - a.totalPoints);
  }, [leaderboard]);

  const handleVerifyOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPin === '1234') {
      setShowPinModal(false);
      router.push('/owner');
    } else {
      setPinError(true);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4F5F7] text-neutral-800 pb-16 font-sans antialiased">
      <div className="max-w-md mx-auto p-4 sm:p-5 space-y-6">

        {/* Header App */}
        <div className="text-center pt-3 pb-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-[#C2410C] rounded-full text-xs font-black uppercase tracking-wider mb-2">
            <Flame className="w-3.5 h-3.5 fill-[#C2410C]" /> Rasajo Portal
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight">Pilih Outlet Kamu</h1>
          <p className="text-xs text-neutral-500 mt-1">Pilih cabang tugasmu untuk mulai mencatat kasir.</p>
        </div>

        {/* PILIHAN 4 CABANG */}
        <div className="space-y-2.5">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => router.push(`/outlet/${b.id}`)}
              className="w-full bg-white hover:bg-neutral-50 border border-neutral-200/90 rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#C2410C] flex items-center justify-center group-hover:bg-[#C2410C] group-hover:text-white transition-colors">
                  <Store className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-extrabold text-neutral-900">{b.name}</h2>
                  <span className="text-[11px] text-neutral-400 font-medium">Buka kasir & lapor stok</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
            </button>
          ))}
        </div>

        {/* PAPAN JUARA BULAN INI */}
        <div className="bg-white rounded-3xl p-5 border border-neutral-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C2410C]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                Papan Juara Bulan Ini
              </h3>
            </div>
            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2.5 py-0.5 rounded-full">
              Live Klasemen
            </span>
          </div>

          {/* Toggle Tab */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'sales'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#C2410C]" />
              <span>Raja Penjualan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discipline')}
              className={`py-2 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'discipline'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Paling Rajin</span>
            </button>
          </div>

          {/* Daftar Ranking */}
          {loading ? (
            <p className="text-xs text-neutral-400 text-center py-4">Menghitung klasemen...</p>
          ) : leaderboard.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-4">Belum ada data shift bulan ini.</p>
          ) : (
            <div className="space-y-2">
              {(activeTab === 'sales' ? sortedSales : sortedDiscipline).map((emp, idx) => {
                const isFirst = idx === 0;
                const isSecond = idx === 1;
                const isThird = idx === 2;

                return (
                  <div
                    key={emp.id}
                    className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                      isFirst
                        ? 'bg-orange-50/60 border-orange-200'
                        : isSecond
                        ? 'bg-neutral-50 border-neutral-200'
                        : isThird
                        ? 'bg-neutral-50/60 border-neutral-200'
                        : 'bg-white border-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                          isFirst
                            ? 'bg-[#C2410C] text-white shadow-sm'
                            : isSecond
                            ? 'bg-neutral-700 text-white'
                            : isThird
                            ? 'bg-amber-600 text-white'
                            : 'bg-neutral-200 text-neutral-600'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-neutral-900 flex items-center gap-1.5">
                          {emp.name}
                          {isFirst && <Award className="w-3.5 h-3.5 text-[#C2410C]" />}
                        </h4>
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {emp.shiftsCount} shift jaga
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      {activeTab === 'sales' ? (
                        <>
                          <span className="text-xs font-black text-neutral-900 block">
                            {emp.totalSold.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-neutral-500">btr</span>
                          </span>
                          <span className="text-[9px] text-emerald-600 font-bold">Terjual</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-black text-amber-600 block">
                            {emp.totalPoints} <span className="text-[10px] font-normal text-neutral-500">pts</span>
                          </span>
                          <span className="text-[9px] text-neutral-400 font-bold">Disiplin Buka</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-neutral-400 text-center pt-1 leading-relaxed">
            🔥 Buka kasir sebelum jam 09.00 (+2 Poin) & sebelum jam 12.00 (+1 Poin) untuk kejar bonus bulanan!
          </p>
        </div>

        {/* TOMBOL OWNER */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowPinModal(true)}
            className="text-xs font-bold text-neutral-400 hover:text-neutral-700 flex items-center justify-center gap-1.5 mx-auto transition-colors"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Masuk Portal Owner (PIN)
          </button>
        </div>

      </div>

      {/* POPUP PIN OWNER */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95">
            <h3 className="text-base font-black text-neutral-900 mb-1">Verifikasi Owner</h3>
            <p className="text-xs text-neutral-500 mb-4">Masukkan 4 digit PIN owner.</p>

            <form onSubmit={handleVerifyOwnerPin} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={ownerPin}
                onChange={(e) => {
                  setOwnerPin(e.target.value);
                  setPinError(false);
                }}
                className="w-full text-center tracking-widest text-2xl font-black bg-neutral-100 rounded-2xl py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C2410C]"
              />

              {pinError && (
                <p className="text-xs text-rose-600 font-bold">PIN salah, coba lagi.</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setOwnerPin('');
                    setPinError(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold"
                >
                  Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}