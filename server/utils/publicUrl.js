// ML-231: fetching a web address a member typed in, safely. Without this the server could be pointed
// at itself or at a private network ("server-side request forgery") - a member adding a band gives a
// website, and the server looks at it to check the band is real.
//
// - http and https only, on the ordinary ports.
// - The name is looked up first and every address it resolves to must be a public one: not this
//   machine (127.x, ::1), not a private network (10.x, 172.16-31.x, 192.168.x, fc00::/7), not a
//   link-local or cloud metadata address (169.254.x, fe80::/10), not anything else reserved.
// - Redirects are followed by hand, a few at most, and each hop is checked the same way.
// - Nothing of the answer is handed back but "it answered" or "it didn't".
// What it can't stop: a name that answers with a public address when checked and a private one a
// moment later (DNS rebinding). Closing that needs the connection pinned to the checked address.
import dns from 'node:dns/promises';
import net from 'node:net';

const fail = (message) => Object.assign(new Error(message), { status: 400, notPublic: true });

// Pure: is this IP address one on the public internet?
export function isPublicAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;            // "this network", private, loopback, multicast and reserved
    if (a === 100 && b >= 64 && b <= 127) return false;                         // carrier-grade NAT
    if (a === 169 && b === 254) return false;                                   // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return false;                          // private
    if (a === 192 && (b === 168 || b === 0)) return false;                      // private; protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return false;                      // benchmarking
    return true;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);                 // an IPv4 address in IPv6 clothing
    if (mapped) return isPublicAddress(mapped[1]);
    if (lower === '::' || lower === '::1') return false;                        // unspecified, loopback
    if (/^f[cd]/.test(lower)) return false;                                     // unique local (fc00::/7)
    if (/^fe[89ab]/.test(lower)) return false;                                  // link-local (fe80::/10)
    if (/^ff/.test(lower)) return false;                                        // multicast
    if (/^(64:ff9b:|2001:db8:|::ffff:)/.test(lower)) return false;              // translation, documentation, other mapped forms
    return true;
  }
  return false;
}

// Pure: the shape of the address, before anything is looked up.
export function checkUrlShape(input) {
  let url;
  try { url = input instanceof URL ? input : new URL(String(input)); } catch { throw fail('That is not a web address.'); }
  if (!/^https?:$/.test(url.protocol)) throw fail('Only http and https addresses can be used.');
  if (url.username || url.password) throw fail('An address with a user name or password in it can\'t be used.');
  if (url.port && !['80', '443'].includes(url.port)) throw fail('Only the ordinary web ports can be used.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw fail('That address is not on the public internet.');
  if (net.isIP(host) && !isPublicAddress(host)) throw fail('That address is not on the public internet.');
  return url;
}

// The address is public: its shape is fine and every address its name resolves to is a public one.
export async function assertPublicUrl(input, { lookup = dns.lookup } = {}) {
  const url = checkUrlShape(input);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return url;
  let found;
  try { found = await lookup(host, { all: true }); } catch { throw fail('That website couldn\'t be found.'); }
  if (!found.length || !found.every((a) => isPublicAddress(a.address))) throw fail('That address is not on the public internet.');
  return url;
}

// Does a public website answer at this address? true / false - never the answer itself. Redirects are
// followed by hand (three at most), each one checked before it is fetched.
export async function publicSiteAnswers(input, { timeoutMs = 8000, maxRedirects = 3, lookup, fetchImpl = fetch } = {}) {
  let url = await assertPublicUrl(input, { lookup });
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let res;
    try { res = await fetchImpl(url.toString(), { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) }); } catch { return false; }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location'), url), { lookup });
      continue;
    }
    try { await res.body?.cancel(); } catch { /* nothing to drop */ }
    return res.ok;
  }
  return false;
}
