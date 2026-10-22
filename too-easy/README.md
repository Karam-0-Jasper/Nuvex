# Too Easy — shopping app

A mobile shopping app (installable PWA) for **Too Easy**, the Monrovia streetwear brand
founded in 2023 by Abubakar C. Jalloh (JacTheRealest). Instagram: [@tooeasy001](https://www.instagram.com/tooeasy001/).

## What's inside

- **Home** — "Who said it can't be easy?" hero, the Liberian Jue (Independence Day) collection, categories, signature tees, and a "buy the real one" anti-counterfeit note.
- **Shop** — search and filter by Tees, Liberian Jue, Caps, Kids. Save favourites with ♡.
- **Product** — colour variants, size picker, add to bag.
- **Bag / checkout** — Monrovia delivery zones, Orange Money / MTN MoMo / cash on delivery. The order is sent to the brand as a ready-made WhatsApp message.
- **Story** — founder, milestones, community work, social links.
- **USD ⇄ LRD** price toggle. Bag, saved items and currency are remembered on the phone.

## Before launch — fill in the real details

Nothing below was public on the brand's pages, so these are placeholders:

| What | Where |
|---|---|
| WhatsApp order number | `src/config.js` → `whatsapp` (checkout is blocked until this is set) |
| Prices | `src/products.js` → each `price` (USD) |
| Exchange rate | `src/config.js` → `LRD_PER_USD` |
| Delivery zones & fees | `src/config.js` → `DELIVERY_ZONES` |
| Pickup address | `src/config.js` → `pickup` |
| Real product photos | put files in `public/photos/` and add `image: "/photos/name.jpg"` to a product |
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
