// Product catalog, matched to Too Easy pieces seen in press photos (OkayAfrica, FrontPageAfrica,
// Liberian Investigator): the brushed smiley "TOO EASY" logo on tees and tanks, the Liberian Jue
// ringer baby tees, and the black tote. Caps are mentioned in coverage but not pictured, so the
// cap drawing is a best guess.
//
// TODO before launch: real prices (USD) and real stock counts. The numbers below are samples.
// `art` picks the drawing in ProductArt.jsx; use the brand's own photo by setting `image: "/photos/x.jpg"`.

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "tees", label: "Tees" },
  { id: "jue", label: "Liberian Jue" },
  { id: "tanks", label: "Tanks" },
  { id: "accessories", label: "Caps & Bags" },
  { id: "kids", label: "Kids" },
];

export const ADULT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];
const KIDS_SIZES = ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-12Y"];

// Stock counts per size, in the same order as the size list.
const stock = (sizes, counts) => Object.fromEntries(sizes.map((s, i) => [s, counts[i]]));

export const PRODUCTS = [
  {
    id: "smiley-tee-white",
    name: "Smiley Logo Tee",
    color: "White / Maroon",
    category: "tees",
    price: 20,
    art: { kind: "tee", base: "#F7F6F2", ink: "#6E1F45", logo: "large" },
    stock: stock(ADULT_SIZES, [6, 9, 4, 2, 0, 1]),
    badge: "Signature",
    desc: "The original. White tee with the big brushed TOO EASY smiley across the chest.",
  },
  {
    id: "smiley-tee-blue",
    name: "Smiley Logo Tee",
    color: "Royal Blue / Black",
    category: "tees",
    price: 20,
    art: { kind: "tee", base: "#2E6AD1", ink: "#0B0B0B", logo: "chest" },
    stock: stock(ADULT_SIZES, [3, 7, 5, 4, 2, 0]),
    desc: "Royal blue tee with a small black smiley logo on the chest.",
  },
  {
    id: "smiley-tank-navy",
    name: "Smiley Tank",
    color: "Navy / White",
    category: "tanks",
    price: 18,
    art: { kind: "tank", base: "#1C2E6B", ink: "#FFFFFF" },
    stock: stock(ADULT_SIZES, [5, 6, 3, 1, 0, 0]),
    desc: "Navy racer tank with the white smiley logo.",
  },
  {
    id: "smiley-sleeveless-white",
    name: "Smiley Sleeveless Tee",
    color: "White / Gold",
    category: "tanks",
    price: 18,
    art: { kind: "sleeveless", base: "#F7F6F2", ink: "#C9A227" },
    stock: stock(ADULT_SIZES, [2, 4, 4, 3, 1, 0]),
    desc: "Cut-off sleeveless tee in white with a gold smiley logo.",
  },
  {
    id: "jue-baby-tee-red",
    name: "Liberian Jue Baby Tee",
    color: "Red / Navy",
    category: "jue",
    price: 22,
    art: { kind: "jue", base: "#D7262E", yoke: "#1B2A5C", stripe: "#FFFFFF", script: "#1B2A5C", outline: "#FFFFFF" },
    stock: stock(ADULT_SIZES, [4, 2, 1, 0, 3, 1]),
    badge: "Jue Drop",
    desc: "Fitted ringer crop from the Independence Day Liberian Jue collection. Navy shoulders, white stripes, \"Liberian Jue\" script with the lone star.",
  },
  {
    id: "jue-baby-tee-navy",
    name: "Liberian Jue Baby Tee",
    color: "Navy / White / Red",
    category: "jue",
    price: 22,
    art: { kind: "jue", base: "#1B2A5C", yoke: "#FFFFFF", stripe: "#D7262E", script: "#D7262E", outline: "#FFFFFF" },
    stock: stock(ADULT_SIZES, [3, 5, 2, 2, 0, 0]),
    badge: "Jue Drop",
    desc: "Navy body, white shoulders, red stripes and red \"Liberian Jue\" script.",
  },
  {
    id: "jue-baby-tee-black",
    name: "Liberian Jue Baby Tee",
    color: "Black / White",
    category: "jue",
    price: 22,
    art: { kind: "jue", base: "#111111", yoke: "#FFFFFF", stripe: "#111111", script: "#FFFFFF", outline: "#111111" },
    stock: stock(ADULT_SIZES, [1, 3, 3, 0, 1, 2]),
    badge: "Jue Drop",
    desc: "Black body, white shoulders, white \"Liberian Jue\" script.",
  },
  {
    id: "jue-kids-tee-red",
    name: "Kids Liberian Jue Tee",
    color: "Red / Navy",
    category: "kids",
    price: 15,
    sizes: KIDS_SIZES,
    art: { kind: "jue", base: "#D7262E", yoke: "#1B2A5C", stripe: "#FFFFFF", script: "#1B2A5C", outline: "#FFFFFF", full: true },
    stock: stock(KIDS_SIZES, [3, 4, 2, 0, 1]),
    desc: "The Jue ringer in kids' sizes, full length, so the whole family can match on July 26.",
  },
  {
    id: "cap-black",
    name: "Too Easy Cap",
    color: "Black / White",
    category: "accessories",
    price: 15,
    sizes: ["One size"],
    art: { kind: "cap", base: "#111111", ink: "#FFFFFF" },
    stock: { "One size": 12 },
    desc: "Six-panel cap with the smiley logo, adjustable strap.",
  },
  {
    id: "tote-black",
    name: "Too Easy Tote",
    color: "Black",
    category: "accessories",
    price: 12,
    sizes: ["One size"],
    art: { kind: "tote", base: "#141414", ink: "#FFFFFF" },
    stock: { "One size": 3 },
    desc: "Black canvas shoulder tote with the woven \"too easy\" label.",
  },
];

// Every adult garment uses S–3XL unless it sets its own sizes.
for (const p of PRODUCTS) p.sizes ??= ADULT_SIZES;

export const LOW_STOCK = 3;
export const totalStock = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0);
