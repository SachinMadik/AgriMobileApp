const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const STAGES = ['sowing', 'germination', 'transplanting', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest'];

function mapCycle(r) {
  return {
    id: r.id,
    crop: r.crop,
    variety: r.variety,
    field: r.field,
    area: r.area,
    sowingDate: r.sowing_date,
    expectedHarvest: r.expected_harvest,
    currentStage: r.current_stage,
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

function mapStageLog(r) {
  return { id: r.id, cycleId: r.cycle_id, stage: r.stage, date: r.date, notes: r.notes || '' };
}

// GET /crop-calendar — active cycle with stage logs
router.get('/', async (req, res, next) => {
  try {
    const cycle = await get('SELECT * FROM crop_cycles ORDER BY created_at DESC LIMIT 1');
    if (!cycle) return res.json(null);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [cycle.id]);
    res.json({ ...mapCycle(cycle), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

// GET /crop-calendar/all — all cycles
router.get('/all', async (req, res, next) => {
  try {
    const cycles = await all('SELECT * FROM crop_cycles ORDER BY created_at DESC');
    res.json(cycles.map(mapCycle));
  } catch (err) { next(err); }
});

// POST /crop-calendar — create new cycle
router.post('/', async (req, res, next) => {
  try {
    const { crop, variety, field, area, sowingDate, expectedHarvest, notes } = req.body;
    if (!crop || !sowingDate || !expectedHarvest) {
      return res.status(400).json({ error: 'crop, sowingDate and expectedHarvest are required', code: 400 });
    }
    const id = newId();
    await run(
      `INSERT INTO crop_cycles (id,crop,variety,field,area,sowing_date,expected_harvest,current_stage,notes)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, crop, variety || '', field || 'Main Field', area || '1 ha',
       sowingDate, expectedHarvest, 'sowing', notes || null]
    );
    // Auto-log sowing stage
    await run('INSERT INTO crop_stage_logs (cycle_id,stage,date,notes) VALUES (?,?,?,?)',
      [id, 'sowing', sowingDate, 'Crop cycle started']);
    const created = await get('SELECT * FROM crop_cycles WHERE id = ?', [id]);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [id]);
    res.status(201).json({ ...mapCycle(created), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

// PUT /crop-calendar/:id/stage — advance to next stage
router.put('/:id/stage', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;
    if (!stage || !STAGES.includes(stage)) {
      return res.status(400).json({ error: `stage must be one of: ${STAGES.join(', ')}`, code: 400 });
    }
    const cycle = await get('SELECT * FROM crop_cycles WHERE id = ?', [id]);
    if (!cycle) return res.status(404).json({ error: 'Crop cycle not found', code: 404 });
    await run('UPDATE crop_cycles SET current_stage = ? WHERE id = ?', [stage, id]);
    const date = new Date().toISOString().split('T')[0];
    await run('INSERT INTO crop_stage_logs (cycle_id,stage,date,notes) VALUES (?,?,?,?)',
      [id, stage, date, notes || null]);
    const updated = await get('SELECT * FROM crop_cycles WHERE id = ?', [id]);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [id]);
    res.json({ ...mapCycle(updated), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

// DELETE /crop-calendar/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const cycle = await get('SELECT * FROM crop_cycles WHERE id = ?', [id]);
    if (!cycle) return res.status(404).json({ error: 'Crop cycle not found', code: 404 });
    await run('DELETE FROM crop_stage_logs WHERE cycle_id = ?', [id]);
    await run('DELETE FROM crop_cycles WHERE id = ?', [id]);
    res.json({ success: true, id });
  } catch (err) { next(err); }
});

module.exports = router;
