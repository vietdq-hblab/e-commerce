# hblab-ecommerce

Simple TypeScript e-commerce REST API built with Express 4, Node.js 20, and an in-memory data store.

## Quick start

```bash
npm install
npm run dev          # ts-node-dev on src/server.ts
# or
npm run build && npm start
```

Server listens on `PORT` (default `3000`): `http://localhost:3000`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run with live reload via `ts-node-dev` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server from `dist/` |
| `npm run typecheck` | `tsc --noEmit` |

## Project layout

```
src/
  models/types.ts      # Product, User, Cart, Order, ...
  store/db.ts          # in-memory singleton (seeded with 5 products)
  utils/auth.ts        # pbkdf2 password hashing + token helpers
  middleware/auth.ts   # requireAuth + AuthedRequest
  routes/auth.ts       # /auth/register, /auth/login, /auth/logout
  routes/products.ts   # /products CRUD
  routes/cart.ts       # /cart CRUD (per-user)
  routes/orders.ts     # /orders checkout + list
  server.ts            # Express entry
```

## API

All authenticated endpoints require header `Authorization: Bearer <token>`.

### Auth
| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password, name }` | no |
| POST | `/auth/login` | `{ email, password }` | no |
| POST | `/auth/logout` | — | yes |

### Products
| Method | Path | Body | Auth |
|---|---|---|---|
| GET | `/products?q=search` | — | no |
| GET | `/products/:id` | — | no |
| POST | `/products` | `{ name, description, price, stock }` | yes |
| PUT | `/products/:id` | partial product | yes |
| DELETE | `/products/:id` | — | yes |

### Cart (all require auth)
| Method | Path | Body |
|---|---|---|
| GET | `/cart` | — |
| POST | `/cart/items` | `{ productId, quantity }` |
| PATCH | `/cart/items/:productId` | `{ quantity }` |
| DELETE | `/cart/items/:productId` | — |
| DELETE | `/cart` | — (clears cart) |

### Orders (all require auth)
| Method | Path | Description |
|---|---|---|
| POST | `/orders` | Checkout current cart. Decrements product stock, clears cart. |
| GET | `/orders` | List current user's orders (newest first) |
| GET | `/orders/:id` | Get single order (must belong to caller) |

### Health
`GET /health` → `{ status: 'ok' }`

## Example flow

```bash
# register
TOKEN=$(curl -s -X POST localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"secret123","name":"Alice"}' | jq -r .token)

# pick a product
PID=$(curl -s localhost:3000/products | jq -r '.[0].id')

# add to cart
curl -X POST localhost:3000/cart/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$PID\",\"quantity\":2}"

# checkout
curl -X POST localhost:3000/orders -H "Authorization: Bearer $TOKEN"
```

## Notes

- Data lives in memory; the server resets on restart. Swap `src/store/db.ts` for a persistent store when needed.
- Passwords are hashed with PBKDF2-SHA256 (10k iterations, 32-byte key). Tokens are 32-byte random hex stored in the in-memory map.
- No RBAC — any authenticated user can create/update/delete products. Add roles to `User` and a check in route handlers when needed.
