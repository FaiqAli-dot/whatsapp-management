/**
 * Load test against an isolated running API (not production).
 * Usage: API_URL=http://127.0.0.1:4000 npx tsx scripts/load-test.ts
 */
import autocannon from 'autocannon';
import fs from 'node:fs';
import path from 'node:path';

const url = process.env.API_URL || 'http://127.0.0.1:4000';

async function run(name: string, pathSuffix: string, opts: Partial<autocannon.Options> = {}) {
  const result = await autocannon({
    url: `${url}${pathSuffix}`,
    connections: opts.connections ?? 20,
    duration: opts.duration ?? 10,
    method: opts.method ?? 'GET',
    headers: opts.headers,
    body: opts.body,
    ...opts,
  });
  return {
    name,
    path: pathSuffix,
    requestsPerSec: result.requests.average,
    latencyMs: {
      p50: result.latency.p50,
      p90: result.latency.p90,
      p99: result.latency.p99,
      mean: result.latency.mean,
    },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    throughputBytesAvg: result.throughput.average,
  };
}

async function main() {
  const results = [];
  results.push(await run('health', '/health', { connections: 50, duration: 8 }));
  results.push(await run('ready', '/ready', { connections: 20, duration: 8 }));
  results.push(
    await run('webhook_burst', '/api/v1/webhooks/whatsapp', {
      connections: 30,
      duration: 8,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entry: [] }),
    }),
  );
  results.push(
    await run('unauth_analytics', '/api/v1/analytics', { connections: 20, duration: 5 }),
  );

  const out = {
    measuredAt: new Date().toISOString(),
    target: url,
    note: 'Isolated env only. Not a capacity claim for production.',
    results,
  };
  const outPath = path.resolve(process.cwd(), 'load-test-results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
