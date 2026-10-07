# Registro de clases

A small web app for tracking paid Spanish classes. A teacher logs every class (date, family or place, schedule, hourly rate), the hours and totals calculate themselves, and the boss sees the same sheet. A class only becomes **PAGADO** once **both** sides agree.

The interface is in Spanish.

## What it does

**Teacher (profesor/a)**
- Signs up from the WhatsApp invite link the boss sends.
- Sees **Mis clases**, one month at a time, with a 12-month chart (paid vs. pending).
- **Agregar clase**: family/place, **class role** (e.g. Maestra, Helper), date, from–to time. The hourly rate comes from the role, minus her retention if she has one, and hours and total calculate themselves. Families she has used before show up as one-tap suggestions that fill in the last role and schedule.
- Row menu: **Editar**, **Repetir la próxima semana** (copies the class to the same day next week), **Eliminar**. Paid rows are locked.

**Boss (jefe/a)**
- Sidebar listing each teacher with how much is pending, plus a badge when payments are waiting for the boss to confirm.
- Clicking a teacher opens the same monthly sheet and chart (read-only).
- **Roles y tarifas** (sidebar): the list of class roles and their hourly rates. New teams start with **Maestra** and **Helper**, with rates left blank for the boss to fill in. A role without a rate can't be picked until it has one.
- **⋯ next to a teacher → Configuración**: per-teacher settings. For now that's **Retención (%)**, which is subtracted from the role rate. Example: 20% retention, Maestra $70/h → the class is logged at $56/h.
- **Invitar profesor/a** creates a single-use link (valid 14 days) and opens WhatsApp with a ready-to-send message.

**Payment confirmation (both need to agree)**
1. Either side clicks **Marcar pagado** on a row, or **Marcar mes como pagado** for the whole month.
2. The row changes to *Por confirmar*. The other side gets a yellow banner and a **Confirmar** button (per row, or **Confirmar N pagos** for the month).
3. Once confirmed, the row is **PAGADO** and locked. The other side can also answer **No** (it wasn't paid), and the requester can **Deshacer**. If the teacher edits a row after asking for confirmation, the request is cancelled so nobody confirms an amount that changed.

Each row also has a small comment thread, so either person can ask something like "were these 1.5 h?".

**How rates are saved.** Each class saves its role, the role rate and the retention at the moment it's created, so changing a rate or a retention later doesn't rewrite classes already logged. If the teacher edits a pending class, it's recalculated with the current rate and retention. The server always does this calculation, so the teacher can't set her own rate.

## Stack

- Next.js 16 (App Router, Server Actions), deployable on Vercel
- shadcn/ui (Radix + Tailwind CSS v4), Recharts for the chart
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

1. The **boss** opens the site, clicks **Créala aquí**, creates an account, then creates the team (**Crear mi equipo**).
2. The boss sets the hourly rate for each role (**Definir tarifas**).
3. The boss clicks **Invitar profesor/a** → **Crear enlace** → **Enviar por WhatsApp**.
4. The **teacher** opens the link, creates her account, and lands on her sheet.
5. Optional: if a teacher has a retention, the boss sets it with **⋯ → Configuración** next to her name.

If the teacher already has an account, she opens the link and taps **Inicia sesión**. Each account belongs to one team.

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
src/app/actions.ts                 Server actions: classes, payments, invites, comments
src/app/(app)/layout.tsx           Boss = sidebar layout · Teacher = simple header
src/app/(app)/t/[teacherId]/       The monthly sheet (shared by boss and teacher)
src/app/invite/[token]/            Invite landing + sign-up
src/components/sheet/              Table, add/edit dialog, chart, summary, month navigation
src/components/settings/           Roles & rates dialog, per-teacher settings (retention)
src/lib/roles.ts                   Default roles + rate-after-retention math
src/lib/db.ts                      MongoDB client + collection types
src/lib/auth.ts                    Better Auth config
scripts/reset-password.mjs         Admin password reset
```

Data lives in four collections (`teams` (incl. roles and rates), `members` (incl. retention), `invites`, `classes`) plus Better Auth's own (`user`, `account`, `session`, `verification`).
