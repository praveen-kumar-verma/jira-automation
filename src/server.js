require('dotenv').config();

const express = require('express');
const issueRoutes = require('./routes/issues');
const logger = require('./logger');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'jira-automation-local-demo',
    status: 'ok'
  });
});

app.use('/', issueRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

app.use((error, req, res, next) => {
  logger.error('Unhandled server error', { error: error.message });
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const server = app.listen(port, () => {
  logger.info('Jira automation demo server started', {
    port,
    baseUrl: `http://localhost:${port}`
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use`, {
      hint: `Stop the existing process or set PORT to another value, for example PORT=3001.`
    });
    process.exit(1);
  }

  logger.error('Failed to start server', { error: error.message });
  process.exit(1);
});
