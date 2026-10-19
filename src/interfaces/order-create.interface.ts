import type {
  CreateOrderRequest,
  Order,
  OrderItem,
} from '../../clients/types.js';

/**
 * Body of POST /api/v1/orders: 1-20 items of { productId (uuid), quantity 1-99 }
 * and an optional couponCode of up to 40 characters. Taken from the OpenAPI
 * document, so it follows the contract after `pnpm generate:api`.
 */
export type OrderCreate = CreateOrderRequest;

/** What an order DTO needs from the test: ids of the product and coupon seeded for it. */
export interface OrderCreateParams {
  productId: string;
  couponCode: string;
}

/**
 * Fields of the created order a test checks. Ids, sku, name and timestamps are
 * left out. A type, not an interface: `toMatchObject` needs a Record.
 */
export type OrderCreateExpected = Pick<
  Order,
  | 'userId'
  | 'status'
  | 'subtotalCents'
  | 'discountCents'
  | 'totalCents'
  | 'couponCode'
  | 'chargeId'
> & {
  items: Pick<OrderItem, 'productId' | 'unitPriceCents' | 'quantity'>[];
};

/** What the expected order needs from the test besides the order params. */
export interface OrderCreateExpectedParams extends OrderCreateParams {
  userId: string;
}
