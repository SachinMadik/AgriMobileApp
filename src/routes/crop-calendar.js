const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const STAGES = ['sowing', 'germination', 'transplanting', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest'];
function mapCycle(r) {
  return { id: r.id, crop: r.crop, variety: r.variety, field: r.field, area: r.area,
    sowingDate: r.sowing_date, expectedHarvest: r.expected_harvest, currentStage: r.current_stage,
    notes: r.notes || '', createdAt: r.created_at };
}
function mapStageLog(r) { return { id: r.id, cycleId: r.cycle_id, stage: r.stage, date: r.date, notes: r.notes || '' }; }

router.get('/', async (req, res, next) => {
  try {
    const cycle = await get('SELECT * FROM crop_cycles WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.userId]);
    if (!cycle) return res.json(null);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [cycle.id]);
    res.json({ ...mapCycle(cycle), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

router.get('/all', async (req, res, next) => {
  try {
    res.json((await all('SELECT * FROM crop_cycles WHERE user_id = ? ORDER BY created_at DESC', [req.userId])).map(mapCycle));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { crop, variety, field, area, sowingDate, expectedHarvest, notes } = req.body;
    if (!crop || !sowingDate || !expectedHarvest) {
      return res.status(400).json({ error: 'crop, sowingDate and expectedHarvest are required', code: 400 });
    }
    const id = newId();
    await run(
      `INSERT INTO crop_cycles (id,user_id,crop,variety,field,area,sowing_date,expected_harvest,current_stage,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, req.userId, crop, variety || '', field || 'Main Field', area || '1 ha', sowingDate, expectedHarvest, 'sowing', notes || null]
    );
    await run('INSERT INTO crop_stage_logs (cycle_id,stage,date,notes) VALUES (?,?,?,?)', [id, 'sowing', sowingDate, 'Crop cycle started']);
    const created = await get('SELECT * FROM crop_cycles WHERE id = ?', [id]);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [id]);
    res.status(201).json({ ...mapCycle(created), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

router.put('/:id/stage', async (req, res, next) => {
  try {
    const { stage, notes } = req.body;
    if (!stage || !STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of: ${STAGES.join(', ')}`, code: 400 });
    const cycle = await get('SELECT * FROM crop_cycles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!cycle) return res.status(404).json({ error: 'Crop cycle not found', code: 404 });
    await run('UPDATE crop_cycles SET current_stage = ? WHERE id = ?', [stage, req.params.id]);
    await run('INSERT INTO crop_stage_logs (cycle_id,stage,date,notes) VALUES (?,?,?,?)',
      [req.params.id, stage, new Date().toISOString().split('T')[0], notes || null]);
    const updated = await get('SELECT * FROM crop_cycles WHERE id = ?', [req.params.id]);
    const stageLogs = await all('SELECT * FROM crop_stage_logs WHERE cycle_id = ? ORDER BY date ASC', [req.params.id]);
    res.json({ ...mapCycle(updated), stageLogs: stageLogs.map(mapStageLog), allStages: STAGES });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const cycle = await get('SELECT * FROM crop_cycles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!cycle) return res.status(404).json({ error: 'Crop cycle not found', code: 404 });
    await run('DELETE FROM crop_stage_logs WHERE cycle_id = ?', [req.params.id]);
    await run('DELETE FROM crop_cycles WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

module.exports = router;
