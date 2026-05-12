import { Hono } from 'hono';
import type { Env } from './types';
import authRoutes from './routes/auth';
import challengeRoutes from './routes/challenges';
import leaderboardRoutes from './routes/leaderboard';
import userRoutes from './routes/users';
import adminRoutes from './routes/admin';
import { authMiddleware } from './middleware/auth';
import { corsMiddleware, securityHeaders } from './middleware/validation';
import { rateLimit } from './middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  return c.text(err.message || String(err), 500);
});

app.use('*', corsMiddleware);
app.use('*', securityHeaders);
app.use('*', authMiddleware);

app.get('/api/health', (c) => {
  return c.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

const api = new Hono<{ Bindings: Env }>();

api.route('/auth', authRoutes);
api.route('/challenges', challengeRoutes);
api.route('/leaderboard', leaderboardRoutes);
api.route('/users', userRoutes);
api.route('/admin', adminRoutes);

app.route('/api', api);

app.get('/api/*', (c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

export default app;
