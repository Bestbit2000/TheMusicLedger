let app = null;

async function initApp() {
  if (app) {
    console.log('[INIT] App already initialized');
    return app;
  }

  console.log('[INIT] Starting app initialization...');

  try {
    console.log('[INIT] Importing express...');
    const express = (await import('express')).default;
    console.log('[INIT] Express imported OK');

    app = express();
    console.log('[INIT] Express app created OK');

    // Test basic middleware
    console.log('[INIT] Adding test route...');
    app.get('/test', (req, res) => {
      res.json({ test: 'ok' });
    });
    console.log('[INIT] Test route added OK');

    return app;
  } catch (error) {
    console.error('[INIT ERROR]', error.message, error.stack);
    throw error;
  }
}

export default async (req, res) => {
  try {
    console.log('[REQ]', req.method, req.url);

    const expressApp = await initApp();
    console.log('[REQ] App ready, handling request...');

    expressApp(req, res);
  } catch (error) {
    console.error('[HANDLER ERROR]', error.message);
    res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
};
