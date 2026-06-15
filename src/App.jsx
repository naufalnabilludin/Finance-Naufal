import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { db, ref, onValue, push, set, remove } from "./firebase";

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
const fmtShort = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1000000) return "Rp" + (n / 1000000).toFixed(1).replace(".0", "") + "jt";
  if (abs >= 1000) return "Rp" + Math.round(n / 1000) + "rb";
  return "Rp" + n;
};
const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayStr().slice(0, 7);
const dateLabel = (d) => d === todayStr() ? "Hari Ini"
  : new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const monthLabel = () => new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

// ════════════════════════════════════════════════════════════
//  SEED DATA (data awal Naufal)
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
//  AI PARSER (with fallback manual parsing)
// ════════════════════════════════════════════════════════════
async function parseWithAI(text, type) {
  const cats = type === "expense"
    ? Object.keys(EXPENSE_CATEGORIES).join(", ")
    : Object.keys(INCOME_CATEGORIES).join(", ");
  const examples = type === "expense"
    ? `"beli nasi goreng 15rb" → {"amount":15000,"description":"Nasi goreng","category":"Makan & Minum"}
"langganan Claude 385rb" → {"amount":385000,"description":"Langganan Claude","category":"Langganan Claude 🤖"}
"bayar internet 100rb" → {"amount":100000,"description":"Internet","category":"Internet"}`
    : `"honor pelatihan 750rb" → {"amount":750000,"description":"Honor pelatihan","category":"Honorarium"}
"uang KPK 260rb" → {"amount":260000,"description":"Uang kegiatan KPK","category":"Komunitas"}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1000,
        messages: [{ role: "user", content:
          `Parser keuangan. Tipe: ${type}. User: "${text}"
Balas HANYA JSON: {"amount":<angka>,"description":"<desk>","category":"<dari: ${cats}>"}
Contoh:\n${examples}\nJika gagal: {"amount":0,"description":"","category":"Lain-lain"}` }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.find(b => b.type === "text")?.text || "{}";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    // Fallback: manual parse (format: "kategori nominal")
    const parts = text.trim().split(/\s+/);
    const amount = parseInt(parts[parts.length - 1]);
    if (!amount || isNaN(amount)) return { amount: 0, description: text, category: "Lain-lain" };
    return { amount, description: parts.slice(0, -1).join(" ") || text, category: "Lain-lain" };
  }
}

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("spending");
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [assets, setAssets] = useState([]);

  useEffect(() => { bootstrap(); }, []);

  async function bootstrap() {
    try {
      // Setup Firebase listeners
      const expRef = ref(db, 'expenses');
      const incRef = ref(db, 'incomes');
      const astRef = ref(db, 'assets');

      // Check if Firebase has data, if not seed it
      onValue(expRef, async (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.entries(data).map(([, v]) => v).sort((a, b) => b.id - a.id);
          setExpenses(list);
        } else {
          // Seed expenses
          for (const e of SEED_EXPENSES) {
            await set(ref(db, `expenses/${e.id}`), e);
          }
          setExpenses(SEED_EXPENSES);
        }
        setReady(true);
      });

      onValue(incRef, async (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.entries(data).map(([, v]) => v).sort((a, b) => b.id - a.id);
          setIncomes(list);
        } else {
          // Seed incomes
          for (const i of SEED_INCOMES) {
            await set(ref(db, `incomes/${i.id}`), i);
          }
          setIncomes(SEED_INCOMES);
        }
      });

      onValue(astRef, async (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list = Object.entries(data).map(([, v]) => v).sort((a, b) => a.id - b.id);
          setAssets(list);
        } else {
          // Seed assets
          for (const a of SEED_ASSETS) {
            await set(ref(db, `assets/${a.id}`), a);
          }
          setAssets(SEED_ASSETS);
        }
      });
    } catch (e) {
      console.error("Bootstrap error:", e);
      setReady(true);
    }
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: "#EEF2ED", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',system-ui,sans-serif", color: "#88928A" }}>
      ⏳ Memuat data...
    </div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#EEF2ED", fontFamily: "'Inter',system-ui,sans-serif", paddingBottom: 72 }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 16px 0" }}>
        {page === "spending"
          ? <SpendingPage expenses={expenses} incomes={incomes} setExpenses={setExpenses} setIncomes={setIncomes} />
          : <AssetPage assets={assets} setAssets={setAssets} />}
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

function Donut({ data, total }) {
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
//  SPENDING PAGE
// ════════════════════════════════════════════════════════════
function SpendingPage({ expenses, incomes, setExpenses, setIncomes }) {
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const [inputDate, setInputDate] = useState(todayStr());
  const [inputType, setInputType] = useState("expense");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showAllTx, setShowAllTx] = useState(false);

  const m = thisMonth();
  const monthExp = expenses.filter(e => e.date.startsWith(m));
  const monthInc = incomes.filter(e => e.date.startsWith(m));
  const totalExp = monthExp.reduce((s, e) => s + e.amount, 0);
  const totalInc = monthInc.reduce((s, e) => s + e.amount, 0);
  const sisaReal = BUDGET_AWAL + totalInc - totalExp;
  const budgetLeft = BUDGET_AWAL - totalExp;
  const pctBudget = Math.min((totalExp / BUDGET_AWAL) * 100, 100);

  const byCat = {};
  monthExp.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });

  const distData = Object.entries(byCat).map(([cat, val]) => ({ name: cat, value: val })).sort((a, b) => b.value - a.value);

  const dailyMap = {};
  monthExp.forEach(e => { dailyMap[e.date] = (dailyMap[e.date] || 0) + e.amount; });
  const trendData = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ day: new Date(d).getDate(), value: v }));
  const avgDaily = trendData.length ? totalExp / trendData.length : 0;
  const maxDaily = trendData.length ? Math.max(...trendData.map(t => t.value)) : 0;

  const allTx = [
    ...monthExp.map(e => ({ ...e, type: "expense" })),
    ...monthInc.map(e => ({ ...e, type: "income" })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const shownTx = showAllTx ? allTx : allTx.slice(0, 4);

  async function handleAdd() {
    if (!inputText.trim()) return;
    setLoading(true); setFeedback(null);
    try {
      const p = await parseWithAI(inputText, inputType);
      if (!p.amount || p.amount <= 0) { setFeedback({ ok: false, msg: "Nominal gak kebaca. Coba: 'makan 20rb'" }); setLoading(false); return; }
      const entry = { id: Date.now(), date: inputDate, amount: p.amount, description: p.description, category: p.category };
      
      // Save to Firebase
      const storeType = inputType === "expense" ? "expenses" : "incomes";
      await set(ref(db, `${storeType}/${entry.id}`), entry);
      
      // Update local state
      if (inputType === "expense") setExpenses(prev => [entry, ...prev]);
      else setIncomes(prev => [entry, ...prev]);
      
      setInputText("");
      setFeedback({ ok: true, msg: `✅ ${p.description} — ${fmt(p.amount)}` });
    } catch { setFeedback({ ok: false, msg: "Gagal. Coba lagi." }); }
    setLoading(false);
  }

  async function handleDelete(id, type) {
    const storeType = type === "expense" ? "expenses" : "incomes";
    await remove(ref(db, `${storeType}/${id}`));
    
    if (type === "expense") setExpenses(prev => prev.filter(e => e.id !== id));
    else setIncomes(prev => prev.filter(e => e.id !== id));
  }

  const envelopeCats = Object.entries(EXPENSE_CATEGORIES).filter(([, info]) => info.budget > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* TITLE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>🧾</span>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#1a2b22" }}>Spending</div>
            <div style={{ fontSize: 13, color: "#7A857C" }}>Kelola pengeluaran harian dengan lebih bijak</div>
          </div>
        </div>
        <div style={{ ...card, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#3a4540" }}>📅 {monthLabel()}</div>
      </div>

      {/* HERO */}
      <div style={{ background: "linear-gradient(150deg,#1F4D38 0%,#2D6347 100%)", borderRadius: 22, padding: 24, color: "white", position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Ringkasan Spending</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>Sisa uang bulan ini</div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1, margin: "2px 0 18px" }}>{fmt(sisaReal)}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 18 }}>
          {[["💳", "Budget Awal", fmt(BUDGET_AWAL), "white"],
            ["⬆️", "Pemasukan", "+" + fmt(totalInc), "#A8F0C6"],
            ["⬇️", "Pengeluaran", "-" + fmt(totalExp), "#FFC4C4"],
            ["🎯", "vs Budget Plan", (budgetLeft >= 0 ? "+" : "") + fmt(budgetLeft), budgetLeft >= 0 ? "#A8F0C6" : "#FFC4C4"]].map(([ic, l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{ic} {l}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: 14, padding: "14px 16px", color: "#1a2b22" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "#7A857C" }}>Realisasi Pengeluaran</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{fmt(totalExp)}</div>
              <div style={{ fontSize: 11, color: "#4A9B7F", fontWeight: 600 }}>{pctBudget.toFixed(1)}% dari budget</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#7A857C" }}>Sisa Budget</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: budgetLeft >= 0 ? "#2D7D4A" : "#C0392B" }}>{fmt(budgetLeft)}</div>
            </div>
          </div>
          <div style={{ height: 8, background: "#E8EDE9", borderRadius: 8, position: "relative" }}>
            <div style={{ height: 8, borderRadius: 8, width: `${pctBudget}%`, background: pctBudget >= 90 ? "#C0392B" : pctBudget >= 70 ? "#E8A838" : "#3A9B6E", transition: "width 0.5s" }} />
          </div>
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

      {/* DISTRIBUSI + TREND (2 kolom di desktop) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        {/* Distribusi donut */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 16 }}>Distribusi Pengeluaran</div>
          {distData.length > 0 ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Donut data={distData} total={totalExp} />
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

        {/* Trend harian */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 16 }}>Trend Pengeluaran Harian</div>
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
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#2a3530" }}>{trendData.length}</div>
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
                <button onClick={() => handleDelete(tx.id, tx.type)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc", flexShrink: 0 }}>🗑️</button>
              </div>
            );
          })}
          {shownTx.length === 0 && <div style={{ textAlign: "center", color: "#aab3ab", padding: 20, fontSize: 14 }}>Belum ada transaksi</div>}
        </div>
      </div>

      {/* FAB - Catat Transaksi */}
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
              {inputType === "expense" ? 'Contoh: "beli buku 85rb", "makan siang 25rb"' : 'Contoh: "honor pelatihan 750rb", "uang KPK 260rb"'}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
                placeholder={inputType === "expense" ? "beli / bayar / transport..." : "honor / project / beasiswa..."}
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
function AssetPage({ assets, setAssets }) {
  const [editing, setEditing] = useState(null);
  const [editNow, setEditNow] = useState("");

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

  async function saveNow(asset) {
    const val = parseInt(String(editNow).replace(/\D/g, ""));
    if (!val) { setEditing(null); return; }
    const updated = { ...asset, now: val };
    await set(ref(db, `assets/${asset.id}`), updated);
    setAssets(prev => prev.map(a => a.id === asset.id ? updated : a));
    setEditing(null); setEditNow("");
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
            {a.type === "cash" || a.type === "hutang" ? a.ket : `${a.qty} ${a.unit} · avg ${fmt(a.beli)}`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {editing === a.id ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input autoFocus value={editNow} onChange={e => setEditNow(e.target.value)} onKeyDown={e => e.key === "Enter" && saveNow(a)}
                placeholder="harga skrg" style={{ width: 90, border: "1px solid #ccc", borderRadius: 7, padding: "4px 7px", fontSize: 13 }} />
              <button onClick={() => saveNow(a)} style={{ background: "#2D5A3D", color: "white", border: "none", borderRadius: 7, padding: "4px 9px", fontSize: 12, cursor: "pointer" }}>✓</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#2a3530" }}>{fmt(n)}</div>
              {showRet && <div style={{ fontSize: 12, fontWeight: 600, color: ret >= 0 ? "#2D7D4A" : "#C0392B" }}>{ret >= 0 ? "+" : ""}{ret.toFixed(2)}%</div>}
            </>
          )}
        </div>
        {(a.type === "emas" || a.type === "saham") && editing !== a.id && (
          <button onClick={() => { setEditing(a.id); setEditNow(String(a.now)); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#ccc", flexShrink: 0 }} title="Update harga sekarang">✏️</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* TITLE */}
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

      {/* HERO + ALOKASI (2 kolom) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Net Worth */}
        <div style={{ background: "linear-gradient(150deg,#1A3D2C 0%,#27543C 100%)", borderRadius: 22, padding: 24, color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Net Worth</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Total Kekayaan Bersih</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: "4px 0 12px" }}>{fmt(netWorth)}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>Total Aset {fmt(totalAset)} − Hutang {fmt(hutangTotal)}</div>
        </div>

        {/* Alokasi */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: 16 }}>Alokasi Aset</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Donut data={donutData} total={totalAset} />
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

      {/* 4 SUMMARY CARDS */}
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

      {/* RINCIAN ASET */}
      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 8 }}>Rincian Aset</div>

        {emas.length > 0 && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E8A838", marginTop: 14, marginBottom: 2 }}>💛 EMAS</div>
          {emas.map(a => <AssetRow key={a.id} a={a} showRet />)}
        </>}

        {cash.length > 0 && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#4A9B7F", marginTop: 16, marginBottom: 2 }}>🏦 CASH & DEPOSITO</div>
          {cash.map(a => <AssetRow key={a.id} a={a} showRet={false} />)}
        </>}

        {saham.length > 0 && <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#5B8DB8", marginTop: 16, marginBottom: 2 }}>📈 SAHAM</div>
          {saham.map(a => <AssetRow key={a.id} a={a} showRet />)}
          <div style={{ fontSize: 11, color: "#aab3ab", marginTop: 8, fontStyle: "italic" }}>
            💡 Update harga saham dari Google Finance dengan tap ✏️
          </div>
        </>}
      </div>

      {/* INFO BOX */}
      <div style={{ ...card, background: "#FDFBF4", border: "1px solid #F0E8D0" }}>
        <div style={{ fontSize: 13, color: "#8a7a4a", lineHeight: 1.6 }}>
          💡 <strong>Tips:</strong> Saham di-track real-time lebih akurat di Google Finance. Di sini cukup update angka totalnya sesekali (tap ✏️) untuk melihat Net Worth keseluruhan bersama emas, deposito, dan cash.
        </div>
      </div>
    </div>
  );
}