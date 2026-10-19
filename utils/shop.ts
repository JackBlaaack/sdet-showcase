import { constants as http } from 'node:http2';
import { expect, type APIRequestContext } from '@playwright/test';
import { SutApi } from '../clients/sut-api.js';
import type { Shop, ShopSeed } from '../src/interfaces/shop.interface.js';
import { uniqueSuffix } from './unique.js';

function first<T>(items: T[], what: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`Seed response contains no ${what}`);
  }
  return item;
}

/**
 * Seeds one customer, one product and one coupon through the test hooks and
 * mints a token for the customer. Names are unique, so tests stay independent
 * and can run in parallel against one SUT. The layer fixtures call this.
 */
export async function createShop(
  request: APIRequestContext,
  seed: ShopSeed,
): Promise<Shop> {
  const api = new SutApi(request);
  const suffix = uniqueSuffix();
  const email = `customer-${suffix.toLowerCase()}@example.com`;

  const seedResponse = await api.seed({
    users: [{ email, password: seed.password }],
    products: [
      {
        sku: `SHOP-${suffix}`,
        name: `Shop product ${suffix}`,
        priceCents: seed.priceCents,
        stock: seed.stock,
      },
    ],
    coupons: [{ code: `SAVE${suffix}`, percentOff: seed.percentOff }],
  });
  expect(seedResponse.status, seedResponse.text).toBe(
    http.HTTP_STATUS_CREATED,
  );
  const seeded = seedResponse.data;
  const user = first(seeded.users, 'user');
  const product = first(seeded.products, 'product');
  const coupon = first(seeded.coupons, 'coupon');

  const tokenResponse = await api.issueToken(email);
  expect(tokenResponse.status, tokenResponse.text).toBe(http.HTTP_STATUS_OK);
  const { token } = tokenResponse.data;

  return {
    api,
    customer: { id: user.id, email, password: seed.password, token },
    product,
    coupon: { code: coupon.code, percentOff: coupon.percentOff },
  };
}
