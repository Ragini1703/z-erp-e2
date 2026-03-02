const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// ──────────────────────────────────────────────────────────
// GET /api/employees/me
// Returns the logged-in user's employee profile
// ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Fetch employee error:', error);
            return res.status(500).json({ error: 'Failed to fetch employee profile' });
        }

        if (!data) {
            // Auto-create a skeleton employee record for new users
            const authUser = req.user;
            const fullName =
                authUser.user_metadata?.full_name ||
                authUser.user_metadata?.name ||
                authUser.email?.split('@')[0] ||
                'Employee';

            const { data: created, error: createErr } = await supabase
                .from('employees')
                .insert({
                    user_id: userId,
                    full_name: fullName,
                    email: authUser.email,
                    status: 'active',
                })
                .select()
                .single();

            if (createErr) {
                console.error('Create employee error:', createErr);
                return res.status(500).json({ error: 'Failed to create employee profile' });
            }

            return res.json({ employee: created });
        }

        return res.json({ employee: data });
    } catch (err) {
        console.error('Get employee error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────────────────
// PUT /api/employees/me
// Update the logged-in user's employee profile
// ──────────────────────────────────────────────────────────
const validateUpdateEmployee = [
    body('full_name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('department').optional().trim(),
    body('position').optional().trim(),
    body('emergency_contact_name').optional().trim(),
    body('emergency_contact_relationship').optional().trim(),
    body('emergency_contact_phone').optional().trim(),
];

router.put('/me', requireAuth, validateUpdateEmployee, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
        });
    }

    try {
        const userId = req.user.id;

        const allowedFields = [
            'full_name',
            'phone',
            'address',
            'department',
            'position',
            'manager',
            'emergency_contact_name',
            'emergency_contact_relationship',
            'emergency_contact_phone',
            'bank_name',
            'bank_account_number',
            'bank_routing_number',
            'avatar_url',
        ];

        // Only pick allowed fields from request body
        const updates = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            console.error('Update employee error:', error);
            return res.status(500).json({ error: 'Failed to update employee profile' });
        }

        return res.json({ employee: data, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Update employee error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────────────────
// GET /api/employees
// Returns all employees (admin view)
// ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Fetch employees error:', error);
            return res.status(500).json({ error: 'Failed to fetch employees' });
        }

        return res.json({ employees: data || [] });
    } catch (err) {
        console.error('Get employees error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ──────────────────────────────────────────────────────────
// GET /api/employees/:id
// Returns a specific employee by their id
// ──────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        return res.json({ employee: data });
    } catch (err) {
        console.error('Get employee by ID error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
