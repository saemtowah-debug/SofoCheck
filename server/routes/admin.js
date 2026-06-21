import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';
import bcrypt from 'bcrypt';
import { formatPhoneNumber } from '../utils/helpers.js';

export async function adminRoutes(fastify, options) {
    fastify.get('/members', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { search, limit = 50, offset = 0, active } = request.query;
        const db = getDb();

        let query = `
      SELECT id, phone_number, email, full_name, birthday, created_at, is_active
      FROM members
    `;

        const conditions = [];
        if (search) {
            conditions.push(`(full_name LIKE '%${search}%' OR phone_number LIKE '%${search}%')`);
        }
        if (active !== undefined) {
            conditions.push(`is_active = ${active === 'true' ? 1 : 0}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY full_name ASC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

        const members = resultToObjects(db.exec(query));

        let countQuery = 'SELECT COUNT(*) as count FROM members';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        const totalResult = resultToObject(db.exec(countQuery));
        const total = totalResult ? totalResult.count : 0;

        return reply.send({
            members,
            total,
            pagination: { limit: parseInt(limit), offset: parseInt(offset) }
        });
    });

    fastify.get('/members/:id', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { id } = request.params;
        const db = getDb();

        const member = resultToObject(db.exec(`
      SELECT id, phone_number, email, full_name, birthday, created_at, is_active
      FROM members WHERE id = '${id}'
    `));

        if (!member) {
            return reply.status(404).send({ error: 'Member not found' });
        }

        const totalResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records WHERE member_id = '${id}'
    `));
        const totalAttendance = totalResult ? totalResult.count : 0;

        const recentAttendance = resultToObjects(db.exec(`
      SELECT ar.checked_in_at, s.name as session_name
      FROM attendance_records ar
      LEFT JOIN attendance_sessions s ON ar.session_id = s.id
      WHERE ar.member_id = '${id}'
      ORDER BY ar.checked_in_at DESC
      LIMIT 10
    `));

        return reply.send({
            member,
            stats: { total_attendance: totalAttendance },
            recent_attendance: recentAttendance
        });
    });

    fastify.patch('/members/:id', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { id } = request.params;
        const { full_name, email, birthday, is_active } = request.body;
        const db = getDb();

        const updates = [];
        if (full_name) updates.push(`full_name = '${full_name}'`);
        if (email !== undefined) updates.push(`email = ${email ? `'${email}'` : 'NULL'}`);
        if (birthday) updates.push(`birthday = '${birthday}'`);
        if (is_active !== undefined) updates.push(`is_active = ${is_active ? 1 : 0}`);

        if (updates.length === 0) {
            return reply.status(400).send({ error: 'No fields to update' });
        }

        try {
            db.run(`UPDATE members SET ${updates.join(', ')} WHERE id = '${id}'`);
            saveDatabase();

            const member = resultToObject(db.exec(`
        SELECT id, phone_number, email, full_name, birthday, created_at, is_active
        FROM members WHERE id = '${id}'
      `));

            if (!member) {
                return reply.status(404).send({ error: 'Member not found' });
            }

            return reply.send({ message: 'Member updated', member });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to update member' });
        }
    });

    fastify.post('/admins', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        if (request.user.role !== 'super_admin') {
            return reply.status(403).send({ error: 'Only super admins can create admins' });
        }

        const { phone_number, password, full_name, role = 'admin' } = request.body;
        const db = getDb();

        if (!phone_number || !password || !full_name) {
            return reply.status(400).send({ error: 'Phone number, password, and full name required' });
        }

        const formattedPhone = formatPhoneNumber(phone_number);

        const existing = resultToObject(db.exec(`SELECT id FROM admins WHERE phone_number = '${formattedPhone}'`));
        if (existing) {
            return reply.status(409).send({ error: 'Admin with this phone already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();

        try {
            db.run(`
        INSERT INTO admins (id, phone_number, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?)
      `, [id, formattedPhone, hashedPassword, full_name, role]);
            saveDatabase();

            return reply.status(201).send({
                message: 'Admin created',
                admin: { id, phone_number: formattedPhone, full_name, role }
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to create admin' });
        }
    });

    fastify.get('/admins', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        if (request.user.role !== 'super_admin') {
            return reply.status(403).send({ error: 'Only super admins can view admin list' });
        }

        const db = getDb();
        const admins = resultToObjects(db.exec(`
      SELECT id, phone_number, full_name, role, created_at, is_active
      FROM admins
      ORDER BY created_at DESC
    `));

        return reply.send({ admins });
    });

    fastify.get('/dashboard', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const db = getDb();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        const todayResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records WHERE checked_in_at >= '${todayStr}'
    `));
        const todayCount = todayResult ? todayResult.count : 0;

        const membersResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM members WHERE is_active = 1
    `));
        const totalMembers = membersResult ? membersResult.count : 0;

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        const weekStr = startOfWeek.toISOString();

        const weekResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records WHERE checked_in_at >= '${weekStr}'
    `));
        const weekCount = weekResult ? weekResult.count : 0;

        const recentCheckins = resultToObjects(db.exec(`
      SELECT m.full_name, ar.checked_in_at
      FROM attendance_records ar
      JOIN members m ON ar.member_id = m.id
      WHERE ar.checked_in_at >= '${todayStr}'
      ORDER BY ar.checked_in_at DESC
      LIMIT 10
    `));

        const upcomingBirthdays = getUpcomingBirthdays();

        return reply.send({
            stats: {
                today_attendance: todayCount,
                total_members: totalMembers,
                week_attendance: weekCount
            },
            recent_checkins: recentCheckins,
            upcoming_birthdays: upcomingBirthdays
        });
    });
}

function getUpcomingBirthdays() {
    const db = getDb();
    const today = new Date();
    const members = resultToObjects(db.exec(`
    SELECT id, full_name, birthday FROM members WHERE is_active = 1
  `));

    const upcoming = [];

    for (const member of members) {
        if (!member.birthday) continue;

        const bday = new Date(member.birthday);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

        if (thisYearBday < today) {
            thisYearBday.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((thisYearBday - today) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 7) {
            upcoming.push({
                id: member.id,
                full_name: member.full_name,
                birthday: member.birthday,
                days_until: daysUntil
            });
        }
    }

    return upcoming.sort((a, b) => a.days_until - b.days_until);
}
