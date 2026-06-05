# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

乡村村务平台 (Village Affairs Platform) — a points-based rural governance system. Villagers earn points through community participation and redeem them for goods. Village officials manage users, products, and announcements via an admin panel.

**Stack**: Python Flask + SQLite backend, Vite + vanilla JS frontend, JWT auth, monorepo.

## Commands

```bash
# Backend (terminal 1)
cd server
pip install flask pyjwt    # first time only
python app.py              # → http://127.0.0.1:5000

# Frontend (terminal 2)
cd client
npm install                # first time only
npm run dev                # → http://localhost:5173
npm run build              # production build → client/dist/
```

Vite proxies `/api/*` to Flask at `127.0.0.1:5000` (configured in `client/vite.config.js`).

## Architecture

```
client/                         server/
├── index.html   (entry)        ├── app.py          (Flask factory, blueprint registration)
├── vite.config.js              ├── config.py       (JWT_SECRET, DB_PATH)
└── src/                        ├── models.py       (DDL for 6 tables + seed data)
    ├── css/style.css            ├── auth.py         (PBKDF2 hashing, JWT create/decode, decorators)
    └── js/                      └── routes/
        ├── app.js   (main)          ├── auth_routes.py
        ├── api.js   (fetch layer)   ├── product_routes.py
        ├── auth.js  (session)       ├── points_routes.py
        ├── router.js                 ├── announcement_routes.py
        └── utils.js                  └── admin_routes.py
```

### Frontend module roles
- **`api.js`** — All `fetch()` calls to `/api/*`. Injects `Authorization: Bearer <token>`. On 401, clears token and reloads.
- **`auth.js`** — Login/register/logout, token persistence in `localStorage("vp_token")`, `currentUser` state, `initAuth()` gate.
- **`router.js`** — `switchPage(n)` and `switchTab(n)`, dispatches `page-changed` / `tab-changed` custom events.
- **`app.js`** — All page rendering and business logic. Listens for `page-changed`/`tab-changed` events to re-render. Exposes `window._functionName` globals for inline `onclick` handlers.
- **`utils.js`** — `showToast()`, `openModal()`/`closeModal()`, date formatters.

### Backend patterns
- All routes use `login_required` or `official_required` decorators from `auth.py`. These extract JWT payload into `g.user_id` / `g.role`.
- Database connections via `get_db()` in `models.py` — returns `sqlite3.Connection` with `row_factory = sqlite3.Row` and WAL mode enabled.
- `seed_if_empty()` in `models.py` inserts 8 products, 4 demo users, and 4 announcements on first run.
- Exchange operations use `BEGIN IMMEDIATE` + `COMMIT`/`ROLLBACK` for atomic stock+balance updates.

### Database (SQLite at `server/village.db`)

| Table | Key columns | Notes |
|-------|------------|-------|
| `users` | id, username, password_hash, name, role, balance | role = 'villager' \| 'official' |
| `products` | id, name, emoji, points, stock | 8 default items |
| `exchanges` | user_id, product_id, points_spent | redemption audit |
| `points_log` | user_id, type, points, balance_after | earn/spend audit trail |
| `announcements` | title, content, publisher_id | |
| `announcement_reads` | announcement_id, user_id | UNIQUE constraint prevents duplicate reads |

### Auth flow
1. `index.html` loads → `<script type="module">` calls `initAuth()`.
2. If no token in localStorage → show `#authPage` (login/register forms).
3. If token exists → `GET /api/auth/me` to validate → populate `currentUser` → hide `#authPage`, show `#appMain`.
4. `appMain` visibility is toggled by `auth.js` (`showAuthPage()`/`hideAuthPage()`).

### Role-based UI
- Nav bar: villagers see 4 tabs, officials see 5 (admin gear tab appended dynamically by `updateNavVisibility()` in `app.js`).
- Announcements page: publish button only for officials (`isOfficial()` check in `renderAnnouncements()`).
- Admin page (`#pageAdmin`): dashboard stats, user search, balance adjustment, product editing.

## Key Design Decisions
- No JS framework — vanilla ES modules with custom events for decoupling.
- Passwords hashed with `hashlib.pbkdf2_hmac` (stdlib, no extra deps).
- CSS uses CSS custom properties in `:root` for consistent theming (warm green `#5B9A6B` primary).
- Demo accounts seeded on first DB init: `admin`/`zhang`/`lisi` all with password `123456`.
