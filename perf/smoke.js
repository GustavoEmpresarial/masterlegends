/**
 * k6 smoke against a running API (local or staging).
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3001 k6 run perf/smoke.js
 *
 * Thresholds are intentionally lenient — this is a deploy smoke, not a capacity study.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3001';

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
  });

  // Unauthenticated probe — must not 5xx
  const events = http.get(`${BASE_URL}/api/events/`);
  check(events, {
    'events without auth is 401': (r) => r.status === 401,
  });

  sleep(0.5);
}
