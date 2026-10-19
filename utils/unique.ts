import { randomUUID } from 'node:crypto';

/**
 * Short upper-case token for names, SKUs and coupon codes. Keeps seeded
 * entities unique across parallel workers and repeated runs.
 */
export function uniqueSuffix(length = 10): string {
  return randomUUID().replaceAll('-', '').slice(0, length).toUpperCase();
}
