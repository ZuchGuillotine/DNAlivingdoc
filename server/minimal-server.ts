import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Immediate health check endpoints
app.get('/', (req, res) => {
  res.status(200).send('OK - Server is running');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/_health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist', 'public')));

// Catch all route for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
});

// Start server immediately
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server running on 0.0.0.0:${PORT}`);
  console.log('Health checks available at /, /health, /_health, /api/health');
});