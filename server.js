const app = require('./src/app');
const express = require('express'); // ✅ FIX: import express
const path = require('path');

const PORT = process.env.PORT || 3000;

// ✅ Serve Angular static files
app.use(express.static(path.join(__dirname, 'dist/managecoffee/browser')));

// ✅ FIX: SSR build generates "index.csr.html" not "index.html"
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/managecoffee/browser/index.csr.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});