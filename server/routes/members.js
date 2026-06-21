import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';

export async function memberRoutes(fastify, options) {
    fastify.get('/profile', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const db = getDb();
        const member = resultToObject(db.exec(`
      SELECT id, phone_number, email, full_name, birthday, created_at
      FROM members WHERE id = '${request.user.id}'
    `));

        if (!member) {
            return reply.status(404).send({ error: 'Member not found' });
        }

        return reply.send({ member });
    });

    fastify.patch('/profile', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { full_name, email, birthday } = request.body;
        const memberId = request.user.id;
        const db = getDb();

        const updates = [];
        if (full_name) updates.push(`full_name = '${full_name}'`);
        if (email !== undefined) updates.push(`email = ${email ? `'${email}'` : 'NULL'}`);
        if (birthday) updates.push(`birthday = '${birthday}'`);

        if (updates.length === 0) {
            return reply.status(400).send({ error: 'No fields to update' });
        }

        try {
            db.run(`UPDATE members SET ${updates.join(', ')} WHERE id = '${memberId}'`);
            saveDatabase();

            const member = resultToObject(db.exec(`
        SELECT id, phone_number, email, full_name, birthday, created_at
        FROM members WHERE id = '${memberId}'
      `));

            return reply.send({ message: 'Profile updated', member });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to update profile' });
        }
    });

    fastify.post('/change-password', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { current_password, new_password } = request.body;
        const memberId = request.user.id;
        const db = getDb();

        if (!current_password || !new_password) {
            return reply.status(400).send({ error: 'Current and new password required' });
        }

        if (new_password.length < 8) {
            return reply.status(400).send({ error: 'New password must be at least 8 characters' });
        }

        const member = resultToObject(db.exec(`SELECT password_hash FROM members WHERE id = '${memberId}'`));

        const bcrypt = await import('bcrypt');
        const valid = await bcrypt.compare(current_password, member.password_hash);

        if (!valid) {
            return reply.status(401).send({ error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(new_password, 10);
        db.run(`UPDATE members SET password_hash = '${newHash}' WHERE id = '${memberId}'`);
        saveDatabase();

        return reply.send({ message: 'Password changed successfully' });
    });

    // Get member stats with milestones
    fastify.get('/stats', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const memberId = request.user.id;
        const db = getDb();

        // Total attendance count
        const totalResult = resultToObject(db.exec(`
            SELECT COUNT(*) as count FROM attendance_records WHERE member_id = '${memberId}'
        `));
        const totalAttendance = totalResult ? totalResult.count : 0;

        // Calculate milestones
        const milestones = [
            { count: 10, name: 'Faithful Beginner', icon: '⭐', description: '10 attendances' },
            { count: 25, name: 'Committed Member', icon: '🌟', description: '25 attendances' },
            { count: 50, name: 'Devoted Disciple', icon: '💫', description: '50 attendances' },
            { count: 100, name: 'Pillar of Faith', icon: '👑', description: '100 attendances' },
            { count: 200, name: 'Legendary Saint', icon: '🏆', description: '200 attendances' }
        ];

        const earnedMilestones = milestones.filter(m => totalAttendance >= m.count);
        const nextMilestone = milestones.find(m => totalAttendance < m.count);

        // Check for newly achieved milestone (highest earned)
        const latestMilestone = earnedMilestones.length > 0 ? earnedMilestones[earnedMilestones.length - 1] : null;

        return reply.send({
            total_attendance: totalAttendance,
            milestones: {
                earned: earnedMilestones,
                next: nextMilestone,
                latest: latestMilestone,
                progress: nextMilestone ? Math.round((totalAttendance / nextMilestone.count) * 100) : 100
            }
        });
    });

    // Check if member has birthday today or this week
    fastify.get('/birthday-check', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const memberId = request.user.id;
        const db = getDb();

        const member = resultToObject(db.exec(`
            SELECT full_name, birthday FROM members WHERE id = '${memberId}'
        `));

        if (!member || !member.birthday) {
            return reply.send({ hasBirthday: false });
        }

        const today = new Date();
        const birthday = new Date(member.birthday);

        // Check if birthday is today
        const isToday = birthday.getMonth() === today.getMonth() &&
            birthday.getDate() === today.getDate();

        // Check if birthday is this week (within 7 days)
        const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
        const diffDays = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
        const isThisWeek = diffDays >= 0 && diffDays <= 7;
        const isPastThisWeek = diffDays >= -7 && diffDays < 0;

        return reply.send({
            hasBirthday: isToday || isThisWeek || isPastThisWeek,
            isToday,
            isThisWeek: isThisWeek || isPastThisWeek,
            daysUntil: diffDays,
            name: member.full_name
        });
    });

    // Get other members with birthdays this week (for community celebration)
    fastify.get('/birthdays-this-week', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const db = getDb();
        const members = resultToObjects(db.exec(`
            SELECT id, full_name, birthday FROM members WHERE is_active = 1 AND birthday IS NOT NULL
        `));

        const today = new Date();
        const birthdaysThisWeek = [];

        for (const member of members) {
            const birthday = new Date(member.birthday);
            const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
            const diffDays = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));

            if (diffDays >= -1 && diffDays <= 7) {
                birthdaysThisWeek.push({
                    id: member.id,
                    name: member.full_name,
                    date: `${birthday.getDate()}/${birthday.getMonth() + 1}`,
                    isToday: diffDays === 0,
                    daysUntil: diffDays
                });
            }
        }

        // Sort by days until birthday
        birthdaysThisWeek.sort((a, b) => a.daysUntil - b.daysUntil);

        return reply.send({ birthdays: birthdaysThisWeek });
    });
}
