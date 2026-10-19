// Saves the OpenAPI document of the system under test to spec/openapi.json.
//
// The default source is the running orders-sut instance (BASE_URL, default
// http://localhost:3000). Set OPENAPI_SOURCE to a URL or a file path to read the
// document from somewhere else, for example the openapi.json in the orders-sut
// repository.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const source = process.env.OPENAPI_SOURCE ?? `${baseUrl}/openapi.json`;
const target = new URL('../spec/openapi.json', import.meta.url);

async function readSource() {
  if (!/^https?:\/\//.test(source)) {
    return readFile(source, 'utf8');
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`GET ${source} answered ${response.status}`);
  }
  return response.text();
}

const spec = JSON.parse(await readSource());
const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const operations = Object.values(spec.paths ?? {}).reduce(
  (count, item) => count + Object.keys(item).filter((key) => httpMethods.includes(key)).length,
  0,
);

await mkdir(new URL('./', target), { recursive: true });
await writeFile(target, `${JSON.stringify(spec, null, 2)}\n`);

console.log(
  `Saved ${source} to spec/openapi.json (OpenAPI ${spec.openapi}, ${operations} operations)`,
);
