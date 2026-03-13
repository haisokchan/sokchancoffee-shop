const app = require('./src/app');
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ✅ Serve Angular static files (JS, CSS, images etc.)
app.use(express.static(path.join(__dirname, 'dist/managecoffee/browser')));

// ✅ Catch-all: send index.csr.html for ALL Angular routes
// /login, /dashboard, /product, /cart etc. all go to Angular router
// Only skip /api/* routes so your backend API still works
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  res.sendFile(
    path.join(__dirname, 'dist/managecoffee/browser/index.csr.html'),
    (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error loading application');
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API URL: http://localhost:${PORT}/api`);
});