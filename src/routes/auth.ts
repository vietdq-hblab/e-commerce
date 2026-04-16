import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store/db';
import { hashPassword, verifyPassword, createToken, getUserByToken, toPublicUser } from '../utils/auth';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { User } from '../models/types';

const router = Router();

router.post('/register', (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  const normalizedEmail = email.toLowerCase();
  if (store.usersByEmail.has(normalizedEmail)) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const user: User = {
    id: uuidv4(),
    email: normalizedEmail,
    name: name.trim(),
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };

  store.users.set(user.id, user);
  store.usersByEmail.set(normalizedEmail, user.id);

  const token = createToken(user.id);
  res.status(201).json({ user: toPublicUser(user), token });
});

router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const userId = store.usersByEmail.get(email.toLowerCase());
  const user = userId ? store.users.get(userId) : undefined;
  if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = createToken(user.id);
  res.status(200).json({ user: toPublicUser(user), token });
});

router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const token = req.headers.authorization!.slice(7);
  store.tokens.delete(token);
  res.status(204).send();
});

export default router;
