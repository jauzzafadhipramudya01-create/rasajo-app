'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  ChefHat,
  Plus,
  Trash2,
  Save,
  Calendar,
  DollarSign,
  Utensils,
  History,
  CheckCircle2,
  AlertCircle,
  Pencil,
  X,
  AlertTriangle
} from 'lucide-react';

interface MaterialItem {
  id?: string;
  item_name: string;
  cost: number;
}

interface BatchRecord {
  id: string;
  batch_date: string;
  produced_cilok: number;
  produced_tahu: number;
  labor_cook_count: number;
  labor_dishwashing: number;
  labor_meals: number;
  total_labor_cost: number;
  total_raw_material_cost: number;
  grand_total_cost: number;
  notes?: string;
}

export default function ProductionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [historyList, setHistoryList] = useState<BatchRecord[]>([]);

  // Mode Edit
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  // State Form Batch
  const [batchDate, setBatchDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [producedCilok, setProducedCilok] = useState<number>(0);
  const [producedTahu, setProducedTahu] = useState<number>(0);

  // Tenaga Kerja Produksi (Default: 3 orang @100rb + Cuci 25rb + Makan 40rb = 365rb)
  const [cookCount, setCookCount] = useState<number>(3);
  const [cookRate] = useState<number>(100000);
  const [dishwashingCost, setDishwashingCost] = useState<number>(25000);
  const [mealsCost, setMealsCost] = useState<number>(40000);

  // Belanja Bahan Baku (Daftar Dinamis)
  const [materials, setMaterials] = useState<MaterialItem[]>([
    { item_name: 'Daging / Ayam', cost: 600000 },
    { item_name: 'Tepung Tapioka & Terigu', cost: 350000 },
    { item_name: 'Bumbu, Cabai & Bawang', cost: 250000 },
    { item_name: 'Plastik Kemasan & Vakum', cost: 80000 },
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCost, setNewItemCost] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Modal Konfirmasi Hapus Custom
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    batchId: string;
    batchDate: string;
  }>({
    show: false,
    batchId: '',
    batchDate: '',
  });

  // Modal Notifikasi Sukses / Gagal
  const [feedback, setFeedback] = useState<{
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

  // Hitungan Otomatis
  const totalLaborCost = cookCount * cookRate + dishwashingCost + mealsCost;
  const totalMaterialsCost = materials.reduce((acc, m) => acc + Number(m.cost || 0), 0);
  const grandTotalCost = totalLaborCost + totalMaterialsCost;
  const totalItemsProduced = Number(producedCilok) + Number(producedTahu);
  const hppPerItem = totalItemsProduced > 0 ? Math.round(grandTotalCost / totalItemsProduced) : 0;

  const fetchHistory = async () => {
    const { data } = await supabase
      .from('production_batches')
      .select('*')
      .order('batch_date', { ascending: false })
      .limit(10);

    if (data) setHistoryList(data);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemCost <= 0) return;

    setMaterials([...materials, { item_name: newItemName.trim(), cost: Number(newItemCost) }]);
    setNewItemName('');
    setNewItemCost(0);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const resetForm = () => {
    setEditingBatchId(null);
    setBatchDate(new Date().toISOString().split('T')[0]);
    setProducedCilok(0);
    setProducedTahu(0);
    setCookCount(3);
    setDishwashingCost(25000);
    setMealsCost(40000);
    setMaterials([
      { item_name: 'Daging / Ayam', cost: 600000 },
      { item_name: 'Tepung Tapioka & Terigu', cost: 350000 },
      { item_name: 'Bumbu, Cabai & Bawang', cost: 250000 },
      { item_name: 'Plastik Kemasan & Vakum', cost: 80000 },
    ]);
    setNotes('');
  };

  // Mulai Edit Batch dari Riwayat
  const handleStartEdit = async (batch: BatchRecord) => {
    setEditingBatchId(batch.id);
    setBatchDate(batch.batch_date);
    setProducedCilok(batch.produced_cilok || 0);
    setProducedTahu(batch.produced_tahu || 0);
    setCookCount(batch.labor_cook_count || 3);
    setDishwashingCost(Number(batch.labor_dishwashing) || 25000);
    setMealsCost(Number(batch.labor_meals) || 40000);
    setNotes(batch.notes || '');

    const { data: matData } = await supabase
      .from('production_materials')
      .select('*')
      .eq('batch_id', batch.id);

    if (matData && matData.length > 0) {
      setMaterials(matData.map((m) => ({ id: m.id, item_name: m.item_name, cost: Number(m.cost) })));
    } else {
      setMaterials([]);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Buka Modal Konfirmasi Hapus Custom
  const triggerDeleteModal = (batchId: string, bDate: string) => {
    setDeleteModal({
      show: true,
      batchId,
      batchDate: bDate,
    });
  };

  // Eksekusi Hapus Batch
  const executeDeleteBatch = async () => {
    const { batchId, batchDate: bDate } = deleteModal;
    setDeleteModal({ show: false, batchId: '', batchDate: '' });

    const { error } = await supabase.from('production_batches').delete().eq('id', batchId);
    if (!error) {
      if (editingBatchId === batchId) resetForm();
      fetchHistory();
      setFeedback({
        show: true,
        type: 'success',
        title: 'Batch Berhasil Dihapus',
        message: `Catatan produksi tanggal ${bDate} telah dibersihkan dari database.`,
      });
    } else {
      setFeedback({
        show: true,
        type: 'error',
        title: 'Gagal Menghapus',
        message: error.message,
      });
    }
  };

  // Simpan / Perbarui Batch
  const handleSaveBatch = async () => {
    if (totalItemsProduced <= 0) {
      setFeedback({
        show: true,
        type: 'error',
        title: 'Hasil Produksi Kosong',
        message: 'Masukkan jumlah cilok atau tahu yang berhasil diproduksi.',
      });
      return;
    }

    setLoading(true);

    if (editingBatchId) {
      // Update data batch
      const { error: updateError } = await supabase
        .from('production_batches')
        .update({
          batch_date: batchDate,
          produced_cilok: producedCilok,
          produced_tahu: producedTahu,
          labor_cook_count: cookCount,
          labor_cook_rate: cookRate,
          labor_dishwashing: dishwashingCost,
          labor_meals: mealsCost,
          total_labor_cost: totalLaborCost,
          total_raw_material_cost: totalMaterialsCost,
          grand_total_cost: grandTotalCost,
          notes: notes,
        })
        .eq('id', editingBatchId);

      if (updateError) {
        setLoading(false);
        setFeedback({
          show: true,
          type: 'error',
          title: 'Gagal Memperbarui',
          message: updateError.message,
        });
        return;
      }

      await supabase.from('production_materials').delete().eq('batch_id', editingBatchId);
      if (materials.length > 0) {
        const materialRows = materials.map((m) => ({
          batch_id: editingBatchId,
          item_name: m.item_name,
          cost: m.cost,
        }));
        await supabase.from('production_materials').insert(materialRows);
      }

      setLoading(false);
      setFeedback({
        show: true,
        type: 'success',
        title: 'Perubahan Tersimpan',
        message: `Catatan batch tanggal ${batchDate} berhasil diperbarui!`,
      });
      resetForm();
      fetchHistory();
    } else {
      // Simpan batch baru
      const { data: batchData, error: batchError } = await supabase
        .from('production_batches')
        .insert({
          batch_date: batchDate,
          produced_cilok: producedCilok,
          produced_tahu: producedTahu,
          labor_cook_count: cookCount,
          labor_cook_rate: cookRate,
          labor_dishwashing: dishwashingCost,
          labor_meals: mealsCost,
          total_labor_cost: totalLaborCost,
          total_raw_material_cost: totalMaterialsCost,
          grand_total_cost: grandTotalCost,
          notes: notes,
        })
        .select()
        .single();

      if (batchError || !batchData) {
        setLoading(false);
        setFeedback({
          show: true,
          type: 'error',
          title: 'Gagal Menyimpan',
          message: batchError?.message || 'Terjadi kesalahan sistem.',
        });
        return;
      }

      if (materials.length > 0) {
        const materialRows = materials.map((m) => ({
          batch_id: batchData.id,
          item_name: m.item_name,
          cost: m.cost,
        }));
        await supabase.from('production_materials').insert(materialRows);
      }

      setLoading(false);
      setFeedback({
        show: true,
        type: 'success',
        title: 'Batch Produksi Tersimpan',
        message: `Berhasil mencatat produksi ${totalItemsProduced.toLocaleString('id-ID')} butir dengan total biaya Rp ${grandTotalCost.toLocaleString('id-ID')}.`,
      });

      resetForm();
      fetchHistory();
    }
  };

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-3xl border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/owner')}
              className="w-10 h-10 rounded-2xl border border-neutral-200 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-bold text-[#C2410C] tracking-wider uppercase block">
                Central Kitchen
              </span>
              <h1 className="text-xl font-black text-neutral-900">Produksi Dapur & Bahan Baku</h1>
            </div>
          </div>

          {editingBatchId && (
            <button
              onClick={resetForm}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
            >
              <X className="w-4 h-4" /> Batal Edit
            </button>
          )}
        </div>

        {/* Banner Indikator Edit */}
        {editingBatchId && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-between gap-3 text-amber-900 text-xs font-bold animate-in fade-in">
            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Mode Edit Aktif: Mengubah catatan batch tanggal {batchDate}</span>
            </div>
            <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-lg text-amber-800">
              Perubahan akan ditimpa
            </span>
          </div>
        )}

        {/* 1. Hasil Jadi Produksi */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#C2410C]" />
              <h2 className="text-base font-black text-neutral-900">1. Hasil Jadi Produksi (Mingguan)</h2>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-neutral-400" />
              <input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 rounded-xl px-2.5 py-1 text-xs font-bold text-neutral-800 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
              <span className="text-xs font-medium text-neutral-500 block">Total Cilok Dihasilkan (Butir)</span>
              <input
                type="number"
                value={producedCilok || ''}
                onChange={(e) => setProducedCilok(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
              />
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5">
              <span className="text-xs font-medium text-neutral-500 block">Total Tahu Dihasilkan (Pcs)</span>
              <input
                type="number"
                value={producedTahu || ''}
                onChange={(e) => setProducedTahu(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-black text-neutral-900 focus:outline-none mt-1"
              />
            </div>
          </div>
        </div>

        {/* 2. Upah Tenaga Kerja Produksi */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-base font-black text-neutral-900">2. Upah & Operasional Tenaga Masak</h2>
                <p className="text-xs text-neutral-400">Preset otomatis: 3 orang @100rb, cuci piring 25rb, makan 40rb.</p>
              </div>
            </div>
            <span className="text-sm font-black text-amber-700">
              Rp {totalLaborCost.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Tukang Bikin/Masak</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={cookCount}
                  onChange={(e) => setCookCount(Number(e.target.value))}
                  className="w-14 bg-white border border-neutral-300 rounded-xl px-2 py-1 text-center font-bold text-sm"
                />
                <span className="text-xs font-bold text-neutral-700">Orang (@100k)</span>
              </div>
              <span className="text-[11px] text-neutral-400 block">
                = Rp {(cookCount * cookRate).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Cuci Piring / Wadah</span>
              <input
                type="number"
                value={dishwashingCost}
                onChange={(e) => setDishwashingCost(Number(e.target.value))}
                className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-1 font-bold text-sm text-neutral-900"
              />
              <span className="text-[11px] text-neutral-400 block">Standar: Rp 25.000</span>
            </div>

            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Uang Makan Tim</span>
              <input
                type="number"
                value={mealsCost}
                onChange={(e) => setMealsCost(Number(e.target.value))}
                className="w-full bg-white border border-neutral-300 rounded-xl px-3 py-1 font-bold text-sm text-neutral-900"
              />
              <span className="text-[11px] text-neutral-400 block">Standar: Rp 40.000</span>
            </div>
          </div>
        </div>

        {/* 3. Belanja Bahan Baku & Bumbu */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <div>
                <h2 className="text-base font-black text-neutral-900">3. Rincian Belanja Bahan Mentah & Bumbu</h2>
                <p className="text-xs text-neutral-400">Catat semua bahan yang dibeli untuk batch ini.</p>
              </div>
            </div>
            <span className="text-sm font-black text-emerald-700">
              Rp {totalMaterialsCost.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="space-y-2">
            {materials.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs"
              >
                <span className="font-bold text-neutral-800">{m.item_name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-black text-neutral-900">
                    Rp {Number(m.cost).toLocaleString('id-ID')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterial(idx)}
                    className="text-neutral-400 hover:text-rose-600 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form Tambah Bahan Baru */}
          <form onSubmit={handleAddMaterial} className="flex flex-wrap gap-2 pt-2">
            <input
              type="text"
              placeholder="Nama bahan (misal: Gas tabung / Cabai kering)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 min-w-[200px] bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none"
            />
            <input
              type="number"
              placeholder="Nominal (Rp)"
              value={newItemCost || ''}
              onChange={(e) => setNewItemCost(Number(e.target.value))}
              className="w-32 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold text-neutral-900 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          </form>

          <div>
            <textarea
              placeholder="Catatan tambahan batch ini (opsional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 focus:outline-none"
              rows={2}
            />
          </div>
        </div>

        {/* Ringkasan Total Batch & Tombol Simpan */}
        <div className="bg-neutral-900 text-white p-5 sm:p-6 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider block">
              TOTAL BIAYA PRODUKSI BATCH INI:
            </span>
            <p className="text-3xl font-black text-emerald-400 mt-1">
              Rp {grandTotalCost.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-neutral-300 mt-1">
              Estimasi HPP Modal: <b className="text-white">Rp {hppPerItem}</b> per butir ({totalItemsProduced.toLocaleString('id-ID')} butir total)
            </p>
          </div>

          <button
            onClick={handleSaveBatch}
            disabled={loading}
            className={`px-6 py-3.5 rounded-2xl font-black text-sm shadow-md active:scale-95 transition-all flex items-center gap-2 text-white ${
              editingBatchId
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-[#C2410C] hover:bg-[#A3360A]'
            }`}
          >
            <Save className="w-5 h-5" />
            <span>
              {loading
                ? 'Menyimpan...'
                : editingBatchId
                ? 'Perbarui Batch Produksi'
                : 'Simpan Batch Produksi'}
            </span>
          </button>
        </div>

        {/* Riwayat Batch Produksi Sebelumnya */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <History className="w-5 h-5 text-neutral-600" />
            <h2 className="text-base font-black text-neutral-900">Riwayat Batch Produksi Sebelumnya</h2>
          </div>

          {historyList.length === 0 ? (
            <p className="text-xs text-neutral-400 text-center py-6">Belum ada riwayat batch produksi.</p>
          ) : (
            <div className="space-y-3">
              {historyList.map((batch) => (
                <div
                  key={batch.id}
                  className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs transition-all ${
                    editingBatchId === batch.id
                      ? 'bg-amber-50/60 border-amber-300'
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-neutral-900 text-sm">
                        {batch.batch_date}
                      </span>
                      {editingBatchId === batch.id && (
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md">
                          Sedang diedit
                        </span>
                      )}
                    </div>
                    <span className="text-neutral-500 mt-0.5 block">
                      Hasil: {batch.produced_cilok} Cilok &bull; {batch.produced_tahu} Tahu ({batch.produced_cilok + batch.produced_tahu} butir)
                    </span>
                    <span className="text-neutral-400 text-[11px] block">
                      Upah Tim: Rp {Number(batch.total_labor_cost).toLocaleString('id-ID')} | Bahan: Rp {Number(batch.total_raw_material_cost).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-400 block font-bold">TOTAL BIAYA</span>
                      <span className="text-base font-black text-neutral-900">
                        Rp {Number(batch.grand_total_cost).toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Tombol Edit & Hapus */}
                    <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-3">
                      <button
                        onClick={() => handleStartEdit(batch)}
                        className="p-2 rounded-xl bg-white border border-neutral-200 hover:border-amber-400 hover:text-amber-700 text-neutral-600 transition-colors shadow-sm active:scale-95"
                        title="Edit batch ini"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => triggerDeleteModal(batch.id, batch.batch_date)}
                        className="p-2 rounded-xl bg-white border border-neutral-200 hover:border-rose-400 hover:text-rose-600 text-neutral-600 transition-colors shadow-sm active:scale-95"
                        title="Hapus batch ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: KONFIRMASI HAPUS (CUSTOM TAILWIND POPUP)          */}
      {/* ========================================================= */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-neutral-900 mb-1.5">
              Hapus Catatan Produksi?
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              Yakin ingin menghapus catatan batch tanggal <b className="text-neutral-800">{deleteModal.batchDate}</b>? Data rincian bahan dan upah produksi ini akan terhapus permanen.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal({ show: false, batchId: '', batchDate: '' })}
                className="py-3 px-4 rounded-xl border border-neutral-200 text-xs font-bold text-neutral-600 hover:bg-neutral-50 active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeDeleteBatch}
                className="py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-md active:scale-95 transition-all"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: NOTIFIKASI SUKSES / GAGAL                         */}
      {/* ========================================================= */}
      {feedback.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 shadow-2xl border border-neutral-100 text-center animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setFeedback({ ...feedback, show: false })}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
            >
              <X className="w-4 h-4" />
            </button>

            <div
              className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
                feedback.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
            </div>

            <h3 className="text-base font-black text-neutral-900 mb-1.5">{feedback.title}</h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-6">{feedback.message}</p>

            <button
              type="button"
              onClick={() => setFeedback({ ...feedback, show: false })}
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