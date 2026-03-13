const app = require('./src/app');
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ✅ Serve static files
app.use(express.static(path.join(__dirname, 'dist/managecoffee/browser')));

// ✅ Catch-all MUST be after API routes in src/app.js
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) return next();
  
  res.sendFile(
    path.join(__dirname, 'dist/managecoffee/browser/index.csr.html'),
    (err) => { if (err) res.status(500).send('Error loading app'); }
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});