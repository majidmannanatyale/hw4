# Campus Customs

A heritage collegiate-apparel storefront (React + Vite + TypeScript) with a FastAPI backend and an AI "Concierge" chatbot (PydanticAI, via the Portkey gateway).

This guide explains how to run it from a fresh clone.

---

## Clone the repository

```bash
git clone https://github.com/<your-username>/hw4.git
cd hw4
```

> **Note:** the product images and the `campus_customs.db` database are **not** included in the repo (they're excluded via `.gitignore`). After cloning, place the provided `data/` folder **one level above** the cloned `hw4/` folder — see **Expected folder layout** below. Your real `.env` is also never committed; create it from `.env.example` as described under **Backend**.

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** (includes `npm`)
- A **Portkey API key** (for the chatbot). The site's catalogue, cart, accounts, ribbons, and pickup all work without it — only the chat needs it.

## Expected folder layout

The backend reads the product database and images from a `data/` folder that sits **next to `hw4/`** (one level up):

```
Assignment 4/
├─ data/
│  ├─ campus_customs.db        # SQLite database (catalogue, inventory, users, …)
│  ├─ products/                # original product images
│  └─ products_clean/          # white-background images (optional; falls back to products/)
└─ hw4/
   ├─ backend/                 # FastAPI app
   ├─ frontend/                # React + Vite app
   ├─ requirements.txt
   └─ .env.example
```

If you cloned only `hw4/`, make sure the `data/` folder is placed one directory above it, as shown.

---

## 1. Backend (FastAPI, port 8000)

From the `hw4/` folder:

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create your .env from the template and fill it in
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

Edit `.env` and set:

- `APP_SECRET` — any long random string (signs login tokens). Generate one with:
  ```bash
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- `PORTKEY_API_KEY` — your Portkey key (needed only for the chatbot).
- `OPENAI_MODEL` — optional; defaults to `gpt-terra`.

> The backend also looks upward for a `keys.env` file if you keep your `PORTKEY_API_KEY` there instead.

Then start the server **from the `backend/` folder**:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (e.g. `http://localhost:8000/api/products`). The cart and pickup tables are created automatically on first run.

> **Dependency note:** on Windows ARM64, `pydantic-ai-slim[openai]` can't build (its `tiktoken` dependency has no wheel), so `requirements.txt` installs `pydantic-ai-slim` + `openai` directly. On other platforms you may use `pydantic-ai-slim[openai]` instead.

---

## 2. Frontend (React + Vite, port 5173)

In a **second terminal**, from the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

By default the frontend calls the backend at `http://localhost:8000`. To point it elsewhere, set `VITE_API_URL` before building/running, e.g.:

```bash
# Windows (PowerShell)
$env:VITE_API_URL="https://your-backend.example.com"; npm run dev
# macOS / Linux
VITE_API_URL="https://your-backend.example.com" npm run dev
```

### Production build

```bash
npm run build        # outputs static files to frontend/dist/
npm run preview      # preview the build locally
```

The build uses relative asset paths and hash-based routing, so it can be hosted from a sub-path (e.g. GitHub Pages).

---

## Deploying to GitHub Pages

GitHub Pages serves **static files only**, so it can host the **frontend** but **not** the FastAPI backend. To deploy:

1. Host the backend somewhere that runs Python (e.g. a small VM or a service like Render/Railway/Fly). Set its `.env` there.
2. Build the frontend with `VITE_API_URL` pointing at that backend's public URL.
3. Publish `frontend/dist/` to GitHub Pages.

Without a reachable backend, the catalogue, chat, cart, accounts, and pickup features will not load (the pages still render).

---

## Troubleshooting

- **Products/images don't load:** confirm the `data/` folder is one level above `hw4/` and contains `campus_customs.db` and the `products/` images.
- **Chat says the concierge is unavailable:** `PORTKEY_API_KEY` isn't set in `.env` (or `keys.env`).
- **CORS errors:** the backend allows `http://localhost:5173` by default; if you run the frontend on another origin, update the CORS origins in `backend/main.py`.
- **Port already in use:** change `--port` for the backend, or the Vite port with `npm run dev -- --port <n>` (and set `VITE_API_URL` accordingly).
