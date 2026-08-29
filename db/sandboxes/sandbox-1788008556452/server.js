const express = require('express');
const { Pool } = require('pg');
const logger = require('./logger');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000, // wait up to 2 seconds to acquire a connection
});

// Log pool events
pool.on('connect', (client) => {
  logger.info({ event: 'pool_connect' }, 'Database client connected to pool');
});

pool.on('error', (err, client) => {
  logger.error({ event: 'pool_error', err }, 'Unexpected database client error on idle client');
});

app.post('/orders', async (req, res) => {
  let client;
  logger.info({ event: 'order_request_received', body: req.body }, 'Received order creation request');

  try {
    logger.info({ event: 'pool_acquire_start' }, 'Acquiring database connection from pool');
    client = await pool.connect();
    logger.info({ event: 'pool_acquire_success' }, 'Successfully acquired connection');

    // Simulate database query delay (2 seconds)
    logger.info({ event: 'db_query_start' }, 'Executing database query (simulated)...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    logger.info({ event: 'db_query_complete' }, 'Database query completed');

    // BUG: Validation path throws and leaks connection
    if (!req.body.customerId) {
      logger.warn({ event: 'validation_failure' }, 'Validation failed: missing customerId. Connection LEAKED due to unhandled block.');
      throw new Error("Missing customerId");
    }

    // Success path
    client.release();
    logger.info({ event: 'pool_release' }, 'Released connection back to pool');
    
    return res.status(201).json({
      status: 'success',
      orderId: Math.floor(Math.random() * 1000000)
    });

  } catch (err) {
    logger.error({ event: 'order_request_error', err: err.message }, 'Error in order processing');

    if (err.message === "Missing customerId") {
      // INTENTIONAL LEAK: Developer returns early, forgets to call client.release()
      logger.error({ event: 'connection_leak' }, 'Leak warning: client connection is not released due to early validation return.');
      return res.status(400).json({ error: 'Missing customerId validation error' });
    }

    // Safe path for general errors
    if (client) {
      client.release();
      logger.info({ event: 'pool_release_error' }, 'Released connection after general error');
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/health', async (req, res) => {
  const totalConnections = pool.totalCount;
  const idleConnections = pool.idleCount;
  const waitingConnections = pool.waitingCount;

  logger.info({
    event: 'health_check',
    totalConnections,
    idleConnections,
    waitingConnections
  }, 'Health check queried');

  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    pool: {
      total: totalConnections,
      idle: idleConnections,
      waiting: waitingConnections,
      maxLimit: 5
    }
  });
});

app.listen(PORT, () => {
  logger.info({ event: 'server_started', port: PORT }, `order-service running on port ${PORT}`);
});
