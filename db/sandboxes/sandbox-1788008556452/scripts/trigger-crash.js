const axios = require('axios');

const URL = process.env.SERVICE_URL || 'http://localhost:3000';

async function run() {
  console.log('=== STARTING CONNECTION POOL EXHAUSTION TEST ===\n');

  console.log('Step 1: Sending 5 malformed requests to leak connections...');
  for (let i = 1; i <= 5; i++) {
    try {
      console.log(`Sending malformed request #${i} (missing customerId)...`);
      await axios.post(`${URL}/orders`, {});
    } catch (err) {
      console.log(`Request #${i} responded with expected 400 status: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }
  }

  console.log('\nStep 2: Querying health endpoint to check pool metrics...');
  try {
    const res = await axios.get(`${URL}/health`);
    console.log('Pool metrics:', JSON.stringify(res.data.pool, null, 2));
  } catch (err) {
    console.error('Failed to query health endpoint:', err.message);
  }

  console.log('\nStep 3: Attempting a valid request (should hang and time out because pool is exhausted)...');
  const startTime = Date.now();
  try {
    // Setting connection timeout in axios
    await axios.post(`${URL}/orders`, { customerId: 'cust-123' }, { timeout: 4000 });
    console.log('Unexpected success! The request succeeded but pool should have been exhausted.');
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Request failed after ${elapsed}s: ${err.message}`);
    console.log('Pool connection timeout verified!');
  }

  console.log('\nStep 4: Querying health endpoint again to check queue waiting status...');
  try {
    const res = await axios.get(`${URL}/health`);
    console.log('Current pool metrics:', JSON.stringify(res.data.pool, null, 2));
  } catch (err) {
    console.error('Failed to query health endpoint:', err.message);
  }

  console.log('\n=== TEST RUN COMPLETED ===');
}

run();
