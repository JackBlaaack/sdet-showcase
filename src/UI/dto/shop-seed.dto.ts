import type { DTO } from '../../interfaces/dto.interface.js';
import type { ShopSeed } from '../../interfaces/shop.interface.js';

/** Shops UI tests seed. Kept apart from the API layer so each can change on its own. */
export const shopSeed: DTO<ShopSeed>[] = [
  {
    type: 'DEFAULT_SHOP_SEED',
    data: () => ({
      priceCents: 1000,
      stock: 5,
      percentOff: 10,
      password: 'shop12345',
    }),
  },
];
