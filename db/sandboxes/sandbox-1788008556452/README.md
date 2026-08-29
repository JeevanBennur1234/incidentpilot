# Order Service (Buggy Microservice Demo)

This is a Node.js/Express microservice designed to simulate a database connection pool leak. It connects to a Postgres database using `pg.Pool` with a maximum limit of **5 connections**.

## Folder Structure
- `server.js` - Express microservice server containing the pool connection and buggy order creation endpoint.
- `logger.js` - Pino logger configuring structured JSON output.
- `scripts/trigger-crash.js` - Test script that sends malformed payloads to exhaust the connection pool.
- `Dockerfile` & `docker-compose.yml` - Dockerization setup to launch the database and the app.

---

## How to Run the Service

### 1. Start the microservice and database
Run the following command in this directory to spin up the Postgres database and build/run the `order-service` container:
```bash
docker compose up --build
```

### 2. Install dependencies locally (for running the crash script)
In another terminal session inside the `demo-service/` directory, install local packages (required for running the client load script):
```bash
npm install
```

### 3. Run the leak/exhaustion test
Trigger the connection leak by executing the script:
```bash
node scripts/trigger-crash.js
```

---

## What to Observe

### In the Crash Script Output
1. The script will send **5 malformed requests** which trigger a `400 Bad Request` validation error.
2. The query to `/health` will show that all **5 connections** are currently active (`total: 5`, `idle: 0`).
3. The script will then attempt to send a valid request (`{"customerId": "cust-123"}`). Because all 5 connections are leaked/exhausted, this request will hang.
4. After 4 seconds, the client request will fail with a `timeout` error.
5. The final `/health` query will show `waiting: 1` as the client is queued waiting for an available connection from the exhausted pool.

### In the Docker Logs
You will see structured JSON logs printed by `pino`. Look for the following signature events:
* `{"event":"connection_leak"}` logs highlighting that a database connection was acquired but not released.
* `{"event":"order_request_error","err":"Missing customerId"}` showing the error occurred inside the unhandled path.
