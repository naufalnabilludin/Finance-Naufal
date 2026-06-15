import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { db, ref, onValue, set, remove } from "./firebase";

// ════════════════════════════════════════════════════════════
//  CONFIG & CONSTANTS
// ════════════════════════════════════════════════════════════
const BUDGET_AWAL = 1000000;

const EXPENSE_CATEGORIES = {
  "Makan & Minum":       { icon: "🍜", color: "#E8735A", budget: 300000 },
  "Transport":           { icon: "🚌", color: "#5B8DB8", budget: 100000 },
  "Kesehatan":           { icon: "💊", color: "#E8A838", budget: 0 },
  "Literasi & Buku":     { icon: "📚", color: "#4A9B7F", budget: 150000 },
  "Langganan Claude 🤖": { icon: "🤖", color: "#E8A838", budget: 385000 },
  "Internet":            { icon: "🌐", color: "#20B2AA", budget: 100000 },
  "Lain-lain":           { icon: "📦", color: "#888888", budget: 0 },
};

const INCOME_CATEGORIES = {
  "Honorarium": { icon: "🎤", color: "#2D5A3D" },
  "Project":    { icon: "💼", color: "#4A9B7F" },
  "Beasiswa":   { icon: "🎓", color: "#5B8DB8" },
  "Komunitas":  { icon: "🤝", color: "#9B6BB5" },
  "Lain-lain":  { icon: "💰", color: "#E8A838" },
};

const ASSET_TYPES = {
  emas:    { label: "Emas",            icon: "💛", color: "#E8A838" },
  saham:   { label: "Saham",           icon: "📈", color: "#5B8DB8" },
  cash:    { label: "Cash & Deposito", icon: "🏦", color: "#4A9B7F" },
  hutang:  { label: "Hutang",          icon: "💳", color: "#C0392B" },
};

const DONUT_COLORS = ["#E8A838", "#A8D8C0", "#88C4A8", "#5B8DB8", "#E8895A", "#9B6BB5", "#888888"];

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const fmt = (n) => "Rp" + Number(Math.round(n)).toLocaleString("id-ID");
const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayStr().slice(0, 7);
const dateLabel = (d) => {
  const today = todayStr();
  const yest = new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10);
  if (d === today) return "Hari Ini";
  if (d === yest) return "Kemarin";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
const monthLabel = () => new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

// ════════════════════════════════════════════════════════════
//  MANUAL PARSER (replace AI parser)
// ════════════════════════════════════════════════════════════
function parseTransaction(text, type) {
  const lower = text.toLowerCase();
  const parts = text.trim().split(/\s+/);
  
  // Find amount (last numeric or "Xrb" / "Xjt" pattern)
  let amount = 0;
  let amountStr = "";
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].toLowerCase().replace(/[.,]/g, '');
    if (p.match(/^\d+rb$/)) { amount = parseInt(p.replace('rb', '')) * 1000; amountStr = parts[i]; break; }
    if (p.match(/^\d+jt$/)) { amount = parseInt(p.replace('jt', '')) * 1000000; amountStr = parts[i]; break; }
    if (p.match(/^\d+k$/))  { amount = parseInt(p.replace('k', ''))  * 1000; amountStr = parts[i]; break; }
    if (p.match(/^\d+$/))   { amount = parseInt(p); amountStr = parts[i]; break; }
  }
  
  if (!amount) return { amount: 0, description: text, category: "Lain-lain" };
  
  const description = text.replace(amountStr, "").trim() || "Transaksi";
  
  // Auto-categorize
  let category = "Lain-lain";
  const cats = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  
  if (type === "expense") {
    if (lower.match(/makan|minum|nasi|kopi|jajan|sarapan|lunch|dinner|gofood|grab.*food|traktir/)) category = "Makan & Minum";
    else if (lower.match(/transport|grab|gojek|bensin|parkir|ojek|bus|taxi/)) category = "Transport";
    else if (lower.match(/obat|dokter|klinik|halodoc|kesehatan|vitamin|rs/)) category = "Kesehatan";
    else if (lower.match(/buku|literasi|baca|novel|perpus/)) category = "Literasi & Buku";
    else if (lower.match(/claude|langganan ai|chatgpt|api/)) category = "Langganan Claude 🤖";
    else if (lower.match(/internet|wifi|kuota|paket data/)) category = "Internet";
  } else {
    if (lower.match(/honor|gaji|fee|pelatihan/)) category = "Honorarium";
    else if (lower.match(/project|proyek|freelance|klien/)) category = "Project";
    else if (lower.match(/beasiswa|stipend/)) category = "Beasiswa";
    else if (lower.match(/komunitas|kpk|rumah dunia|auditorium/)) category = "Komunitas";
  }
  
  return { amount, description, category };
}

// ════════════════════════════════════════════════════════════
//  SEED DATA
// ════════════════════════════════════════════════════════════
const SEED_EXPENSES = [
  { id: 1013, date: "2026-06-13", amount: 28000,  description: "Konsul Halodoc", category: "Kesehatan" },
  { id: 1014, date: "2026-06-13", amount: 70000,  description: "Beli obat", category: "Kesehatan" },
  { id: 1015, date: "2026-06-13", amount: 70000,  description: "Makan & traktiran", category: "Makan & Minum" },
  { id: 1016, date: "2026-06-12", amount: 82000,  description: "Buku Fiksi Mini SIP", category: "Literasi & Buku" },
  { id: 1017, date: "2026-06-09", amount: 50000,  description: "Buku Ledakkan Idemu", category: "Literasi & Buku" },
  { id: 1018, date: "2026-06-07", amount: 26000,  description: "Bazar buku Perpusda", category: "Literasi & Buku" },
  { id: 1019, date: "2026-06-01", amount: 366000, description: "Langganan Claude", category: "Langganan Claude 🤖" },
  { id: 1020, date: "2026-06-04", amount: 50000,  description: "Internet", category: "Internet" },
  { id: 1021, date: "2026-06-03", amount: 100000, description: "Belanja makanan", category: "Makan & Minum" },
];
const SEED_INCOMES = [
  { id: 2011, date: "2026-06-11", amount: 260000, description: "Uang kegiatan KPK", category: "Komunitas" },
  { id: 2009, date: "2026-06-09", amount: 100000, description: "Auditorium Rumah Dunia", category: "Komunitas" },
];
const SEED_ASSETS = [
  { id: 3001, type: "emas",   nama: "Emas Digital", qty: 2.2217, unit: "gr",  beli: 2000000, now: 2587000, ket: "" },
  { id: 3002, type: "emas",   nama: "Emas Fisik",   qty: 1.0000, unit: "gr",  beli: 2006700, now: 2549000, ket: "" },
  { id: 3003, type: "saham",  nama: "BBRI", qty: 100, unit: "lbr", beli: 3465, now: 3170, ket: "" },
  { id: 3004, type: "saham",  nama: "SIDO", qty: 800, unit: "lbr", beli: 489,  now: 406,  ket: "" },
  { id: 3005, type: "cash",   nama: "Deposito Krom",    qty: 1, unit: "", beli: 1900000, now: 1900000, ket: "Jatuh tempo Jan 2027" },
  { id: 3006, type: "cash",   nama: "Cash Operasional", qty: 1, unit: "", beli: 1000000, now: 1000000, ket: "Saldo rekening utama" },
  { id: 3007, type: "hutang", nama: "Kredivo+", qty: 1, unit: "", beli: 900000, now: 900000, ket: "Cicilan" },
];

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("spending");
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    let mounted = true;
    let loadedExp = false, loadedInc = false, loadedAst = false;
    
    const checkReady = () => {
      if (loadedExp && loadedInc && loadedAst && mounted) setReady(true);
    };

    // Expenses listener
    const expRef = ref(db, 'expenses');
    onValue(expRef, async (snap) => {
      if (snap.exists()) {
        const list = Object.values(snap.val()).sort((a, b) => b.id - a.id);
        if (mounted) setExpenses(list);
      } else {
        // Seed once
        for (const e of SEED_EXPENSES) await set(ref(db, `expenses/${e.id}`), e);
        if (mounted) setExpenses(SEED_EXPENSES);
      }
      loadedExp = true;
      checkReady();
    });

    // Incomes listener
    const incRef = ref(db, 'incomes');
    onValue(incRef, async (snap) => {
      if (snap.exists()) {
        const list = Object.values(snap.val()).sort((a, b) => b.id - a.id);
        if (mounted) setIncomes(list);
      } else {
        for (const i of SEED_INCOMES) await set(ref(db, `incomes/${i.id}`), i);
        if (mounted) setIncomes(SEED_INCOMES);
      }
      loadedInc = true;
      checkReady();
    });

    // Assets listener
    const astRef = ref(db, 'assets');
    onValue(astRef, async (snap) => {
      if (snap.exists()) {
        const list = Object.values(snap.val()).sort((a, b) => a.id - b.id);
        if (mounted) setAssets(list);
      } else {
        for (const a of SEED_ASSETS) await set(ref(db, `assets/${a.id}`), a);
        if (mounted) setAssets(SEED_ASSETS);
      }
      loadedAst = true;
      checkReady();
    });

    return () => { mounted = false; };
  }, []);

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: "#EEF2ED", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", color: "#88928A" }}>
      ⏳ Memuat data...
    </div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2ED", fontFamily: "'Inter',system-ui,sans-serif", paddingBottom: 72 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 16px 0" }}>
        {page === "spending"
          ? <SpendingPage expenses={expenses} incomes={incomes} />
          : <AssetPage assets={assets} />}
      </div>
      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SHARED UI
// ════════════════════════════════════════════════════════════
const card = { background: "white", borderRadius: 18, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)" };
const sectionTitle = { fontSize: 12, fontWeight: 700, color: "#7A857C", letterSpacing: 1, textTransform: "uppercase" };
const addBtnStyle = { background: "#EEF2ED", border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#3A9B6E", cursor: "pointer" };

function AssetEditModal({ asset, onChange, onSave, onDelete, onClose }) {
  const isQty = asset.type === "emas" || asset.type === "saham";
  const isDebt = asset.type === "hutang";
  const isCash = asset.type === "cash";
  const typeLabel = ASSET_TYPES[asset.type].label;
  const num = (v) => parseInt(String(v).replace(/\D/g, "")) || 0;
  const numFloat = (v) => parseFloat(String(v).replace(/[^\d.]/g, "")) || 0;

  const lbl = { fontSize: 12, color: "#7A857C", fontWeight: 600, display: "block", marginBottom: 4 };
  const inp = { width: "100%", border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginBottom: 12, outline: "none", boxSizing: "border-box" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 22, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2b22", marginBottom: 4 }}>
          {asset.isNew ? `Tambah ${typeLabel}` : `Edit ${asset.nama || typeLabel}`}
        </div>
        <div style={{ fontSize: 12, color: "#9AA39B", marginBottom: 16 }}>{ASSET_TYPES[asset.type].icon} {typeLabel}</div>

        <label style={lbl}>Nama Aset</label>
        <input value={asset.nama} onChange={e => onChange({ ...asset, nama: e.target.value })} placeholder={isQty ? "Contoh: BBRI, Emas Digital" : "Contoh: Deposito Krom"} style={inp} />

        {isQty && (
          <>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Jumlah ({asset.unit})</label>
                <input value={asset.qty} onChange={e => onChange({ ...asset, qty: numFloat(e.target.value) })} style={inp} />
              </div>
              <div style={{ width: 90 }}>
                <label style={lbl}>Satuan</label>
                <input value={asset.unit} onChange={e => onChange({ ...asset, unit: e.target.value })} style={inp} />
              </div>
            </div>
            <label style={lbl}>Harga Rata-rata Beli (per {asset.unit})</label>
            <input value={asset.beli} onChange={e => onChange({ ...asset, beli: num(e.target.value) })} style={inp} />
            <label style={lbl}>Harga Sekarang (per {asset.unit})</label>
            <input value={asset.now} onChange={e => onChange({ ...asset, now: num(e.target.value) })} style={inp} />

            <div style={{ background: "#F7F9F6", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "#7A857C" }}>Nilai sekarang</span>
                <span style={{ fontWeight: 700 }}>{fmt(asset.qty * asset.now)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#7A857C" }}>Return</span>
                <span style={{ fontWeight: 700, color: asset.now >= asset.beli ? "#2D7D4A" : "#C0392B" }}>
                  {asset.beli ? (((asset.now - asset.beli) / asset.beli) * 100).toFixed(2) : "0"}%
                </span>
              </div>
            </div>
          </>
        )}

        {(isCash || isDebt) && (
          <>
            <label style={lbl}>{isDebt ? "Sisa Hutang (Rp)" : "Nilai / Saldo (Rp)"}</label>
            <input value={asset.now} onChange={e => onChange({ ...asset, now: num(e.target.value), beli: num(e.target.value) })} style={inp} />
            <label style={lbl}>Keterangan</label>
            <input value={asset.ket} onChange={e => onChange({ ...asset, ket: e.target.value })} placeholder={isDebt ? "Contoh: Cicilan, jatuh tempo..." : "Contoh: Saldo rekening utama"} style={inp} />
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {!asset.isNew && (
            <button onClick={() => onDelete(asset.id)} style={{ padding: "11px 14px", borderRadius: 10, border: "1.5px solid #F0D0CC", background: "white", color: "#C0392B", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>🗑️</button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #E2E6E0", background: "white", color: "#6a756e", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Batal</button>
          <button onClick={() => onSave({ id: asset.id, type: asset.type, nama: asset.nama, qty: asset.qty, unit: asset.unit, beli: asset.beli, now: asset.now, ket: asset.ket })}
            disabled={!asset.nama}
            style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: asset.nama ? "#1F4D38" : "#ccc", color: "white", fontSize: 14, fontWeight: 700, cursor: asset.nama ? "pointer" : "not-allowed" }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ page, setPage }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #E2E6E0", display: "flex", justifyContent: "center", gap: 60, padding: "14px 0 16px", zIndex: 50 }}>
      {[["spending", "🧾", "Spending"], ["assets", "💎", "Aset"]].map(([v, icon, label]) => (
        <button key={v} onClick={() => setPage(v)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, filter: page === v ? "none" : "grayscale(1) opacity(0.45)" }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: page === v ? 700 : 500, color: page === v ? "#1F4D38" : "#9AA39B" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

function Donut({ data }) {
  return (
    <div style={{ width: 150, height: 150, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={45} outerRadius={72} paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SPENDING PAGE — with Date Selector
// ════════════════════════════════════════════════════════════
function SpendingPage({ expenses, incomes }) {
  const [viewDate, setViewDate] = useState(todayStr()); // ← NEW: Date selector state
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputDate, setInputDate] = useState(todayStr());
  const [inputType, setInputType] = useState("expense");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [trendDays, setTrendDays] = useState(30);

  const m = thisMonth();
  const monthExp = expenses.filter(e => e.date.startsWith(m));
  const monthInc = incomes.filter(e => e.date.startsWith(m));
  const totalExp = monthExp.reduce((s, e) => s + e.amount, 0);
  const totalInc = monthInc.reduce((s, e) => s + e.amount, 0);
  const sisaReal = BUDGET_AWAL + totalInc - totalExp;
  const budgetLeft = BUDGET_AWAL - totalExp;
  const pctBudget = Math.min((totalExp / BUDGET_AWAL) * 100, 100);

  // ════ DATE-SPECIFIC CALCULATIONS (based on viewDate) ════
  const expUpToDate = expenses.filter(e => e.date <= viewDate && e.date.startsWith(m));
  const incUpToDate = incomes.filter(e => e.date <= viewDate && e.date.startsWith(m));
  const totalExpUpToDate = expUpToDate.reduce((s, e) => s + e.amount, 0);
  const totalIncUpToDate = incUpToDate.reduce((s, e) => s + e.amount, 0);
  const sisaUpToDate = BUDGET_AWAL + totalIncUpToDate - totalExpUpToDate;
  
  // Daily transactions (transaksi hanya tanggal yang dipilih)
  const dayExp = expenses.filter(e => e.date === viewDate);
  const dayInc = incomes.filter(e => e.date === viewDate);
  const dayExpTotal = dayExp.reduce((s, e) => s + e.amount, 0);
  const dayIncTotal = dayInc.reduce((s, e) => s + e.amount, 0);

  const byCat = {};
  monthExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  const distData = Object.entries(byCat).map(([cat, val]) => ({ name: cat, value: val })).sort((a, b) => b.value - a.value);

  const trendCutoff = new Date();
  trendCutoff.setDate(trendCutoff.getDate() - (trendDays - 1));
  const trendCutoffStr = trendCutoff.toISOString().slice(0, 10);
  const dailyMap = {};
  expenses.filter(e => e.date >= trendCutoffStr).forEach(e => { dailyMap[e.date] = (dailyMap[e.date] || 0) + e.amount; });
  const trendData = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ day: new Date(d).getDate(), value: v }));
  const trendTotal = Object.values(dailyMap).reduce((s, v) => s + v, 0);
  const avgDaily = trendData.length ? trendTotal / trendData.length : 0;
  const maxDaily = trendData.length ? Math.max(...trendData.map(t => t.value)) : 0;

  const allTx = [
    ...monthExp.map(e => ({ ...e, type: "expense" })),
    ...monthInc.map(e => ({ ...e, type: "income" })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const shownTx = showAllTx ? allTx : allTx.slice(0, 4);

  // ════ FIREBASE OPERATIONS ════
  async function handleAdd() {
    if (!inputText.trim()) return;
    setLoading(true); setFeedback(null);
    try {
      const p = parseTransaction(inputText, inputType);
      if (!p.amount || p.amount <= 0) { setFeedback({ ok: false, msg: "Nominal gak kebaca. Coba: 'makan 20000' atau 'makan 20rb'" }); setLoading(false); return; }
      const entry = { id: Date.now(), date: inputDate, amount: p.amount, description: p.description, category: p.category };
      const storeType = inputType === "expense" ? "expenses" : "incomes";
      await set(ref(db, `${storeType}/${entry.id}`), entry);
      setInputText("");
      setFeedback({ ok: true, msg: `✅ ${p.description} — ${fmt(p.amount)}` });
    } catch (e) { setFeedback({ ok: false, msg: "Gagal. Coba lagi." }); }
    setLoading(false);
  }

  async function handleDelete(id, type) {
    const storeType = type === "expense" ? "expenses" : "incomes";
    await remove(ref(db, `${storeType}/${id}`));
  }

  async function handleSaveEdit(updated, type) {
    const storeType = type === "expense" ? "expenses" : "incomes";
    await set(ref(db, `${storeType}/${updated.id}`), updated);
    setEditTx(null);
  }

  const envelopeCats = Object.entries(EXPENSE_CATEGORIES).filter(([, info]) => info.budget > 0);

  // Quick date buttons
  const quickDates = [
    { label: "Hari Ini", value: todayStr() },
    { label: "Kemarin", value: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().slice(0, 10) },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* TITLE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>🧾</span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1a2b22" }}>Spending</div>
            <div style={{ fontSize: 13, color: "#7A857C" }}>Kelola pengeluaran harian dengan lebih bijak</div>
          </div>
        </div>
        <div style={{ ...card, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#3a4540" }}>📅 {monthLabel()}</div>
      </div>

      {/* ════ DATE SELECTOR (C + A) ════ */}
      <div style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#7A857C" }}>Lihat tanggal:</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {quickDates.map(q => (
            <button key={q.label} onClick={() => setViewDate(q.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "none",
                background: viewDate === q.value ? "#1F4D38" : "#F0F2EF",
                color: viewDate === q.value ? "white" : "#6a756e",
                fontWeight: viewDate === q.value ? 700 : 500, fontSize: 12, cursor: "pointer" }}>
              {q.label}
            </button>
          ))}
          <input type="date" value={viewDate} max={todayStr()} onChange={e => setViewDate(e.target.value)}
            style={{ border: "1.5px solid #E2E6E0", borderRadius: 8, padding: "5px 10px", fontSize: 13, background: "#FAFBFA", cursor: "pointer", fontWeight: 500 }} />
        </div>
        {viewDate !== todayStr() && (
          <button onClick={() => setViewDate(todayStr())}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "#3A9B6E", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ↻ Reset
          </button>
        )}
      </div>

      {/* HERO - DYNAMIC (based on viewDate) */}
      <div style={{ background: "linear-gradient(150deg,#1F4D38 0%,#2D6347 100%)", borderRadius: 22, padding: 24, color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
          Ringkasan {viewDate === todayStr() ? "Bulan Ini" : `s/d ${dateLabel(viewDate)}`}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Sisa uang {viewDate === todayStr() ? "bulan ini" : dateLabel(viewDate)}
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "2px 0 18px" }}>{fmt(sisaUpToDate)}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 18 }}>
          {[["💳", "Budget Awal", fmt(BUDGET_AWAL), "white"],
            ["⬆️", "Pemasukan", "+" + fmt(totalIncUpToDate), "#A8F0C6"],
            ["⬇️", "Pengeluaran", "-" + fmt(totalExpUpToDate), "#FFC4C4"],
            ["🎯", "vs Budget Plan", (BUDGET_AWAL - totalExpUpToDate >= 0 ? "+" : "") + fmt(BUDGET_AWAL - totalExpUpToDate), BUDGET_AWAL - totalExpUpToDate >= 0 ? "#A8F0C6" : "#FFC4C4"]].map(([ic, l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{ic} {l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Transaksi hari yang dipilih */}
        <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 14, padding: "14px 16px", color: "#1a2b22" }}>
          <div style={{ fontSize: 11, color: "#7A857C", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Transaksi {dateLabel(viewDate)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: "#7A857C" }}>Pengeluaran</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#C0392B" }}>{fmt(dayExpTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#7A857C" }}>Pemasukan</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#2D7D4A" }}>{fmt(dayIncTotal)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#7A857C" }}>Net</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: (dayIncTotal - dayExpTotal) >= 0 ? "#2D7D4A" : "#C0392B" }}>{(dayIncTotal - dayExpTotal) >= 0 ? "+" : ""}{fmt(dayIncTotal - dayExpTotal)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* PROGRESS BAR BULANAN */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: "#7A857C" }}>Realisasi Pengeluaran Bulan Ini</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2b22" }}>{fmt(totalExp)}</div>
            <div style={{ fontSize: 11, color: "#4A9B7F", fontWeight: 600 }}>{pctBudget.toFixed(1)}% dari budget</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#7A857C" }}>Sisa Budget Bulan</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: budgetLeft >= 0 ? "#2D7D4A" : "#C0392B" }}>{fmt(budgetLeft)}</div>
          </div>
        </div>
        <div style={{ height: 10, background: "#E8EDE9", borderRadius: 8 }}>
          <div style={{ height: 10, borderRadius: 8, width: `${pctBudget}%`, background: pctBudget >= 90 ? "#C0392B" : pctBudget >= 70 ? "#E8A838" : "#3A9B6E", transition: "width 0.5s" }} />
        </div>
      </div>

      {/* ENVELOPE */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={sectionTitle}>Pengeluaran per Kategori</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {envelopeCats.map(([cat, info]) => {
            const spent = byCat[cat] || 0;
            const pct = Math.min((spent / info.budget) * 100, 100);
            const over = spent > info.budget;
            const pctColor = over ? "#C0392B" : pct > 85 ? "#E8A838" : "#3A9B6E";
            return (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 26, flexShrink: 0 }}>{info.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#2a3530" }}>{cat}</span>
                    <span style={{ fontSize: 13, color: "#9AA39B" }}>{fmt(spent)} / {fmt(info.budget)}</span>
                  </div>
                  <div style={{ height: 7, background: "#EEF1ED", borderRadius: 7 }}>
                    <div style={{ height: 7, borderRadius: 7, width: `${pct}%`, background: over ? "#C0392B" : pct > 85 ? "#E8A838" : info.color, transition: "width 0.4s" }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, background: pctColor + "18", padding: "4px 9px", borderRadius: 20, flexShrink: 0, minWidth: 48, textAlign: "center" }}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* DISTRIBUSI + TREND */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 16 }}>Distribusi Pengeluaran</div>
          {distData.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Donut data={distData} />
                <div style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 8 }}>
                  {distData.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, color: "#5a655e" }}>{d.name}</span>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "#2a3530" }}>{((d.value / totalExp) * 100).toFixed(1)}%</div>
                        <div style={{ fontSize: 10, color: "#aab3ab" }}>{fmt(d.value)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #EEF1ED", marginTop: 14, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#7A857C" }}>Total Pengeluaran</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#2a3530" }}>{fmt(totalExp)}</span>
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: "#aab3ab", padding: 30, fontSize: 14 }}>Belum ada pengeluaran bulan ini</div>}
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={sectionTitle}>Trend Pengeluaran</span>
            <div style={{ display: "flex", gap: 4, background: "#F0F2EF", borderRadius: 9, padding: 3 }}>
              {[[7, "7 hari"], [14, "14 hari"], [30, "1 bulan"]].map(([d, l]) => (
                <button key={d} onClick={() => setTrendDays(d)} style={{ border: "none", borderRadius: 7, padding: "5px 10px", fontSize: 12, fontWeight: trendDays === d ? 700 : 500, background: trendDays === d ? "white" : "transparent", color: trendDays === d ? "#1F4D38" : "#9AA39B", cursor: "pointer", boxShadow: trendDays === d ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>{l}</button>
              ))}
            </div>
          </div>
          {trendData.length > 0 ? (
            <>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F2EF" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#aab3ab" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#aab3ab" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000) + "rb" : v} />
                    <Tooltip formatter={v => fmt(v)} labelFormatter={l => `Tgl ${l}`} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 12 }} />
                    <Line type="monotone" dataKey="value" stroke="#3A9B6E" strokeWidth={2.5} dot={{ r: 3, fill: "#3A9B6E" }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ borderTop: "1px solid #EEF1ED", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#7A857C" }}>Rata-rata/hari</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#3A9B6E" }}>{fmt(avgDaily)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#7A857C" }}>Tertinggi</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#C0392B" }}>{fmt(maxDaily)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#7A857C" }}>Hari aktif</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2a3530" }}>{trendData.length} / {trendDays}</div>
                </div>
              </div>
            </>
          ) : <div style={{ textAlign: "center", color: "#aab3ab", padding: 30, fontSize: 14 }}>Belum ada data</div>}
        </div>
      </div>

      {/* TRANSAKSI TERBARU */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={sectionTitle}>Transaksi Terbaru</span>
          {allTx.length > 4 && (
            <button onClick={() => setShowAllTx(!showAllTx)} style={{ background: "none", border: "none", color: "#3A9B6E", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {showAllTx ? "Tampilkan sedikit" : "Lihat Semua →"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shownTx.map(tx => {
            const info = tx.type === "expense" ? (EXPENSE_CATEGORIES[tx.category] || { icon: "📦" }) : (INCOME_CATEGORIES[tx.category] || { icon: "💰" });
            const isInc = tx.type === "income";
            return (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F4F6F3" }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: isInc ? "#E8F5EE" : "#FCEEEA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{info.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#2a3530", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</div>
                  <div style={{ fontSize: 12, color: "#9AA39B" }}>{tx.category}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isInc ? "#2D7D4A" : "#C0392B" }}>{isInc ? "+" : "-"}{fmt(tx.amount)}</div>
                  <div style={{ fontSize: 11, color: "#aab3ab" }}>{dateLabel(tx.date)}</div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditTx({ ...tx })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc" }}>✏️</button>
                  <button onClick={() => handleDelete(tx.id, tx.type)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc" }}>🗑️</button>
                </div>
              </div>
            );
          })}
          {shownTx.length === 0 && <div style={{ textAlign: "center", color: "#aab3ab", padding: 20, fontSize: 14 }}>Belum ada transaksi</div>}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editTx && (
        <div onClick={() => setEditTx(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 22, width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2b22", marginBottom: 16 }}>Edit Transaksi</div>

            <label style={{ fontSize: 12, color: "#7A857C", fontWeight: 600 }}>Deskripsi</label>
            <input value={editTx.description} onChange={e => setEditTx({ ...editTx, description: e.target.value })}
              style={{ width: "100%", border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginTop: 4, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />

            <label style={{ fontSize: 12, color: "#7A857C", fontWeight: 600 }}>Nominal</label>
            <input value={editTx.amount} onChange={e => setEditTx({ ...editTx, amount: parseInt(e.target.value.replace(/\D/g, "")) || 0 })}
              style={{ width: "100%", border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginTop: 4, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />

            <label style={{ fontSize: 12, color: "#7A857C", fontWeight: 600 }}>Tanggal</label>
            <input type="date" value={editTx.date} max={todayStr()} onChange={e => setEditTx({ ...editTx, date: e.target.value })}
              style={{ width: "100%", border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginTop: 4, marginBottom: 12, outline: "none", boxSizing: "border-box" }} />

            <label style={{ fontSize: 12, color: "#7A857C", fontWeight: 600 }}>Kategori</label>
            <select value={editTx.category} onChange={e => setEditTx({ ...editTx, category: e.target.value })}
              style={{ width: "100%", border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, marginTop: 4, marginBottom: 18, outline: "none", boxSizing: "border-box", background: "white" }}>
              {Object.keys(editTx.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditTx(null)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #E2E6E0", background: "white", color: "#6a756e", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Batal</button>
              <button onClick={() => handleSaveEdit({ id: editTx.id, date: editTx.date, amount: editTx.amount, description: editTx.description, category: editTx.category }, editTx.type)}
                style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: "#1F4D38", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT MODAL */}
      {showInput && (
        <div onClick={() => setShowInput(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "22px 22px 0 0", padding: 22, width: "100%", maxWidth: 480, boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 40, height: 4, background: "#E2E6E0", borderRadius: 4, margin: "0 auto 18px" }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2b22", marginBottom: 16 }}>Catat Transaksi</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[["expense", "📤 Pengeluaran"], ["income", "📥 Pemasukan"]].map(([v, l]) => (
                <button key={v} onClick={() => setInputType(v)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "none", background: inputType === v ? (v === "expense" ? "#C0392B" : "#2D5A3D") : "#F0F2EF", color: inputType === v ? "white" : "#6a756e", fontWeight: inputType === v ? 700 : 500, fontSize: 14, cursor: "pointer" }}>{l}</button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#6a756e" }}>📅</span>
              <input type="date" value={inputDate} max={todayStr()} onChange={e => setInputDate(e.target.value)} style={{ flex: 1, border: "1.5px solid #E2E6E0", borderRadius: 9, padding: "9px 12px", fontSize: 14, background: "#FAFBFA", outline: "none" }} />
              {inputDate !== todayStr() && <button onClick={() => setInputDate(todayStr())} style={{ background: "#F0F2EF", border: "none", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "#6a756e", cursor: "pointer" }}>Hari ini</button>}
            </div>

            <div style={{ fontSize: 12, color: "#aab3ab", marginBottom: 8 }}>
              {inputType === "expense" ? 'Contoh: "beli buku 85000", "makan 20rb"' : 'Contoh: "honor 750000", "uang KPK 260rb"'}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
                placeholder={inputType === "expense" ? "deskripsi nominal..." : "deskripsi nominal..."}
                style={{ flex: 1, border: "1.5px solid #E2E6E0", borderRadius: 11, padding: "12px 14px", fontSize: 15, outline: "none", background: "#FAFBFA" }} />
              <button onClick={handleAdd} disabled={loading || !inputText.trim()} style={{ background: loading ? "#ccc" : inputType === "expense" ? "#C0392B" : "#2D5A3D", color: "white", border: "none", borderRadius: 11, padding: "12px 18px", fontSize: 18, cursor: loading ? "wait" : "pointer" }}>{loading ? "⏳" : "➕"}</button>
            </div>
            {feedback && <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 9, fontSize: 13, background: feedback.ok ? "#E8F5EE" : "#FCEEEA", color: feedback.ok ? "#2D7D4A" : "#C0392B" }}>{feedback.msg}</div>}
          </div>
        </div>
      )}

      <button onClick={() => { setShowInput(true); setFeedback(null); }} style={{ position: "fixed", bottom: 88, right: "max(20px, calc((100vw - 1040px)/2 + 20px))", width: 60, height: 60, borderRadius: 30, background: "#1F4D38", border: "none", color: "white", fontSize: 26, cursor: "pointer", boxShadow: "0 6px 20px rgba(31,77,56,0.4)", zIndex: 40 }}>➕</button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ASSET PAGE
// ════════════════════════════════════════════════════════════
function AssetPage({ assets }) {
  const [editAsset, setEditAsset] = useState(null);

  const emas = assets.filter(a => a.type === "emas");
  const saham = assets.filter(a => a.type === "saham");
  const cash = assets.filter(a => a.type === "cash");
  const hutang = assets.filter(a => a.type === "hutang");

  const nilai = (a) => a.qty * a.now;
  const nilaiBeli = (a) => a.qty * a.beli;

  const emasNow = emas.reduce((s, a) => s + nilai(a), 0);
  const emasBeli = emas.reduce((s, a) => s + nilaiBeli(a), 0);
  const sahamNow = saham.reduce((s, a) => s + nilai(a), 0);
  const sahamBeli = saham.reduce((s, a) => s + nilaiBeli(a), 0);
  const cashTotal = cash.reduce((s, a) => s + nilai(a), 0);
  const hutangTotal = hutang.reduce((s, a) => s + a.now, 0);
  const totalAset = emasNow + sahamNow + cashTotal;
  const netWorth = totalAset - hutangTotal;

  const emasRet = emasBeli ? ((emasNow - emasBeli) / emasBeli) * 100 : 0;
  const sahamRet = sahamBeli ? ((sahamNow - sahamBeli) / sahamBeli) * 100 : 0;

  const donutData = [
    ...emas.map(a => ({ name: a.nama, value: nilai(a) })),
    ...cash.map(a => ({ name: a.nama, value: nilai(a) })),
    ...saham.map(a => ({ name: a.nama, value: nilai(a) })),
  ].sort((a, b) => b.value - a.value);

  async function handleSaveAsset(asset) {
    await set(ref(db, `assets/${asset.id}`), asset);
    setEditAsset(null);
  }

  async function handleDeleteAsset(id) {
    await remove(ref(db, `assets/${id}`));
    setEditAsset(null);
  }

  function startAdd(type) {
    const isQtyAsset = type === "emas" || type === "saham";
    setEditAsset({
      id: Date.now(), type, nama: "",
      qty: isQtyAsset ? 0 : 1, unit: type === "emas" ? "gr" : type === "saham" ? "lbr" : "",
      beli: 0, now: 0, ket: "", isNew: true,
    });
  }

  function AssetRow({ a, showRet }) {
    const n = nilai(a);
    const ret = nilaiBeli(a) ? ((n - nilaiBeli(a)) / nilaiBeli(a)) * 100 : 0;
    const info = ASSET_TYPES[a.type];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F4F6F3" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: info.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>{info.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2a3530" }}>{a.nama}</div>
          <div style={{ fontSize: 11, color: "#9AA39B" }}>
            {a.type === "cash" || a.type === "hutang" ? (a.ket || "—") : `${a.qty} ${a.unit} · avg ${fmt(a.beli)} → ${fmt(a.now)}`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#2a3530" }}>{fmt(n)}</div>
          {showRet && <div style={{ fontSize: 12, fontWeight: 600, color: ret >= 0 ? "#2D7D4A" : "#C0392B" }}>{ret >= 0 ? "+" : ""}{ret.toFixed(2)}%</div>}
        </div>
        <button onClick={() => setEditAsset({ ...a })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc", flexShrink: 0 }}>✏️</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>💎</span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1a2b22" }}>Aset</div>
            <div style={{ fontSize: 13, color: "#7A857C" }}>Lacak dan kelola seluruh asetmu</div>
          </div>
        </div>
        <div style={{ ...card, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#3a4540" }}>📅 {dateLabel(todayStr())}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={{ background: "linear-gradient(150deg,#1A3D2C 0%,#27543C 100%)", borderRadius: 22, padding: 24, color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Net Worth</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Total Kekayaan Bersih</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: "4px 0 12px" }}>{fmt(netWorth)}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Total Aset {fmt(totalAset)} − Hutang {fmt(hutangTotal)}</div>
        </div>

        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 16 }}>Alokasi Aset</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Donut data={donutData} />
            <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 7 }}>
              {donutData.map((d, i) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, color: "#5a655e" }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: "#2a3530" }}>{((d.value / totalAset) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { ic: "💛", label: "Nilai Emas", value: fmt(emasNow), sub: `${emasRet >= 0 ? "+" : ""}${emasRet.toFixed(1)}%`, color: emasRet >= 0 ? "#2D7D4A" : "#C0392B", foot: emasRet >= 0 ? "↑ Performa baik" : "↓ Performa turun", footBg: emasRet >= 0 ? "#E8F5EE" : "#FCEEEA" },
          { ic: "📈", label: "Nilai Saham", value: fmt(sahamNow), sub: `${sahamRet >= 0 ? "+" : ""}${sahamRet.toFixed(1)}%`, color: sahamRet >= 0 ? "#2D7D4A" : "#C0392B", foot: sahamRet >= 0 ? "↑ Performa baik" : "↓ Performa turun", footBg: sahamRet >= 0 ? "#E8F5EE" : "#FCEEEA" },
          { ic: "🏦", label: "Cash & Deposito", value: fmt(cashTotal), sub: "Likuid", color: "#5B8DB8", foot: "💧 Likuiditas tinggi", footBg: "#EAF2F8" },
          { ic: "💳", label: "Total Hutang", value: fmt(hutangTotal), sub: "Kredivo", color: "#C0392B", foot: "⚠️ Perhatikan", footBg: "#FDF6E8" },
        ].map(c => (
          <div key={c.label} style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{c.ic}</span>
                <span style={{ fontSize: 12, color: "#9AA39B" }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1a2b22" }}>{c.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginTop: 2 }}>{c.sub}</div>
            </div>
            <div style={{ background: c.footBg, padding: "8px 16px", fontSize: 12, fontWeight: 600, color: c.color }}>{c.foot}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Rincian Aset</div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#E8A838" }}>💛 EMAS</span>
          <button onClick={() => startAdd("emas")} style={addBtnStyle}>+ Tambah</button>
        </div>
        {emas.map(a => <AssetRow key={a.id} a={a} showRet />)}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#4A9B7F" }}>🏦 CASH & DEPOSITO</span>
          <button onClick={() => startAdd("cash")} style={addBtnStyle}>+ Tambah</button>
        </div>
        {cash.map(a => <AssetRow key={a.id} a={a} showRet={false} />)}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5B8DB8" }}>📈 SAHAM</span>
          <button onClick={() => startAdd("saham")} style={addBtnStyle}>+ Tambah</button>
        </div>
        {saham.map(a => <AssetRow key={a.id} a={a} showRet />)}
        {saham.length > 0 && <div style={{ fontSize: 11, color: "#aab3ab", marginTop: 8, fontStyle: "italic" }}>
          💡 Update harga & lembar saham dari Google Finance dengan tap ✏️
        </div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#C0392B" }}>💳 HUTANG</span>
          <button onClick={() => startAdd("hutang")} style={addBtnStyle}>+ Tambah</button>
        </div>
        {hutang.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F4F6F3" }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: "#C0392B18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, flexShrink: 0 }}>💳</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#2a3530" }}>{a.nama}</div>
              <div style={{ fontSize: 11, color: "#9AA39B" }}>{a.ket || "—"}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#C0392B", flexShrink: 0 }}>{fmt(a.now)}</div>
            <button onClick={() => setEditAsset({ ...a })} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc", flexShrink: 0 }}>✏️</button>
          </div>
        ))}
      </div>

      {editAsset && (
        <AssetEditModal asset={editAsset} onChange={setEditAsset} onSave={handleSaveAsset} onDelete={handleDeleteAsset} onClose={() => setEditAsset(null)} />
      )}

      <div style={{ ...card, background: "#FDFBF4", border: "1px solid #F0E8D0" }}>
        <div style={{ fontSize: 13, color: "#8a7a4a", lineHeight: 1.6 }}>
          💡 <strong>Tips:</strong> Saham di-track real-time lebih akurat di Google Finance. Di sini cukup update angka totalnya sesekali (tap ✏️) untuk melihat Net Worth keseluruhan bersama emas, deposito, dan cash.
        </div>
      </div>
    </div>
  );
}