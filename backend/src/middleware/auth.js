const supabase = require('../config/supabase');

/**
 * requireAuth middleware
 * Validates the Bearer token from the Authorization header using Supabase.
 * Attaches the authenticated `user` object to `req.user` for downstream handlers.
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.split(' ')[1];

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Attach authenticated user to request for downstream use
        req.user = data.user;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { requireAuth };
