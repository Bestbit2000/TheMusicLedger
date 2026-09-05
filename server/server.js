import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Dynamic import ensures dotenv has loaded before app.js (and anything it
// imports, like the Google config) reads process.env. Static imports are
// hoisted in ES modules and would run before the dotenv.config() call above.
const { default: app } = await import('./app.js');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎵 TheMusicLedger backend running on http://localhost:${PORT}`);
});
