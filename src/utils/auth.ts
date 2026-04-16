import crypto from 'node:crypto';
import { User, PublicUser } from '../models/types';
import { store } from '../store/db';

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256');
  const expected = Buffer.from(hash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

export function createToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  store.tokens.set(token, userId);
  return token;
}

export function getUserByToken(token: string): User | undefined {
  const userId = store.tokens.get(token);
  if (!userId) return undefined;
  return store.users.get(userId);
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
  };
}
