import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";

const money = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const waLink = (phoneKey, text = "") => `https://wa.me/${phoneKey}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

const GIVEAWAY_RULES = [
  { id: "repeat", label: "Repeat buyers (2+ orders)", test: (c) => c.orders >= 2 },
  { id: "loyal", label: "Loyal buyers (3+ orders)", test: (c) => c.orders >= 3 },
  { id: "big", label: "Spent $50 or more", test: (c) => Number(c.spent) >= 50 },
  { id: "all", label: "Every customer", test: () => true },
];

function toCsv(rows) {
  const cols = ["name", "phone", "orders", "spent", "items", "first_order", "last_order", "areas"];
  const esc = (v) => `"${String(Array.isArray(v) ? v.join("; ") : v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function Admin({ exit }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <section className="section"><p className="muted">Loading…</p></section>;
  return session ? <Dashboard session={session} exit={exit} /> : <Login exit={exit} />;
}

function Login({ exit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setMsg(error.message === "Email not confirmed" ? "Confirm your email first — check your inbox for the link." : error.message);
  };
  const create = async () => {
    if (password.length < 8) { setMsg("Use a password of at least 8 characters."); return; }
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    setMsg(error ? error.message : "Account created. Open the confirmation email we just sent, tap the link, then come back here and sign in.");
  };

  return (
    <section className="section admin">
      <button className="link back" onClick={exit}>← Back to shop</button>
      <h1 className="page-title">Shop admin</h1>
      <p className="muted">Customer records and giveaways. Only emails on the admin list can see this.</p>
      <div className="form">
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
      </div>
      {msg && <p className="error" role="alert">{msg}</p>}
      <button className="btn primary wide" onClick={signIn} disabled={busy || !email || !password}>Sign in</button>
      <button className="btn ghost wide admin-create" onClick={create} disabled={busy || !email || !password}>First time? Create admin account</button>
    </section>
  );
}

function Dashboard({ session, exit }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("customers");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [c, o] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    if (c.error || o.error) { setError((c.error || o.error).message); return; }
    setCustomers(c.data); setOrders(o.data);
  };

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data, error: e }) => {
      setIsAdmin(!e && data === true);
      if (!e && data === true) load();
    });
  }, [session.user.id]);

  const signOut = () => supabase.auth.signOut();

  if (isAdmin === null) return <section className="section"><p className="muted">Checking access…</p></section>;
  if (!isAdmin) {
    return (
      <section className="section admin">
        <h1 className="page-title">No access</h1>
        <p className="muted">{session.user.email} isn't on the shop's admin list.</p>
        <button className="btn ghost wide" onClick={signOut}>Sign out</button>
      </section>
    );
  }

  const repeat = customers.filter((c) => c.orders >= 2);
  const revenue = customers.reduce((s, c) => s + Number(c.spent), 0);

  return (
    <section className="section admin">
      <div className="section-head">
        <button className="link" onClick={exit}>← Shop</button>
        <button className="link" onClick={signOut}>Sign out</button>
      </div>
      <h1 className="page-title">Customers</h1>
      <div className="stats">
        <div><b>{customers.length}</b><span>Customers</span></div>
        <div><b>{repeat.length}</b><span>Repeat buyers</span></div>
        <div><b>{orders.filter((o) => o.status !== "cancelled").length}</b><span>Orders</span></div>
        <div><b>{money(revenue)}</b><span>Sales</span></div>
      </div>
      <div className="chips">
        {[["customers", "Customers"], ["giveaway", "🎁 Giveaway"], ["orders", "Orders"]].map(([id, label]) => (
          <button key={id} className={`chip ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
        <button className="chip" onClick={load}>↻ Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {tab === "customers" && <CustomerList customers={customers} orders={orders} />}
      {tab === "giveaway" && <Giveaway customers={customers} />}
      {tab === "orders" && <OrderList orders={orders} reload={load} />}
    </section>
  );
}

function CustomerList({ customers, orders }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("orders");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = { all: 1, repeat: 2, loyal: 3 }[filter];
    const by = {
      orders: (a, b) => b.orders - a.orders || b.spent - a.spent,
      spent: (a, b) => b.spent - a.spent || b.orders - a.orders,
      latest: (a, b) => new Date(b.last_order) - new Date(a.last_order),
    }[sort];
    return customers
      .filter((c) => c.orders >= min && (!q || `${c.name} ${c.phone} ${c.areas.join(" ")}`.toLowerCase().includes(q)))
      .sort(by);
  }, [customers, filter, sort, query]);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(list)], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `too-easy-customers-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <input className="search" type="search" placeholder="Search name, phone or area…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="admin-bar">
        <div className="chips">
          {[["all", "All"], ["repeat", "Repeat (2+)"], ["loyal", "3+ orders"]].map(([id, label]) => (
            <button key={id} className={`chip ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort customers">
          <option value="orders">Most orders</option>
          <option value="spent">Most spent</option>
          <option value="latest">Latest order</option>
        </select>
      </div>
      {list.length === 0 && <p className="muted center">No customers here yet.</p>}
      <ol className="customers">
        {list.map((c, i) => (
          <li key={c.phone_key} className={c.orders >= 2 ? "repeat" : ""}>
            <button className="cust" onClick={() => setOpen(open === c.phone_key ? null : c.phone_key)}>
              <span className="rank">{i + 1}</span>
              <span className="cust-main">
                <b>{c.name}</b>
                <span className="muted">{c.phone}{c.areas.length ? ` · ${c.areas.join(", ")}` : ""}</span>
                <span className="muted">Last order {day(c.last_order)}{c.all_sample ? " · test orders" : ""}</span>
              </span>
              <span className="cust-num">
                <span className={`badge-orders ${c.orders >= 3 ? "gold" : c.orders >= 2 ? "silver" : ""}`}>
                  {c.orders} order{c.orders === 1 ? "" : "s"}
                </span>
                <b>{money(c.spent)}</b>
              </span>
            </button>
            {open === c.phone_key && (
              <div className="cust-orders">
                <a className="btn ghost" href={waLink(c.phone_key)} target="_blank" rel="noreferrer">WhatsApp {c.name.split(" ")[0]}</a>
                <ul>
                  {orders.filter((o) => o.phone_key === c.phone_key).map((o) => (
                    <li key={o.id}>
                      <b>{o.order_no}</b> · {day(o.created_at)} · {money(o.total)} · {o.status}
                      <span className="muted">{o.items.map((it) => `${it.qty}× ${it.name} (${it.color}, ${it.size})`).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className="btn ghost wide" onClick={exportCsv} disabled={!list.length}>Download as spreadsheet (CSV)</button>
    </>
  );
}

function Giveaway({ customers }) {
  const [rule, setRule] = useState("repeat");
  const [winner, setWinner] = useState(null);
  const eligible = customers.filter(GIVEAWAY_RULES.find((r) => r.id === rule).test);
  const top = [...eligible].sort((a, b) => b.orders - a.orders || b.spent - a.spent).slice(0, 5);

  const pick = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    setWinner(eligible[buf[0] % eligible.length]);
  };

  return (
    <div className="giveaway">
      <h3>Who can win?</h3>
      <div className="chips wrap">
        {GIVEAWAY_RULES.map((r) => (
          <button key={r.id} className={`chip ${rule === r.id ? "on" : ""}`} onClick={() => { setRule(r.id); setWinner(null); }}>{r.label}</button>
        ))}
      </div>
      <p className="muted">{eligible.length === 1 ? "1 customer qualifies." : `${eligible.length} customers qualify.`}</p>
      <button className="btn primary wide" onClick={pick} disabled={!eligible.length}>🎲 Pick a random winner</button>
      {winner && (
        <div className="winner">
          <span className="muted">Winner</span>
          <b>{winner.name}</b>
          <span>{winner.phone} · {winner.orders} orders · {money(winner.spent)} spent</span>
          <a className="btn whatsapp wide" target="_blank" rel="noreferrer"
            href={waLink(winner.phone_key, `Hi ${winner.name.split(" ")[0]}! You just won the Too Easy giveaway 🎉 Thank you for shopping with us. Reply here so we can arrange your prize.`)}>
            Message the winner on WhatsApp
          </a>
        </div>
      )}
      {top.length > 0 && (
        <>
          <h3>Top customers</h3>
          <ol className="top">
            {top.map((c) => <li key={c.phone_key}><b>{c.name}</b><span>{c.orders} orders · {money(c.spent)}</span></li>)}
          </ol>
        </>
      )}
    </div>
  );
}

function OrderList({ orders, reload }) {
  const [busy, setBusy] = useState(null);
  const setStatus = async (o, status) => {
    setBusy(o.id);
    await supabase.from("orders").update({ status }).eq("id", o.id);
    setBusy(null); reload();
  };
  const remove = async (o) => {
    if (!window.confirm(`Delete order ${o.order_no} from ${o.customer_name}? Use this for test orders.`)) return;
    setBusy(o.id);
    await supabase.from("orders").delete().eq("id", o.id);
    setBusy(null); reload();
  };
  if (!orders.length) return <p className="muted center">No orders yet.</p>;
  return (
    <ul className="admin-orders">
      {orders.map((o) => (
        <li key={o.id}>
          <div className="ao-head">
            <b>{o.order_no}</b>
            <span className="muted">{day(o.created_at)}{o.sample ? " · test" : ""}</span>
          </div>
          <span><b>{o.customer_name}</b> · <a href={waLink(o.phone_key)} target="_blank" rel="noreferrer">{o.phone}</a></span>
          <span className="muted">{o.items.map((it) => `${it.qty}× ${it.name} (${it.color}, ${it.size})`).join(", ")}</span>
          <span className="muted">
            {o.mode === "delivery" ? `Deliver ${o.deliver_label} · ${o.area}` : `Pickup ${o.deliver_label}`}
            {o.landmark ? ` · ${o.landmark}` : ""}
          </span>
          <div className="ao-foot">
            <b>{money(o.total)}{o.fee_quoted ? " + delivery" : ""}</b>
            <select value={o.status} disabled={busy === o.id} onChange={(e) => setStatus(o, e.target.value)} aria-label="Order status">
              <option value="new">New</option>
              <option value="confirmed">Confirmed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="link danger" disabled={busy === o.id} onClick={() => remove(o)}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
