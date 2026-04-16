import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store/db';
import { requireAuth } from '../middleware/auth';
import { Product } from '../models/types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const q = req.query.q as string | undefined;
  let products = Array.from(store.products.values());

  if (q) {
    const lower = q.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    );
  }

  res.json(products);
});

router.get('/:id', (req: Request, res: Response) => {
  const product = store.products.get(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json(product);
});

router.post('/', requireAuth, (req: Request, res: Response) => {
  const { name, description, price, stock } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (price === undefined || price === null || typeof price !== 'number' || price < 0) {
    res.status(400).json({ error: 'Price must be a non-negative number' });
    return;
  }
  if (stock === undefined || stock === null || typeof stock !== 'number' || stock < 0) {
    res.status(400).json({ error: 'Stock must be a non-negative number' });
    return;
  }

  const product: Product = {
    id: uuidv4(),
    name: name.trim(),
    description: description || '',
    price,
    stock,
    createdAt: new Date().toISOString(),
  };

  store.products.set(product.id, product);
  res.status(201).json(product);
});

router.put('/:id', requireAuth, (req: Request, res: Response) => {
  const product = store.products.get(req.params.id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const { name, description, price, stock } = req.body;

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ error: 'Name must be a non-empty string' });
    return;
  }
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    res.status(400).json({ error: 'Price must be a non-negative number' });
    return;
  }
  if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
    res.status(400).json({ error: 'Stock must be a non-negative number' });
    return;
  }

  const updated: Product = {
    ...product,
    ...(name !== undefined && { name: name.trim() }),
    ...(description !== undefined && { description }),
    ...(price !== undefined && { price }),
    ...(stock !== undefined && { stock }),
  };

  store.products.set(updated.id, updated);
  res.json(updated);
});

router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  if (!store.products.has(req.params.id)) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  store.products.delete(req.params.id);
  res.status(204).send();
});

export default router;
