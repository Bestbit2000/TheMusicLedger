// ML-147: pg-connection-string currently treats sslmode=require/prefer/verify-ca as aliases for
// verify-full (full certificate chain + hostname verification) - so today's connections are
// already as strict as verify-full. The next major version (pg-connection-string v3/pg v9) drops
// that aliasing and adopts standard libpq semantics instead, which are weaker for 'require'
// (certificate presence only, no hostname check). Rewriting to the literal 'verify-full' mode
// keeps today's behaviour locked in explicitly, rather than silently inheriting whatever 'require'
// becomes once that change lands. Shared by server/config/db.js and db/migrate.js - both build a
// pg client/pool straight from DATABASE_URL.
export function withVerifyFullSsl(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
