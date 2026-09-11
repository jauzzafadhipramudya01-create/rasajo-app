'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, KeyRound, Users, Plus, Save, ShieldCheck } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  pin: string;
}

interface Employee {
  id: string;
  name: string;
  is_active: boolean;
}

export default function OwnerSettingsPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchPin, setNewBranchPin] = useState('');
  const [newEmpName, setNewEmpName] = useState('');

  const [editingPins, setEditingPins] = useState<Record<string, string>>({});
  const [ownerPin, setOwnerPin] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const { data: bData } = await supabase.from('branches').select('*').order('name');
    const { data: eData } = await supabase.from('employees').select('*').order('name');
    const { data: oData } = await supabase.from('app_settings').select('value').eq('key', 'owner_pin').maybeSingle();

    if (bData) {
      setBranches(bData);
      const pins: Record<string, string> = {};
      bData.forEach((b) => (pins[b.id] = b.pin));
      setEditingPins(pins);
    }
    if (eData) setEmployees(eData);
    if (oData) setOwnerPin(oData.value);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleUpdateOwnerPin = async () => {
    if (!ownerPin || ownerPin.length !== 4) {
      showNotification('PIN Owner harus berupa 4 angka!');
      return;
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'owner_pin', value: ownerPin });

    if (error) {
      showNotification('Gagal ubah PIN Owner: ' + error.message);
    } else {
      showNotification('PIN Owner berhasil diperbarui!');
    }
  };

  const handleUpdatePin = async (branchId: string) => {
    const newPin = editingPins[branchId];
    if (!newPin || newPin.length !== 4) {
      showNotification('PIN cabang harus tepat 4 angka!');
      return;
    }

    const { error } = await supabase
      .from('branches')
      .update({ pin: newPin })
      .eq('id', branchId);

    if (error) {
      showNotification('Gagal ubah PIN: ' + error.message);
    } else {
      showNotification('PIN cabang berhasil diubah!');
      fetchData();
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim() || newBranchPin.length !== 4) {
      showNotification('Nama cabang dan PIN 4-angka wajib diisi!');
      return;
    }

    const { error } = await supabase.from('branches').insert({
      name: newBranchName.trim(),
      pin: newBranchPin.trim(),
    });

    if (error) {
      showNotification('Gagal: ' + error.message);
    } else {
      setNewBranchName('');
      setNewBranchPin('');
      showNotification('Cabang baru berhasil ditambahkan!');
      fetchData();
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    const { error } = await supabase.from('employees').insert({
      name: newEmpName.trim(),
      is_active: true,
    });

    if (error) {
      showNotification('Gagal: ' + error.message);
    } else {
      setNewEmpName('');
      showNotification('Karyawan berhasil didaftarkan!');
      fetchData();
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200 shadow-sm">
          <button
            onClick={() => router.push('/owner')}
            className="w-10 h-10 rounded-2xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[11px] font-bold text-[#C2410C] tracking-wider uppercase block">
              Pengaturan Rasajo
            </span>
            <h1 className="text-xl font-black text-neutral-900">Kelola Akses, Cabang & Karyawan</h1>
          </div>
        </div>

        {msg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 animate-in fade-in">
            {msg}
          </div>
        )}

        {/* 1. Ganti PIN Owner */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-neutral-900" />
            <div>
              <h2 className="text-base font-black text-neutral-900">PIN Keamanan Owner</h2>
              <p className="text-xs text-neutral-500">PIN rahasia pemilik untuk login ke dashboard owner.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="text"
              maxLength={4}
              value={ownerPin}
              onChange={(e) => setOwnerPin(e.target.value)}
              placeholder="4 digit"
              className="w-28 bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-2 text-center text-sm font-mono font-black text-neutral-900 focus:outline-none focus:border-neutral-900"
            />
            <button
              onClick={handleUpdateOwnerPin}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" /> Simpan PIN Owner
            </button>
          </div>
        </div>

        {/* 2. Ganti PIN Cabang */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#C2410C]" />
            <div>
              <h2 className="text-base font-black text-neutral-900">Ganti PIN Cabang</h2>
              <p className="text-xs text-neutral-500">Atur PIN 4 digit untuk akses shift masing-masing outlet.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {branches.map((b) => (
              <div key={b.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                <span className="font-bold text-xs text-neutral-900">{b.name}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={editingPins[b.id] || ''}
                    onChange={(e) => setEditingPins({ ...editingPins, [b.id]: e.target.value })}
                    className="w-16 bg-white border border-neutral-300 rounded-xl px-2.5 py-1.5 text-center text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:border-[#C2410C]"
                  />
                  <button
                    onClick={() => handleUpdatePin(b.id)}
                    className="p-2 bg-[#C2410C] hover:bg-[#A3360A] text-white rounded-xl text-xs font-bold active:scale-95"
                    title="Simpan PIN"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form Tambah Cabang */}
          <form onSubmit={handleAddBranch} className="pt-4 border-t border-neutral-100 flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Nama Cabang Baru"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1 min-w-[160px] bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none"
            />
            <input
              type="text"
              maxLength={4}
              placeholder="PIN 4-Angka"
              value={newBranchPin}
              onChange={(e) => setNewBranchPin(e.target.value)}
              className="w-28 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Cabang
            </button>
          </form>
        </div>

        {/* 3. Kelola Karyawan */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#C2410C]" />
            <div>
              <h2 className="text-base font-black text-neutral-900">Daftar Karyawan</h2>
              <p className="text-xs text-neutral-500">Karyawan aktif yang bisa dipilih saat buka shift outlet.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {employees.map((emp) => (
              <span
                key={emp.id}
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800"
              >
                {emp.name}
              </span>
            ))}
          </div>

          {/* Form Tambah Karyawan */}
          <form onSubmit={handleAddEmployee} className="pt-4 border-t border-neutral-100 flex gap-2">
            <input
              type="text"
              placeholder="Nama Karyawan Baru (misal: Putri)"
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#C2410C] hover:bg-[#A3360A] text-white text-xs font-bold rounded-xl active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Karyawan
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}