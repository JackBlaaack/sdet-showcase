import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiResponse } from './api-response.js';
import type {
  CreateOrderRequest,
  Order,
  Product,
  SeedRequest,
  SeedResult,
  TokenResult,
} from './types.js';

function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function toApiResponse<T>(
  pending: Promise<APIResponse>,
): Promise<ApiResponse<T>> {
  const response = await pending;
  return new ApiResponse<T>(
    response.ok(),
    response.status(),
    await response.text(),
  );
}

/**
 * Service layer over the orders-sut HTTP API. Methods return an ApiResponse
 * so that a test can assert the status code and read the typed body it needs.
 */
export class SutApi {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** Test hook: creates exactly the entities described. Needs ENABLE_TEST_API=true. */
  seed(payload: SeedRequest): Promise<ApiResponse<SeedResult>> {
    return toApiResponse(this.request.post('/test/seed', { data: payload }));
  }

  /** Test hook: mints a bearer token for an existing user without a password. */
  issueToken(email: string): Promise<ApiResponse<TokenResult>> {
    return toApiResponse(this.request.post('/test/token', { data: { email } }));
  }

  createOrder(
    token: string,
    payload: CreateOrderRequest,
  ): Promise<ApiResponse<Order>> {
    return toApiResponse(
      this.request.post('/api/v1/orders', {
        data: payload,
        headers: bearer(token),
      }),
    );
  }

  getProduct(productId: string): Promise<ApiResponse<Product>> {
    return toApiResponse(this.request.get(`/api/v1/products/${productId}`));
  }
}
