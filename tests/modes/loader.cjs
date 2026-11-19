/* eslint-disable @typescript-eslint/no-require-imports -- Node CJS harness for in-memory TS transpilation. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '../..');

// Transpile the actual TS adapter/client in memory; no generated JS, dependencies or real network.
exports.loadSource = function (mode, fetchImpl = () => { throw new Error('Unexpected real network'); }, storage = new Map()) {
  const cache = new Map();
  const window = { sessionStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } };
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const record = { exports: {} }; cache.set(file, record);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const requireSource = spec => {
      const target = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(file), spec);
      return load(target + '.ts');
    };
    vm.runInNewContext(code, { module: record, exports: record.exports, require: requireSource,
      process: { env: { NEXT_PUBLIC_DATA_SOURCE: mode } }, window, fetch: fetchImpl,
      Response, Request, Headers, FormData, Blob, URL, DOMException, TextEncoder, crypto: webcrypto, console,
    }, { filename: file });
    return record.exports;
  }
  return { load, storage };
};
