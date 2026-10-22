// Everything the brand owner needs to edit lives in this file and products.js.
// Values marked TODO were not public on Too Easy's pages — confirm with the brand before launch.

export const BRAND = {
  name: "Too Easy",
  tagline: "Who said it can't be easy?",
  city: "Monrovia, Liberia",
  founded: "2023",
  founder: "Abubakar C. Jalloh",
  founderHandle: "JacTheRealest",
  instagram: "https://www.instagram.com/tooeasy001/",
  instagramHandle: "@tooeasy001",
  facebook: "https://www.facebook.com/tooeasy001",
  founderInstagram: "https://www.instagram.com/jactherealest/",
  // TODO: the brand's real WhatsApp number, international format, digits only (e.g. 231770000000).
  whatsapp: "231000000000",
  // TODO: confirm pickup / shop address.
  pickup: "Pickup point in Monrovia — address confirmed on WhatsApp",
};

// TODO: set today's rate. Prices in products.js are stored in USD.
export const LRD_PER_USD = 190;

// TODO: confirm zones and fees with the brand's delivery rider.
export const DELIVERY_ZONES = [
  { id: "pickup", label: "Pickup (free)", fee: 0 },
  { id: "central", label: "Central Monrovia", fee: 2 },
  { id: "sinkor", label: "Sinkor / Congo Town", fee: 3 },
  { id: "paynesville", label: "Paynesville / ELWA / Rehab", fee: 4 },
  { id: "bushrod", label: "Bushrod Island / Duala", fee: 4 },
  { id: "gardnersville", label: "Gardnersville / Barnersville", fee: 4 },
  { id: "outside", label: "Outside Monrovia (quote on WhatsApp)", fee: 0 },
];

export const PAYMENT_METHODS = [
  { id: "orange", label: "Orange Money" },
  { id: "momo", label: "MTN Mobile Money" },
  { id: "cash", label: "Cash on delivery" },
];
