import { useEffect, useMemo, useState } from "react";
import { BRAND, LRD_PER_USD, DELIVERY_ZONES, PAYMENT_METHODS } from "./config.js";
import { CATEGORIES, PRODUCTS } from "./products.js";
import ProductArt from "./ProductArt.jsx";

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

export default function App() {
  const [tab, setTab] = useState("home");
  const [productId, setProductId] = useState(null);
  const [category, setCategory] = useState("all");
  const [currency, setCurrency] = useStored("te-currency", "USD");
  const [bag, setBag] = useStored("te-bag", []);
  const [saved, setSaved] = useStored("te-saved", []);
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
    setBag((b) => {
      const hit = b.find((l) => l.id === id && l.size === size);
      if (hit) return b.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l));
      return [...b, { id, size, qty: 1 }];
    });
    setToast("Added to bag");
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
            product={findProduct(productId)} price={price} addToBag={addToBag}
            saved={saved.includes(productId)} toggleSaved={() => toggleSaved(productId)}
            back={() => setTab("shop")} openProduct={openProduct}
          />
        )}
        {tab === "saved" && (
          <Saved price={price} saved={saved} openProduct={openProduct} toggleSaved={toggleSaved} goShop={goShop} />
        )}
        {tab === "bag" && <Bag bag={bag} setBag={setBag} price={price} currency={currency} goShop={goShop} />}
        {tab === "story" && <Story goShop={goShop} />}
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
        <ProductArt product={product} />
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
      </button>
    </div>
  );
}

function Home({ price, openProduct, goShop }) {
  const featured = PRODUCTS.filter((p) => p.category === "jue").slice(0, 4);
  const best = PRODUCTS.filter((p) => p.category === "tees" || p.category === "caps").slice(0, 4);
  return (
    <>
      <section className="hero">
        <div className="hero-flag" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => <i key={i} />)}
        </div>
        <p className="eyebrow">{BRAND.city} · Since {BRAND.founded}</p>
        <h1>Who said it can't be <em>easy?</em></h1>
        <p className="hero-sub">Liberia's own streetwear. Made in Monrovia, worn wherever Liberians are.</p>
        <div className="hero-ctas">
          <button className="btn primary" onClick={() => goShop("all")}>Shop the drop</button>
          <button className="btn ghost" onClick={() => goShop("jue")}>Liberian Jue</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Liberian Jue Collection</h2>
          <button className="link" onClick={() => goShop("jue")}>See all</button>
        </div>
        <p className="muted">The Independence Day drop. Crop tops, matching sets, and kids' fits for July 26.</p>
        <div className="row-scroll">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Shop by category</h2>
        <div className="cats">
          {CATEGORIES.filter((c) => c.id !== "all").map((c) => {
            const sample = PRODUCTS.find((p) => p.category === c.id);
            return (
              <button key={c.id} className="cat" onClick={() => goShop(c.id)}>
                <ProductArt product={sample} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Signature pieces</h2>
          <button className="link" onClick={() => goShop("tees")}>See all</button>
        </div>
        <div className="grid">
          {best.map((p) => (
            <ProductCard key={p.id} product={p} price={price} onOpen={() => openProduct(p.id)} />
          ))}
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
        className="search" type="search" placeholder="Search tees, caps, Jue…"
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

function Product({ product, price, addToBag, saved, toggleSaved, back, openProduct }) {
  const [size, setSize] = useState(product.sizes.length === 1 ? product.sizes[0] : "");
  const [warn, setWarn] = useState(false);
  useEffect(() => { setSize(product.sizes.length === 1 ? product.sizes[0] : ""); setWarn(false); }, [product.id]);

  const variants = PRODUCTS.filter((p) => p.name === product.name && p.id !== product.id);
  const related = PRODUCTS.filter((p) => p.category === product.category && p.name !== product.name).slice(0, 4);

  const add = () => {
    if (!size) { setWarn(true); return; }
    addToBag(product.id, size);
  };

  return (
    <section className="product">
      <button className="link back" onClick={back}>← Back to shop</button>
      <div className="product-img">
        {product.badge && <span className="badge">{product.badge}</span>}
        <ProductArt product={product} />
      </div>
      <div className="product-body">
        <div className="product-title">
          <div>
            <h1>{product.name}</h1>
            <p className="muted">{product.color}</p>
          </div>
          <p className="product-price">{price(product.price)}</p>
        </div>
        <p>{product.desc}</p>

        {variants.length > 0 && (
          <>
            <h3>Other colours</h3>
            <div className="swatches">
              {variants.map((v) => (
                <button key={v.id} className="swatch" onClick={() => openProduct(v.id)} aria-label={v.color}>
                  <i style={{ background: v.art.base }} />
                  {v.color}
                </button>
              ))}
            </div>
          </>
        )}

        <h3>Size {warn && <span className="warn">— pick a size</span>}</h3>
        <div className="sizes">
          {product.sizes.map((s) => (
            <button key={s} className={`size ${size === s ? "on" : ""}`} onClick={() => { setSize(s); setWarn(false); }}>
              {s}
            </button>
          ))}
        </div>

        <div className="product-actions">
          <button className="btn primary wide" onClick={add}>Add to bag</button>
          <button className={`btn ghost square ${saved ? "on" : ""}`} onClick={toggleSaved} aria-label="Save">
            {saved ? "♥" : "♡"}
          </button>
        </div>
        <p className="muted small">Delivery across Monrovia · Orange Money, MTN MoMo or cash</p>
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

function Bag({ bag, setBag, price, currency, goShop }) {
  const [form, setForm] = useState({ name: "", phone: "", zone: "central", address: "", pay: "orange", note: "" });
  const [error, setError] = useState("");
  const lines = bag.map((l) => ({ ...l, product: findProduct(l.id) })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const zone = DELIVERY_ZONES.find((z) => z.id === form.zone);
  const total = subtotal + zone.fee;

  const setQty = (i, qty) =>
    setBag((b) => (qty <= 0 ? b.filter((_, j) => j !== i) : b.map((l, j) => (j === i ? { ...l, qty } : l))));
  const field = (k) => ({ value: form[k], onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  const sendOrder = () => {
    if (!form.name.trim() || !form.phone.trim()) { setError("Add your name and phone so we can reach you."); return; }
    if (form.zone !== "pickup" && !form.address.trim()) { setError("Add a delivery address or landmark."); return; }
    if (/^2310+$/.test(BRAND.whatsapp)) { setError("The shop's WhatsApp number isn't set up yet (see src/config.js)."); return; }
    setError("");
    const orderNo = `TE-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const pay = PAYMENT_METHODS.find((p) => p.id === form.pay).label;
    const msg = [
      `Hi Too Easy! New order ${orderNo}`,
      "",
      ...lines.map((l) => `• ${l.qty}× ${l.product.name} (${l.product.color}, ${l.size}) — ${price(l.product.price * l.qty)}`),
      "",
      `Subtotal: ${price(subtotal)}`,
      `Delivery: ${zone.label}${zone.fee ? ` — ${price(zone.fee)}` : ""}`,
      `Total: ${price(total)} (${currency})`,
      "",
      `Name: ${form.name}`,
      `Phone: ${form.phone}`,
      form.zone !== "pickup" ? `Address: ${form.address}` : "Pickup",
      `Payment: ${pay}`,
      form.note ? `Note: ${form.note}` : null,
    ].filter((x) => x !== null).join("\n");
    window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  if (lines.length === 0) {
    return (
      <section className="section">
        <h1 className="page-title">Your bag</h1>
        <div className="empty">
          <p>Your bag is empty. It's too easy to fix that.</p>
          <button className="btn primary" onClick={() => goShop()}>Start shopping</button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h1 className="page-title">Your bag</h1>
      <ul className="lines">
        {lines.map((l, i) => (
          <li key={`${l.id}-${l.size}`} className="line">
            <div className="line-img"><ProductArt product={l.product} /></div>
            <div className="line-info">
              <b>{l.product.name}</b>
              <span className="muted">{l.product.color} · {l.size}</span>
              <div className="qty">
                <button onClick={() => setQty(i, l.qty - 1)} aria-label="Decrease">−</button>
                <span>{l.qty}</span>
                <button onClick={() => setQty(i, l.qty + 1)} aria-label="Increase">+</button>
              </div>
            </div>
            <b className="line-price">{price(l.product.price * l.qty)}</b>
          </li>
        ))}
      </ul>

      <h2>Delivery</h2>
      <div className="form">
        <label>Full name<input {...field("name")} autoComplete="name" /></label>
        <label>Phone (WhatsApp)<input {...field("phone")} type="tel" placeholder="077 / 088…" autoComplete="tel" /></label>
        <label>Area
          <select {...field("zone")}>
            {DELIVERY_ZONES.map((z) => (
              <option key={z.id} value={z.id}>{z.label}{z.fee ? ` — ${price(z.fee)}` : ""}</option>
            ))}
          </select>
        </label>
        {form.zone !== "pickup" && (
          <label>Address or landmark<input {...field("address")} placeholder="e.g. Behind Total station, 19th St Sinkor" /></label>
        )}
        <label>Payment
          <div className="pay">
            {PAYMENT_METHODS.map((p) => (
              <button key={p.id} type="button" className={`chip ${form.pay === p.id ? "on" : ""}`} onClick={() => setForm({ ...form, pay: p.id })}>
                {p.label}
              </button>
            ))}
          </div>
        </label>
        <label>Note (optional)<input {...field("note")} placeholder="Gift, timing, anything else" /></label>
      </div>

      <div className="totals">
        <div><span>Subtotal</span><span>{price(subtotal)}</span></div>
        <div><span>Delivery</span><span>{zone.fee ? price(zone.fee) : zone.id === "outside" ? "Quoted" : "Free"}</span></div>
        <div className="grand"><span>Total</span><span>{price(total)}</span></div>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn whatsapp wide" onClick={sendOrder}>Send order on WhatsApp</button>
      <p className="muted small center">Your order opens in WhatsApp. The team confirms stock and payment there.</p>
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
    </section>
  );
}
