/**
 * Standard 档位并发压测脚本（文档记录用）
 * 用法: node scripts/load-test-standard.mjs --url http://localhost:8787 --concurrency 100
 */
const args = process.argv.slice(2);
const url = args.includes('--url')
  ? args[args.indexOf('--url') + 1]
  : 'http://localhost:8787';
const concurrency = args.includes('--concurrency')
  ? Number(args[args.indexOf('--concurrency') + 1])
  : 100;

async function ping(i) {
  const started = Date.now();
  const res = await fetch(`${url}/api/health`);
  return { i, ok: res.ok, ms: Date.now() - started };
}

const started = Date.now();
const results = await Promise.all(
  Array.from({ length: concurrency }, (_, i) => ping(i)),
);
const elapsed = Date.now() - started;
const ok = results.filter((r) => r.ok).length;
const p95 = results.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(concurrency * 0.95)] ?? 0;

console.log(
  JSON.stringify(
    {
      url,
      concurrency,
      ok,
      failed: concurrency - ok,
      elapsedMs: elapsed,
      p95Ms: p95,
    },
    null,
    2,
  ),
);

if (ok < concurrency) {
  process.exitCode = 1;
}
