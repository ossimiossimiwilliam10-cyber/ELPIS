# Contributing to ELPIS

Welcome to the ELPIS project! This guide will help new developers get up to speed quickly with running tests and deploying the application.

## Running Unit Tests

The ELPIS project uses **Vitest** for its Node.js components. 

### Web Interface Tests
To run tests for the React frontend:

```bash
cd interface/web
npm install
npm test
```
*Tip: Use `npm run test:watch` to run the tests in watch mode during development.*

### Bridge API Tests
To run tests for the Node.js backend:

```bash
cd interface/bridge
npm install
npm test
```
*Tip: Use `npm run test:watch` to run the tests in watch mode during development.*

*(Note: Python unit tests for the backend agents are not covered in this guide at this time.)*

## Deployment to Production

The application consists of a React frontend and a Node.js backend (Bridge API) that serves it.

### Generic Build Steps

To build and run the application manually on any server:

1. **Build the Web Frontend:**
   ```bash
   cd interface/web
   npm install --include=dev
   npm run build
   ```

2. **Setup the Bridge API:**
   ```bash
   cd ../bridge
   npm install
   ```

3. **Start the Production Server:**
   ```bash
   node server.js
   ```

### Render.com Deployment

The project is natively configured for deployment on **Render.com** via the `render.yaml` file in the root directory.

When deploying to Render.com, the platform will automatically use the following configuration:
- **Build Command:** `cd interface/web && npm install --include=dev && npm run build && cd ../bridge && npm install`
- **Start Command:** `cd interface/bridge && node server.js`
- **Node Version:** 20 (Configured via environment variables)

You only need to connect the repository to Render.com, and it will handle the build and start steps automatically based on `render.yaml`.
