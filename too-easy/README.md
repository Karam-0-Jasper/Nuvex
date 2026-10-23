# Too Easy — shopping app

A mobile shopping app (installable PWA) for **Too Easy**, the Monrovia streetwear brand
founded in 2023 by Abubakar C. Jalloh (JacTheRealest). Instagram: [@tooeasy001](https://www.instagram.com/tooeasy001/).

## What's inside

- **Home** — "Who said it can't be easy?" hero on the TE001 campaign photo, Graphic Tees, the Smiley Logo Tee in 22 colourways, categories, Raglans, Utility Totes, a lookbook, and a "buy the real one" anti-counterfeit note.
- **Shop** — 60 colourways across 10 products, all shown with the brand's own photos: Smiley Logo Tees ($15), Star T ($20), Plate T ($25), Trust Your Dopeness ($25), Bubble Logo, Raglans, caps ($10) and totes. Search and filter by New Drops, Smiley Tees, Raglans, Graphic Tees, Caps, Bags. Each card shows how many are left. Save favourites with ♡.
- **Product** — front/back photos for the graphic tees, colour dots, S–3XL size picker showing how many are left in each size, a stock table for every colour × size, add to bag, and **Order for delivery**. Sold-out sizes are blocked and the bag can't exceed stock.
- **Delivery checkout** — choose delivery or pickup, then pick the drop-off spot on a map of Greater Monrovia (70+ communities from OpenStreetMap, tap your community, drop a pin, or use the phone's location), add a landmark, and choose the day and time (8 AM–8 PM, at least 2 hours ahead, up to 30 days). Orange Money / MTN MoMo / cash. The order goes to the brand as a WhatsApp message with a map link; until the WhatsApp number is set it runs as a **sample** and saves the order on the phone under "Your deliveries".
- **Story** — founder, milestones, community work, social links.
- **USD ⇄ LRD** price toggle. Bag, saved items and currency are remembered on the phone.

## Before launch — fill in the real details

Nothing below was public on the brand's pages, so these are placeholders:

| What | Where |
|---|---|
| WhatsApp order number | `src/config.js` → `whatsapp` (checkout is blocked until this is set) |
| Prices still to confirm (Raglan, Bubble Logo, Tote) | `src/products.js` → `FAMILIES` |
| Stock counts (sample numbers now) | `src/products.js` → each `stock` line, one number per size S, M, L, XL, XXL, 3XL |
| Exchange rate | `src/config.js` → `LRD_PER_USD` |
| Delivery zones & fees | `src/config.js` → `DELIVERY_ZONES` (which community is in which zone: `src/places.js`) |
| Delivery hours and time slots | `src/config.js` → `DELIVERY_HOURS`, `TIME_SLOTS` |
| Pickup address | `src/config.js` → `pickup` |
| New product photos | put a 3:4 photo in `public/photos/` and a 480px-wide copy in `public/photos/thumbs/`, then add a line to `VARIANTS` in `src/products.js` |
| Add / remove products | `src/products.js` |

## Run it

```bash
cd too-easy
npm install
npm run dev      # local preview
npm run build    # production build in dist/
```

## Deploy to Vercel

Import the repo on vercel.com and set **Root Directory** to `too-easy`. Vercel detects Vite automatically.
On an iPhone, open the live link in Safari → Share → **Add to Home Screen**.
