import type { DTO } from '../src/interfaces/dto.interface.js';

/** Hands out test data from a DTO list by its `type`. */
export class DataProvider<T, P = void> {
  private readonly dtos: readonly DTO<T, P>[];

  constructor(dtos: readonly DTO<T, P>[]) {
    this.dtos = dtos;
  }

  /** A fresh copy of the data set `type`. Throws when the DTO list has no such set. */
  getData(type: string, params: P): T {
    const dto = this.dtos.find((item) => item.type === type);
    if (dto === undefined) {
      const known = this.dtos.map((item) => item.type).join(', ');
      throw new Error(`No DTO of type '${type}', known types: ${known}`);
    }
    return dto.data(params);
  }
}
