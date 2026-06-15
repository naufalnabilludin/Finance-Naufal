import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { db, ref, onValue, push, remove } from './firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState('spending');
  const [transaksi, setTransaksi] = useState([]);
  const [aset, setAset] = useState({});
  const [budget, setBudget] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState('Pengeluaran');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDays, setFilterDays] = useState(30);

  const DEFAULT_BUDGET = {
    'Makan & Minum': 300000,
    'Transportasi': 100000,
    'Kesehatan': 0,
    'Literasi & Buku': 150000,
    'Langganan Claude': 385000,
    'Internet': 100000,
    'Lain-lain': 0
  };

  // Firebase listeners
  useEffect(() => {
    const txRef = ref(db, 'transaksi');
    const unsubscribe = onValue(txRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const txList = Object.entries(data).map(([key, val]) => ({ id: key, ...val }));
        setTransaksi(txList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
      } else {
        setTransaksi([]);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const asetRef = ref(db, 'aset');
    const unsubscribe = onValue(asetRef, (snap) => {
      setAset(snap.exists() ? snap.val() : {});
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const budgetRef = ref(db, 'budget');
    const unsubscribe = onValue(budgetRef, (snap) => {
      if (snap.exists()) {
        setBudget(snap.val());
      } else {
        setBudget(DEFAULT_BUDGET);
      }
    });
    return unsubscribe;
  }, []);

  const parseInput = (text) => {
    const parts = text.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    const description = parts.slice(0, -1).join(' ');
    if (!amount || isNaN(amount)) throw new Error('Format: kategori nominal');
    return { amount, description: description || 'Transaksi', category: 'Lain-lain' };
  };

  const handleAddTransaksi = async () => {
    if (!inputValue.trim()) return alert('Input tidak boleh kosong');
    try {
      const parsed = parseInput(inputValue);
      const newTx = {
        tanggal: selectedDate,
        nominal: parsed.amount,
        deskripsi: parsed.description,
        kategori: parsed.category,
        tipe: inputType,
        timestamp: new Date().toISOString()
      };
      await push(ref(db, 'transaksi'), newTx);
      setInputValue('');
      setShowModal(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus transaksi ini?')) {
      await remove(ref(db, `transaksi/${id}`));
    }
  };

  const now = new Date();
  const filteredDate = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000);
  const filteredTx = transaksi.filter(tx => new Date(tx.tanggal) >= filteredDate && tx.tipe === 'Pengeluaran');

  const totalSpent = filteredTx.reduce((sum, tx) => sum + tx.nominal, 0);
  const totalIncome = transaksi.filter(tx => tx.tipe === 'Pemasukan').reduce((sum, tx) => sum + tx.nominal, 0);
  const totalBudget = Object.values(budget).reduce((sum, b) => sum + b, 0);
  const remaining = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const spendByCategory = {};
  filteredTx.forEach(tx => {
    const cat = tx.kategori || 'Lain-lain';
    spendByCategory[cat] = (spendByCategory[cat] || 0) + tx.nominal;
  });

  const categoryData = Object.entries(spendByCategory).map(([name, value]) => ({ name, value }));
  const totalAsset = Object.values(aset).reduce((sum, val) => sum + (val || 0), 0);
  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50">
      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
              💰 Keuangan Naufal
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('spending')}
                className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === 'spending' ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                🧾 Pengeluaran
              </button>
              <button
                onClick={() => setActiveTab('asset')}
                className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === 'asset' ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                💎 Aset
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'spending' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-sm opacity-90 font-semibold">Sisa Anggaran</p>
                <p className="text-3xl font-bold mt-2">Rp{remaining.toLocaleString('id')}</p>
                <div className="mt-4 w-full bg-white/20 rounded-full h-2">
                  <div className="bg-white h-2 rounded-full" style={{ width: `${Math.min(percentUsed, 100)}%` }}></div>
                </div>
                <p className="text-xs mt-2 opacity-80">{percentUsed.toFixed(1)}% terpakai</p>
              </div>

              <div className="bg-gradient-to-br from-blue-400 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-sm opacity-90 font-semibold">Anggaran Awal</p>
                <p className="text-3xl font-bold mt-2">Rp{totalBudget.toLocaleString('id')}</p>
              </div>

              <div className="bg-gradient-to-br from-red-400 to-pink-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-sm opacity-90 font-semibold">Pengeluaran</p>
                <p className="text-3xl font-bold mt-2">-Rp{totalSpent.toLocaleString('id')}</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-400 to-orange-600 text-white rounded-xl p-6 shadow-lg">
                <p className="text-sm opacity-90 font-semibold">Pemasukan</p>
                <p className="text-3xl font-bold mt-2">+Rp{totalIncome.toLocaleString('id')}</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Distribusi Pengeluaran</h3>
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={{ fontSize: 12 }} outerRadius={80} fill="#8884d8" dataKey="value">
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `Rp${value.toLocaleString('id')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-400">Belum ada data pengeluaran</div>
                )}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Anggaran vs Pengeluaran</h3>
                {Object.keys(budget).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(budget).map(([cat, budg]) => ({
                      category: cat.split(' ')[0],
                      budget: budg,
                      pengeluaran: spendByCategory[cat] || 0
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(value) => `Rp${value.toLocaleString('id')}`} />
                      <Legend />
                      <Bar dataKey="budget" fill="#82ca9d" />
                      <Bar dataKey="pengeluaran" fill="#ffc658" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-400">Loading chart...</div>
                )}
              </div>
            </div>

            {/* Filter & Button */}
            <div className="bg-white rounded-xl p-6 shadow-lg flex justify-between items-center">
              <div className="flex gap-2 flex-wrap">
                {[7, 14, 30].map(days => (
                  <button
                    key={days}
                    onClick={() => setFilterDays(days)}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${filterDays === days ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    {days} hari
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setShowModal(true); setInputValue(''); }}
                className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-8 py-3 rounded-xl hover:shadow-lg transition font-bold text-lg"
              >
                ➕ Tambah
              </button>
            </div>

            {/* Modal */}
            {showModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
                  <h2 className="text-2xl font-bold mb-6 text-gray-800">Catat Transaksi</h2>
                  <div className="space-y-4">
                    <select value={inputType} onChange={(e) => setInputType(e.target.value)} className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none font-semibold">
                      <option>Pengeluaran</option>
                      <option>Pemasukan</option>
                    </select>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none" />
                    <div>
                      <input type="text" placeholder="kategori nominal (e.g: makan 50000)" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none" />
                      <p className="text-xs text-gray-500 mt-2">Contoh: makan 50000</p>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button onClick={handleAddTransaksi} className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-3 rounded-lg hover:shadow-lg transition font-bold">
                        Simpan
                      </button>
                      <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-400 transition font-bold">
                        Batal
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Transaksi List */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="font-bold text-lg mb-4 text-gray-800">Transaksi Terbaru</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transaksi.length > 0 ? (
                  transaksi.map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:shadow-md transition border-l-4 border-green-500">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{tx.deskripsi}</p>
                        <p className="text-sm text-gray-500">{tx.tanggal} • {tx.kategori}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold text-lg ${tx.tipe === 'Pengeluaran' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.tipe === 'Pengeluaran' ? '−' : '+'}Rp{tx.nominal.toLocaleString('id')}
                        </p>
                        <button onClick={() => handleDelete(tx.id)} className="text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">Belum ada transaksi</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'asset' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl p-8 shadow-lg">
              <p className="text-sm opacity-90 font-semibold">Total Aset</p>
              <p className="text-5xl font-bold mt-4">Rp{totalAsset.toLocaleString('id')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(aset).map(([key, value]) => (
                <div key={key} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition border-t-4 border-blue-500">
                  <p className="text-gray-600 text-sm font-semibold">📊 {key}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-3">Rp{value.toLocaleString('id')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}