import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { store } from '../store/db';
import { Cart, CartItem } from '../models/types';

const router = Router();

function getOrCreateCart(userId: string): Cart {
  if (!store.carts.has(userId)) {
    store.carts.set(userId, { userId, items: [], updatedAt: new Date().toISOString() });
  }
  return store.carts.get(userId)!;
}

function expandCart(cart: Cart) {
  let total = 0;
  const items = cart.items.map((item) => {
    const product = store.products.get(item.productId);
    const name = product ? product.name : '';
    const price = product ? product.price : 0;
    const subtotal = price * item.quantity;
    total += subtotal;
    return { productId: item.productId, name, price, quantity: item.quantity, subtotal };
  });
  return { userId: cart.userId, items, total, updatedAt: cart.updatedAt };
}

router.use(requireAuth);

router.get('/', (req, res: Response) => {
  const user = (req as AuthedRequest).user;
  const cart = getOrCreateCart(user.id);
  res.json(expandCart(cart));
});

router.post('/items', (req, res: Response) => {
  const user = (req as AuthedRequest).user;
  const { productId, quantity } = req.body;

  if (!productId || quantity === undefined) {
    res.status(400).json({ error: 'productId and quantity are required' });
    return;
  }

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    res.status(400).json({ error: 'quantity must be an integer >= 1' });
    return;
  }

  const product = store.products.get(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const cart = getOrCreateCart(user.id);
  const existing = cart.items.find((i) => i.productId === productId);

  if (existing) {
    const newQty = Math.min(existing.quantity + qty, product.stock);
    existing.quantity = newQty;
  } else {
    if (qty > product.stock) {
      res.status(400).json({ error: 'quantity exceeds available stock' });
      return;
    }
    cart.items.push({ productId, quantity: qty });
  }

  cart.updatedAt = new Date().toISOString();
  res.json(expandCart(cart));
});

router.patch('/items/:productId', (req, res: Response) => {
  const user = (req as unknown as AuthedRequest).user;
  const { productId } = req.params;
  const { quantity } = req.body;

  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    res.status(400).json({ error: 'quantity must be an integer >= 1' });
    return;
  }

  const product = store.products.get(productId);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  if (qty > product.stock) {
    res.status(400).json({ error: 'quantity exceeds available stock' });
    return;
  }

  const cart = getOrCreateCart(user.id);
  const existing = cart.items.find((i) => i.productId === productId);
  if (!existing) {
    res.status(404).json({ error: 'Item not in cart' });
    return;
  }

  existing.quantity = qty;
  cart.updatedAt = new Date().toISOString();
  res.json(expandCart(cart));
});

router.delete('/items/:productId', (req, res: Response) => {
  const user = (req as unknown as AuthedRequest).user;
  const { productId } = req.params;

  const cart = getOrCreateCart(user.id);
  const idx = cart.items.findIndex((i) => i.productId === productId);
  if (idx === -1) {
    res.status(404).json({ error: 'Item not in cart' });
    return;
  }

  cart.items.splice(idx, 1);
  cart.updatedAt = new Date().toISOString();
  res.json(expandCart(cart));
});

router.delete('/', (req, res: Response) => {
  const user = (req as AuthedRequest).user;
  const cart = getOrCreateCart(user.id);
  cart.items = [];
  cart.updatedAt = new Date().toISOString();
  res.json(expandCart(cart));
});

export default router;
