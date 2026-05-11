const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// GET /api/tasks — Dashboard: all tasks visible to user
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT t.*, 
          u.name as assignee_name, 
          p.name as project_name,
          CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as overdue
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        ORDER BY t.created_at DESC
      `);
    } else {
      result = await pool.query(`
        SELECT t.*, 
          u.name as assignee_name, 
          p.name as project_name,
          CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as overdue
        FROM tasks t
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.assignee_id = $1
          OR t.project_id IN (
            SELECT project_id FROM project_members WHERE user_id = $1
          )
          OR t.project_id IN (
            SELECT id FROM projects WHERE owner_id = $1
          )
        ORDER BY t.created_at DESC
      `, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/stats — Dashboard summary stats
router.get('/stats', async (req, res) => {
  try {
    let baseFilter = req.user.role === 'admin'
      ? ''
      : `WHERE (t.assignee_id = ${req.user.id} OR t.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = ${req.user.id}
        ))`;

    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE t.status = 'todo') as todo,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE t.status = 'done') as done,
        COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status != 'done') as overdue
      FROM tasks t
      ${baseFilter}
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tasks/project/:projectId — Tasks for a specific project
router.get('/project/:projectId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name as assignee_name,
        CASE WHEN t.due_date < NOW() AND t.status != 'done' THEN true ELSE false END as overdue
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1
      ORDER BY 
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.created_at DESC
    `, [req.params.projectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks — Admin creates tasks
router.post('/', requireAdmin, async (req, res) => {
  const { title, description, status, priority, due_date, project_id, assignee_id } = req.body;
  if (!title || !project_id) {
    return res.status(400).json({ error: 'Title and project_id are required' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO tasks (title, description, status, priority, due_date, project_id, assignee_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title,
      description || '',
      status || 'todo',
      priority || 'medium',
      due_date || null,
      project_id,
      assignee_id || null,
      req.user.id
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tasks/:id — Admin can update all fields; member can only update status
router.put('/:id', async (req, res) => {
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    if (req.user.role === 'member') {
      // Members can only update status of tasks assigned to them
      if (task.rows[0].assignee_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only update your own tasks' });
      }
      const { status } = req.body;
      if (!status) return res.status(400).json({ error: 'Status is required' });

      const result = await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
        [status, req.params.id]
      );
      return res.json(result.rows[0]);
    }

    // Admin: full update
    const { title, description, status, priority, due_date, assignee_id } = req.body;
    const result = await pool.query(`
      UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        due_date = COALESCE($5, due_date),
        assignee_id = COALESCE($6, assignee_id)
      WHERE id = $7
      RETURNING *
    `, [title, description, status, priority, due_date, assignee_id, req.params.id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tasks/:id — Admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
