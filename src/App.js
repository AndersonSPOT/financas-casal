import { useState, useMemo, useEffect } from "react";
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, setDoc, getDoc
} from "firebase/firestore";
import { db } from "./firebase";

const CATEGORIES = [
  { id: "alimentacao", label: "Alimentação", emoji: "🍽️", color: "#FF6B6B" },
  { id: "transporte",  label: "Transporte",  emoji: "🚗", color: "#4ECDC4" },
  { id: "moradia",     label: "Moradia",     emoji: "🏠", color: "#45B7D1" },
  { id: "saude",       label: "Saúde",       emoji: "💊", color: "#96CEB4" },
  { id: "lazer",       label: "Lazer",       emoji: "🎮", color: "#FFEAA7" },
  { id: "educacao",    label: "Educação",    emoji: "📚", color: "#DDA0DD" },
  { id: "vestuario",   label: "Vestuário",   emoji: "👗", color: "#F0A500" },
  { id: "outros",      label: "Outros",      emoji: "📦", color: "#B0B0B0" },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const USERS = [
  { id: "user1", color: "#7C6AF7", avatar: "🧑" },
  { id: "user2", color: "#F75A8C", avatar: "👩" },
];

const PAYMENT_METHODS = [
  { id: "debito",   label: "Débito",        emoji: "💳", color: "#4ECDC4" },
  { id: "credito",  label: "Crédito",       emoji: "💳", color: "#7C6AF7" },
  { id: "refeicao", label: "Vale Refeição", emoji: "🍱", color: "#F0A500" },
  { id: "alelo",    label: "Alelo Car",     emoji: "🚗", color: "#96CEB4" },
];

const CREDIT_CARDS = [
  { id: "c6",     label: "C6 Bank", emoji: "⬛" },
  { id: "outros", label: "Outros",  emoji: "💳" },
];

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function getToday() {
  return new Date().toISOString().split("T")[0];
}
function getPaymentLabel(e) {
  if (!e.payment) return "";
  const pm = PAYMENT_METHODS.find(p => p.id === e.payment);
  if (!pm) return "";
  if (e.payment === "credito" && e.creditCard) {
    const cc = CREDIT_CARDS.find(c => c.id === e.creditCard);
    return pm.emoji + " " + pm.label + " " + (cc ? "(" + cc.label + ")" : "");
  }
  return pm.emoji + " " + pm.label;
}

export default function App() {
  const [currentUser, setCurrentUser]   = useState(null);
  const [userNames, setUserNames]       = useState({ user1: "Pessoa 1", user2: "Pessoa 2" });
  const [expenses, setExpenses]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [connected, setConnected]       = useState(true);

  const [form, setForm] = useState({ desc: "", amount: "", category: "alimentacao", date: getToday(), type: "expense", payment: "debito", creditCard: "c6" });
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [filterMonth, setFilterMonth]   = useState(new Date().getMonth());
  const [filterYear]                    = useState(new Date().getFullYear());
  const [filterUser, setFilterUser]     = useState("all");
  const [showForm, setShowForm]         = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editNames, setEditNames]       = useState({ user1: "", user2: "" });
  const [setupName, setSetupName]       = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "config", "names"));
        if (snap.exists()) setUserNames(snap.data());
      } catch (e) {
        setConnected(false);
        console.error(e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const q = query(collection(db, "expenses"), orderBy("date", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setConnected(true);
      },
      (err) => {
        console.error(err);
        setConnected(false);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [currentUser]);

  async function handleSelectUser(uid) {
    if (setupName.trim()) {
      const newNames = { ...userNames, [uid]: setupName.trim() };
      await setDoc(doc(db, "config", "names"), newNames);
      setUserNames(newNames);
      setSetupName("");
    }
    setCurrentUser(uid);
  }

  async function handleAdd() {
    if (!form.desc || !form.amount) return;
    try {
      const data = {
        ...form,
        amount: parseFloat(form.amount),
        userId: currentUser,
        createdAt: new Date().toISOString(),
      };
      if (form.type !== "expense") {
        delete data.payment;
        delete data.creditCard;
      }
      if (form.payment !== "credito") {
        delete data.creditCard;
      }
      await addDoc(collection(db, "expenses"), data);
      setForm({ desc: "", amount: "", category: "alimentacao", date: getToday(), type: "expense", payment: "debito", creditCard: "c6" });
      setShowForm(false);
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id) {
    try { await deleteDoc(doc(db, "expenses", id)); }
    catch (e) { console.error(e); }
  }

  async function handleSaveNames() {
    await setDoc(doc(db, "config", "names"), editNames);
    setUserNames(editNames);
    setShowSettings(false);
  }

  const filtered = useMemo(() =>
    expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === filterMonth
        && d.getFullYear() === filterYear
        && (filterUser === "all" || e.userId === filterUser);
    }), [expenses, filterMonth, filterYear, filterUser]);

  const totalIncome  = filtered.filter(e => e.type === "income").reduce((s,e) => s + e.amount, 0);
  const totalExpense = filtered.filter(e => e.type === "expense").reduce((s,e) => s + e.amount, 0);
  const balance      = totalIncome - totalExpense;

  const byCategory = useMemo(() => {
    const map = {};
    filtered.filter(e => e.type === "expense").forEach(e => {
      map[e.category] = (map[e.category] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const byPayment = useMemo(() => {
    const map = {};
    filtered.filter(e => e.type === "expense" && e.payment).forEach(e => {
      const key = e.payment === "credito" && e.creditCard ? `credito_${e.creditCard}` : e.payment;
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const splitSummary = useMemo(() => {
    const r = { user1: { income: 0, expense: 0 }, user2: { income: 0, expense: 0 } };
    expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    }).forEach(e => {
      const uid = e.userId || "user1";
      if (!r[uid]) r[uid] = { income: 0, expense: 0 };
      if (e.type === "income") r[uid].income += e.amount;
      else r[uid].expense += e.amount;
    });
    return r;
  }, [expenses, filterMonth, filterYear]);

  const getCat  = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[7];
  const getUser = id => USERS.find(u => u.id === id);
  const maxCat  = byCategory.length ? byCategory[0][1] : 1;
  const maxPay  = byPayment.length ? byPayment[0][1] : 1;
  const me      = currentUser ? USERS.find(u => u.id === currentUser) : null;
  const myName  = currentUser ? userNames[currentUser] : "";

  function getPaymentInfo(key) {
    if (key.startsWith("credito_")) {
      const ccId = key.replace("credito_", "");
      const cc = CREDIT_CARDS.find(c => c.id === ccId);
      return { emoji: "💳", label: `Crédito ${cc ? cc.label : ""}`, color: "#7C6AF7" };
    }
    const pm = PAYMENT_METHODS.find(p => p.id === key);
    return pm || { emoji: "💳", label: key, color: "#888" };
  }

  if (!currentUser) {
    return (
      <div style={styles.loginWrap}>
        <style>{BASE_CSS}</style>
        {!connected && <div style={styles.errorBanner}>⚠️ Erro ao conectar no Firebase.</div>}
        <div style={{ fontSize: 52, marginBottom: 16 }}>💑</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Finanças do Casal</h1>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 32 }}>Controle compartilhado em tempo real</p>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <p style={styles.label}>QUEM ESTÁ ACESSANDO?</p>
          <input value={setupName} onChange={e => setSetupName(e.target.value)}
            placeholder="Seu nome (opcional)"
            style={{ ...styles.input, marginBottom: 12 }} />
          {USERS.map((u, i) => (
            <button key={u.id} onClick={() => handleSelectUser(u.id)} style={styles.userCard(u.color)}
              onMouseOver={e => e.currentTarget.style.background = "#1e1e2a"}
              onMouseOut={e  => e.currentTarget.style.background = "#17171F"}>
              <div style={styles.avatar(u.color)}>{u.avatar}</div>
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#F0EDE8", fontWeight: 600, fontSize: 15 }}>{userNames[u.id]}</p>
                <p style={{ color: "#555", fontSize: 12 }}>Perfil {i + 1}</p>
              </div>
              <div style={{ marginLeft: "auto", color: u.color, fontSize: 18 }}>→</div>
            </button>
          ))}
          <p style={{ textAlign: "center", color: "#444", fontSize: 11, marginTop: 16 }}>
            ⚡ Dados sincronizados em tempo real via Firebase
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#0C0C14", color: "#F0EDE8" }}>
      <style>{BASE_CSS}</style>
      {!connected && <div style={styles.errorBanner}>⚠️ Sem conexão com Firebase</div>}

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 20px 0" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#4ECDC4" : "#FF6B6B", animation: connected ? "pulse 2s infinite" : "none" }} />
              <p style={{ fontSize: 11, color: "#555" }}>{connected ? "Conectado" : "Offline"}</p>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Olá, {myName} {me?.avatar}</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditNames({ ...userNames }); setShowSettings(true); }} style={styles.iconBtn}>⚙️</button>
            <button onClick={() => setCurrentUser(null)} style={{ ...styles.iconBtn, fontSize: 12 }}>Trocar</button>
          </div>
        </div>

        {/* Month selector */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          {MONTHS.map((m, i) => (
            <button key={i} className="pill-btn" onClick={() => setFilterMonth(i)}
              style={{ padding: "6px 14px", whiteSpace: "nowrap", background: filterMonth === i ? me?.color : "#1e1e28", color: filterMonth === i ? "#fff" : "#888" }}>
              {m}
            </button>
          ))}
        </div>

        {/* User filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["all","👥 Todos"], ["user1",`🧑 ${userNames.user1}`], ["user2",`👩 ${userNames.user2}`]].map(([id, label]) => (
            <button key={id} className="pill-btn" onClick={() => setFilterUser(id)}
              style={{ padding: "6px 14px", background: filterUser === id ? "#252530" : "none", color: filterUser === id ? "#F0EDE8" : "#555", border: filterUser === id ? "1px solid #333" : "1px solid transparent" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Balance cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Entradas", val: totalIncome,  color: "#4ECDC4", icon: "↑" },
            { label: "Saídas",   val: totalExpense,  color: "#FF6B6B", icon: "↓" },
            { label: "Saldo",    val: balance, color: balance >= 0 ? me?.color : "#FF6B6B", icon: "=" },
          ].map(({ label, val, color, icon }) => (
            <div key={label} className="card" style={{ padding: "12px 10px" }}>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}><span style={{ color }}>{icon}</span> {label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color }}>{formatBRL(val)}</div>
            </div>
          ))}
        </div>

        {/* Split summary */}
        <div className="card" style={{ padding: "14px 16px", marginBottom: 16, display: "flex", gap: 12 }}>
          {USERS.map((u, i) => {
            const s = splitSummary[u.id] || { income: 0, expense: 0 };
            return (
              <div key={u.id} style={{ flex: 1, borderRight: i === 0 ? "1px solid #252530" : "none", paddingRight: i === 0 ? 12 : 0 }}>
                <p style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{u.avatar} {userNames[u.id]}</p>
                <p style={{ fontSize: 12, color: "#4ECDC4", fontFamily: "'DM Mono', monospace" }}>+{formatBRL(s.income)}</p>
                <p style={{ fontSize: 12, color: "#FF6B6B", fontFamily: "'DM Mono', monospace" }}>-{formatBRL(s.expense)}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, background: "#1a1a22", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {[["dashboard","📊 Categorias"], ["pagamentos","💳 Pagamentos"], ["list","📋 Lançamentos"]].map(([id, label]) => (
            <button key={id} className="tab-btn" onClick={() => setActiveTab(id)}
              style={{ flex: 1, padding: "9px 4px", borderRadius: 9, fontSize: 12, fontWeight: 500,
                background: activeTab === id ? me?.color : "none",
                color: activeTab === id ? "#fff" : "#666" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard - Categorias */}
        {activeTab === "dashboard" && (
          <div style={{ paddingBottom: 80 }}>
            {loading
              ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555" }}>Carregando...</div>
              : byCategory.length === 0
                ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 14 }}>Nenhum gasto em {MONTHS[filterMonth]}</div>
                : byCategory.map(([catId, amount]) => {
                    const cat = getCat(catId);
                    return (
                      <div key={catId} className="card" style={{ padding: "14px 16px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{cat.label}</span>
                          </div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: cat.color }}>{formatBRL(amount)}</span>
                        </div>
                        <div style={{ height: 4, background: "#252530", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${(amount / maxCat) * 100}%`, background: cat.color, borderRadius: 2, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        )}

        {/* Pagamentos */}
        {activeTab === "pagamentos" && (
          <div style={{ paddingBottom: 80 }}>
            {loading
              ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555" }}>Carregando...</div>
              : byPayment.length === 0
                ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 14 }}>Nenhum gasto em {MONTHS[filterMonth]}</div>
                : byPayment.map(([key, amount]) => {
                    const info = getPaymentInfo(key);
                    return (
                      <div key={key} className="card" style={{ padding: "14px 16px", marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{info.emoji}</span>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{info.label}</span>
                          </div>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, color: info.color }}>{formatBRL(amount)}</span>
                        </div>
                        <div style={{ height: 4, background: "#252530", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${(amount / maxPay) * 100}%`, background: info.color, borderRadius: 2, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        )}

        {/* List */}
        {activeTab === "list" && (
          <div style={{ paddingBottom: 80 }}>
            {loading
              ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555" }}>Carregando...</div>
              : filtered.length === 0
                ? <div className="card" style={{ padding: 24, textAlign: "center", color: "#555", fontSize: 14 }}>Nenhum lançamento neste período</div>
                : [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => {
                    const cat  = getCat(e.category);
                    const user = getUser(e.userId);
                    const d    = new Date(e.date + "T00:00:00");
                    const pm   = e.payment ? PAYMENT_METHODS.find(p => p.id === e.payment) : null;
                    return (
                      <div key={e.id} className="row-item card" style={{ padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cat.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          {e.type === "income" ? "💵" : cat.emoji}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.desc}</p>
                          <p style={{ fontSize: 11, color: "#555" }}>
                            {d.getDate().toString().padStart(2,"0")}/{(d.getMonth()+1).toString().padStart(2,"0")} ·{" "}
                            <span style={{ color: user?.color }}>{user?.avatar} {userNames[e.userId]}</span>
                            {" · "}{e.type === "income" ? "Entrada" : cat.label}
                            {pm && <span style={{ color: pm.color }}> · {getPaymentLabel(e)}</span>}
                          </p>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: e.type === "income" ? "#4ECDC4" : "#FF6B6B" }}>
                            {e.type === "income" ? "+" : "-"}{formatBRL(e.amount)}
                          </p>
                          {e.userId === currentUser && (
                            <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 11, marginTop: 2 }}>remover</button>
                          )}
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="add-btn" onClick={() => setShowForm(true)}
        style={{ background: me?.color, boxShadow: `0 4px 20px ${me?.color}55` }}>＋</button>

      {/* Add Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Novo lançamento <span style={{ color: me?.color }}>({myName})</span></h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>

            {/* Tipo */}
            <div className="type-toggle" style={{ marginBottom: 14 }}>
              {[["expense","💸 Gasto"], ["income","💵 Entrada"]].map(([t, label]) => (
                <div key={t} className="type-option" onClick={() => setForm(f => ({ ...f, type: t }))}
                  style={{ background: form.type === t ? (t === "expense" ? "#FF6B6B22" : "#4ECDC422") : "none",
                    color: form.type === t ? (t === "expense" ? "#FF6B6B" : "#4ECDC4") : "#666",
                    border: form.type === t ? `1px solid ${t === "expense" ? "#FF6B6B44" : "#4ECDC444"}` : "1px solid transparent" }}>
                  {label}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="form-input" placeholder="Descrição" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} />
              <input className="form-input" placeholder="Valor (R$)" type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />

              {/* Forma de pagamento — só para gastos */}
              {form.type === "expense" && (
                <>
                  <p style={{ fontSize: 12, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>Forma de pagamento</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {PAYMENT_METHODS.map(pm => (
                      <div key={pm.id} onClick={() => setForm(f => ({ ...f, payment: pm.id }))}
                        style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer", border: `1px solid ${form.payment === pm.id ? pm.color : "#252530"}`,
                          background: form.payment === pm.id ? `${pm.color}18` : "#0C0C14",
                          color: form.payment === pm.id ? pm.color : "#666", fontSize: 13, fontWeight: 500,
                          display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                        <span>{pm.emoji}</span> {pm.label}
                      </div>
                    ))}
                  </div>

                  {/* Bandeira do cartão — só para crédito */}
                  {form.payment === "credito" && (
                    <>
                      <p style={{ fontSize: 12, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" }}>Cartão de crédito</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {CREDIT_CARDS.map(cc => (
                          <div key={cc.id} onClick={() => setForm(f => ({ ...f, creditCard: cc.id }))}
                            style={{ padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${form.creditCard === cc.id ? "#7C6AF7" : "#252530"}`,
                              background: form.creditCard === cc.id ? "#7C6AF718" : "#0C0C14",
                              color: form.creditCard === cc.id ? "#7C6AF7" : "#666", fontSize: 13, fontWeight: 500,
                              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                            <span>{cc.emoji}</span> {cc.label}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              <button onClick={handleAdd}
                style={{ background: me?.color, color: "#fff", border: "none", borderRadius: 12, padding: 13, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="modal-sheet">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>⚙️ Configurações</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: "#555", marginBottom: 12 }}>NOMES DOS PERFIS</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {USERS.map((u, i) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{u.avatar}</span>
                  <input className="form-input" value={editNames[u.id]} onChange={e => setEditNames(n => ({ ...n, [u.id]: e.target.value }))}
                    placeholder={`Nome do perfil ${i + 1}`} style={{ flex: 1 }} />
                </div>
              ))}
              <button onClick={handleSaveNames}
                style={{ background: me?.color, color: "#fff", border: "none", borderRadius: 12, padding: 13, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1a22; } ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  input, select { outline: none; }
  .card { background: #17171F; border: 1px solid #252530; border-radius: 16px; }
  .pill-btn { border: none; cursor: pointer; font-family: inherit; border-radius: 50px; transition: all 0.2s; font-size: 13px; font-weight: 500; }
  .row-item:hover { background: #1e1e28 !important; }
  .add-btn { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; font-size: 26px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; z-index: 100; }
  .add-btn:hover { transform: scale(1.08); }
  .form-input { width: 100%; background: #0C0C14; border: 1px solid #252530; border-radius: 10px; color: #F0EDE8; padding: 10px 14px; font-family: inherit; font-size: 14px; transition: border-color 0.2s; }
  .form-input:focus { border-color: #7C6AF7; }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: flex-end; justify-content: center; z-index: 200; backdrop-filter: blur(4px); }
  .modal-sheet { background: #17171F; border: 1px solid #252530; border-radius: 24px 24px 0 0; padding: 28px 24px 32px; width: 100%; max-width: 480px; animation: slideUp 0.3s ease; max-height: 90vh; overflow-y: auto; }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .type-toggle { display: flex; background: #0C0C14; border-radius: 10px; padding: 4px; gap: 4px; }
  .type-option { flex: 1; text-align: center; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; }
  .tab-btn { background: none; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
`;

const styles = {
  loginWrap: { fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#0C0C14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, color: "#F0EDE8" },
  label: { fontSize: 12, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 },
  input: { width: "100%", background: "#17171F", border: "1px solid #252530", borderRadius: 12, color: "#F0EDE8", padding: "12px 16px", fontFamily: "inherit", fontSize: 14, outline: "none" },
  userCard: (color) => ({ width: "100%", background: "#17171F", border: `1px solid ${color}44`, borderRadius: 14, padding: "16px 20px", marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s", fontFamily: "inherit" }),
  avatar: (color) => ({ width: 44, height: 44, borderRadius: "50%", background: `${color}22`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }),
  iconBtn: { background: "#17171F", border: "1px solid #252530", borderRadius: 10, padding: "8px 12px", color: "#888", cursor: "pointer", fontSize: 16, fontFamily: "inherit" },
  errorBanner: { background: "#FF6B6B22", border: "1px solid #FF6B6B44", color: "#FF6B6B", padding: "10px 16px", textAlign: "center", fontSize: 13 },
};
