# Assignment 4 — Harness

<!-- ============================================================ -->
<!-- SECTION: DATABASE                                              -->
<!-- ============================================================ -->

---

## 🗄️ Database

**Source:** `Assignment 4/data/campus_customs.db` (SQLite)

| Table | Rows | Purpose |
|---|---|---|
| `catalogue` | 102 | One row per product |
| `inventory` | 612 | Stock count per product per size |
| `users` | 3 | Registered customer accounts |
| `chat_messages` | 22 | Saved chatbot conversation history |
| `sqlite_sequence` | 3 | SQLite internal auto-ID counter |

### Table: `catalogue`

- **`product_id`**
  - A unique ID built from the product name (e.g. `basic-hoodie-big-yale`) that links each product to its inventory rows, so the chatbot can look up an exact item's stock and the site can build stable product links.
- **`name`**
  - The name customers see, which the chatbot uses when recommending or confirming items so its answers match what shoppers see on the page.
- **`garment_type`**
  - The kind of clothing it is, though it's written inconsistently (22 variants for about 7 real categories), which matters because the chatbot needs it to filter requests like "show me hoodies" and must normalize the variants to avoid missing products.
- **`description`**
  - A one-to-two-sentence description of how the item looks, which the chatbot can quote or search to answer detail questions ("does it have a pocket?") and match vague requests.
- **`colors`**
  - A list of the item's colors (e.g. `["navy", "white"]`) that lets the chatbot answer "do you have this in pink?" accurately, which is why the 3 products with an empty list are a gap.
- **`search_tags`**
  - Keywords for matching what customers type (e.g. `"college rivalry"`, `"Yale merch"`) that let the chatbot find relevant products even when the shopper's wording doesn't match the product name.
- **`image_file_path`**
  - The location of the product photo (all 102 exist), which lets the site and chat product cards show a picture so customers can see what they're buying.
- **`price`**
  - The price in USD, set by garment type, which the shop needs to sell the item and the chatbot needs to answer price and budget questions without making up numbers.

### Table: `inventory`

- **`id`**
  - A row number that uniquely identifies each product-size stock record, so the backend can update one specific record when stock changes.
- **`product_id`**
  - The link back to `catalogue`, which lets the chatbot connect a product the customer is discussing to its stock levels.
- **`size`**
  - The size (XS, S, M, L, XL or XXL, with all 6 present for every product), which matters because customers buy a specific size and the chatbot must answer "do you have it in a medium?" per size.
- **`quantity`**
  - The units on hand (0–25, 5,920 in total, 145 slots sold out), which tells the chatbot whether to recommend an item or warn that a size is out of stock, so it never sells what the shop doesn't have.

### Table: `users`

- **`id`**
  - A unique user number that `chat_messages` uses to tie each message to a person, which lets the chatbot load the right customer's history and keep conversations private.
- **`name`**
  - The customer's full name, which the site and chatbot can display to personalize the experience.
- **`email`**
  - The login email (no two accounts can share one), which identifies the customer at sign-in and prevents duplicate accounts.
- **`password_hash`**
  - The password stored scrambled (PBKDF2-SHA256) rather than in plain text, which lets the shop verify logins securely without exposing passwords if the database leaks.
- **`created_at`**
  - When the account was created, which helps the shop track sign-ups and tell new customers from returning ones.
- **`first_name`**
  - The customer's first name, added after the table was first built, which lets the chatbot greet people personally ("Hi, Test!").
- **`last_name`**
  - The customer's last name, added alongside `first_name`, which lets the shop address customers formally or tell apart customers who share a first name.

### Table: `chat_messages`

- **`id`**
  - A number recording the order messages came in, which lets the chatbot replay a conversation in the correct sequence as context.
- **`user_id`**
  - Which customer the message belongs to, so the chatbot remembers each user's own past conversation and never mixes up customers.
- **`role`**
  - Whether the message came from the customer (`user`) or the chatbot (`assistant`), which the AI model needs to tell who said what when it reads the history.
- **`content`**
  - The message text (some saved text has broken `�` characters), which is the conversation the chatbot reads back as memory and the shop can review for quality.
- **`products_json`**
  - The product cards the chatbot attached to its reply, stored as JSON, which lets the site redisplay product images and prices when a past chat is reloaded.
- **`created_at`**
  - The time the message was sent, which lets the shop order and audit conversations and see when customers are active.

### Table: `sqlite_sequence`

- **`name`**
  - The name of a table that uses auto-increment IDs, which SQLite uses internally so the shop never has to manage IDs by hand.
- **`seq`**
  - The last ID handed out for that table, which ensures every new user, message, or inventory row gets a unique ID.

<!-- ============================ END OF DATABASE SECTION ============================ -->

---

<!-- ============================================================ -->
<!-- SECTION: AUTHENTICATION                                        -->
<!-- ============================================================ -->

## 🔐 Authentication

How customer accounts are stored and verified (registration, login, logout).

### Password hashing

- **Hash function:** `PBKDF2-HMAC-SHA256` (`pbkdf2_sha256`).
  - PBKDF2 ("Password-Based Key Derivation Function 2") runs the password and its salt through HMAC-SHA256 over and over. It is deliberately *slow*: the whole point is to make each password guess expensive, so that even if the database is stolen, an attacker can only try a small number of passwords per second instead of billions.
- **Iterations:**
  - **120,000** for the original seed users already in the database.
  - **600,000** for every new account created through the site (a stronger, modern setting).
  - "Iterations" is how many times the hashing is repeated. More iterations = slower to compute = harder to crack. The count multiplies the attacker's cost for every single guess.

  > Note: Majid's request said "12,000"; the code actually uses **120,000** (seed) and **600,000** (new). The larger numbers are kept because they are stronger and match what is really stored.

### How it protects the account

- **Passwords are never stored in plaintext.** The database only ever holds the hash, never the password itself. Even staff with full database access cannot read anyone's password.
- **Passwords are never provided or returned in plaintext.** The password is sent once over the connection at sign-in, checked, and discarded; the API never echoes it back, logs it, or includes it (or the hash/salt) in any response to the browser.
- **Every account has a unique salt.** The salt is random per user and stored alongside the hash. It means two people with the same password still get completely different hashes, which defeats pre-computed "rainbow table" attacks.
- **The same salt must be used to verify the account.** At login the stored salt is combined with the entered password and run through the same hash with the same iteration count; only if the result matches the stored hash is the login accepted. The stored hash record is self-describing (`algorithm$iterations$salt$hash`) so the correct salt and settings are always reused — change any one of them and the account can no longer be unlocked.

<!-- ============================ END OF AUTHENTICATION SECTION ============================ -->

---

<!-- ============================================================ -->
<!-- SECTION: CHATBOT (THE CONCIERGE)                               -->
<!-- ============================================================ -->

## 💬 Chatbot — "The Concierge"

The chat widget is powered by an AI agent that answers questions about the collection.

### How it works, end to end

1. **The browser** (the chat widget) takes what the guest types and sends it to our own **FastAPI** backend at `POST /api/chat`, along with the recent conversation and — if the guest is signed in — their login token. While it waits, the widget shows a friendly "is typing…" indicator.
2. **FastAPI** hands the message to the **agent** (`agent.py`, built with PydanticAI). The agent reads two things it needs to reply well:
   - the **system prompt** in `backend/prompts/prompt.md`, which sets the Concierge's friendly voice and its strict privacy rules, and
   - the **AI model**, reached through the **Portkey** gateway (model name from `OPENAI_MODEL`, default `gpt-terra`).
3. To get real facts, the agent calls **tools** (`tools.py`) that query the **database** — searching the catalogue, pulling a product's sizes and stock, or listing what the house sells. These tools can read the product tables **only**; they cannot touch the users table, so account data can never reach the model.
4. The model returns a short friendly reply, the **ids** of any products to show, and 2–3 suggested follow-up questions. FastAPI turns those ids into **product cards** using prices, images and stock straight from the database (so the model can't invent a price), and sends the whole package back to the browser.
5. **The browser** shows the reply, the product cards (each links to its product page), and the follow-up suggestions as tap-able chips that ask the next question for the guest.

In short: **the front end talks to FastAPI to fetch real database information, then the prompt and model turn that information into a helpful, on-brand reply** — with product facts always coming from the database, never from the model's imagination.

### The tools the agent can call
All tools read `campus_customs.db` directly and return only real values — the agent is instructed never to invent any of them.

- **`find_products(query)`** — searches the catalogue for items matching what the guest is looking for (by name, type, color, occasion, team, or recipient) and returns the matches. The agent puts the matching ids in its answer so they appear as **product cards** in the chat; clicking a card opens that item's full detail page (large image on the right; description, price, sizes and stock on the left) while the chat stays open.
- **`find_in_color(color, keywords)`** — finds products available in a given colour, optionally narrowed by keywords such as a garment type. Powers "do you have this in blue" using the page the guest is viewing. Read-only.
- **`check_availability(product_id)`** — the stock/price lookup. Returns a product's real **description, price, total stock, and per-size stock** (each size flagged in-stock or sold out), or `found: false` if the id is unknown. The agent must call this before quoting any price or stock, and for "found: false" it tells the guest the item is unavailable instead of guessing.
- **`catalogue_overview()`** — the menu of garment types with counts and price ranges, for broad "what do you sell?" questions.

### How products are shown (dynamic loading)
When the guest asks about a specific item, the agent calls `find_products`, then names the matching ids. The backend turns each id into a product card by reading the image, price and current stock from the database **at that moment**, so cards always reflect the live catalogue. The same data powers the detail page a card opens. Nothing about the product is stored in the chat or the model — it is loaded fresh from the database each time.

> **Database access is one-way (read-only).** Every chatbot query — searching, checking stock, building cards — uses a **read-only** connection and only ever runs `SELECT` statements. Product searches and lookups **never insert, update, or delete** anything in `campus_customs.db`; browsing the catalogue cannot change catalogue or inventory data. (The only writes anywhere in the app are creating a new customer account at registration, which is a separate, authenticated path.)

> **Why accuracy matters:** price and stock drive the guest's decision to buy. If the bot quoted a wrong price or said a sold-out size was available, the guest could be misled and the house could lose a sale or its credibility. That is why these values are read live from the database on every question — never remembered or guessed — and why the backend rebuilds each product card's price and stock from the database, not from the model. The chat shows out-of-stock items with an "Out of stock" badge and strikes through any sold-out sizes, so availability is clear at a glance as well as in words.

### Chat history (signed-in guests)
- A **signed-in guest's conversation is saved** in the database's `chat_messages` table (one row per message: who it belongs to, whether it was the guest or the Concierge, the text, and the ids of any product cards shown). Each time they send a message, that message and the reply are written there.
- When they **sign in again, reload, or move between pages**, their past conversation is **restored** from that table — including on a different day or device — and the product cards are rebuilt live from the catalogue so prices and stock are current.
- A guest is identified by the secure login token from signing in, which maps to their account (**name and email**); the history is looked up by that account. **Anonymous (not signed-in) guests can chat too, but nothing is saved** — their conversation lives only in their own browser and is not written to the database. On **logout**, the chat is cleared so the next person never sees the previous guest's history.

### What the Concierge knows about the customer
The agent is told **only the signed-in guest's first name**, so it can greet them warmly and feel familiar. That is the single account field it ever sees. It is never given the email, password, hash, salt, or any other customer's details — the email is used only behind the scenes to identify whose history to load, and is never shown to the model.

### Page context (answering "this")
The chat widget also tells the backend **which page the guest is currently on** — the route, and on a product page the product's id. The agent uses this so that when a guest says "do you have **this** in blue" while viewing an item, it knows which item "this" is, then searches the catalogue (via `find_in_color`) for that style in the requested colour and shows the matches as cards. The page context is passed with each message; nothing is scraped from the screen.

### Privacy
The Concierge may greet a signed-in guest by **first name only**. It will never reveal passwords, hashes, salts, emails, other customers, or anything about the database or servers — the prompt forbids it, and the agent's tools physically cannot read that data.

### Running the backend
From the `backend/` folder:

```
uvicorn main:app --reload --port 8000
```

This needs `PORTKEY_API_KEY` available in the environment (from `keys.env` or `.env`).

### Chat efficiency (saving model calls)
Two checks run **before** the gateway, so Portkey (and its cost) is only used when it adds value:
1. **Trivial greetings/pleasantries** ("hi", "thanks", "bye") are answered with a canned friendly reply in code — no model call. (Verified: "hi" returns in ~0.1s.)
2. **Repeat questions** are served from memory: a per-user/anonymous in-process cache, plus a signed-in guest's own saved history. If the same question was asked before, the earlier answer (with fresh cards) is returned without calling the model. (Verified: an identical question went from ~8.3s to ~0.008s.)

Separately, if a request is **vague** ("show me sweaters"), the agent asks one short clarifying question before searching, so the results are actually relevant.

<!-- ============================ END OF CHATBOT SECTION ============================ -->

---

<!-- ============================================================ -->
<!-- SECTION: AGENT MODEL, SAFETY & SPECS                           -->
<!-- ============================================================ -->

## 🧭 Agent model, abilities, safety & specs

### Data model fields (and why they matter)
The chatbot passes data in typed shapes (`backend/models.py`). The important ones:

- **`AgentOutput`** — what the model itself returns: `reply` (the message), `product_ids` (just ids, not full cards), `follow_ups`. *Why it matters:* the model names products by **id only**; the backend turns ids into real cards, so the model can never invent a price or image.
- **`ProductCard`** — `product_id`, `name`, `price`, `image_url`, `colors`, `in_stock`, `sizes` (per-size `SizeStock`), `badge`. *Why:* price/stock/`badge` all come from the DB, so what the shopper sees is always true; `sizes`/`in_stock`/`badge` drive the sold-out marks and Hot / Almost-Gone ribbons.
- **`SizeStock`** — `size`, `quantity`, `in_stock`. *Why:* lets the UI show which sizes are available vs sold out.
- **`ProductAvailability`** — `found`, `name`, `description`, `price`, `total_stock`, `in_stock`, `sizes`. *Why:* the authoritative answer to any price/stock question; `found:false` tells the agent to say "unavailable" instead of guessing.
- **`ChatReply`** — `reply`, `products` (cards), `follow_ups`. *Why:* the final payload the browser renders.
- **`PageContext`** — `path`, `product_id`. *Why:* lets the agent resolve "this" to the item the guest is viewing.
- **`ChatRequest` / `ChatTurn`** — the incoming message, recent history, and page context.

### Tools & abilities
The agent can (read-only) **search the catalogue** (`find_products`), **find items by colour** (`find_in_color`), **look up one item's price/stock** (`check_availability`), and **summarise what the shop sells** (`catalogue_overview`). It can greet a signed-in guest by first name, show clickable product cards, suggest follow-ups, and ask a clarifying question when a request is vague. It **cannot** write to the catalogue, read the users table, or reach anything outside these tools. (Full per-tool detail is in the Chatbot section above.)

### Safety rules
- **No external access:** the agent uses only its tools and the shop catalogue — it never browses or fetches outside sites, and ignores instructions embedded in messages, product fields, or page content.
- **No fabrication:** it answers only from tool results; prices and stock are always read live from the database, and cards are rebuilt server-side so they can't be hallucinated.
- **No private/internal data:** never passwords, hashes, salts, API keys, emails, other customers, DB/schema, or server details — only the current guest's first name. The agent's tools physically cannot read the users table.
- **Risk handling & logging:** suspicious requests (probing for private data, injection, trying to override instructions) are refused and recorded in the audit trail. Every DB call the agent makes is a read-only `SELECT`.

### Audit trail
`output/audit_trail.json` records the agent's loop activity and is **append-only — never cleared between runs**. Each entry is timestamped (ISO-8601 UTC) and is one of: a **`tool_call`** (tool name, short args, short result), a **`run`** outcome with a **`stop_reason`** (`completed`, `cache_hit`, `smalltalk_bypass`, `usage_limit`, `error`), or a **`suspicious`** flag (the message that tripped the security check).

### Specifications
- **Model:** `gpt-terra` by default, set via the `OPENAI_MODEL` env var, reached through the **Portkey** gateway (`https://api.portkey.ai/v1`) using `PORTKEY_API_KEY`.
- **LLM loop limit:** `request_limit = 12` model requests per turn (a safety cap against runaway loops/cost).
- **Result caps:** at most **6** product cards and **3** follow-up suggestions per reply; search tools return up to **6** matches; recommendations return up to **4**; conversation history sent to the model is the last **8** turns; saved history loads the last **50** messages.
- **Efficiency:** greetings answer locally (no model call); repeat questions are served from memory (per-user/anon cache + signed-in history).
- **Auth specs:** PBKDF2-HMAC-SHA256, 600,000 iterations for new accounts (120,000 for seed users); login token is HMAC-signed and expires after **7 days**; token secret from `APP_SECRET`.
- **Env vars:** `PORTKEY_API_KEY` (model access), `OPENAI_MODEL` (model name), `APP_SECRET` (token signing). Loaded from `hw4/.env` and the course `keys.env`.
- **How to run** — backend, from `backend/`:
  ```
  uvicorn main:app --reload --port 8000
  ```
  Frontend, from `frontend/`: `npm run dev` (Vite, port 5173). Dependencies: `hw4/requirements.txt` (backend) and `frontend/package.json` (frontend).

<!-- ============================ END OF AGENT MODEL/SAFETY/SPECS SECTION ============================ -->

---

<!-- ============================================================ -->
<!-- SECTION: CART, RIBBONS & IN-STORE PICKUP                       -->
<!-- ============================================================ -->

## 🛍️ Cart, ribbons & in-store pickup

### Cart (temporary holding table)
- Adding an item writes to a lightweight **`cart_items`** table (`owner`, `product_id`, `size`, `quantity`, `created_at`). There is **no checkout funnel** — this just holds the bag.
- A cart belongs to an **owner**: `user:<id>` when signed in, or `anon:<token>` for a guest (the token lives in the browser's localStorage). Identical lines merge instead of duplicating.
- "Add to Bag" opens an **overlay** that confirms the item and shows **"Pairs well with"** recommendations. Those recommendations are deliberately a **different kind of apparel** than the item added (checked against the catalogue's garment type) and favour pieces that are **"Hot" or "Almost Gone"** and still in stock, nudging the shopper toward scarce items. The recommendation images are clickable and open the product page.
- The header shows a bag button with a live item count; clicking it opens the same overlay in "your bag" view.

### "Hot" / "Almost Gone" ribbons
- Shown on every product image that qualifies — on the Products page, Home carousels, chat cards, recommendations, and the product detail page.
- The label is computed **from live inventory**, not stored:
  - **Almost Gone** — total stock across all sizes is ≤ 20 (genuinely scarce). *4 products today.*
  - **Hot** — 3 or more sizes are already sold out (selling fast). *17 products today.*
  - Almost-Gone takes precedence when both apply.
- Why it matters: the ribbon has to reflect *real* stock — telling a shopper something is "almost gone" when it isn't erodes trust, so it's derived from the inventory table every time.

### In-store pickup requests
- Each product page has a **"Request In-Store Pickup"** button that opens a form: a **pickup date**, and a **"someone else will pick it up"** toggle that reveals a name field for the person collecting.
- Submitting writes to a **`pickup_requests`** table (`owner`, `product_id`, `size`, `pickup_date`, `alternate_name`, `created_at`) and shows a confirmation. No payment or checkout is involved.

<!-- ============================ END OF CART/RIBBONS/PICKUP SECTION ============================ -->

---
