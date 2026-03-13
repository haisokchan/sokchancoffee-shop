const app = require('./src/app');
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ✅ dist is now built inside client folder
app.use(express.static(path.join(__dirname, 'client/dist/managecoffee/browser')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(
    path.join(__dirname, 'client/dist/managecoffee/browser/index.csr.html'),
    (err) => { if (err) res.status(500).send('Error loading app'); }
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});