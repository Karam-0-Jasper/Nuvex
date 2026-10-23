// Product catalog, built from Too Easy's own product photos (public/photos/).
// TODO before launch: real prices (USD) and real stock counts. The numbers below are samples.
// Stock is one number per size, in the order of that product's size list.
// To add a product: drop a 3:4 photo in public/photos/ (and a 480px copy in public/photos/thumbs/),
// then add a line below.

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "smiley", label: "Smiley Tees" },
  { id: "raglan", label: "Raglans" },
  { id: "graphic", label: "Graphic Tees" },
  { id: "bags", label: "Bags" },
];

export const ADULT_SIZES = ["S", "M", "L", "XL", "XXL", "3XL"];
const ONE_SIZE = ["One size"];

const FAMILIES = {
  smiley: { name: "Smiley Logo Tee", category: "smiley", price: 20, sizes: ADULT_SIZES,
    desc: "Classic crew-neck tee with the brushed TOO EASY smiley printed big across the chest." },
  smileyWhite: { name: "Smiley Tee — White Edition", category: "smiley", price: 20, sizes: ADULT_SIZES,
    desc: "Crisp white tee with the smiley logo in a colour of your choice." },
  smileyBlack: { name: "Smiley Tee — Black Edition", category: "smiley", price: 20, sizes: ADULT_SIZES,
    desc: "Black tee with the smiley logo in a colour of your choice." },
  raglan: { name: "Raglan Smiley Tee", category: "raglan", price: 22, sizes: ADULT_SIZES,
    desc: "Two-tone raglan tee with contrast sleeves and collar, smiley logo on the chest." },
  bubble: { name: "Bubble Logo Tee", category: "graphic", price: 25, sizes: ADULT_SIZES, views: ["Back", "Front"],
    desc: "Small bubble-letter TOO EASY on the chest and a giant multicolour bubble logo across the back." },
  dope: { name: "Trust Your Dopeness Tee", category: "graphic", price: 25, sizes: ADULT_SIZES, views: ["Back", "Front"],
    desc: "Small \"too· easy\" on the chest and the full \"Trust Your Dopeness\" graffiti piece on the back." },
  tote: { name: "Utility Tote", category: "bags", price: 30, sizes: ONE_SIZE,
    desc: "Canvas utility tote with two front cargo pockets, top handles, a shoulder strap and the oval \"too easy\" logo." },
};

// [family, id, colour, [body, accent] swatch, photos, stock per size]
const VARIANTS = [
  // Smiley Logo Tee
  ["smiley", "smiley-red", "Red / White", ["#C8102E", "#FFFFFF"], ["smiley-red"], [4, 7, 1, 0, 8, 0]],
  ["smiley", "smiley-cream", "Cream / Black", ["#E9DCC0", "#111111"], ["smiley-cream"], [9, 7, 7, 4, 1, 4]],
  ["smiley", "smiley-maroon", "Maroon / White", ["#7A1424", "#FFFFFF"], ["smiley-maroon"], [0, 8, 7, 1, 0, 9]],
  ["smiley", "smiley-royal-blue", "Royal Blue / White", ["#0F4C9A", "#FFFFFF"], ["smiley-royal-blue"], [9, 0, 0, 9, 6, 7]],
  ["smiley", "smiley-brown", "Brown / White", ["#4A2E22", "#FFFFFF"], ["smiley-brown"], [4, 0, 4, 7, 9, 2]],
  ["smiley", "smiley-orange", "Orange / White", ["#F05A22", "#FFFFFF"], ["smiley-orange"], [0, 1, 0, 2, 6, 0]],
  ["smiley", "smiley-gold", "Gold / Black", ["#F5B416", "#111111"], ["smiley-gold"], [7, 2, 0, 0, 2, 5]],
  ["smiley", "smiley-grey", "Grey / Black", ["#A9AAAD", "#111111"], ["smiley-grey"], [7, 8, 1, 3, 9, 0]],
  ["smiley", "smiley-turquoise", "Turquoise / White", ["#1AA3D3", "#FFFFFF"], ["smiley-turquoise"], [8, 0, 1, 7, 0, 3]],
  ["smiley", "smiley-bottle-green", "Bottle Green / White", ["#10302A", "#FFFFFF"], ["smiley-bottle-green"], [0, 2, 0, 1, 7, 5]],
  ["smiley", "smiley-olive", "Olive / White", ["#4F5320", "#FFFFFF"], ["smiley-olive"], [6, 9, 1, 0, 8, 4]],
  // Smiley Tee — White Edition
  ["smileyWhite", "smiley-white-red", "White / Red", ["#FFFFFF", "#B0172F"], ["smiley-white-red"], [0, 7, 6, 9, 2, 1]],
  ["smileyWhite", "smiley-white-orange", "White / Orange", ["#FFFFFF", "#F2793A"], ["smiley-white-orange"], [0, 6, 0, 7, 8, 9]],
  ["smileyWhite", "smiley-white-green", "White / Green", ["#FFFFFF", "#1F5E3B"], ["smiley-white-green"], [2, 0, 2, 0, 1, 9]],
  ["smileyWhite", "smiley-white-yellow", "White / Yellow", ["#FFFFFF", "#F2C315"], ["smiley-white-yellow"], [3, 1, 0, 2, 4, 4]],
  ["smileyWhite", "smiley-white-gold", "White / Gold", ["#FFFFFF", "#B8975A"], ["smiley-white-gold"], [0, 0, 4, 8, 8, 5]],
  ["smileyWhite", "smiley-white-pink", "White / Pink", ["#FFFFFF", "#F2A7B5"], ["smiley-white-pink"], [5, 5, 8, 5, 1, 5]],
  // Smiley Tee — Black Edition
  ["smileyBlack", "smiley-black-purple", "Black / Purple", ["#111111", "#6B3F7A"], ["smiley-black-purple"], [5, 4, 9, 1, 6, 8]],
  ["smileyBlack", "smiley-black-orange", "Black / Orange", ["#111111", "#F07A2A"], ["smiley-black-orange"], [1, 9, 0, 0, 0, 2]],
  ["smileyBlack", "smiley-black-pink", "Black / Pink", ["#111111", "#F4A0B0"], ["smiley-black-pink"], [0, 2, 6, 0, 4, 5]],
  ["smileyBlack", "smiley-black-gold", "Black / Gold", ["#111111", "#C9A35A"], ["smiley-black-gold"], [5, 8, 6, 4, 2, 9]],
  ["smileyBlack", "smiley-black-red", "Black / Red", ["#111111", "#D2232A"], ["smiley-black-red"], [6, 8, 8, 0, 4, 8]],
  // Raglan Smiley Tee
  ["raglan", "raglan-sky-navy", "Sky Blue / Navy", ["#BFDDF1", "#1B2A55"], ["raglan-sky-navy"], [8, 2, 4, 4, 2, 4]],
  ["raglan", "raglan-grey-black", "Grey / Black", ["#BDBDBD", "#111111"], ["raglan-grey-black"], [2, 6, 8, 7, 5, 2]],
  ["raglan", "raglan-cream-brown", "Cream / Brown", ["#F2E8CC", "#6B4A2E"], ["raglan-cream-brown"], [3, 5, 2, 9, 1, 3]],
  ["raglan", "raglan-white-navy", "White / Navy", ["#F7F7F5", "#1B2A55"], ["raglan-white-navy"], [6, 8, 6, 1, 7, 1]],
  ["raglan", "raglan-mocha-brown", "Mocha / Brown", ["#B08463", "#7A4E2D"], ["raglan-mocha-brown"], [6, 4, 9, 0, 9, 9]],
  ["raglan", "raglan-white-red", "White / Red", ["#F7F7F5", "#D7262E"], ["raglan-white-red"], [0, 0, 4, 8, 3, 2]],
  ["raglan", "raglan-pink-black", "Pink / Black", ["#F6C6C6", "#111111"], ["raglan-pink-black"], [7, 1, 7, 8, 4, 0]],
  ["raglan", "raglan-white-black", "White / Black", ["#F7F7F5", "#111111"], ["raglan-white-black"], [4, 0, 1, 9, 2, 6]],
  ["raglan", "raglan-cream-sky", "Cream / Sky Blue", ["#F6EBC8", "#A9CDEB"], ["raglan-cream-sky"], [6, 8, 7, 8, 9, 7]],
  // Bubble Logo Tee
  ["bubble", "bubble-black", "Black", ["#111111", "#F4A28C"], ["bubble-black", "bubble-black-2"], [8, 5, 1, 7, 5, 3]],
  ["bubble", "bubble-pink", "Pink", ["#F7C6DA", "#3E6B3A"], ["bubble-pink", "bubble-pink-2"], [4, 8, 2, 0, 3, 4]],
  ["bubble", "bubble-cream", "Cream", ["#F3EEDB", "#3E6B3A"], ["bubble-cream", "bubble-cream-2"], [1, 8, 4, 7, 9, 1]],
  ["bubble", "bubble-forest", "Forest Green", ["#1F4A34", "#F5C542"], ["bubble-forest", "bubble-forest-2"], [1, 1, 6, 6, 5, 0]],
  // Trust Your Dopeness Tee
  ["dope", "dope-black", "Black", ["#111111", "#5FA8E0"], ["dope-black", "dope-black-2"], [0, 6, 2, 1, 9, 2]],
  ["dope", "dope-pink", "Pink", ["#F7C6DA", "#F2A23A"], ["dope-pink", "dope-pink-2"], [8, 8, 8, 5, 3, 5]],
  ["dope", "dope-white", "White", ["#F7F7F5", "#3E8E4F"], ["dope-white", "dope-white-2"], [1, 2, 6, 2, 7, 1]],
  ["dope", "dope-brown", "Brown", ["#4A3426", "#5FA8E0"], ["dope-brown", "dope-brown-2"], [2, 4, 9, 4, 8, 0]],
  // Utility Tote
  ["tote", "tote-cream-red", "Cream / Red", ["#EFE9DC", "#B0222A"], ["tote-cream-red"], [8]],
  ["tote", "tote-tan", "Tan / Rust", ["#C9A06B", "#A2532A"], ["tote-tan", "tote-tan-2"], [4]],
  ["tote", "tote-olive", "Olive", ["#5C6340", "#4A5033"], ["tote-olive"], [8]],
  ["tote", "tote-black", "Black / Grey", ["#151515", "#6E6E6E"], ["tote-black"], [6]],
  ["tote", "tote-magenta", "Magenta / Pink", ["#C2357A", "#E8A6C4"], ["tote-magenta"], [8]],
];

export const PRODUCTS = VARIANTS.map(([family, id, color, swatch, photos, counts]) => {
  const f = FAMILIES[family];
  return {
    ...f, id, color, swatch,
    images: photos.map((p, i) => ({ src: `/photos/${p}.jpg`, thumb: `/photos/thumbs/${p}.jpg`, label: f.views?.[i] })),
    stock: Object.fromEntries(f.sizes.map((s, i) => [s, counts[i] ?? 0])),
  };
});

export const LOOKBOOK = [
  "/photos/lookbook-plates-crew.jpg",
  "/photos/lookbook-plates-trio.jpg",
  "/photos/lookbook-plates-portrait.jpg",
  "/photos/lookbook-cinema-duo.jpg",
  "/photos/lookbook-cinema-red.jpg",
  "/photos/lookbook-plates-street.jpg",
];

export const LOW_STOCK = 3;
export const totalStock = (p) => Object.values(p.stock).reduce((a, b) => a + b, 0);
