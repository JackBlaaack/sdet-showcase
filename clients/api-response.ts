import type { ApiError } from './types.js';

/**
 * A response of the service layer: the status code, the raw text and the JSON
 * body parsed on demand. The body is not checked against the contract here,
 * a test does that with a schema validator.
 *
 * `data` is the body of the documented success response and `error` the body
 * of an error response. Reading the wrong one throws with the real body in the
 * message, so a test that forgot to assert the status still fails clearly.
 */
export class ApiResponse<T> {
  readonly status: number;
  readonly text: string;
  private readonly ok: boolean;

  constructor(ok: boolean, status: number, text: string) {
    this.ok = ok;
    this.status = status;
    this.text = text;
  }

  get data(): T {
    if (!this.ok) {
      throw new Error(
        `Expected a success response, got ${this.status}: ${this.text}`,
      );
    }
    return JSON.parse(this.text) as T;
  }

  get error(): ApiError {
    if (this.ok) {
      throw new Error(
        `Expected an error response, got ${this.status}: ${this.text}`,
      );
    }
    return JSON.parse(this.text) as ApiError;
  }
}
