const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { body, query, validationResult } = require('express-validator');

// ──────────────────────────────────────────────────────────
// POST /api/attendance/checkin
// Records a check-in for the authenticated employee
// ──────────────────────────────────────────────────────────
router.post(
    '/checkin',
    requireAuth,
    [
        body('work_mode')
            .optional()
            .isIn(['office', 'remote', 'hybrid', 'onsite'])
            .withMessage('work_mode must be one of: office, remote, hybrid, onsite'),
        body('note').optional().trim(),
        body('location').optional().trim(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
            });
        }

        try {
            const userId = req.user.id;
            const now = new Date().toISOString();
            const today = now.split('T')[0]; // YYYY-MM-DD

            // Prevent double check-in on the same day
            const { data: existing } = await supabase
                .from('attendance')
                .select('id, status, check_in_time')
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();

            if (existing) {
                return res.status(409).json({
                    error: 'Already checked in today',
                    record: existing,
                });
            }

            // Get or create employee record to link the attendance
            const { data: employee } = await supabase
                .from('employees')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            const { data, error } = await supabase
                .from('attendance')
                .insert({
                    user_id: userId,
                    employee_id: employee?.id || null,
                    date: today,
                    check_in_time: now,
                    work_mode: req.body.work_mode || 'office',
                    location: req.body.location || null,
                    check_in_note: req.body.note || null,
                    status: 'present',
                })
                .select()
                .single();

            if (error) {
                console.error('Check-in error:', error);
                return res.status(500).json({ error: 'Failed to record check-in' });
            }

            return res.status(201).json({
                message: 'Checked in successfully',
                record: data,
            });
        } catch (err) {
            console.error('Check-in error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ──────────────────────────────────────────────────────────
// POST /api/attendance/checkout
// Records a check-out for today's active attendance record
// ──────────────────────────────────────────────────────────
router.post(
    '/checkout',
    requireAuth,
    [body('note').optional().trim()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
            });
        }

        try {
            const userId = req.user.id;
            const now = new Date().toISOString();
            const today = now.split('T')[0];

            // Find today's open attendance record
            const { data: record, error: findErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();

            if (findErr || !record) {
                return res.status(404).json({ error: 'No active check-in found for today' });
            }

            if (record.check_out_time) {
                return res.status(409).json({ error: 'Already checked out today' });
            }

            // Calculate total work hours
            const checkInMs = new Date(record.check_in_time).getTime();
            const checkOutMs = new Date(now).getTime();
            const totalMs = checkOutMs - checkInMs;
            const breakMs = record.total_break_minutes ? record.total_break_minutes * 60 * 1000 : 0;
            const workMs = Math.max(0, totalMs - breakMs);
            const workHours = parseFloat((workMs / (1000 * 60 * 60)).toFixed(2));

            const { data, error } = await supabase
                .from('attendance')
                .update({
                    check_out_time: now,
                    check_out_note: req.body.note || null,
                    work_hours: workHours,
                    updated_at: now,
                })
                .eq('id', record.id)
                .select()
                .single();

            if (error) {
                console.error('Check-out error:', error);
                return res.status(500).json({ error: 'Failed to record check-out' });
            }

            return res.json({
                message: 'Checked out successfully',
                record: data,
            });
        } catch (err) {
            console.error('Check-out error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ──────────────────────────────────────────────────────────
// POST /api/attendance/break/start
// Starts a break for today's active attendance record
// ──────────────────────────────────────────────────────────
router.post(
    '/break/start',
    requireAuth,
    [
        body('break_type')
            .optional()
            .isIn(['lunch', 'tea', 'short', 'meeting', 'other'])
            .withMessage('Invalid break type'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
            });
        }

        try {
            const userId = req.user.id;
            const now = new Date().toISOString();
            const today = now.split('T')[0];

            const { data: record, error: findErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('user_id', userId)
                .eq('date', today)
                .maybeSingle();

            if (findErr || !record) {
                return res.status(404).json({ error: 'No active check-in found for today' });
            }

            if (record.check_out_time) {
                return res.status(409).json({ error: 'Cannot start break after check-out' });
            }

            if (record.break_start_time && !record.break_end_time) {
                return res.status(409).json({ error: 'Already on a break' });
            }

            const { data, error } = await supabase
                .from('attendance')
                .update({
                    break_start_time: now,
                    break_end_time: null,
                    break_type: req.body.break_type || 'other',
                    updated_at: now,
                })
                .eq('id', record.id)
                .select()
                .single();

            if (error) {
                console.error('Break start error:', error);
                return res.status(500).json({ error: 'Failed to start break' });
            }

            return res.json({
                message: 'Break started',
                record: data,
            });
        } catch (err) {
            console.error('Break start error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ──────────────────────────────────────────────────────────
// POST /api/attendance/break/end
// Ends the current break and accumulates break time
// ──────────────────────────────────────────────────────────
router.post('/break/end', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        const { data: record, error: findErr } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

        if (findErr || !record) {
            return res.status(404).json({ error: 'No active check-in found for today' });
        }

        if (!record.break_start_time || record.break_end_time) {
            return res.status(409).json({ error: 'No active break to end' });
        }

        // Calculate this break's duration in minutes
        const breakStartMs = new Date(record.break_start_time).getTime();
        const breakEndMs = new Date(now).getTime();
        const thisBrBreakMinutes = Math.round((breakEndMs - breakStartMs) / (1000 * 60));
        const totalBreakMinutes = (record.total_break_minutes || 0) + thisBrBreakMinutes;

        const { data, error } = await supabase
            .from('attendance')
            .update({
                break_end_time: now,
                total_break_minutes: totalBreakMinutes,
                updated_at: now,
            })
            .eq('id', record.id)
            .select()
            .single();

        if (error) {
            console.error('Break end error:', error);
            return res.status(500).json({ error: 'Failed to end break' });
        }

        return res.json({
            message: 'Break ended',
            break_duration_minutes: thisBrBreakMinutes,
            record: data,
        });
    } catch (err) {
        console.error('Break end error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────────────────
// GET /api/attendance/today
// Returns today's attendance status for the logged-in user
// ──────────────────────────────────────────────────────────
router.get('/today', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', userId)
            .eq('date', today)
            .maybeSingle();

        if (error) {
            console.error('Fetch today attendance error:', error);
            return res.status(500).json({ error: 'Failed to fetch today\'s attendance' });
        }

        return res.json({ record: data || null });
    } catch (err) {
        console.error('Fetch today attendance error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────────────────
// GET /api/attendance/history
// Returns attendance history for the logged-in user
// Query params: month (YYYY-MM), limit (default 30)
// ──────────────────────────────────────────────────────────
router.get(
    '/history',
    requireAuth,
    [
        query('month')
            .optional()
            .matches(/^\d{4}-\d{2}$/)
            .withMessage('month must be in YYYY-MM format'),
        query('limit').optional().isInt({ min: 1, max: 365 }).withMessage('limit must be 1-365'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
            });
        }

        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 30;

            let queryBuilder = supabase
                .from('attendance')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })
                .limit(limit);

            // Filter by month if provided (e.g., 2026-02)
            if (req.query.month) {
                const [year, month] = req.query.month.split('-');
                const startDate = `${year}-${month}-01`;
                const endOfMonth = new Date(parseInt(year), parseInt(month), 0);
                const endDate = `${year}-${month}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
                queryBuilder = queryBuilder.gte('date', startDate).lte('date', endDate);
            }

            const { data, error } = await queryBuilder;

            if (error) {
                console.error('Fetch attendance history error:', error);
                return res.status(500).json({ error: 'Failed to fetch attendance history' });
            }

            return res.json({ records: data || [] });
        } catch (err) {
            console.error('Fetch attendance history error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ──────────────────────────────────────────────────────────
// GET /api/attendance/stats
// Returns attendance statistics: present days, total hours,
// average hours/day, absent days for the logged-in user
// ──────────────────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Default: current month
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const startDate = `${year}-${month}-01`;
        const endOfMonth = new Date(year, now.getMonth() + 1, 0);
        const endDate = `${year}-${month}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('attendance')
            .select('status, work_hours, date')
            .eq('user_id', userId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) {
            console.error('Fetch stats error:', error);
            return res.status(500).json({ error: 'Failed to fetch attendance stats' });
        }

        const records = data || [];
        const presentDays = records.filter((r) => r.status === 'present' || r.status === 'late').length;
        const absentDays = records.filter((r) => r.status === 'absent').length;
        const totalHours = records.reduce((sum, r) => sum + (r.work_hours || 0), 0);
        const avgHoursPerDay = presentDays > 0 ? parseFloat((totalHours / presentDays).toFixed(1)) : 0;

        return res.json({
            stats: {
                present_days: presentDays,
                absent_days: absentDays,
                total_hours: parseFloat(totalHours.toFixed(1)),
                avg_hours_per_day: avgHoursPerDay,
                month: `${year}-${month}`,
            },
        });
    } catch (err) {
        console.error('Fetch stats error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
