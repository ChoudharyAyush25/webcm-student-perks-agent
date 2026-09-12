import cors from 'cors';
import express from 'express';
import { discoverOffers } from './agent/discover.js';

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'student-perks-agent-api' });
});

app.post('/api/offers/discover', async (request, response) => {
  try {
    const result = await discoverOffers(request.body);
    return response.status(result.status).json(result.body);
  } catch (error) {
    return response.status(502).json({
      error: 'Live browser research failed',
      details: error instanceof Error ? error.message : String(error),
      offers: [],
    });
  }
});

app.use((error, _request, response, _next) => {
  response.status(error?.status || 500).json({
    error: 'API request failed',
    details: error instanceof Error ? error.message : String(error),
    offers: [],
  });
});

app.listen(port, () => {
  console.log(`Student Perks Agent API listening on http://localhost:${port}`);
});
