import type { SutApi } from '../../clients/sut-api.js';
import type { Product } from '../../clients/types.js';

/** Values a seeded shop starts with. Each layer (API, UI) keeps its own DTO in its `dto/`. */
export interface ShopSeed {
  priceCents: number;
  stock: number;
  percentOff: number;
  password: string;
}

export interface ShopCustomer {
  id: string;
  email: string;
  password: string;
  token: string;
}

export interface ShopCoupon {
  code: string;
  percentOff: number;
}

/** A customer, a product and a coupon seeded for one test, plus the client to drive them. */
export interface Shop {
  api: SutApi;
  customer: ShopCustomer;
  product: Product;
  coupon: ShopCoupon;
}
