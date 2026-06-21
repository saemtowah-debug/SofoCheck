import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';
import {
    isWithinChurchGeofence,
    getCurrentDayOfWeek,
    isWithinSessionTime,
    getStartOfDay
} from '../utils/helpers.js';

const connectedClients = new Set();

export async function attendanceRoutes(fastify, options) {
    fastify.get('/live', { websocket: true }, (socket, req) => {
        connectedClients.add(socket);

        const todayCount = getTodayAttendanceCount();
        socket.send(JSON.stringify({ type: 'count', count: todayCount }));

        socket.on('close', () => {
            connectedClients.delete(socket);
        });
    });

    fastify.post('/check-in', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { latitude, longitude, accuracy } = request.body;
        const memberId = request.user.id;
        const db = getDb();

        // TEST_MODE: Skip location requirement for testing
        const TEST_MODE = process.env.TEST_MODE === 'true';

        if (!TEST_MODE && (latitude === undefined || longitude === undefined)) {
            return reply.status(400).send({
                error: 'Location required',
                message: 'Please enable location services to mark attendance'
            });
        }

        // TEST_MODE: Skip geolocation check
        if (!TEST_MODE) {
            const geoCheck = isWithinChurchGeofence(latitude, longitude);
            if (!geoCheck.isWithin) {
                return reply.status(403).send({
                    error: 'Outside church premises',
                    message: `You are ${geoCheck.distance} meters from the church. Please move closer to mark attendance.`,
                    distance: geoCheck.distance
                });
            }
        }

        // TEST_MODE: Find any active session instead of matching day
        let activeSession;
        if (TEST_MODE) {
            activeSession = resultToObject(db.exec(`
                SELECT id, name, start_time, end_time 
                FROM attendance_sessions 
                WHERE is_active = 1
                LIMIT 1
            `));
        } else {
            const today = getCurrentDayOfWeek();
            activeSession = resultToObject(db.exec(`
                SELECT id, name, start_time, end_time 
                FROM attendance_sessions 
                WHERE day_of_week = '${today}' AND is_active = 1
            `));
        }

        if (!activeSession) {
            return reply.status(403).send({
                error: 'No active session',
                message: 'Attendance is not open today. Please check the service schedule.'
            });
        }

        // TEST_MODE: Skip time check
        if (!TEST_MODE && !isWithinSessionTime(activeSession.start_time, activeSession.end_time)) {
            return reply.status(403).send({
                error: 'Outside session time',
                message: `Attendance for ${activeSession.name} is open from ${activeSession.start_time} to ${activeSession.end_time}`
            });
        }

        const startOfDay = getStartOfDay().toISOString();
        const existingAttendance = resultToObject(db.exec(`
      SELECT id FROM attendance_records 
      WHERE member_id = '${memberId}' AND checked_in_at >= '${startOfDay}'
    `));

        if (existingAttendance) {
            return reply.status(409).send({
                error: 'Already checked in',
                message: 'You have already marked attendance today. Welcome back!'
            });
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            db.run(`
        INSERT INTO attendance_records (id, member_id, session_id, checked_in_at, latitude, longitude, accuracy)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, memberId, activeSession.id, now, latitude, longitude, accuracy || null]);
            saveDatabase();

            const member = resultToObject(db.exec(`SELECT full_name FROM members WHERE id = '${memberId}'`));

            const todayCount = getTodayAttendanceCount();
            const message = JSON.stringify({
                type: 'checkin',
                count: todayCount,
                member: { name: member.full_name, time: now }
            });

            connectedClients.forEach(client => {
                try {
                    client.send(message);
                } catch (e) {
                    connectedClients.delete(client);
                }
            });

            return reply.status(201).send({
                success: true,
                message: 'Attendance recorded successfully!',
                session: activeSession.name,
                checked_in_at: now
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to record attendance' });
        }
    });

    fastify.get('/availability', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const memberId = request.user.id;
        const db = getDb();

        // TEST_MODE: Bypass day/time restrictions
        const TEST_MODE = process.env.TEST_MODE === 'true';

        // TEST_MODE: Find any active session instead of matching day
        let activeSession;
        if (TEST_MODE) {
            activeSession = resultToObject(db.exec(`
                SELECT id, name, start_time, end_time 
                FROM attendance_sessions 
                WHERE is_active = 1
                LIMIT 1
            `));
        } else {
            const today = getCurrentDayOfWeek();
            activeSession = resultToObject(db.exec(`
                SELECT id, name, start_time, end_time 
                FROM attendance_sessions 
                WHERE day_of_week = '${today}' AND is_active = 1
            `));
        }

        if (!activeSession) {
            return reply.send({
                available: false,
                reason: 'no_session',
                message: 'No service scheduled for today'
            });
        }

        // TEST_MODE: Skip time validation
        if (!TEST_MODE) {
            const isTimeValid = isWithinSessionTime(activeSession.start_time, activeSession.end_time);
            if (!isTimeValid) {
                return reply.send({
                    available: false,
                    reason: 'outside_time',
                    session: activeSession,
                    message: `Attendance opens at ${activeSession.start_time}`
                });
            }
        }

        const startOfDay = getStartOfDay().toISOString();
        const existingAttendance = resultToObject(db.exec(`
      SELECT id, checked_in_at FROM attendance_records 
      WHERE member_id = '${memberId}' AND checked_in_at >= '${startOfDay}'
    `));

        if (existingAttendance) {
            return reply.send({
                available: false,
                reason: 'already_checked_in',
                checked_in_at: existingAttendance.checked_in_at,
                message: 'You have already marked attendance today'
            });
        }

        return reply.send({
            available: true,
            session: activeSession,
            message: 'Attendance is open'
        });
    });

    fastify.get('/history', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const memberId = request.user.id;
        const { limit = 50, offset = 0 } = request.query;
        const db = getDb();

        const records = resultToObjects(db.exec(`
      SELECT ar.id, ar.checked_in_at, s.name as session_name
      FROM attendance_records ar
      LEFT JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.member_id = '${memberId}'
      ORDER BY ar.checked_in_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `));

        const totalResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records WHERE member_id = '${memberId}'
    `));
        const total = totalResult ? totalResult.count : 0;

        const streak = calculateAttendanceStreak(memberId);

        return reply.send({
            records,
            total,
            streak,
            pagination: { limit: parseInt(limit), offset: parseInt(offset) }
        });
    });

    fastify.get('/today-count', async (request, reply) => {
        const count = getTodayAttendanceCount();
        return reply.send({ count });
    });
}

function getTodayAttendanceCount() {
    const db = getDb();
    const startOfDay = getStartOfDay().toISOString();
    const result = resultToObject(db.exec(`
    SELECT COUNT(*) as count FROM attendance_records WHERE checked_in_at >= '${startOfDay}'
  `));
    return result ? result.count : 0;
}

function calculateAttendanceStreak(memberId) {
    const db = getDb();
    const records = resultToObjects(db.exec(`
    SELECT DISTINCT date(checked_in_at) as attendance_date
    FROM attendance_records
    WHERE member_id = '${memberId}'
    ORDER BY attendance_date DESC
    LIMIT 52
  `));

    if (records.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();

    while (currentDate.getDay() !== 0) {
        currentDate.setDate(currentDate.getDate() - 1);
    }

    for (let i = 0; i < 52; i++) {
        const sundayStr = currentDate.toISOString().split('T')[0];
        const attended = records.some(r => r.attendance_date === sundayStr);

        if (attended) {
            streak++;
        } else {
            break;
        }

        currentDate.setDate(currentDate.getDate() - 7);
    }

    return streak;
}
