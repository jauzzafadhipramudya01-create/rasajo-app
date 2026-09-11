'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChevronRight, Delete, Store, Lock, ShieldCheck } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  pin: string;
  is_active: boolean;
  statusToday?: 'Buka' | 'Belum buka';
}

const BRANCH_ORDER = ['Calung', 'Cemara', 'Danau Singkarak', 'Sriwijaya'];

export default function HomePage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal PIN Cabang
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Modal Login Owner
  const [showOwnerLogin, setShowOwnerLogin] = useState(false);
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [ownerPinError, setOwnerPinError] = useState(false);
  const [storedOwnerPin, setStoredOwnerPin] = useState('9999');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'owner_pin')
        .maybeSingle();

      if (settingData?.value) {
        setStoredOwnerPin(settingData.value);
      }

      const { data, error } = await supabase.from('branches').select('*');

      if (!error && data) {
        const today = new Date().toISOString().split('T')[0];
        const branchesWithStatus = await Promise.all(
          data.map(async (b) => {
            const { data: shift } = await supabase
              .from('daily_shifts')
              .select('id, status')
              .eq('branch_id', b.id)
              .eq('shift_date', today)
              .maybeSingle();

            return {
              ...b,
              statusToday: shift?.status === 'open' ? 'Buka' : 'Belum buka',
            };
          })
        );

        branchesWithStatus.sort((a, b) => {
          const indexA = BRANCH_ORDER.indexOf(a.name);
          const indexB = BRANCH_ORDER.indexOf(b.name);
          return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
        });

        setBranches(branchesWithStatus as Branch[]);
      }
      setLoading(false);
    }

    fetchData();
  }, []);

  const handleBranchClick = (branch: Branch) => {
    setSelectedBranch(branch);
    setPinInput('');
    setPinError(false);
  };

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 4) {
      const nextPin = pinInput + num;
      setPinInput(nextPin);
      setPinError(false);

      if (nextPin.length === 4 && selectedBranch) {
        if (nextPin === selectedBranch.pin) {
          sessionStorage.setItem('rasajo_branch_id', selectedBranch.id);
          sessionStorage.setItem('rasajo_branch_name', selectedBranch.name);
          router.push(`/outlet/${selectedBranch.id}`);
        } else {
          setPinError(true);
          setTimeout(() => setPinInput(''), 600);
        }
      }
    }
  };

  const handleOwnerKeyPress = (num: string) => {
    if (ownerPinInput.length < 4) {
      const next = ownerPinInput + num;
      setOwnerPinInput(next);
      setOwnerPinError(false);

      if (next.length === 4) {
        if (next === storedOwnerPin) {
          sessionStorage.setItem('rasajo_owner_logged_in', 'true');
          router.push('/owner');
        } else {
          setOwnerPinError(true);
          setTimeout(() => setOwnerPinInput(''), 600);
        }
      }
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-xl overflow-hidden border border-neutral-200 min-h-[720px] flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#C2410C] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              R
            </div>
            <span className="font-bold text-neutral-900 tracking-wider text-base">RASAJO</span>
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-900 mb-1">Pilih outlet kamu</h1>
          <p className="text-neutral-500 text-sm mb-6">Sentuh salah satu cabang untuk mulai shift.</p>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-10 text-neutral-400 text-sm">Memuat data cabang...</div>
            ) : (
              branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => handleBranchClick(branch)}
                  className="w-full text-left bg-white border border-neutral-200 hover:border-[#C2410C] rounded-2xl p-4 transition-all active:scale-[0.98] shadow-sm flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 bg-neutral-50 border border-neutral-100 rounded-xl group-hover:bg-orange-50 transition-colors">
                      <Store className="w-5 h-5 text-neutral-600 group-hover:text-[#C2410C]" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-neutral-900 text-base leading-snug">{branch.name}</h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            branch.statusToday === 'Buka' ? 'bg-emerald-500' : 'bg-neutral-300'
                          }`}
                        />
                        <span
                          className={`text-xs font-medium ${
                            branch.statusToday === 'Buka' ? 'text-emerald-700' : 'text-neutral-400'
                          }`}
                        >
                          {branch.statusToday === 'Buka' ? 'Sedang beroperasi' : 'Belum buka'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-neutral-700" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-neutral-100 text-center">
          <button 
            onClick={() => {
              setShowOwnerLogin(true);
              setOwnerPinInput('');
              setOwnerPinError(false);
            }}
            className="text-xs text-neutral-500 hover:text-[#C2410C] font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto"
          >
            <Lock className="w-3.5 h-3.5" /> Masuk sebagai Owner
          </button>
        </div>
      </div>

      {/* Modal PIN Cabang */}
      {selectedBranch && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-[420px] bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col justify-between min-h-[600px] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2">
              <button
                onClick={() => setSelectedBranch(null)}
                className="w-9 h-9 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50"
              >
                &larr;
              </button>
              <div className="text-center flex-1 mr-9">
                <h3 className="font-bold text-neutral-900 text-lg">{selectedBranch.name}</h3>
                <p className="text-xs text-neutral-500">Masukkan PIN cabang 4-angka</p>
              </div>
            </div>

            <div className="flex justify-center items-center gap-4 my-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pinError
                      ? 'border-red-500 bg-red-100 scale-110'
                      : pinInput.length > index
                      ? 'border-[#C2410C] bg-[#C2410C] scale-110'
                      : 'border-neutral-300 bg-white'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-center text-xs font-semibold text-red-500 -mt-2 mb-2">PIN salah!</p>
            )}

            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto w-full my-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeyPress(digit)}
                  className="h-14 rounded-2xl border border-neutral-200 text-xl font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 shadow-sm transition-all"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setPinInput('')}
                className="h-14 rounded-2xl text-xs font-bold text-neutral-400 hover:text-neutral-700"
              >
                Hapus
              </button>
              <button
                onClick={() => handleKeyPress('0')}
                className="h-14 rounded-2xl border border-neutral-200 text-xl font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 shadow-sm transition-all"
              >
                0
              </button>
              <button
                onClick={() => setPinInput((p) => p.slice(0, -1))}
                className="h-14 rounded-2xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 active:scale-95 shadow-sm"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Login Owner (Password Rahasia Tanpa Bocoran) */}
      {showOwnerLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-neutral-900 text-white mx-auto flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-neutral-900 mb-1">Owner Access</h3>
            <p className="text-xs text-neutral-500 mb-4">Masukkan 4-angka PIN keamanan Owner</p>

            <div className="flex justify-center items-center gap-3 mb-5">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                    ownerPinError
                      ? 'border-red-500 bg-red-100 scale-110'
                      : ownerPinInput.length > index
                      ? 'border-neutral-900 bg-neutral-900 scale-110'
                      : 'border-neutral-300 bg-white'
                  }`}
                />
              ))}
            </div>

            {ownerPinError && (
              <p className="text-center text-xs font-semibold text-red-500 -mt-3 mb-3">PIN Owner salah!</p>
            )}

            <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto w-full mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleOwnerKeyPress(digit)}
                  className="h-12 rounded-xl border border-neutral-200 text-lg font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 shadow-sm"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setOwnerPinInput('')}
                className="h-12 rounded-xl text-[11px] font-bold text-neutral-400"
              >
                Clear
              </button>
              <button
                onClick={() => handleOwnerKeyPress('0')}
                className="h-12 rounded-xl border border-neutral-200 text-lg font-bold text-neutral-800 hover:bg-neutral-50 active:scale-95 shadow-sm"
              >
                0
              </button>
              <button
                onClick={() => setOwnerPinInput((p) => p.slice(0, -1))}
                className="h-12 rounded-xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 active:scale-95 shadow-sm"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => setShowOwnerLogin(false)}
              className="w-full py-2.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Kembali ke Menu Outlet
            </button>
          </div>
        </div>
      )}
    </main>
  );
}