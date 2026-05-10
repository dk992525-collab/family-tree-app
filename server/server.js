const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const personRoutes = require('./routes/persons');
const relationshipRoutes = require('./routes/relationships');

const app = express();

app.use(cors({
    origin: ['https://tree-play.netlify.app', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/relationships', relationshipRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Family Tree API running' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});