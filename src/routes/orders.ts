import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { store } from '../store/db';
import { Order, OrderItem } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(requireAuth);

router.post('/', (req, res: Response) => {
  const user = (req as unknown as AuthedRequest).user;
  const cart = store.carts.get(user.id);

  if (!cart || cart.items.length === 0) {
    res.status(400).json({ error: 'Cart is empty' });
    return;
  }

  for (const item of cart.items) {
    const product = store.products.get(item.productId);
    if (!product || product.stock < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for product ${item.productId}` });
      return;
    }
  }

  const orderItems: OrderItem[] = [];
  let total = 0;

  for (const item of cart.items) {
    const product = store.products.get(item.productId)!;
    product.stock -= item.quantity;
    const subtotal = product.price * item.quantity;
    total += subtotal;
    orderItems.push({ productId: item.productId, name: product.name, price: product.price, quantity: item.quantity });
  }

  const order: Order = {
    id: uuidv4(),
    userId: user.id,
    items: orderItems,
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  store.orders.set(order.id, order);

  cart.items = [];
  cart.updatedAt = new Date().toISOString();

  res.status(201).json(order);
});

router.get('/', (req, res: Response) => {
  const user = (req as unknown as AuthedRequest).user;
  const orders = Array.from(store.orders.values())
    .filter((o) => o.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(orders);
});

router.get('/:id', (req, res: Response) => {
  const user = (req as unknown as AuthedRequest).user;
  const order = store.orders.get(req.params.id);
  if (!order || order.userId !== user.id) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json(order);
});

export default router;
