const express = require('express');
const app = express();
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.get('/', (req, res) => {
  res.send(Buffer.from('{"error":"test"}'));
});
app.listen(3000, () => console.log('started'));
