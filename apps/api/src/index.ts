import express from 'express';

const app = express();
const port = process.env.PORT ?? 3001;

// Stub only — not yet wired to real data. See README §2 for the planned routes:
// GET /api/terms, GET /api/courses, GET /api/courses/:id, GET /api/sections/:id/grades
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`TitanTrack API listening on http://localhost:${port}`);
});
