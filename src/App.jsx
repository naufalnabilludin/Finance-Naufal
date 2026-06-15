import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { db, ref, onValue, push, remove, set } from './firebase';

export default function App() {
  const [activeTab, setActiveTab] = useState('spending');
  const [transaksi, setTransaksi] = useState([]);
  const [aset, setAset] = useState({});
  const [budget, setBudget] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputType, setInputType] = useState('Pengeluaran');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState(null);
  const [filterDays, setFilterDays] = useState(30);

  // Initialize Budget
  const DEFAULT_BUDGET = {
    'Makan & Minum': 300000,
    'Transportasi': 100000,
    'Kesehatan': 0,
    'Literasi & Buku': 150000,
    'Langganan Claude': 385000,
    'Internet': 100000,
    'Lain-lain': 0
  };

  const CATEGORIES = {
    Pengeluaran: [
      'Makan & Minum', 'Transportasi', 'Kesehatan', 'Literasi & Buku',
      'Langganan Claude', 'Internet', 'Lain-lain'
    ],
    Pemasukan: ['Honor', 'Beasiswa', 'Freelance', 'Auditorium', 'Lain-lain']
  };

  // Firebase: Listen to Transaksi
  useEffect(() => {
    const transaksiRef = ref(db, 'transaksi');
    const unsubscribe = onValue(transaksiRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const txList = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val
        }));
        setTransaksi(txList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal)));
      } else {
        setTransaksi([]);
      }
    });
    return unsubscribe;
  }, []);

  // Firebase: Listen to Aset
  useEffect(() => {
    const asetRef = ref(db, 'aset');
    const unsubscribe = onValue(asetRef, (snapshot) => {
      if (snapshot.exists()) {
        setAset(snapshot.val());
      } else {
        setAset({});
      }
    });
    return unsubscribe;
  }, []);

  // Firebase: Listen to Budget
  useEffect(() => {
    const budgetRef = ref(db, 'budget');
    const unsubscribe = onValue(budgetRef, (snapshot) => {
      if (snapshot.exists()) {
        setBudget(snapshot.val());
      } else {
        setBudget(DEFAULT_BUDGET);
        set(budgetRef, DEFAULT_BUDGET);
      }
    });
    return unsubscribe;
  }, []);

  // Parse input dengan simple parsing (tanpa AI untuk sekarang)
  const parseInput = (text) => {
    const parts = text.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    const description = parts.slice(0, -1).join(' ');

    if (!amount || isNaN(amount)) {
      throw new Error('Format: kategori nominal (e.g: makan 20000)');
    }

    return {
      amount,
      description: description || 'Transaksi',
      category: 'Lain-lain'
    };
  };

  // Add/Update Transaksi to Firebase
  const handleAddTransaksi = async () => {
    if (!inputValue.trim()) {
      alert('Input tidak boleh kosong');
      return;
    }

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

      if (editingId) {
        await set(ref(db, `transaksi/${editingId}`), newTx);
        setEditingId(null);
      } else {
        await push(ref(db, 'transaksi'), newTx);
      }

      setInputValue('');
      setShowModal(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Delete Transaksi from Firebase
  const handleDeleteTransaksi = async (id) => {
    if (confirm('Hapus transaksi ini?')) {
      await remove(ref(db, `transaksi/${id}`));
    }
  };

  // Calculate total & by category
  const now = new Date();
  const filteredDate = new Date(now.getTime() - filterDays * 24 * 60 * 60 * 1000);
  const filteredTx = transaksi.filter(tx => new Date(tx.tanggal) >= filteredDate && tx.tipe === 'Pengeluaran');

  const totalSpent = filteredTx.reduce((sum, tx) => sum + tx.nominal, 0);
  const totalIncome = transaksi.filter(tx => tx.tipe === 'Pemasukan').reduce((sum, tx) => sum + tx.nominal, 0);
  const totalBudget = Object.values(budget).reduce((sum, b) => sum + b, 0);
  const remaining = totalBudget - totalSpent;

  const spendByCategory = {};
  filteredTx.forEach(tx => {
    const cat = tx.kategori || 'Lain-lain';
    spendByCategory[cat] = (spendByCategory[cat] || 0) + tx.nominal;
  });

  const categoryData = Object.entries(spendByCategory).map(([name, value]) => ({
    name,
    value
  }));

  // Asset calculations
  const totalAsset = Object.values(aset).reduce((sum, val) => sum + (val || 0), 0);

  const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50">
      {/* Navbar */}
      <div className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-700">💰 Finance Naufal</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('spending')}
              className={`px-4 py-2 rounded ${activeTab === 'spending' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
            >
              🧾 Pengeluaran
            </button>
            <button
              onClick={() => setActiveTab('asset')}
              className={`px-4 py-2 rounded ${activeTab === 'asset' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
            >
              💎 Aset
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Spending Tab */}
        {activeTab === 'spending' && (
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg p-6 shadow-lg">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm opacity-90">Sisa Anggaran</p>
                  <p className="text-3xl font-bold">Rp{remaining.toLocaleString('id')}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Anggaran Awal</p>
                  <p className="text-xl font-bold">Rp{totalBudget.toLocaleString('id')}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Pengeluaran</p>
                  <p className="text-xl font-bold text-red-300">-Rp{totalSpent.toLocaleString('id')}</p>
                </div>
                <div>
                  <p className="text-sm opacity-90">Pemasukan</p>
                  <p className="text-xl font-bold text-green-300">+Rp{totalIncome.toLocaleString('id')}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white rounded-lg p-4 shadow">
                <h3 className="font-bold mb-4">Distribusi Pengeluaran</h3>
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
              </div>

              {/* Budget vs Actual */}
              <div className="bg-white rounded-lg p-4 shadow">
                <h3 className="font-bold mb-4">Anggaran vs Pengeluaran</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(budget).map(([cat, budget]) => ({
                    category: cat.split(' ')[0],
                    budget,
                    pengeluaran: spendByCategory[cat] || 0
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => `Rp${value.toLocaleString('id')}`} />
                    <Legend />
                    <Bar dataKey="budget" fill="#82ca9d" />
                    <Bar dataKey="pengeluaran" fill="#ffc658" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Filter & Add Button */}
            <div className="bg-white rounded-lg p-4 shadow flex justify-between items-center">
              <div className="flex gap-2">
                <button onClick={() => setFilterDays(7)} className={`px-4 py-2 rounded ${filterDays === 7 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>7 hari</button>
                <button onClick={() => setFilterDays(14)} className={`px-4 py-2 rounded ${filterDays === 14 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>14 hari</button>
                <button onClick={() => setFilterDays(30)} className={`px-4 py-2 rounded ${filterDays === 30 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>30 hari</button>
              </div>
              <button onClick={() => { setShowModal(true); setEditingId(null); setInputValue(''); }} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                ➕
              </button>
            </div>

            {/* Modal */}
            {showModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
                  <h2 className="text-xl font-bold mb-4">Catat Transaksi</h2>
                  <select value={inputType} onChange={(e) => setInputType(e.target.value)} className="w-full border p-2 mb-4 rounded">
                    <option>Pengeluaran</option>
                    <option>Pemasukan</option>
                  </select>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full border p-2 mb-4 rounded" />
                  <input type="text" placeholder="kategori nominal" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="w-full border p-2 mb-4 rounded" />
                  <p className="text-xs text-gray-500 mb-4">Contoh: makan 50000</p>
                  <div className="flex gap-2">
                    <button onClick={handleAddTransaksi} className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Simpan</button>
                    <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-300 px-4 py-2 rounded">Batal</button>
                  </div>
                </div>
              </div>
            )}

            {/* Transaksi List */}
            <div className="bg-white rounded-lg p-4 shadow">
              <h3 className="font-bold mb-4">Transaksi Terbaru</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {transaksi.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center p-3 bg-gray-50 rounded hover:bg-gray-100">
                    <div>
                      <p className="font-semibold">{tx.deskripsi}</p>
                      <p className="text-xs text-gray-600">{tx.tanggal} • {tx.kategori}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`font-bold ${tx.tipe === 'Pengeluaran' ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.tipe === 'Pengeluaran' ? '-' : '+'}Rp{tx.nominal.toLocaleString('id')}
                      </p>
                      <button onClick={() => handleDeleteTransaksi(tx.id)} className="text-red-600 hover:text-red-800">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Asset Tab */}
        {activeTab === 'asset' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6 shadow-lg">
              <p className="text-sm opacity-90">Total Aset</p>
              <p className="text-4xl font-bold">Rp{totalAsset.toLocaleString('id')}</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow space-y-4">
              {Object.entries(aset).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center p-4 bg-gray-50 rounded">
                  <span className="font-semibold">{key}</span>
                  <span className="font-bold text-lg">Rp{value.toLocaleString('id')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
