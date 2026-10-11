# Registro de clases

A small web app for logging paid Spanish classes. You record each class (family or place, role, date, schedule), the hours and amount calculate themselves, you mark classes as paid, and you can export a PDF report.

The interface is in Spanish. Each account is private: you only see your own classes.

## What it does

- **Mis clases**: one month at a time, with a 12-month chart (paid vs. pending), the month's totals (hours, total, paid, pending) and a table of classes (cards on a phone).
- **Ajustes** (top right): your class roles and their hourly rates, plus an optional **Retención (%)** taken off every rate. New accounts start with **Maestra** and **Helper** with blank rates, and a yellow banner asks you to fill them in. Example: Maestra $70/h with 20% retention → classes are logged at $56/h.
- **Agregar clase**: family or place, role, date, and from–to time. Hours, rate (after retention) and total calculate themselves. Families you've used before show up as one-tap suggestions that fill in the last role and times.
- **Marking as paid**:
  - **Marcar pagado** on a single class.
  - **Marcar mes como pagado** for every pending class that month.
  - Tick several classes and use the bar at the bottom.
  - A paid class is locked. Use **⋯ → Marcar como pendiente** to undo, then you can edit it again.
- **Other row actions** (**⋯**): **Editar**, **Repetir la próxima semana** (copies the class to the same day next week), **Eliminar**.
- **Exportar PDF**, two ways:
  - **By filters**: the **Exportar PDF** button lets you pick a period (this month, last month, the year, everything, or custom dates), a status (all / pending / paid) and a family or place. It shows how many classes and how much money before you download.
  - **By selection**: tick classes in the table → **PDF** in the bottom bar.
  - The PDF (US Letter) has the period and filters (no name or email), totals (classes, hours, total, paid, pending), and the class table with role, rate (showing the retention) and status. It's grouped by month with subtotals when it covers several months, and has page numbers.

**How rates are saved.** Each class keeps the role, rate and retention it was saved with. Changing them in Ajustes affects new classes (and pending classes you edit), not ones already logged. The server always does the calculation.

## Stack

- Next.js 16 (App Router, Server Actions), deployable on Vercel
- shadcn/ui (Radix + Tailwind CSS v4), Recharts for the chart
- jsPDF + jspdf-autotable for the PDF (built in the browser, so nothing heavy runs on the server)
- MongoDB (official `mongodb` driver)
- Better Auth: email + password, no email verification

---

## 1. Create the database (MongoDB Atlas, free)

1. Create an account at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. **Database Access** → add a database user with a password.
3. **Network Access** → add `0.0.0.0/0` (allow from anywhere). Vercel doesn't use fixed IP addresses, so this is required.
4. **Connect → Drivers** → copy the connection string (`mongodb+srv://…`) and put your user's password in it.

> Shortcut: in Vercel you can go to **Storage → Marketplace → MongoDB Atlas** instead. It creates the cluster and adds `MONGODB_URI` to your project for you.

The app creates its collections and indexes the first time it runs.

## 2. Run it locally (optional)

```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI and BETTER_AUTH_SECRET
npm run dev
```

Open http://localhost:3000. To generate a secret: `openssl rand -base64 32`

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository:
   ```bash
   git init && git add . && git commit -m "Registro de clases"
   # create an empty repo on GitHub, then:
   git remote add origin https://github.com/<you>/registro-de-clases.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project → Import** that repository (it detects Next.js).
3. Under **Environment Variables**, add:
   | Name | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string |
   | `BETTER_AUTH_SECRET` | a long random string (`openssl rand -base64 32`) |
4. **Deploy.** The app works on its `*.vercel.app` address right away.

**Custom domain?** Add it in Vercel, then add `BETTER_AUTH_URL=https://your-domain.com` and redeploy.

## 4. First use

1. Open the site → **Créala aquí** → name, email and password.
2. Tap **Definir tarifas** (or **Ajustes**) and fill in the hourly rate for each role, plus the retention if there is one.
3. **Agregar clase** and you're going.

## Forgot a password?

There is no "forgot password" email, because the app doesn't send email. Whoever manages the deployment can set a new password from their computer:

```bash
npm run reset-password -- ana@correo.com NuevaClave123
```

This uses `MONGODB_URI` from `.env` or `.env.local`. It also signs that person out everywhere.

## Optional settings

| Variable | Default | What it does |
|---|---|---|
| `MONGODB_DB` | `registro-clases` | Database name |
| `BETTER_AUTH_URL` | (auto) | Needed only for a custom domain |
| `AUTH_ALLOWED_HOSTS` | | Extra hostnames, comma-separated, if you don't set `BETTER_AUTH_URL` |
| `NEXT_PUBLIC_TIMEZONE` | `America/New_York` | Decides what "today" and "this month" are |
| `NEXT_PUBLIC_CURRENCY` | `USD` | Currency used for amounts |

## Project map

```
src/app/(app)/page.tsx             Mis clases: chart, month totals, class table
src/app/(app)/layout.tsx           Header (Ajustes, account menu)
src/app/actions.ts                 Server actions: settings, classes, paid/pending, export data
src/components/sheet/              Table + selection bar, add/edit dialog, chart, summary, month navigation
src/components/settings/           Ajustes dialog (roles, rates, retention) + "define your rates" banner
src/components/export/             Export dialog (filters + live count)
src/lib/pdf-report.ts              PDF layout (jsPDF + autotable)
src/lib/roles.ts                   Default roles + rate-after-retention math
src/lib/db.ts                      MongoDB client + collection types
src/lib/auth.ts                    Better Auth config
scripts/reset-password.mjs         Admin password reset
```

Data lives in two collections, `profiles` (roles, rates and retention per user) and `classes`, plus Better Auth's own (`user`, `account`, `session`, `verification`).

**Upgrading from the earlier team version:** your classes are kept automatically. The first time the app starts, it moves their owner over to the new field. The old `teams`, `members` and `invites` collections aren't used anymore and can be deleted in Atlas whenever you like.
