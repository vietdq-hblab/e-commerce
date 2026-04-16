import { v4 as uuidv4 } from 'uuid';
import { Product, User, Cart, Order } from '../models/types';

class DataStore {
  products: Map<string, Product> = new Map();
  users: Map<string, User> = new Map();
  usersByEmail: Map<string, string> = new Map();
  tokens: Map<string, string> = new Map();
  carts: Map<string, Cart> = new Map();
  orders: Map<string, Order> = new Map();

  constructor() {
    this.seedProducts();
  }

  private seedProducts(): void {
    const now = new Date().toISOString();
    const products: Omit<Product, 'id'>[] = [
      { name: 'T-Shirt', description: 'Classic cotton t-shirt, available in multiple sizes', price: 19.99, stock: 100, createdAt: now },
      { name: 'Mug', description: 'Ceramic coffee mug, 12oz capacity', price: 12.99, stock: 75, createdAt: now },
      { name: 'Notebook', description: 'Hardcover ruled notebook, 200 pages', price: 8.99, stock: 150, createdAt: now },
      { name: 'Sticker Pack', description: 'Assorted vinyl stickers, pack of 20', price: 4.99, stock: 200, createdAt: now },
      { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand for desks', price: 49.99, stock: 40, createdAt: now },
    ];

    for (const p of products) {
      const id = uuidv4();
      this.products.set(id, { id, ...p });
    }
  }
}

export const store = new DataStore();
