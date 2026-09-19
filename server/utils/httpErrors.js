// Central error-response helper for API routes. error.status is only ever set by a service's own
// withStatus(4xx, 'human message') validation throw (metronomeSetups.js/flows.js) - that message
// is deliberately written to be shown to the user, so it's passed through as-is. Anything else (a
// raw exception - a DB error, a bug, schema drift like a migration not yet applied on this
// environment) has no such guarantee: its real message is logged server-side (most call sites had
// no server-side logging at all before this) and the client gets a generic, safe fallback instead
// of whatever internal detail the exception happened to contain - e.g. a raw
// `relation "..." does not exist` Postgres error, which used to reach the user's own toast verbatim.
export function sendError(res, error, fallbackMessage = 'Something went wrong. Please try again.') {
  const status = error.status || 500;
  if (status < 500) {
    return res.status(status).json({ error: error.message });
  }
  console.error(error);
  res.status(status).json({ error: fallbackMessage });
}
