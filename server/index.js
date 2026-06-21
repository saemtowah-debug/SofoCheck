import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { authRoutes } from './routes/auth.js';
import { memberRoutes } from './routes/members.js';
import { attendanceRoutes } from './routes/attendance.js';
import { sessionRoutes } from './routes/sessions.js';
import { adminRoutes } from './routes/admin.js';
import { reportsRoutes } from './routes/reports.js';
import { initDatabase } from './db/init.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000'
];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(...process.env.CLIENT_URL.split(',').map(url => url.trim()));
}

await fastify.register(cors, {
  origin: allowedOrigins,
  credentials: true
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'sofocheck-secret-key-change-in-production'
});

await fastify.register(websocket);

// Authentication decorator
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Admin authentication decorator
fastify.decorate('authenticateAdmin', async function (request, reply) {
  try {
    await request.jwtVerify();
    if (request.user.role !== 'admin' && request.user.role !== 'super_admin') {
      reply.status(403).send({ error: 'Forbidden - Admin access required' });
    }
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Initialize database
await initDatabase();

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(memberRoutes, { prefix: '/api/members' });
await fastify.register(attendanceRoutes, { prefix: '/api/attendance' });
await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
await fastify.register(adminRoutes, { prefix: '/api/admin' });
await fastify.register(reportsRoutes, { prefix: '/api/reports' });

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port: parseInt(port, 10), host });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

export default fastify;
