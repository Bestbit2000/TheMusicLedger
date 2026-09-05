// Cache buster: 2026-09-05T07:15:00Z

let app = null;

async function initApp() {
  if (app) return app;

  try {
    const express = (await import('express')).default;
    app = express();

    app.get('/test', (req, res) => res.json({ test: 'ok' }));
    app.get('/health', (req, res) => res.json({ status: 'healthy' }));

    return app;
  } catch (error) {
    console.error('[INIT ERROR]', error.message);
    throw error;
  }
}

export default async (req, res) => {
  try {
    const expressApp = await initApp();
    expressApp(req, res);
  } catch (error) {
    console.error('[HANDLER ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
};
