# 🌿 Untakkd

Untappd, but for weed. Check in your sessions, rate the strain, and see what your friends are smoking.

- **Email sign-in** with a 6-digit code (no passwords), pick a username
- **Friends**: search by name/@username, send and accept requests, share an invite link
- **Recent activity feed** with your friends' check-ins
- **Check-ins**: strain (shared strain list), method, ½-star rating out of 5, where you bought it, where you smoked it, who rolled it, who you were with (tag friends *or* type any name), notes, photo
- **Strain pages** with the global average rating, plus check-ins from you and your friends
- **🔥 "Light it"** (likes) and comments
- **Profile stats**: top-rated strains, favourite spot, go-to shop, who usually rolls, smoking buddy, method breakdown
- **20 badges**, e.g. *Blaze It* (check in at 4:20), *Rolling Pro*, *Couch Lock*, *Nomad*
- **Installable** on iPhone/Android as a home-screen app (PWA)

Privacy: check-ins are only visible to you, your accepted friends, and people you tag. Postgres row-level security enforces this, so it can't be bypassed from the browser.

---

## Hosting: €0/month

| Piece | Service | Free tier |
|---|---|---|
| Database, login, photo storage | **Supabase** (Free plan) | 500 MB database, 1 GB photo storage, 50k monthly users |
| Website / app | **Vercel** (Hobby plan) | Unlimited for personal projects |

That's far more than a friend group will ever use. Photos are shrunk on the phone before upload (~200 KB each), so 1 GB holds about 5,000 photos.

⚠️ **One catch:** Supabase pauses free projects after **7 days with no activity**. If your crew goes quiet for a week, open the Supabase dashboard and click *Restore project*; your data is kept. If you outgrow the free tier, Supabase Pro is $25/month. A cheaper alternative is moving to a €4/month Hetzner VPS running PocketBase, but that requires rewriting the data layer.

*Alternatives for the website part:* Netlify or Cloudflare Pages work just as well as Vercel. It's a static site.

---

## Setup (about 20 minutes, one time)

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) → **New project** (choose a region close to you, e.g. *West EU*).
2. Open **SQL Editor** → **New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable key**. You'll need them in steps 3 and 4.

### 2. Turn on email login codes
Supabase only lets you edit email templates once you use your own email sender (SMTP). A free Gmail account works:

1. In your Google account, turn on **2-Step Verification**, then create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (name it "Untakkd").
2. Supabase → **Authentication → Emails → SMTP Settings**: enable custom SMTP and fill in
   - Host `smtp.gmail.com`, port `465`
   - Username: your Gmail address; Password: the 16-character app password (no spaces)
   - Sender email: your Gmail address; Sender name: `Untakkd`
3. Supabase → **Authentication → Emails → Templates**. In both **Magic Link** and **Confirm signup**, replace the body with:
   ```html
   <h2>Heeey maatje, alles goed? 🌿</h2>
   <p>Hier is je inlogcode voor Untakkd:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Typ 'm in de app en je bent binnen. Als je dit leest: neem een pof.</p>
   <p><small>Niet aangevraagd? Dan kun je deze mail negeren.</small></p>
   ```
   Set the **Subject** to `Je Untakkd-code is binnen 🌿` and save. Supabase now emails a code instead of a link, which also works inside the iPhone home-screen app.

Gmail lets you send about 500 emails a day. Friends will see your Gmail address as the sender.

### 3. Run it locally (optional)
```bash
cp .env.example .env.local  # then paste your Supabase URL + key into .env.local
npm install
npm run dev                 # → http://localhost:5173
```

### 4. Deploy to Vercel
1. Push this folder to a (private) GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Vercel auto-detects Vite.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then click **Deploy**.
4. Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to `https://your-app.vercel.app`.

Every `git push` redeploys automatically.

### 5. Get your friends on it
Send them the link. On **iPhone**: Safari → Share → *Add to Home Screen*. On **Android**: Chrome ⋮ → *Install app*.
In the app, go to **Friends → Invite your friends** to share a link straight to your profile.

---

## Tech

React 19 + TypeScript + Vite + Tailwind CSS 4, `vite-plugin-pwa`, Supabase (Postgres, Auth with email codes, Storage).

```
supabase/schema.sql   tables, security rules, triggers, photo bucket
src/lib/              Supabase client, auth, friends, stats & badges
src/components/       check-in card, star rating, strain/people pickers, layout
src/pages/            feed, new check-in, check-in detail, profile, friends, strains, settings
```

Badges are calculated in the app from your check-ins (see `src/lib/stats.ts`). To add a new one, add a line to `DEFS`.
