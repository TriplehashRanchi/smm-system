import './config.js';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import mariadb from 'mariadb';
import { connect } from 'node:net';
import { databaseUnavailable, recordDatabaseFailure } from './services/database-availability.service.js';

const url = new URL(process.env.DATABASE_URL);
if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must use MySQL.');
const pool = mariadb.createPool({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
  // Match the application's utf8mb4 tables when comparing bound text parameters.
  collation: 'UTF8MB4_UNICODE_CI',
  connectionLimit: 2,
  minimumIdle: 0,
  idleTimeout: 0,
  prepareCacheLength: 0,
  connectTimeout: 5000,
  acquireTimeout: 6000,
  initializationTimeout: 5000,
  // The driver retries failed authentication internally. During a hosting quota
  // cooldown, fail locally rather than opening more connections to the provider.
  stream: (callback) => {
    if (databaseUnavailable()?.code === 'DATABASE_QUOTA_EXCEEDED') {
      queueMicrotask(() => callback(Object.assign(new Error('Database connection cooldown.'), { errno: 1226 })));
      return;
    }
    return connect({ host: url.hostname, port: Number(url.port || 3306) }).setNoDelay(true);
  },
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});
pool.on('error', recordDatabaseFailure);
// MariaDB's binary prepared statements assign a conflicting collation to LIKE
// parameters on this host. The driver's parameterized text protocol preserves
// Unicode comparisons and still escapes values through its query API.
const adapter = new PrismaMariaDb(pool, { disposeExternalPool: true, useTextProtocol: true });
export const db = new PrismaClient({ adapter, log: [] });
