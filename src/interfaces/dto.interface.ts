/**
 * One named set of test data. `type` is a stable UPPER_CASE key a test asks
 * for, `data` builds a fresh object on every call so tests never share state.
 * `P` is what the data needs from the test, for example the id of a seeded product.
 */
export interface DTO<T, P = void> {
  type: string;
  data: (params: P) => T;
}
