import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BRAND, LRD_PER_USD, DELIVERY_ZONES, DELIVERY_HOURS, TIME_SLOTS, PAYMENT_METHODS } from "./config.js";
import { PLACES, nearestPlace } from "./places.js";
import DeliveryMap from "./DeliveryMap.jsx";
const Admin = lazy(() => import("./Admin.jsx"));
import { CATEGORIES, PRODUCTS, LOOKBOOK, LOW_STOCK, totalStock } from "./products.js";

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

function formatPrice(usd, currency) {
  if (currency === "LRD") return `L$${Math.round(usd * LRD_PER_USD).toLocaleString()}`;
  return `$${usd.toFixed(2).replace(/\.00$/, "")}`;
}

const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
const swatchBg = ([body, accent]) => `linear-gradient(135deg, ${body} 0 55%, ${accent} 55% 100%)`;

function Thumb({ product }) {
  return <img src={product.images[0].thumb} alt={`${product.name}, ${product.color}`} loading="lazy" width="480" height="640" />;
}

export default function App() {
  const [tab, setTab] = useState(() => (window.location.hash === "#admin" ? "admin" : "home"));
  useEffect(() => {
    const onHash = () => setTab(window.location.hash === "#admin" ? "admin" : "home");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const leaveAdmin = () => { history.replaceState(null, "", window.location.pathname); setTab("home"); };
  const [productId, setProductId] = useState(null);
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useStored("te-currency", "USD");
  const [bag, setBag] = useStored("te-bag-v2", []);
  const [saved, setSaved] = useStored("te-saved", []);
  const [orders, setOrders] = useStored("te-orders", []);
  const [toast, setToast] = useState("");

  useEffect(() => { window.scrollTo(0, 0); }, [tab, productId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const price = (usd) => formatPrice(usd, currency);
  const bagCount = bag.reduce((n, l) => n + l.qty, 0);

  const openProduct = (id) => { setProductId(id); setTab("product"); };
  const goShop = (cat = "all") => { setCategory(cat); setTab("shop"); };

  const addToBag = (id, size) => {
    const left = findProduct(id).stock[size] ?? 0;
    const inBag = bag.find((l) => l.id === id && l.size === size)?.qty ?? 0;
    if (inBag >= left) {
      setToast(left ? `Only ${left} left in ${size} — all in your bag` : `${size} is sold out`);
      return;
    }
    setBag((b) => {
      const hit = b.find((l) => l.id === id && l.size === size);
      if (hit) return b.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
      return [...b, { id, size, qty: 1 }];
    });
    setToast("Added to bag");
  };
  const deliverNow = (id, size) => {
    if (!bag.some((l) => l.id === id && l.size === size)) addToBag(id, size);
    setTab("bag");
  };
  const toggleSaved = (id) =>
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="app">
      <header className="topbar">
        <button className="logo" onClick={() => setTab("home")} aria-label="Too Easy home">
          TOO <span>EASY</span>
        </button>
        <button
          className="currency"
          onClick={() => setCurrency(currency === "USD" ? "LRD" : "USD")}
          aria-label="Switch currency"
        >
          <b className={currency === "USD" ? "on" : ""}>USD</b>
          <b className={currency === "LRD" ? "on" : ""}>LRD</b>
        </button>
      </header>

      <main>
        {tab === "home" && <Home price={price} openProduct={openProduct} goShop={goShop} />}
        {tab === "shop" && (
          <Shop
            price={price} category={category} setCategory={setCategory}
            openProduct={openProduct} saved={saved} toggleSaved={toggleSaved}
          />
        )}
        {tab === "product" && findProduct(productId) && (
          <Product
            product={findProduct(productId)} price={price} addToBag={addToBag} deliverNow={deliverNow}
            saved={saved.includes(productId)} toggleSaved={() => toggleSaved(productId)}
            back={() => setTab("shop")} openProduct={openProduct}
          />
        )}
        {tab === "saved" && (
          <Saved price={price} saved={saved} openProduct={openProduct} toggleSaved={toggleSaved} goShop={goShop} />
        )}
        {tab === "bag" && <Bag bag={bag} setBag={setBag} price={price} currency={currency} goShop={goShop} orders={orders} setOrders={setOrders} />}
        {tab === "story" && <Story goShop={goShop} />}
        {tab === "admin" && <Suspense fallback={<p className="section muted">Loading…</p>}><Admin exit={leaveAdmin} /></Suspense>}
      </main>

      {toast && <div className="toast" role="status">{toast}</div>}

      <nav className="tabs">
        {[
          ["home", "Home", "M3 11l9-8 9 8v10h-6v-6H9v6H3z"],
          ["shop", "Shop", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"],
          ["saved", "Saved", "M12 21s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z"],
          ["bag", "Bag", "M4 7h16l-2 14H6zM8 7a4 4 0 018 0"],
          ["story", "Story", "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6L12 16.3 6.6 19.3l1.3-6L3.3 9.2l6.1-.6z"],
        ].map(([id, label, d]) => (
          <button
            key={id}
            className={tab === id || (id === "shop" && tab === "product") ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            {label}
            {id === "bag" && bagCount > 0 && <i className="count">{bagCount}</i>}
            {id === "saved" && saved.length > 0 && <i className="count">{saved.length}</i>}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ProductCard({ product, price, onOpen, saved, onSave }) {
  return (
    <div className="card">
      <button className="card-img" onClick={onOpen}>
        {product.badge && <span className="badge">{product.badge}</span>}
        <Thumb product={product} />
      </button>
      {onSave && (
        <button className={`heart ${saved ? "on" : ""}`} onClick={onSave} aria-label={saved ? "Remove from saved" : "Save"}>
          {saved ? "♥" : "♡"}
        </button>
      )}
      <button className="card-meta" onClick={onOpen}>
        <span className="card-name">{product.name}</span>
        <span className="card-color">{product.color}</span>
        <span className="card-price">{price(product.price)}</span>
        <StockLine left={totalStock(product)} />
      </button>
    </div>
  );
}

function StockLine({ left }) {
  if (left === 0) return <span className="card-stock out">Sold out</span>;
  if (left <= LOW_STOCK * 3) return <span className="card-stock low">Only {left} left</span>;
  return <span className="card-stock">{left} in stock</span>;
}

function Home({ price, openProduct, goShop }) {
  const graphic = PRODUCTS.filter((p) => p.category === "graphic");
  const smiley = PRODUCTS.filter((p) => p.category === "smiley");
  const raglans = PRODUCTS.filter((p) => p.category === "raglan");
  const bags = PRODUCTS.filter((p) => p.category === "bags");
  const drops = PRODUCTS.filter((p) => p.category === "drops");
  const caps = PRODUCTS.filter((p) => p.category === "caps");
  const row = (list) => (
    <div className="row-scroll">
      {list.map((p) => <ProductCard key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)} />)}
    </div>
  );
  return (
    <>
      <section className="hero" style={{ backgroundImage: `url(${LOOKBOOK[0]})` }}>
        <p className="eyebrow">{BRAND.city} · Since {BRAND.founded}</p>
        <h1>Who said it can't be <em>easy?</em></h1>
        <p className="hero-sub">Liberia's own streetwear. Made in Monrovia, worn wherever Liberians are.</p>
        <div className="hero-ctas">
          <button className="btn primary" onClick={() => goShop("all")}>Shop now</button>
          <button className="btn ghost" onClick={() => goShop("drops")}>New drops</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>New Drops</h2>
          <button className="link" onClick={() => goShop("drops")}>See all</button>
        </div>
        <p className="muted">The Star T and the Plate T, straight from the campaign shoots.</p>
        {row(drops)}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Graphic Tees</h2>
          <button className="link" onClick={() => goShop("graphic")}>See all</button>
        </div>
        <p className="muted">"Trust Your Dopeness" and the Bubble Logo, with big prints across the back.</p>
        {row(graphic)}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Smiley Logo Tee</h2>
          <button className="link" onClick={() => goShop("smiley")}>See all</button>
        </div>
        <p className="muted">The signature. {smiley.length} colourways.</p>
        {row(smiley)}
      </section>

      <section className="section">
        <h2>Shop by category</h2>
        <div className="cats">
          {CATEGORIES.filter((c) => c.id !== "all").map((c) => {
            const sample = PRODUCTS.find((p) => p.category === c.id);
            return (
              <button key={c.id} className="cat" onClick={() => goShop(c.id)}>
                <Thumb product={sample} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Raglans</h2>
          <button className="link" onClick={() => goShop("raglan")}>See all</button>
        </div>
        {row(raglans)}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Caps</h2>
          <button className="link" onClick={() => goShop("caps")}>See all</button>
        </div>
        <p className="muted">Washed dad caps with the oval logo or the smiley. {price(10)} each.</p>
        {row(caps)}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Utility Totes</h2>
          <button className="link" onClick={() => goShop("bags")}>See all</button>
        </div>
        {row(bags)}
      </section>

      <section className="section">
        <h2>Lookbook</h2>
        <div className="lookbook">
          {LOOKBOOK.slice(1).map((src) => <img key={src} src={src} alt="Too Easy lookbook" loading="lazy" />)}
        </div>
      </section>

      <section className="section real">
        <h2>Buy the real one</h2>
        <p>
          Too Easy gets copied. Original pieces are only sold through this app, the official
          Instagram <a href={BRAND.instagram} target="_blank" rel="noreferrer">{BRAND.instagramHandle}</a>,
          and the brand's own WhatsApp line.
        </p>
      </section>
    </>
  );
}

function Shop({ price, category, setCategory, openProduct, saved, toggleSaved }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || `${p.name} ${p.color}`.toLowerCase().includes(q))
    );
  }, [category, query]);

  return (
    <section className="section">
      <h1 className="page-title">Shop</h1>
      <input
        className="search" type="search" placeholder="Search colours, tees, totes…"
        value={query} onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="muted center">Nothing matches that yet.</p>}
      <div className="grid">
        {list.map((p) => (
          <ProductCard
            key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)}
            saved={saved.includes(p.id)} onSave={() => toggleSaved(p.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Product({ product, price, addToBag, deliverNow, saved, toggleSaved, back, openProduct }) {
  const onlySize = product.sizes.length === 1 && product.stock[product.sizes[0]] > 0 ? product.sizes[0] : "";
  const [size, setSize] = useState(onlySize);
  const [warn, setWarn] = useState(false);
  const [view, setView] = useState(0);
  useEffect(() => { setSize(onlySize); setWarn(false); setView(0); }, [product.id]);

  const family = PRODUCTS.filter((p) => p.name === product.name);
  const soldOut = totalStock(product) === 0;
  const left = size ? product.stock[size] : 0;
  const related = PRODUCTS.filter((p) => p.category === product.category && p.name !== product.name).slice(0, 4);

  const add = () => {
    if (!size) { setWarn(true); return; }
    addToBag(product.id, size);
  };
  const orderDelivery = () => {
    if (!size) { setWarn(true); return; }
    deliverNow(product.id, size);
  };

  return (
    <section className="product">
      <button className="link back" onClick={back}>← Back to shop</button>
      <div className="product-img">
        <img src={product.images[view].src} alt={`${product.name}, ${product.color}${product.images[view].label ? `, ${product.images[view].label.toLowerCase()}` : ""}`} />
        {product.images[view].label && <span className="badge">{product.images[view].label}</span>}
      </div>
      {product.images.length > 1 && (
        <div className="views">
          {product.images.map((im, i) => (
            <button key={im.src} className={i === view ? "on" : ""} onClick={() => setView(i)}>
              <img src={im.thumb} alt="" />
              <span>{im.label ?? `Photo ${i + 1}`}</span>
            </button>
          ))}
        </div>
      )}
      <div className="product-body">
        <div className="product-title">
          <div>
            <h1>{product.name}</h1>
            <p className="muted">{product.color}</p>
          </div>
          <p className="product-price">{price(product.price)}</p>
        </div>
        <p>{product.desc}</p>

        {family.length > 1 && (
          <>
            <h3>Colour: <span className="muted">{product.color}</span></h3>
            <div className="swatches">
              {family.map((v) => (
                <button
                  key={v.id} title={v.color} aria-label={v.color}
                  className={`dot ${v.id === product.id ? "on" : ""} ${totalStock(v) === 0 ? "out" : ""}`}
                  style={{ background: swatchBg(v.swatch) }}
                  onClick={() => openProduct(v.id)}
                />
              ))}
            </div>
          </>
        )}

        <h3>Size {warn && <span className="warn">— pick a size</span>}</h3>
        <div className="sizes">
          {product.sizes.map((s) => {
            const n = product.stock[s] ?? 0;
            return (
              <button
                key={s} disabled={!n}
                className={`size ${size === s ? "on" : ""} ${!n ? "out" : n <= LOW_STOCK ? "low" : ""}`}
                onClick={() => { setSize(s); setWarn(false); }}
              >
                <span>{s}</span>
                <small>{n ? `${n} left` : "Sold out"}</small>
              </button>
            );
          })}
        </div>
        {size && left <= LOW_STOCK && (
          <p className="stock-note">Only {left} left in {size} — order soon.</p>
        )}

        <h3>Stock by colour & size</h3>
        <div className="stock-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Colour</th>
                {product.sizes.map((s) => <th key={s}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {family.map((v) => (
                <tr key={v.id} className={v.id === product.id ? "current" : ""} onClick={() => openProduct(v.id)}>
                  <td><i style={{ background: swatchBg(v.swatch) }} />{v.color}</td>
                  {v.sizes.map((s) => {
                    const n = v.stock[s] ?? 0;
                    return <td key={s} className={!n ? "out" : n <= LOW_STOCK ? "low" : ""}>{n || "–"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Numbers show pieces left. Tap a colour to switch.</p>

        <div className="product-actions">
          <button className="btn primary wide" onClick={add} disabled={soldOut}>{soldOut ? "Sold out" : "Add to bag"}</button>
          <button className={`btn ghost square ${saved ? "on" : ""}`} onClick={toggleSaved} aria-label="Save">
            {saved ? "♥" : "♡"}
          </button>
        </div>
        {!soldOut && (
          <button className="btn dark wide" onClick={orderDelivery}>🛵 Order for delivery</button>
        )}
        <p className="muted small">Delivery across Monrovia, at the day and time you choose · Orange Money, MTN MoMo or cash</p>
      </div>

      {related.length > 0 && (
        <div className="section">
          <h2>You might also like</h2>
          <div className="row-scroll">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Saved({ price, saved, openProduct, toggleSaved, goShop }) {
  const list = saved.map(findProduct).filter(Boolean);
  return (
    <section className="section">
      <h1 className="page-title">Saved</h1>
      {list.length === 0 ? (
        <div className="empty">
          <p>Tap ♡ on anything you like and it'll wait for you here.</p>
          <button className="btn primary" onClick={() => goShop()}>Browse the shop</button>
        </div>
      ) : (
        <div className="grid">
          {list.map((p) => (
            <ProductCard
              key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)}
              saved onSave={() => toggleSaved(p.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const whenLabel = (date, time) =>
  new Date(`${date}T${time}`).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

// Returns an error message, or "" when the requested delivery time works.
function checkWhen(date, time) {
  if (!date || !time) return "Pick the day and time you need it.";
  const when = new Date(`${date}T${time}`);
  const [h, m] = time.split(":").map(Number);
  const { open, close, leadHours, maxDaysAhead } = DELIVERY_HOURS;
  if (h < open || h + m / 60 > close) return `Deliveries run ${open}:00 AM – ${close - 12}:00 PM.`;
  if (when < new Date(Date.now() + leadHours * 3600e3)) return `Give the rider at least ${leadHours} hours — pick a later time.`;
  if (when > new Date(Date.now() + maxDaysAhead * 86400e3)) return `You can book up to ${maxDaysAhead} days ahead.`;
  return "";
}

function Bag({ bag, setBag, price, currency, goShop, orders, setOrders }) {
  const today = isoDate(new Date());
  const [form, setForm] = useState({ name: "", phone: "", mode: "delivery", landmark: "", pay: "orange", note: "", date: today, time: "" });
  const [spot, setSpot] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(null);
  const lines = bag.map((l) => ({ ...l, product: findProduct(l.id) })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const delivering = form.mode === "delivery";
  const zone = DELIVERY_ZONES.find((z) => z.id === (delivering ? spot?.place.zone : "pickup"));
  const quoted = zone?.id === "outside";
  const total = subtotal + (zone?.fee ?? 0);

  const setQty = (line, qty) => {
    const { product, size } = line;
    const left = product.stock[size] ?? 0;
    if (qty > left) { setError(`Only ${left} left in ${size} for ${product.name} (${product.color}).`); return; }
    setError("");
    setBag((b) => (qty <= 0 ? b.filter((l) => !(l.id === line.id && l.size === size))
      : b.map((l) => (l.id === line.id && l.size === size ? { ...l, qty } : l))));
  };
  const field = (k) => ({ value: form[k], onChange: (e) => { setForm({ ...form, [k]: e.target.value }); setError(""); } });
  const choosePlace = (name) => {
    const p = PLACES.find((x) => x.name === name);
    setSpot(p ? { lat: p.lat, lng: p.lng, place: p, exact: false } : null);
    setError("");
  };
  const locateMe = () => {
    if (!navigator.geolocation) { setError("This phone can't share its location. Tap the map instead."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false); setError("");
        const point = [coords.latitude, coords.longitude];
        setSpot({ lat: point[0], lng: point[1], place: nearestPlace(point), exact: true });
      },
      () => { setLocating(false); setError("Couldn't get your location. Tap your spot on the map instead."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const [saving, setSaving] = useState(false);
  const placeOrder = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError("Add your name and phone so the rider can reach you."); return; }
    if (form.phone.replace(/\D/g, "").length < 7) { setError("That phone number looks too short — use your full 077 / 088 number."); return; }
    if (delivering && !spot) { setError("Show us where to deliver: tap the map or pick your area."); return; }
    if (delivering && !form.landmark.trim()) { setError("Add a landmark so the rider can find you (e.g. house colour, nearby shop)."); return; }
    const whenError = checkWhen(form.date, form.time);
    if (whenError) { setError(whenError); return; }
    setError("");
    const order = {
      no: `TE-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      placedAt: Date.now(),
      items: lines.map((l) => ({ name: l.product.name, color: l.product.color, size: l.size, qty: l.qty, price: l.product.price, thumb: l.product.images[0].thumb })),
      subtotal, fee: zone.fee, quoted, total, currency,
      mode: form.mode, when: whenLabel(form.date, form.time),
      spot: delivering ? { lat: spot.lat, lng: spot.lng, area: spot.place.far ? `Near ${spot.place.name}` : spot.place.name, zone: zone.label, exact: spot.exact } : null,
      landmark: form.landmark, name: form.name, phone: form.phone,
      pay: PAYMENT_METHODS.find((p) => p.id === form.pay).label, note: form.note,
      sample: /^2310+$/.test(BRAND.whatsapp),
    };
    const msg = [
      `Hi Too Easy! New order ${order.no}`,
      "",
      ...order.items.map((i) => `• ${i.qty}× ${i.name} (${i.color}, ${i.size}) — ${price(i.price * i.qty)}`),
      "",
      `Subtotal: ${price(subtotal)}`,
      delivering ? `Delivery: ${zone.label}${quoted ? " — please quote" : ` — ${price(zone.fee)}`}` : "Pickup",
      `Total: ${price(total)} (${currency})${quoted ? " + delivery" : ""}`,
      "",
      `${delivering ? "Deliver" : "Pick up"}: ${order.when}`,
      delivering ? `Area: ${order.spot.area}` : null,
      delivering ? `Map: https://maps.google.com/?q=${spot.lat.toFixed(5)},${spot.lng.toFixed(5)}` : null,
      delivering ? `Landmark: ${form.landmark}` : null,
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      `Payment: ${order.pay}`,
      form.note ? `Note: ${form.note}` : null,
    ].filter((x) => x !== null).join("\n");
    order.whatsappUrl = order.sample ? null : `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`;

    setSaving(true);
    let dbError;
    try {
      const { supabase } = await import("./supabase.js");
      ({ error: dbError } = await supabase.from("orders").insert({
      order_no: order.no,
      customer_name: form.name.trim(),
      phone: form.phone.trim(),
      items: order.items.map(({ thumb, ...i }) => i),
      item_count: order.items.reduce((n, i) => n + i.qty, 0),
      subtotal, delivery_fee: zone.fee, fee_quoted: quoted, total,
      mode: form.mode,
      deliver_at: new Date(`${form.date}T${form.time}`).toISOString(),
      deliver_label: order.when,
      area: order.spot?.area ?? null, zone: zone.label,
      lat: order.spot?.lat ?? null, lng: order.spot?.lng ?? null,
      landmark: delivering ? form.landmark.trim() : null,
      payment: order.pay, note: form.note.trim() || null,
      sample: order.sample,
      }));
    } catch (e) {
      dbError = e;
    }
    setSaving(false);
    if (dbError) { setError("Couldn't reach the shop — check your internet and tap Book again."); return; }

    setOrders((o) => [order, ...o].slice(0, 20));
    setBag([]);
    setConfirmed(order);
    window.scrollTo(0, 0);
  };

  if (confirmed) return <OrderConfirmed order={confirmed} price={price} done={() => { setConfirmed(null); goShop(); }} />;

  if (lines.length === 0) {
    return (
      <section className="section">
        <h1 className="page-title">Your bag</h1>
        <div className="empty">
          <p>Your bag is empty. It's too easy to fix that.</p>
          <button className="btn primary" onClick={() => goShop()}>Start shopping</button>
        </div>
        {orders.length > 0 && (
          <>
            <h2>Your deliveries</h2>
            <ul className="orders">
              {orders.map((o) => (
                <li key={o.no} className="order-row">
                  <img src={o.items[0].thumb} alt="" />
                  <div>
                    <b>{o.no}</b>
                    <span className="muted">{o.mode === "delivery" ? `${o.spot.area} · ${o.when}` : `Pickup · ${o.when}`}</span>
                    <span className="muted">{o.items.reduce((n, i) => n + i.qty, 0)} item(s) · {price(o.total)}{o.quoted ? " + delivery" : ""}</span>
                  </div>
                  <span className="status">{o.sample ? "Sample" : "Booked"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="section">
      <h1 className="page-title">Your bag</h1>
      <ul className="lines">
        {lines.map((l) => (
          <li key={`${l.id}-${l.size}`} className="line">
            <div className="line-img"><Thumb product={l.product} /></div>
            <div className="line-info">
              <b>{l.product.name}</b>
              <span className="muted">{l.product.color} · {l.size}</span>
              <div className="qty">
                <button onClick={() => setQty(l, l.qty - 1)} aria-label="Decrease">−</button>
                <span>{l.qty}</span>
                <button onClick={() => setQty(l, l.qty + 1)} aria-label="Increase">+</button>
              </div>
            </div>
            <b className="line-price">{price(l.product.price * l.qty)}</b>
          </li>
        ))}
      </ul>

      <h2 id="delivery">How do you want it?</h2>
      <div className="mode">
        <button className={delivering ? "on" : ""} onClick={() => setForm({ ...form, mode: "delivery" })}>
          <b>Delivery</b><span>Rider brings it to you</span>
        </button>
        <button className={!delivering ? "on" : ""} onClick={() => setForm({ ...form, mode: "pickup" })}>
          <b>Pickup</b><span>Free · {BRAND.pickup}</span>
        </button>
      </div>

      {delivering && (
        <>
          <h3>Where should we deliver?</h3>
          <p className="muted small">Tap your community on the map, or tap your exact spot.</p>
          <DeliveryMap value={spot} onPick={(s) => { setSpot(s); setError(""); }} />
          <div className="map-tools">
            <select value={spot && !spot.exact ? spot.place.name : ""} onChange={(e) => choosePlace(e.target.value)} aria-label="Choose your area">
              <option value="">Choose your area…</option>
              {DELIVERY_ZONES.filter((z) => z.id !== "pickup").map((z) => (
                <optgroup key={z.id} label={z.label}>
                  {PLACES.filter((p) => p.zone === z.id).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" className="btn ghost" onClick={locateMe} disabled={locating}>{locating ? "Finding you…" : "📍 Use my location"}</button>
          </div>
          {spot && (
            <div className="spot">
              <b>{spot.exact ? (spot.place.far ? `Pinned near ${spot.place.name}` : `Pinned in ${spot.place.name}`) : spot.place.name}</b>
              <span>{zone.label} · {quoted ? "fee quoted on WhatsApp" : `delivery ${price(zone.fee)}`}</span>
            </div>
          )}
          <div className="form">
            <label>Landmark or directions<input {...field("landmark")} placeholder="e.g. Blue gate behind Total station, 19th St" /></label>
          </div>
        </>
      )}

      <h3>When do you need it?</h3>
      <div className="form when">
        <label>Day<input type="date" {...field("date")} min={today} max={isoDate(new Date(Date.now() + DELIVERY_HOURS.maxDaysAhead * 86400e3))} /></label>
        <label>Time<input type="time" {...field("time")} min={`${pad(DELIVERY_HOURS.open)}:00`} max={`${DELIVERY_HOURS.close}:00`} step="900" /></label>
      </div>
      <div className="chips slots">
        {TIME_SLOTS.map((s) => (
          <button key={s.label} type="button" className={`chip ${form.time === s.time ? "on" : ""}`} onClick={() => { setForm({ ...form, time: s.time }); setError(""); }}>
            {s.label} · {new Date(`2000-01-01T${s.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </button>
        ))}
      </div>
      {form.date && form.time && !checkWhen(form.date, form.time) && (
        <p className="when-ok">✓ {delivering ? "Arrives" : "Ready for pickup"} {whenLabel(form.date, form.time)}</p>
      )}

      <h3>Your details</h3>
      <div className="form">
        <label>Full name<input {...field("name")} autoComplete="name" /></label>
        <label>Phone (WhatsApp)<input {...field("phone")} type="tel" placeholder="077 / 088…" autoComplete="tel" /></label>
        <label>Payment
          <div className="pay">
            {PAYMENT_METHODS.map((p) => (
              <button key={p.id} type="button" className={`chip ${form.pay === p.id ? "on" : ""}`} onClick={() => setForm({ ...form, pay: p.id })}>
                {p.label}
              </button>
            ))}
          </div>
        </label>
        <label>Note (optional)<input {...field("note")} placeholder="Gift, call before arriving, anything else" /></label>
      </div>

      <div className="totals">
        <div><span>Subtotal</span><span>{price(subtotal)}</span></div>
        <div><span>Delivery</span><span>{!delivering ? "Free (pickup)" : !zone ? "Pick a spot" : quoted ? "Quoted" : price(zone.fee)}</span></div>
        <div className="grand"><span>Total</span><span>{price(total)}{quoted ? " + delivery" : ""}</span></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary wide" onClick={placeOrder} disabled={saving}>{saving ? "Booking…" : delivering ? "Book delivery" : "Book pickup"}</button>
      <p className="muted small center">
        {/^2310+$/.test(BRAND.whatsapp)
          ? "Sample mode: your order is saved to the shop's records. WhatsApp sending turns on once the shop's number is added."
          : "Your order is saved to the shop's records, then you send it on WhatsApp so the team can confirm stock and payment."}
      </p>
    </section>
  );
}

function OrderConfirmed({ order, price, done }) {
  return (
    <section className="section confirmed">
      <div className="tick" aria-hidden="true">✓</div>
      <h1 className="page-title">{order.mode === "delivery" ? "Delivery booked" : "Pickup booked"}</h1>
      <p className="muted">Order <b>{order.no}</b> · saved to Too Easy's records{order.sample ? " (sample — WhatsApp not connected yet)" : ""}</p>
      {order.whatsappUrl && (
        <a className="btn whatsapp wide" href={order.whatsappUrl} target="_blank" rel="noreferrer">Send order on WhatsApp</a>
      )}
      <div className="confirm-card">
        <div><span>When</span><b>{order.when}</b></div>
        {order.spot && <div><span>Where</span><b>{order.spot.area}</b></div>}
        {order.spot && <div><span>Landmark</span><b>{order.landmark}</b></div>}
        <div><span>Payment</span><b>{order.pay}</b></div>
        <div><span>Total</span><b>{price(order.total)}{order.quoted ? " + delivery" : ""}</b></div>
      </div>
      {order.spot && <DeliveryMap value={order.spot} readOnly height={200} />}
      <ul className="lines">
        {order.items.map((i) => (
          <li key={`${i.name}-${i.color}-${i.size}`} className="line">
            <div className="line-img"><img src={i.thumb} alt="" /></div>
            <div className="line-info"><b>{i.name}</b><span className="muted">{i.color} · {i.size} · ×{i.qty}</span></div>
            <b className="line-price">{price(i.price * i.qty)}</b>
          </li>
        ))}
      </ul>
      <button className="btn primary wide" onClick={done}>Keep shopping</button>
    </section>
  );
}

function Story({ goShop }) {
  return (
    <section className="section story">
      <p className="eyebrow">The story</p>
      <h1 className="page-title">More than a shirt.</h1>
      <p>
        Too Easy was started in Monrovia in 2023 by {BRAND.founder} — known online as {BRAND.founderHandle} — with
        very little money and one question: <b>{BRAND.tagline}</b>
      </p>
      <p>
        The brand is about confidence, celebrating what makes you different, and keeping a positive mind.
        In a short time it became one of the most recognised streetwear names in Liberia, and its signature
        shirts have been worn by people from the streets of Monrovia all the way to the Executive Mansion.
      </p>
      <blockquote>
        "We have been industry leaders. Now, people have found purpose in wearing a Liberia-owned brand."
        <cite>— {BRAND.founderHandle}</cite>
      </blockquote>

      <h2>Milestones</h2>
      <ol className="timeline">
        <li><b>Sept 2023</b> First pieces hit the market.</li>
        <li><b>Oct 2023</b> Grand launch party in Monrovia with five DJs.</li>
        <li><b>Mar 2025</b> International Women's Day: cash, shirts and caps given to women street vendors across Monrovia.</li>
        <li><b>Jul 2025</b> Liberian Jue collection for Independence Day, plus the Jue Party the night before July 26.</li>
      </ol>
      <img className="story-img" src={LOOKBOOK[3]} alt="Too Easy campaign shoot" loading="lazy" />

      <h2>Giving back</h2>
      <p>
        Too Easy runs seminars and workshops for young people and women-led businesses, and puts money
        straight into the hands of the women who keep Monrovia's markets moving.
      </p>

      <h2>Follow</h2>
      <div className="socials">
        <a className="btn ghost" href={BRAND.instagram} target="_blank" rel="noreferrer">Instagram {BRAND.instagramHandle}</a>
        <a className="btn ghost" href={BRAND.facebook} target="_blank" rel="noreferrer">Facebook</a>
        <a className="btn ghost" href={BRAND.founderInstagram} target="_blank" rel="noreferrer">@{BRAND.founderHandle.toLowerCase()}</a>
      </div>
      <button className="btn primary wide" onClick={() => goShop()}>Shop Too Easy</button>
      <a className="admin-link" href="#admin">Shop admin</a>
    </section>
  );
}
