import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';

export async function sessionRoutes(fastify, options) {
    fastify.get('/', async (request, reply) => {
        const db = getDb();
        const sessions = resultToObjects(db.exec(`
      SELECT id, name, day_of_week, start_time, end_time, is_active, created_at
      FROM attendance_sessions
      ORDER BY 
        CASE day_of_week 
          WHEN 'Sunday' THEN 0
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
        END
    `));

        return reply.send({ sessions });
    });

    fastify.get('/active', async (request, reply) => {
        const db = getDb();
        const sessions = resultToObjects(db.exec(`
      SELECT id, name, day_of_week, start_time, end_time
      FROM attendance_sessions
      WHERE is_active = 1
      ORDER BY 
        CASE day_of_week 
          WHEN 'Sunday' THEN 0
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
        END
    `));

        return reply.send({ sessions });
    });

    fastify.post('/', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { name, day_of_week, start_time, end_time } = request.body;
        const db = getDb();

        if (!name || !day_of_week || !start_time || !end_time) {
            return reply.status(400).send({
                error: 'Missing required fields',
                required: ['name', 'day_of_week', 'start_time', 'end_time']
            });
        }

        const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (!validDays.includes(day_of_week)) {
            return reply.status(400).send({ error: 'Invalid day of week' });
        }

        // Validate that end_time is after start_time
        const [startH, startM] = start_time.split(':').map(Number);
        const [endH, endM] = end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
            return reply.status(400).send({
                error: 'Invalid time range',
                message: 'End time must be after start time'
            });
        }

        const id = crypto.randomUUID();

        try {
            db.run(`
        INSERT INTO attendance_sessions (id, name, day_of_week, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [id, name, day_of_week, start_time, end_time]);
            saveDatabase();

            return reply.status(201).send({
                message: 'Session created',
                session: { id, name, day_of_week, start_time, end_time, is_active: true }
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to create session' });
        }
    });

    fastify.patch('/:id', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { id } = request.params;
        const { name, day_of_week, start_time, end_time, is_active } = request.body;
        const db = getDb();

        const updates = [];
        if (name) updates.push(`name = '${name}'`);
        if (day_of_week) updates.push(`day_of_week = '${day_of_week}'`);
        if (start_time) updates.push(`start_time = '${start_time}'`);
        if (end_time) updates.push(`end_time = '${end_time}'`);
        if (is_active !== undefined) updates.push(`is_active = ${is_active ? 1 : 0}`);

        if (updates.length === 0) {
            return reply.status(400).send({ error: 'No fields to update' });
        }

        try {
            db.run(`UPDATE attendance_sessions SET ${updates.join(', ')} WHERE id = '${id}'`);
            saveDatabase();

            const session = resultToObject(db.exec(`SELECT * FROM attendance_sessions WHERE id = '${id}'`));
            if (!session) {
                return reply.status(404).send({ error: 'Session not found' });
            }
            return reply.send({ message: 'Session updated', session });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to update session' });
        }
    });

    fastify.delete('/:id', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { id } = request.params;
        const db = getDb();

        try {
            const existing = resultToObject(db.exec(`SELECT id FROM attendance_sessions WHERE id = '${id}'`));
            if (!existing) {
                return reply.status(404).send({ error: 'Session not found' });
            }

            db.run(`DELETE FROM attendance_sessions WHERE id = '${id}'`);
            saveDatabase();

            return reply.send({ message: 'Session deleted' });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to delete session' });
        }
    });
}
