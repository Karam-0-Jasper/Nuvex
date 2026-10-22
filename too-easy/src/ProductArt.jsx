import { useId } from "react";

// Drawn stand-ins for product photos. Replace with real shots by giving a product an `image`.

const TEE = "M62 38 L82 28 Q100 42 118 28 L138 38 L172 64 L154 88 L140 78 L140 172 L60 172 L60 78 L46 88 L28 64 Z";
const CROP = "M62 38 L82 28 Q100 42 118 28 L138 38 L172 64 L154 88 L140 78 L140 122 L60 122 L60 78 L46 88 L28 64 Z";
const SET_TOP = "M70 22 L86 14 Q100 25 114 14 L130 22 L156 42 L142 60 L132 52 L132 112 L68 112 L68 52 L58 60 L44 42 Z";
const SHORTS = "M68 120 L132 120 L138 182 L106 182 L100 146 L94 182 L62 182 Z";

function Wordmark({ x, y, size, fill }) {
  return (
    <text
      x={x} y={y} fill={fill} textAnchor="middle"
      fontFamily="'Archivo Black', 'Arial Black', sans-serif"
      fontSize={size} letterSpacing="1"
    >
      <tspan x={x} dy="0">TOO</tspan>
      <tspan x={x} dy={size * 0.95}>EASY</tspan>
    </text>
  );
}

function Star({ cx, cy, r, fill }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r * 0.4 : r;
    return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
  });
  return <polygon points={pts.join(" ")} fill={fill} />;
}

export default function ProductArt({ product, size = "100%" }) {
  const clip = useId();
  if (product.image) {
    return <img src={product.image} alt={`${product.name} — ${product.color}`} style={{ width: size, aspectRatio: "1", objectFit: "cover" }} />;
  }
  const { kind, base, ink, star, stripes, shorts } = product.art;
  const outline = base === "#F4F4F0" ? "#D6D6D0" : "rgba(0,0,0,0.25)";

  return (
    <svg viewBox="0 0 200 200" width={size} role="img" aria-label={`${product.name} — ${product.color}`}>
      {kind === "cap" && (
        <g>
          <path d="M44 120 Q46 58 100 54 Q154 58 156 120 Z" fill={base} stroke={outline} strokeWidth="1.5" />
          <path d="M40 120 L160 120 Q176 122 184 136 L60 136 Q44 134 40 120 Z" fill={base} stroke={outline} strokeWidth="1.5" />
          <path d="M100 56 L100 120" stroke={outline} strokeWidth="1" />
          <circle cx="100" cy="56" r="4" fill={base} stroke={outline} />
          <Wordmark x={100} y={90} size={15} fill={ink} />
        </g>
      )}

      {(kind === "tee" || kind === "crop") && (
        <g>
          <clipPath id={clip}><path d={kind === "tee" ? TEE : CROP} /></clipPath>
          <path d={kind === "tee" ? TEE : CROP} fill={base} stroke={outline} strokeWidth="1.5" />
          {stripes && (
            <g clipPath={`url(#${clip})`}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <rect key={i} x="0" y={44 + i * 14} width="200" height="7" fill={ink} opacity="0.9" />
              ))}
            </g>
          )}
          <path d="M82 28 Q100 46 118 28" fill="none" stroke={outline} strokeWidth="2" />
          {star ? (
            <>
              <Star cx={100} cy={kind === "tee" ? 82 : 70} r={16} fill={ink} />
              {kind === "tee" && <Wordmark x={100} y={118} size={17} fill={ink} />}
            </>
          ) : stripes ? (
            <rect x="70" y="60" width="60" height="44" fill={base} />
          ) : (
            <Wordmark x={100} y={kind === "tee" ? 90 : 72} size={kind === "tee" ? 22 : 18} fill={ink} />
          )}
          {stripes && <Wordmark x={100} y={78} size={14} fill={ink} />}
        </g>
      )}

      {kind === "set" && (
        <g>
          <path d={SET_TOP} fill={base} stroke={outline} strokeWidth="1.5" />
          <path d="M86 14 Q100 30 114 14" fill="none" stroke={outline} strokeWidth="2" />
          <Wordmark x={100} y={60} size={15} fill={ink} />
          <path d={SHORTS} fill={shorts} stroke={outline} strokeWidth="1.5" />
          <Star cx={120} cy={168} r={7} fill={ink} />
        </g>
      )}
    </svg>
  );
}
