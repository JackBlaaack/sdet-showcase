import type { DTO } from '../../interfaces/dto.interface.js';
import type {
  OrderCreate,
  OrderCreateExpected,
  OrderCreateExpectedParams,
  OrderCreateParams,
} from '../../interfaces/order-create.interface.js';

/** Orders API tests create. Tests hard-code their expectations from these. */
export const orderCreate: DTO<OrderCreate, OrderCreateParams>[] = [
  {
    type: 'DEFAULT_ORDER_CREATE',
    data: ({ productId, couponCode }) => ({
      items: [{ productId, quantity: 2 }],
      couponCode,
    }),
  },
];

/**
 * The order the API must return for each request above, under the same `type`.
 * Prices follow from DEFAULT_SHOP_SEED: price 1000, coupon 10%.
 */
export const orderCreateExpected: DTO<
  OrderCreateExpected,
  OrderCreateExpectedParams
>[] = [
  {
    type: 'DEFAULT_ORDER_CREATE',
    // 2 x 1000 = 2000, 10% of 2000 = 200, 2000 - 200 = 1800
    data: ({ userId, productId, couponCode }) => ({
      userId,
      status: 'NEW',
      subtotalCents: 2000,
      discountCents: 200,
      totalCents: 1800,
      couponCode,
      chargeId: null,
      items: [{ productId, unitPriceCents: 1000, quantity: 2 }],
    }),
  },
];
