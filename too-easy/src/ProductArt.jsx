import { useId } from "react";

// Drawings of the real Too Easy pieces (brushed smiley logo, Liberian Jue ringer baby tees).
// Replace with the brand's own product photos by giving a product an `image`.

const TEE = "M62 38 L82 28 Q100 42 118 28 L138 38 L172 64 L154 88 L140 78 L140 172 L60 172 L60 78 L46 88 L28 64 Z";
const TANK = "M74 28 Q100 50 126 28 L134 30 Q130 62 144 80 L144 172 L56 172 L56 80 Q70 62 66 30 Z";
const SLEEVELESS = "M62 34 L82 26 Q100 42 118 26 L138 34 Q134 62 146 82 L146 172 L54 172 L54 82 Q66 62 62 34 Z";
const JUE = (bottom) =>
  `M66 36 L84 28 Q100 40 116 28 L134 36 L160 58 L148 76 L136 68 L136 ${bottom} L64 ${bottom} L64 68 L52 76 L40 58 Z`;

// The brushed "TOO EASY" smiley mark. (cx, cy) is its centre, s its scale (1 ≈ 60px wide).
function Smiley({ cx, cy, s = 1, fill }) {
  const font = "'Permanent Marker', 'Marker Felt', cursive";
  return (
    <g fill={fill}>
      <path d={`M${cx - 27 * s} ${cy - 13 * s} l${5 * s} ${-9 * s} M${cx - 21 * s} ${cy - 11 * s} l${5 * s} ${-9 * s}`}
        stroke={fill} strokeWidth={2.4 * s} strokeLinecap="round" />
      <text x={cx + 3 * s} y={cy - 4 * s} fontFamily={font} fontSize={15 * s} textAnchor="middle"
        transform={`rotate(-6 ${cx} ${cy})`}>TOO</text>
      <text x={cx + 1 * s} y={cy + 14 * s} fontFamily={font} fontSize={19 * s} textAnchor="middle" letterSpacing={1.5 * s}
        transform={`rotate(-3 ${cx} ${cy})`}>EASY</text>
      <path d={`M${cx - 28 * s} ${cy + 15 * s} Q${cx} ${cy + 40 * s} ${cx + 28 * s} ${cy + 12 * s}
                Q${cx + 2 * s} ${cy + 30 * s} ${cx - 28 * s} ${cy + 15 * s} Z`} />
    </g>
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

function JueTee({ art, clip, outline }) {
  const { base, yoke, stripe, script, outline: scriptOutline, full } = art;
  const bottom = full ? 166 : 132;
  const path = JUE(bottom);
  const scriptFont = "'Yellowtail', 'Brush Script MT', cursive";
  return (
    <g>
      <clipPath id={clip}><path d={path} /></clipPath>
      <path d={path} fill={base} />
      <g clipPath={`url(#${clip})`}>
        {/* contrast shoulder yoke with two thin stripes under it */}
        <path d="M0 0 H200 V62 Q100 70 0 62 Z" fill={yoke} />
        <path d="M0 64 Q100 72 200 64" stroke={stripe} strokeWidth="2.6" fill="none" />
        <path d="M0 69 Q100 77 200 69" stroke={stripe} strokeWidth="2.6" fill="none" />
        {/* striped sleeve hems */}
        <path d="M43 61 L54 77 M47 58 L57 73" stroke={stripe === yoke ? base : stripe} strokeWidth="2.2" />
        <path d="M157 61 L146 77 M153 58 L143 73" stroke={stripe === yoke ? base : stripe} strokeWidth="2.2" />
      </g>
      <path d={path} fill="none" stroke={outline} strokeWidth="1.5" />
      <path d="M84 28 Q100 44 116 28" fill="none" stroke={stripe === yoke ? base : stripe} strokeWidth="3.5" />
      <g fontFamily={scriptFont} fill={script} stroke={scriptOutline} strokeWidth="1.1" paintOrder="stroke"
        transform="rotate(-7 100 100)">
        <text x="94" y="98" fontSize="21" textAnchor="middle">Liberian</text>
        <text x="106" y="118" fontSize="24" textAnchor="middle">Jue</text>
      </g>
      <path d="M78 116 Q104 128 132 104 Q108 122 80 114 Z" fill={script} stroke={scriptOutline} strokeWidth="0.8" />
      <Star cx={128} cy={84} r={3.6} fill={base === "#FFFFFF" ? "#1B2A5C" : "#FFFFFF"} />
      <Smiley cx={124} cy={bottom - 12} s={0.18} fill={scriptOutline === base ? script : scriptOutline} />
    </g>
  );
}

export default function ProductArt({ product, size = "100%" }) {
  const clip = useId();
  if (product.image) {
    return <img src={product.image} alt={`${product.name} — ${product.color}`} style={{ width: size, aspectRatio: "1", objectFit: "cover" }} />;
  }
  const { art } = product;
  const light = art.base === "#F7F6F2";
  const outline = light ? "#D6D6D0" : "rgba(0,0,0,0.25)";

  return (
    <svg viewBox="0 0 200 200" width={size} role="img" aria-label={`${product.name} — ${product.color}`}>
      {art.kind === "tee" && (
        <g>
          <path d={TEE} fill={art.base} stroke={outline} strokeWidth="1.5" />
          <path d="M82 28 Q100 46 118 28" fill="none" stroke={outline} strokeWidth="2" />
          {art.logo === "chest"
            ? <Smiley cx={100} cy={72} s={0.42} fill={art.ink} />
            : <Smiley cx={100} cy={92} s={1.3} fill={art.ink} />}
        </g>
      )}

      {(art.kind === "tank" || art.kind === "sleeveless") && (
        <g>
          <path d={art.kind === "tank" ? TANK : SLEEVELESS} fill={art.base} stroke={outline} strokeWidth="1.5" />
          <path d={art.kind === "tank" ? "M74 28 Q100 50 126 28" : "M82 26 Q100 44 118 26"} fill="none" stroke={outline} strokeWidth="2" />
          <Smiley cx={100} cy={100} s={0.95} fill={art.ink} />
        </g>
      )}

      {art.kind === "jue" && <JueTee art={art} clip={clip} outline={outline} />}

      {art.kind === "cap" && (
        <g>
          <path d="M44 120 Q46 58 100 54 Q154 58 156 120 Z" fill={art.base} stroke={outline} strokeWidth="1.5" />
          <path d="M40 120 L160 120 Q176 122 184 136 L60 136 Q44 134 40 120 Z" fill={art.base} stroke={outline} strokeWidth="1.5" />
          <circle cx="100" cy="56" r="4" fill={art.base} stroke={outline} />
          <Smiley cx={100} cy={88} s={0.62} fill={art.ink} />
        </g>
      )}

      {art.kind === "tote" && (
        <g>
          <path d="M66 74 Q64 22 100 22 Q136 22 134 74" fill="none" stroke={art.base} strokeWidth="8" />
          <path d="M48 72 L152 72 L158 180 L42 180 Z" fill={art.base} />
          <rect x="70" y="150" width="34" height="13" rx="1.5" fill={art.ink} />
          <text x="87" y="159" fontSize="6.5" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fill="#111">too easy</text>
        </g>
      )}
    </svg>
  );
}
