import type { components, paths } from './generated/schema.js';

/**
 * Names used by the rest of the code. Every type comes from the OpenAPI
 * document through `generated/schema.ts`; regenerate it with `pnpm generate:api`.
 */
type Schemas = components['schemas'];
type JsonBody<T> = T extends { content: { 'application/json': infer Body } }
  ? Body
  : never;

export type User = Schemas['User'];
export type Product = Schemas['Product'];
export type Coupon = Schemas['Coupon'];
export type Order = Schemas['Order'];
export type OrderItem = Schemas['OrderItem'];
export type OrderStatus = Schemas['OrderStatus'];
export type ApiError = Schemas['ApiError'];

export type CreateOrderRequest = JsonBody<
  paths['/api/v1/orders']['post']['requestBody']
>;
export type SeedRequest = JsonBody<
  paths['/test/seed']['post']['requestBody']
>;
export type SeedResult = JsonBody<
  paths['/test/seed']['post']['responses'][201]
>;
export type TokenResult = JsonBody<
  paths['/test/token']['post']['responses'][200]
>;
