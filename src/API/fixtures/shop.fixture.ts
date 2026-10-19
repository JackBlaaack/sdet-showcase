import { expect, test as base } from '@playwright/test';
import type { ShopFixture } from '../../interfaces/fixtures.interface.js';
import { DataProvider } from '../../../utils/data-provider.js';
import { createShop } from '../../../utils/shop.js';
import { shopSeed } from '../dto/shop-seed.dto.js';

const shopSeedProvider = new DataProvider(shopSeed);

/**
 * Gives every API test its own customer, product and coupon.
 *
 * The SUT has no delete endpoints, so there is no teardown: the data is wiped
 * by POST /test/reset or by restarting the database container.
 */
export const test = base.extend<ShopFixture>({
  shop: async ({ request }, use) => {
    await use(
      await createShop(request, shopSeedProvider.getData('DEFAULT_SHOP_SEED')),
    );
  },
});

export { expect };
