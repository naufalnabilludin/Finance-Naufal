import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { db, ref, onValue, push, remove } from './firebase';

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 50%, #f0f9ff 100%)' },
  navbar: { background: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', position: 'sticky', top: 0, zIndex: 40 },
  navbarInner: { maxWidth: '1400px', margin: '0 auto', padding: '1rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(to right, #16a34a, #14b8a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  buttonGroup: { display: 'flex', gap: '0.5rem' },
  button: (active) => ({
    padding: '0.5rem 1.5rem',
    borderRadius: '0.5rem',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s',
    background: active ? 'linear-gradient(to right, #22c55e, #14b8a6)' : '#f3f4f6',
    color: active ? '#fff' : '#374151'
  }),
  main: { maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  card: (gradient) => ({
    background: gradient,
    color: '#fff',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
  }),
  cardText: { fontSize: '0.875rem', opacity: 0.9, fontWeight: '600' },
  cardValue: { fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.5rem' },
  chartContainer: { background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  chartTitle: { fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '1rem', color: '#1f2937' },
  filterButtons: { background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addButton: { background: 'linear-gradient(to right, #22c55e, #14b8a6)', color: '#fff', padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.125rem' },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' },
  modalContent: { background: '#fff', borderRadius: '1.5rem', padding: '2rem', width: '100%', maxWidth: '28rem', boxShadow: '0 25px 50px rgba(0,0,0,0.2)' },
  input: { width: '100%', borderRadius: '0.5rem', padding: '0.75rem', border: '2px solid #d1d5db', marginBottom: '1rem', fontWeight: '500' },
  transactionList: { background: '#fff', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' },
  transactionItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'linear-gradient(to right, #f9fafb, #f3f4f6)', borderRadius: '0.5rem', marginBottom: '0.75rem', borderLeft: '4px solid #16a34a' },
};

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
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.navbarInner}>
          <h1 style={styles.title}>💰 Keuangan Naufal</h1>
          <div style={styles.buttonGroup}>
            <button style={styles.button(activeTab === 'spending')} onClick={() => setActiveTab('spending')}>
              🧾 Pengeluaran
            </button>
            <button style={styles.button(activeTab === 'asset')} onClick={() => setActiveTab('asset')}>
              💎 Aset
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.main}>
        {activeTab === 'spending' && (
          <div>
            <div style={styles.grid}>
              <div style={styles.card('linear-gradient(135deg, #86efac 0%, #6ee7b7 100%)')}>
                <div style={styles.cardText}>Sisa Anggaran</div>
                <div style={styles.cardValue}>Rp{remaining.toLocaleString('id')}</div>
                <div style={{ marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: '0.25rem', height: '0.5rem' }}>
                  <div style={{ background: '#fff', height: '0.5rem', borderRadius: '0.25rem', width: `${Math.min(percentUsed, 100)}%` }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}>{percentUsed.toFixed(1)}% terpakai</div>
              </div>

              <div style={styles.card('linear-gradient(135deg, #60a5fa 0%, #06b6d4 100%)')}>
                <div style={styles.cardText}>Anggaran Awal</div>
                <div style={styles.cardValue}>Rp{totalBudget.toLocaleString('id')}</div>
              </div>

              <div style={styles.card('linear-gradient(135deg, #f87171 0%, #fb7185 100%)')}>
                <div style={styles.cardText}>Pengeluaran</div>
                <div style={styles.cardValue}>-Rp{totalSpent.toLocaleString('id')}</div>
              </div>

              <div style={styles.card('linear-gradient(135deg, #fbbf24 0%, #f97316 100%)')}>
                <div style={styles.cardText}>Pemasukan</div>
                <div style={styles.cardValue}>+Rp{totalIncome.toLocaleString('id')}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>Distribusi Pengeluaran</div>
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
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Belum ada data pengeluaran</div>
                )}
              </div>

              <div style={styles.chartContainer}>
                <div style={styles.chartTitle}>Anggaran vs Pengeluaran</div>
                {Object.keys(budget).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(budget).map(([cat, budg]) => ({ category: cat.split(' ')[0], budget: budg, pengeluaran: spendByCategory[cat] || 0 }))}>
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
                  <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Loading...</div>
                )}
              </div>
            </div>

            <div style={styles.filterButtons}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[7, 14, 30].map(days => (
                  <button key={days} style={{ ...styles.button(filterDays === days), padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setFilterDays(days)}>
                    {days} hari
                  </button>
                ))}
              </div>
              <button style={styles.addButton} onClick={() => { setShowModal(true); setInputValue(''); }}>
                ➕ Tambah
              </button>
            </div>

            {showModal && (
              <div style={styles.modal} onClick={() => setShowModal(false)}>
                <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#1f2937' }}>Catat Transaksi</h2>
                  <select value={inputType} onChange={(e) => setInputType(e.target.value)} style={styles.input}>
                    <option>Pengeluaran</option>
                    <option>Pemasukan</option>
                  </select>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={styles.input} />
                  <input type="text" placeholder="kategori nominal (e.g: makan 50000)" value={inputValue} onChange={(e) => setInputValue(e.target.value)} style={styles.input} />
                  <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '1rem' }}>Contoh: makan 50000</p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={handleAddTransaksi} style={{ ...styles.addButton, flex: 1 }}>Simpan</button>
                    <button onClick={() => setShowModal(false)} style={{ ...styles.addButton, background: '#ccc', color: '#333', flex: 1 }}>Batal</button>
                  </div>
                </div>
              </div>
            )}

            <div style={styles.transactionList}>
              <div style={styles.chartTitle}>Transaksi Terbaru</div>
              <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
                {transaksi.length > 0 ? (
                  transaksi.map((tx) => (
                    <div key={tx.id} style={styles.transactionItem}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{tx.deskripsi}</div>
                        <div style={{ fontSize: '0.875rem', color: '#999' }}>{tx.tanggal} • {tx.kategori}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.125rem', color: tx.tipe === 'Pengeluaran' ? '#dc2626' : '#16a34a' }}>
                          {tx.tipe === 'Pengeluaran' ? '−' : '+'}Rp{tx.nominal.toLocaleString('id')}
                        </div>
                        <button onClick={() => handleDelete(tx.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>🗑️</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Belum ada transaksi</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'asset' && (
          <div>
            <div style={styles.card('linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)')}>
              <div style={styles.cardText}>Total Aset</div>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', marginTop: '1rem' }}>Rp{totalAsset.toLocaleString('id')}</div>
            </div>
            <div style={{ ...styles.grid, marginTop: '2rem' }}>
              {Object.entries(aset).map(([key, value]) => (
                <div key={key} style={{ ...styles.chartContainer, borderTop: '4px solid #3b82f6' }}>
                  <div style={{ color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>📊 {key}</div>
                  <div style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', marginTop: '0.75rem' }}>Rp{value.toLocaleString('id')}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}