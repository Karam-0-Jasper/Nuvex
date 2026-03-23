import { useState, useRef, useEffect, useCallback } from "react";

const TOPICS = [
  { id: "therapy", label: "Therapy & Mental Health", icon: "🧠", desc: "Feelings, growth, wellness" },
  { id: "football", label: "Football / Soccer", icon: "⚽", desc: "Players, stats, clubs, transfers" },
  { id: "coding", label: "Coding & AI/LLMs", icon: "💻", desc: "Code, tech, APIs, AI models" },
  { id: "business", label: "Business & Finance", icon: "📈", desc: "Startups, strategy, money" },
  { id: "roasting", label: "Roast Mode 🔥", icon: "😈", desc: "Brutal honesty & savage energy" },
  { id: "science", label: "Science & Space", icon: "🔬", desc: "Physics, biology, cosmos" },
  { id: "nba", label: "NBA Basketball", icon: "🏀", desc: "Players, teams, playoff stats" },
  { id: "relationships", label: "Relationships & Life", icon: "❤️", desc: "Love, friendships, choices" },
  { id: "custom", label: "Custom Topic", icon: "✨", desc: "Define your own universe" },
];

const PERSONALITIES = [
  { id: "casual", label: "Chill & Casual", sub: "Relaxed, like a friend" },
  { id: "humorous", label: "Witty & Funny", sub: "Dark humor welcome" },
  { id: "savage", label: "Savage & Blunt", sub: "Zero filter, max honesty" },
  { id: "professional", label: "Professional", sub: "Sharp, precise, expert" },
  { id: "academic", label: "Deep & Academic", sub: "Research-grade knowledge" },
];

const STYLES = [
  { id: "short", label: "Short & Punchy" },
  { id: "detailed", label: "Detailed & Thorough" },
  { id: "conversational", label: "Conversational" },
  { id: "bullets", label: "Lists & Structured" },
];

const buildSystemPrompt = (config) => {
  const topicName = config.topic === "custom"
    ? config.customTopic
    : TOPICS.find((t) => t.id === config.topic)?.label;

  const personalityMap = {
    casual: "You are relaxed, conversational, talk like a close friend. No stiff language.",
    humorous: "You are naturally funny with sharp wit, unexpected angles, occasional dark humor. Make people laugh while being genuinely helpful.",
    savage: "You are brutally honest, zero filter, savage energy. You call things out directly. No sugarcoating. AGI-tier confidence.",
    professional: "You are sharp, precise, expert-level. Every response is well-structured and authoritative.",
    academic: "You go extremely deep. You cite concepts, reference research, use proper terminology, genuinely expand knowledge.",
  };

  const styleMap = {
    short: "Keep responses SHORT and punchy. Max 3-4 sentences unless depth is truly needed.",
    detailed: "Give THOROUGH, comprehensive responses. Cover all angles. Don't leave things unexplained.",
    conversational: "Be conversational. Flow naturally like a real dialogue. Match the energy of the user.",
    bullets: "Structure answers with clear lists, bullet points, and organized sections when helpful.",
  };

  return `You are ${config.name || "Nuvex"}, a hyper-specialized AI built for ONE thing: ${topicName}.

IDENTITY:
- Personality: ${personalityMap[config.personality]}
- Style: ${styleMap[config.style]}
- You have VAST expert knowledge about: ${topicName}
- Use web search for current facts, stats, and news
- Reference earlier messages naturally — you have full memory of this conversation

RULES:
1. ONLY discuss ${topicName}. Anything else — redirect with personality.
2. Be genuinely useful and accurate
3. Don't mention being an AI unless directly asked

You are the BEST at ${topicName}. Own it.`;
};

function usePWAInstall() {
  const [prompt, setPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const metas = [
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Nuvex" },
      { name: "theme-color", content: "#080808" },
    ];
    metas.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement("meta");
        m.name = name; m.content = content;
        document.head.appendChild(m);
      }
    });
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setPrompt(null);
  }, [prompt]);

  return { canInstall: !!prompt && !isInstalled, isInstalled, install };
}

function Avatar({ topic, size = 32 }) {
  const icon = TOPICS.find((t) => t.id === topic)?.icon || "N";
  return (
    <div style={{
      width: size, height: size,
      background: "#141414",
      border: "1px solid #252525",
      borderRadius: Math.round(size * 0.28),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontSize: size * 0.48, lineHeight: 1,
    }}>
      {icon}
    </div>
  );
}

function TopicPill({ label }) {
  return (
    <span style={{
      fontSize: 11, fontFamily: "sans-serif",
      color: "#3a3a3a", display: "inline-block",
      letterSpacing: 0.2, lineHeight: 1,
    }}>
      {label}
    </span>
  );
}

const appStyle = {
  minHeight: "100vh", background: "#080808", color: "#FFFFFF",
  fontFamily: "'Georgia', 'Times New Roman', serif",
  position: "relative", overflow: "hidden",
};

const gridStyle = {
  position: "fixed", inset: 0,
  backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
  backgroundSize: "40px 40px", pointerEvents: "none", zIndex: 0,
};

function SetupScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState({ name: "", topic: "", customTopic: "", personality: "humorous", style: "conversational" });

  const canNext =
    step === 1 ? config.name.trim().length > 0
    : step === 2 ? config.topic && (config.topic !== "custom" || config.customTopic.trim())
    : step === 3 ? !!config.personality
    : !!config.style;

  return (
    <div style={{ ...appStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px 18px" }}>
      <div style={gridStyle} />
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 520 }}>

        {/* Brand header */}
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "#383838", letterSpacing: 6, textTransform: "uppercase", marginBottom: 12 }}>
            ✦ Intelligence, Defined ✦
          </div>
          <h1 style={{ fontSize: "clamp(52px, 13vw, 80px)", fontStyle: "italic", fontWeight: 900, margin: 0, lineHeight: 0.9, color: "#FFFFFF", letterSpacing: "-2px" }}>
            Nuvex
          </h1>
          <p style={{ color: "#383838", fontSize: 11, marginTop: 12, fontFamily: "sans-serif", letterSpacing: 3, textTransform: "uppercase" }}>
            Your AI. One Mind. One Mission.
          </p>
          <p style={{ color: "#282828", fontSize: 11, marginTop: 6, fontFamily: "monospace" }}>
            Founded by <span style={{ color: "#555", fontStyle: "italic" }}>Karamba Zelany</span>
          </p>
          <p style={{ color: "#2a2a2a", fontSize: 12, marginTop: 10, fontFamily: "sans-serif" }}>
            Don't worry, there are no Ads 😉
          </p>
        </div>

        {/* Step progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, justifyContent: "center" }}>
          {[1,2,3,4].map((n) => (
            <div key={n} style={{ height: 2, width: 42, borderRadius: 2, background: n <= step ? "#FFFFFF" : "#181818", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Step card */}
        <div style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderRadius: 14, padding: "26px 20px" }}>

          {step === 1 && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontFamily: "monospace", color: "#444", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>01 — Name Your AI</label>
              <input autoFocus value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && canNext && setStep(2)}
                placeholder='e.g. "Sage", "Coach", "The Roaster"'
                style={{ width: "100%", background: "#080808", border: "1px solid #222", borderRadius: 8, padding: "14px 15px", color: "#FFFFFF", fontSize: 18, fontStyle: "italic", fontWeight: 700, outline: "none", boxSizing: "border-box", fontFamily: "Georgia, serif" }}
              />
              <p style={{ color: "#282828", fontSize: 12, marginTop: 8, fontFamily: "sans-serif" }}>This is what your AI will be called</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontFamily: "monospace", color: "#444", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>02 — Pick One Topic</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {TOPICS.map((t) => (
                  <button key={t.id} onClick={() => setConfig({ ...config, topic: t.id })}
                    style={{ background: config.topic === t.id ? "#141414" : "#090909", border: `1px solid ${config.topic === t.id ? "#303030" : "#141414"}`, borderRadius: 8, padding: "11px 12px", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 16, marginBottom: 3 }}>{t.icon}</div>
                    <div style={{ color: config.topic === t.id ? "#FFFFFF" : "#666", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic" }}>{t.label}</div>
                    <div style={{ color: "#2e2e2e", fontSize: 10, fontFamily: "sans-serif", marginTop: 2 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
              {config.topic === "custom" && (
                <input autoFocus value={config.customTopic}
                  onChange={(e) => setConfig({ ...config, customTopic: e.target.value })}
                  placeholder="What topic? Be specific..."
                  style={{ marginTop: 10, width: "100%", background: "#080808", border: "1px solid #252525", borderRadius: 8, padding: "12px 15px", color: "#FFFFFF", fontSize: 15, fontStyle: "italic", outline: "none", boxSizing: "border-box", fontFamily: "Georgia, serif" }}
                />
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontFamily: "monospace", color: "#444", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>03 — Personality</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {PERSONALITIES.map((p) => (
                  <button key={p.id} onClick={() => setConfig({ ...config, personality: p.id })}
                    style={{ background: config.personality === p.id ? "#141414" : "#090909", border: `1px solid ${config.personality === p.id ? "#303030" : "#141414"}`, borderRadius: 8, padding: "13px 15px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: config.personality === p.id ? "#FFFFFF" : "#666", fontSize: 14, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic" }}>{p.label}</div>
                      <div style={{ color: "#383838", fontSize: 12, fontFamily: "sans-serif" }}>{p.sub}</div>
                    </div>
                    {config.personality === p.id && <span style={{ color: "#FFFFFF", fontSize: 15 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <label style={{ display: "block", fontSize: 10, fontFamily: "monospace", color: "#444", letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>04 — Response Style</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 22 }}>
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setConfig({ ...config, style: s.id })}
                    style={{ background: config.style === s.id ? "#141414" : "#090909", border: `1px solid ${config.style === s.id ? "#303030" : "#141414"}`, borderRadius: 8, padding: "16px", cursor: "pointer", color: config.style === s.id ? "#FFFFFF" : "#444", fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div style={{ background: "#080808", border: "1px solid #181818", borderRadius: 8, padding: 13 }}>
                <div style={{ fontSize: 10, color: "#333", fontFamily: "sans-serif", marginBottom: 7, letterSpacing: 2, textTransform: "uppercase" }}>Your AI</div>
                <div style={{ color: "#bbb", fontSize: 14, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.6 }}>
                  <span style={{ color: "#FFFFFF", fontWeight: 700 }}>{config.name}</span> · {config.topic === "custom" ? config.customTopic : TOPICS.find((t) => t.id === config.topic)?.label} · {PERSONALITIES.find((p) => p.id === config.personality)?.label}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}
              style={{ flex: 1, background: "transparent", border: "1px solid #1a1a1a", borderRadius: 8, padding: 14, color: "#444", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}>
              ← Back
            </button>
          )}
          <button onClick={() => step < 4 ? setStep(step + 1) : canNext && onDone(config)}
            disabled={!canNext}
            style={{ flex: 2, background: canNext ? "#FFFFFF" : "#0e0e0e", border: "none", borderRadius: 8, padding: 14, color: canNext ? "#080808" : "#282828", fontSize: 15, fontWeight: 900, fontStyle: "italic", cursor: canNext ? "pointer" : "not-allowed", fontFamily: "Georgia, serif", transition: "all 0.2s" }}>
            {step < 4 ? "Continue →" : `Launch ${config.name || "Nuvex"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ config, onReset }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { canInstall, isInstalled, install } = usePWAInstall();

  const topicLabel = config.topic === "custom"
    ? config.customTopic
    : TOPICS.find((t) => t.id === config.topic)?.label;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  useEffect(() => {
    if (messages.length === 2 && !canInstall && !isInstalled) {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      if (isIOS) setShowIOSHint(true);
    }
  }, [messages.length, canInstall, isInstalled]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    setSearching(false);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: buildSystemPrompt(config),
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      let aiText = "";
      if (data.content) {
        if (data.content.some((b) => b.type === "tool_use" && b.name === "web_search")) setSearching(true);
        aiText = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      }
      if (!aiText && data.error) aiText = `Error: ${data.error.message}`;
      setMessages([...newMessages, { role: "assistant", content: aiText || "..." }]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: `Connection error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setSearching(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, loading, config]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ ...appStyle, display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={gridStyle} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 2, borderBottom: "1px solid #141414", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,10,0.98)", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Avatar topic={config.topic} size={36} />
          <div>
            <div style={{ fontStyle: "italic", fontWeight: 900, fontSize: 17, color: "#FFFFFF", fontFamily: "Georgia, serif", lineHeight: 1.1 }}>{config.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, background: "#2ecc71", borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
              <TopicPill label={topicLabel} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {canInstall && (
            <button onClick={install}
              style={{ background: "#111", border: "1px solid #222", borderRadius: 7, padding: "6px 12px", color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
              ⊕ Home Screen
            </button>
          )}
          <button onClick={onReset}
            style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 7, padding: "6px 12px", color: "#444", fontSize: 12, cursor: "pointer", fontFamily: "sans-serif" }}>
            Reset
          </button>
        </div>
      </div>

      {/* iOS Home Screen hint banner */}
      {showIOSHint && (
        <div style={{ position: "relative", zIndex: 2, background: "#0c0c0c", borderBottom: "1px solid #181818", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic" }}>📲 Add Nuvex to Home Screen</div>
            <div style={{ color: "#444", fontSize: 11, fontFamily: "sans-serif", marginTop: 2 }}>Tap Share ( ↑ ) → "Add to Home Screen" for app-like access</div>
          </div>
          <button onClick={() => setShowIOSHint(false)}
            style={{ background: "transparent", border: "none", color: "#333", fontSize: 17, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
      )}

      {/* Android/Chrome install banner */}
      {canInstall && messages.length >= 1 && (
        <div style={{ position: "relative", zIndex: 2, background: "#0c0c0c", borderBottom: "1px solid #181818", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, fontFamily: "Georgia, serif", fontStyle: "italic" }}>Add Nuvex to your Home Screen</div>
            <div style={{ color: "#444", fontSize: 11, fontFamily: "sans-serif", marginTop: 2 }}>Access like a real app — no store, no download</div>
          </div>
          <button onClick={() => { install(); }}
            style={{ background: "#FFFFFF", border: "none", borderRadius: 6, padding: "7px 14px", color: "#080808", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "sans-serif" }}>
            Add
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 13px", display: "flex", flexDirection: "column", gap: 13, position: "relative", zIndex: 1 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 18px" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>{TOPICS.find((t) => t.id === config.topic)?.icon || "★"}</div>
            <h2 style={{ fontStyle: "italic", fontWeight: 900, fontSize: 21, margin: "0 0 8px", color: "#FFFFFF", fontFamily: "Georgia, serif" }}>
              {config.name} is live.
            </h2>
            <p style={{ color: "#383838", fontSize: 14, fontFamily: "sans-serif", maxWidth: 270, lineHeight: 1.6 }}>
              Ask anything about <span style={{ color: "#888" }}>{topicLabel}</span>. Nothing else.
            </p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "center", marginTop: 18 }}>
              {[
                config.topic === "football" ? "Who is the best player right now?" : null,
                config.topic === "coding" ? "Explain embeddings simply" : null,
                config.topic === "roasting" ? "Roast my life choices" : null,
                config.topic === "therapy" ? "I've been feeling off lately" : null,
                config.topic === "nba" ? "Who wins MVP this year?" : null,
                config.topic === "business" ? "How do I get my first 100 customers?" : null,
                config.topic === "science" ? "Explain dark matter" : null,
                `What's something wild about ${topicLabel}?`,
              ].filter(Boolean).slice(0, 3).map((q, i) => (
                <button key={i} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderRadius: 20, padding: "8px 13px", color: "#555", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-end" }}>
            {msg.role === "assistant" && <Avatar topic={config.topic} size={27} />}
            <div style={{ maxWidth: "78%" }}>
              {msg.role === "assistant" && (
                <div style={{ fontSize: 10, color: "#2e2e2e", fontFamily: "monospace", marginBottom: 4, letterSpacing: 1 }}>{config.name?.toUpperCase()}</div>
              )}
              <div style={{
                background: msg.role === "user" ? "#161616" : "#0d0d0d",
                border: `1px solid ${msg.role === "user" ? "#272727" : "#181818"}`,
                borderRadius: msg.role === "user" ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                padding: "11px 14px",
                color: "#FFFFFF",
                fontSize: 15,
                lineHeight: 1.65,
                fontFamily: "Georgia, serif",
                fontWeight: msg.role === "user" ? 700 : 400,
                fontStyle: msg.role === "user" ? "italic" : "normal",
                whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <Avatar topic={config.topic} size={27} />
            <div style={{ background: "#0d0d0d", border: "1px solid #181818", borderRadius: "13px 13px 13px 3px", padding: "13px 16px" }}>
              {searching
                ? <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace", letterSpacing: 1 }}>◈ searching...</span>
                : <span style={{ display: "inline-flex", gap: 5 }}>
                    {[0,1,2].map((n) => (
                      <span key={n} style={{ width: 6, height: 6, background: "#333", borderRadius: "50%", display: "inline-block", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${n * 0.2}s` }} />
                    ))}
                  </span>
              }
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ position: "relative", zIndex: 2, borderTop: "1px solid #141414", padding: "11px 13px 13px", background: "rgba(8,8,8,0.98)" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 800, margin: "0 auto" }}>
          <textarea ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Ask ${config.name}...`}
            rows={1}
            style={{ flex: 1, background: "#0c0c0c", border: "1px solid #1c1c1c", borderRadius: 10, padding: "12px 14px", color: "#FFFFFF", fontSize: 15, resize: "none", outline: "none", fontFamily: "Georgia, serif", fontStyle: "italic", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
            onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? "#FFFFFF" : "#0e0e0e", border: "1px solid #1c1c1c", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", flexShrink: 0, transition: "background 0.15s", transform: "none" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke={input.trim() && !loading ? "#080808" : "#2a2a2a"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "#1e1e1e", fontFamily: "monospace", letterSpacing: 1 }}>
          NUVEX · POWERED BY CLAUDE · ENTER TO SEND
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#080808}
        ::-webkit-scrollbar-thumb{background:#1c1c1c;border-radius:2px}
        textarea::placeholder{color:#282828}
        input::placeholder{color:#282828}
      `}</style>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  if (!config) return <SetupScreen onDone={setConfig} />;
  return <ChatScreen config={config} onReset={() => setConfig(null)} />;
}
