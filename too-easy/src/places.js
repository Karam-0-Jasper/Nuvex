// Delivery places across Greater Monrovia. Coordinates come from OpenStreetMap (Nominatim).
// Each place belongs to a delivery zone in config.js; zone fees are still placeholders.

export const MAP_CENTER = [6.315, -10.76];

export const PLACES = [
  // Central Monrovia
  { name: "Central Monrovia (Broad St)", zone: "central", lat: 6.3192, lng: -10.8121 },
  { name: "Mamba Point", zone: "central", lat: 6.3117, lng: -10.8147 },
  { name: "Snapper Hill", zone: "central", lat: 6.3199, lng: -10.8125 },
  { name: "Crown Hill", zone: "central", lat: 6.3119, lng: -10.7993 },
  { name: "West Point", zone: "central", lat: 6.3273, lng: -10.8059 },
  { name: "Capitol Hill", zone: "central", lat: 6.3103, lng: -10.7987 },
  { name: "Barclay Training Center", zone: "central", lat: 6.3060, lng: -10.8031 },
  { name: "Bassa Community", zone: "central", lat: 6.3063, lng: -10.7981 },
  { name: "Slipway", zone: "central", lat: 6.3160, lng: -10.7990 },
  { name: "Vai Town", zone: "central", lat: 6.3248, lng: -10.8011 },
  // Sinkor / Congo Town
  { name: "Jallah Town", zone: "sinkor", lat: 6.3026, lng: -10.7936 },
  { name: "Sinkor", zone: "sinkor", lat: 6.2914, lng: -10.7773 },
  { name: "Nancy Doe Market (8th St)", zone: "sinkor", lat: 6.2928, lng: -10.7873 },
  { name: "Fiamah", zone: "sinkor", lat: 6.2949, lng: -10.7727 },
  { name: "Airfield", zone: "sinkor", lat: 6.2879, lng: -10.7641 },
  { name: "Lakpazee", zone: "sinkor", lat: 6.2917, lng: -10.7608 },
  { name: "Matadi", zone: "sinkor", lat: 6.2996, lng: -10.7663 },
  { name: "Old Road", zone: "sinkor", lat: 6.2817, lng: -10.7561 },
  { name: "Smythe Road", zone: "sinkor", lat: 6.2839, lng: -10.7517 },
  { name: "Gaye Town", zone: "sinkor", lat: 6.2846, lng: -10.7448 },
  { name: "Tubman Boulevard", zone: "sinkor", lat: 6.2743, lng: -10.7482 },
  { name: "Peace Island", zone: "sinkor", lat: 6.2769, lng: -10.7344 },
  { name: "Congo Town", zone: "sinkor", lat: 6.2687, lng: -10.7333 },
  { name: "SKD Boulevard", zone: "sinkor", lat: 6.2827, lng: -10.7152 },
  // Paynesville / ELWA / Rehab
  { name: "Paynesville", zone: "paynesville", lat: 6.2724, lng: -10.6951 },
  { name: "Red Light", zone: "paynesville", lat: 6.2921, lng: -10.6900 },
  { name: "ELWA Junction", zone: "paynesville", lat: 6.2646, lng: -10.7040 },
  { name: "ELWA", zone: "paynesville", lat: 6.2452, lng: -10.6993 },
  { name: "Rehab", zone: "paynesville", lat: 6.2400, lng: -10.6816 },
  { name: "Kendeja", zone: "paynesville", lat: 6.2349, lng: -10.6799 },
  { name: "Zubah Town", zone: "paynesville", lat: 6.2539, lng: -10.6754 },
  { name: "GSA Road", zone: "paynesville", lat: 6.2598, lng: -10.6862 },
  { name: "Duport Road", zone: "paynesville", lat: 6.2642, lng: -10.6669 },
  { name: "Thinkers Village", zone: "paynesville", lat: 6.2439, lng: -10.6610 },
  { name: "Jacob Town", zone: "paynesville", lat: 6.3046, lng: -10.7160 },
  { name: "Neezoe Junction", zone: "paynesville", lat: 6.3045, lng: -10.7025 },
  { name: "Wood Camp", zone: "paynesville", lat: 6.2953, lng: -10.6830 },
  { name: "Soul Clinic", zone: "paynesville", lat: 6.2953, lng: -10.6795 },
  { name: "Pipeline Road", zone: "paynesville", lat: 6.3177, lng: -10.6895 },
  { name: "Omega", zone: "paynesville", lat: 6.3061, lng: -10.6694 },
  // Bushrod Island / Duala
  { name: "Clara Town", zone: "bushrod", lat: 6.3288, lng: -10.7971 },
  { name: "Doe Community", zone: "bushrod", lat: 6.3333, lng: -10.7881 },
  { name: "Freeport", zone: "bushrod", lat: 6.3398, lng: -10.7961 },
  { name: "Battery Factory", zone: "bushrod", lat: 6.3410, lng: -10.7790 },
  { name: "Bushrod Island", zone: "bushrod", lat: 6.3440, lng: -10.7864 },
  { name: "Logan Town", zone: "bushrod", lat: 6.3540, lng: -10.7825 },
  { name: "New Kru Town", zone: "bushrod", lat: 6.3715, lng: -10.7903 },
  { name: "Fanti Town", zone: "bushrod", lat: 6.3715, lng: -10.7945 },
  { name: "Duala", zone: "bushrod", lat: 6.3746, lng: -10.7869 },
  { name: "Point Four", zone: "bushrod", lat: 6.3833, lng: -10.8000 },
  { name: "Tweh Farm", zone: "bushrod", lat: 6.3905, lng: -10.7828 },
  // Gardnersville / Barnersville
  { name: "Gardnersville", zone: "gardnersville", lat: 6.3367, lng: -10.7383 },
  { name: "Chocolate City", zone: "gardnersville", lat: 6.3311, lng: -10.7467 },
  { name: "Somalia Drive", zone: "gardnersville", lat: 6.3356, lng: -10.7504 },
  { name: "Topoe Village", zone: "gardnersville", lat: 6.3333, lng: -10.7667 },
  { name: "New Georgia", zone: "gardnersville", lat: 6.3656, lng: -10.7672 },
  { name: "Barnersville", zone: "gardnersville", lat: 6.3667, lng: -10.7333 },
  { name: "Dixville", zone: "gardnersville", lat: 6.3791, lng: -10.7462 },
  { name: "Caldwell", zone: "gardnersville", lat: 6.3922, lng: -10.7342 },
  { name: "Kpelle Town (Johnsonville)", zone: "gardnersville", lat: 6.3362, lng: -10.6777 },
  { name: "Johnsonville", zone: "gardnersville", lat: 6.3533, lng: -10.6997 },
  { name: "Mount Barclay", zone: "gardnersville", lat: 6.3486, lng: -10.6540 },
  // Outside central Monrovia — fee quoted on WhatsApp
  { name: "Brewerville", zone: "outside", lat: 6.4233, lng: -10.7839 },
  { name: "Virginia", zone: "outside", lat: 6.4164, lng: -10.7680 },
  { name: "Kru Town (St. Paul River)", zone: "outside", lat: 6.4174, lng: -10.7999 },
  { name: "Banjor", zone: "outside", lat: 6.4008, lng: -10.8111 },
  { name: "Hotel Africa Road", zone: "outside", lat: 6.3979, lng: -10.7956 },
  { name: "Plunkor", zone: "outside", lat: 6.4588, lng: -10.8080 },
  { name: "Louisiana", zone: "outside", lat: 6.4339, lng: -10.7043 },
  { name: "Fendell", zone: "outside", lat: 6.3798, lng: -10.6168 },
  { name: "Bensonville (Bentol)", zone: "outside", lat: 6.4473, lng: -10.6143 },
  { name: "Careysburg", zone: "outside", lat: 6.4007, lng: -10.5515 },
];

// Distance in km between two [lat, lng] points.
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Closest named place to a dropped pin; pins far from every place are treated as outside Monrovia.
export function nearestPlace(point) {
  let best = PLACES[0];
  let bestKm = Infinity;
  for (const p of PLACES) {
    const km = distanceKm(point, [p.lat, p.lng]);
    if (km < bestKm) { best = p; bestKm = km; }
  }
  return bestKm > 3 ? { ...best, zone: "outside", far: true } : best;
}
