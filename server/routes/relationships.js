const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const auth = require('../middleware/authMiddleware');

// POST create relationship
router.post('/', auth, async (req, res) => {
  const { person1_id, person2_id, relationship_type } = req.body;

  if (!person1_id || !person2_id || !relationship_type) {
    return res.status(400).json({ success: false, error: 'All fields required' });
  }

  if (person1_id === person2_id) {
    return res.status(400).json({ success: false, error: 'Cannot relate a person to themselves' });
  }

  try {
    const p1 = await pool.query(
      'SELECT id FROM persons WHERE id = $1 AND tree_id = $2',
      [person1_id, req.user.treeId]
    );
    const p2 = await pool.query(
      'SELECT id FROM persons WHERE id = $1 AND tree_id = $2',
      [person2_id, req.user.treeId]
    );

    if (p1.rows.length === 0 || p2.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'One or both persons not found in your tree' });
    }

    const result = await pool.query(
      `INSERT INTO relationships (tree_id, person1_id, person2_id, relationship_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.treeId, person1_id, person2_id, relationship_type]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'Relationship already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all relationships for a person
router.get('/:personId', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, 
        p1.first_name AS person1_first, p1.last_name AS person1_last,
        p2.first_name AS person2_first, p2.last_name AS person2_last
       FROM relationships r
       JOIN persons p1 ON r.person1_id = p1.id
       JOIN persons p2 ON r.person2_id = p2.id
       WHERE r.tree_id = $1 AND (r.person1_id = $2 OR r.person2_id = $2)`,
      [req.user.treeId, req.params.personId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE relationship
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM relationships WHERE id = $1 AND tree_id = $2 RETURNING id',
      [req.params.id, req.user.treeId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Relationship not found' });
    }
    res.json({ success: true, data: { deleted: req.params.id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;