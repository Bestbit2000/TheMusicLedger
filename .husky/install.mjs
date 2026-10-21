// Run by `npm install` / `npm ci` (package.json "prepare"). Sets up the git hooks on a developer's
// machine, and does nothing on a Vercel build: there is no .git there, and with NODE_ENV=production
// npm leaves husky (a devDependency) out, so a plain "prepare": "husky" would fail the build.
// The live site must run with NODE_ENV=production (Admin -> Security -> This site checks it).
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) process.exit(0);

let husky;
try {
  husky = (await import('husky')).default;
} catch {
  process.exit(0); // installed without devDependencies - nothing to set up
}
console.log(husky());
