import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';
import { getStartOfWeek, getStartOfMonth } from '../utils/helpers.js';

export async function reportsRoutes(fastify, options) {
    fastify.get('/weekly', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { weeks_ago = 0 } = request.query;
        const db = getDb();

        const startDate = getStartOfWeek();
        startDate.setDate(startDate.getDate() - (parseInt(weeks_ago) * 7));
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();

        const totalResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records 
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
    `));
        const totalAttendance = totalResult ? totalResult.count : 0;

        const uniqueResult = resultToObject(db.exec(`
      SELECT COUNT(DISTINCT member_id) as count FROM attendance_records 
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
    `));
        const uniqueMembers = uniqueResult ? uniqueResult.count : 0;

        const dailyBreakdown = resultToObjects(db.exec(`
      SELECT date(checked_in_at) as date, COUNT(*) as count
      FROM attendance_records
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
      GROUP BY date(checked_in_at)
      ORDER BY date ASC
    `));

        const newResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM members 
      WHERE created_at >= '${startStr}' AND created_at < '${endStr}'
    `));
        const newRegistrations = newResult ? newResult.count : 0;

        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        const prevEndDate = startDate;

        const prevResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records 
      WHERE checked_in_at >= '${prevStartDate.toISOString()}' AND checked_in_at < '${prevEndDate.toISOString()}'
    `));
        const prevTotalAttendance = prevResult ? prevResult.count : 0;

        const changePercent = prevTotalAttendance > 0
            ? Math.round(((totalAttendance - prevTotalAttendance) / prevTotalAttendance) * 100)
            : 0;

        return reply.send({
            period: {
                start: startStr.split('T')[0],
                end: endStr.split('T')[0]
            },
            metrics: {
                total_attendance: totalAttendance,
                unique_members: uniqueMembers,
                new_registrations: newRegistrations,
                change_from_previous_week: changePercent
            },
            daily_breakdown: dailyBreakdown
        });
    });

    fastify.get('/monthly', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { months_ago = 0 } = request.query;
        const db = getDb();

        const startDate = getStartOfMonth();
        startDate.setMonth(startDate.getMonth() - parseInt(months_ago));
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();

        const totalResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records 
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
    `));
        const totalAttendance = totalResult ? totalResult.count : 0;

        const uniqueResult = resultToObject(db.exec(`
      SELECT COUNT(DISTINCT member_id) as count FROM attendance_records 
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
    `));
        const uniqueMembers = uniqueResult ? uniqueResult.count : 0;

        const weeklyBreakdown = resultToObjects(db.exec(`
      SELECT strftime('%W', checked_in_at) as week, COUNT(*) as count
      FROM attendance_records
      WHERE checked_in_at >= '${startStr}' AND checked_in_at < '${endStr}'
      GROUP BY week
      ORDER BY week ASC
    `));

        const sessionsCount = resultToObjects(db.exec(`
      SELECT s.name, COUNT(ar.id) as attendance_count
      FROM attendance_sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id 
        AND ar.checked_in_at >= '${startStr}' AND ar.checked_in_at < '${endStr}'
      GROUP BY s.id, s.name
    `));

        const avgAttendance = sessionsCount.length > 0
            ? Math.round(totalAttendance / sessionsCount.length)
            : 0;

        const monthBirthdays = getBirthdaysForMonth(startDate.getMonth() + 1);

        const prevStartDate = new Date(startDate);
        prevStartDate.setMonth(prevStartDate.getMonth() - 1);
        const prevEndDate = startDate;

        const prevResult = resultToObject(db.exec(`
      SELECT COUNT(*) as count FROM attendance_records 
      WHERE checked_in_at >= '${prevStartDate.toISOString()}' AND checked_in_at < '${prevEndDate.toISOString()}'
    `));
        const prevTotalAttendance = prevResult ? prevResult.count : 0;

        const changePercent = prevTotalAttendance > 0
            ? Math.round(((totalAttendance - prevTotalAttendance) / prevTotalAttendance) * 100)
            : 0;

        return reply.send({
            period: {
                start: startStr.split('T')[0],
                end: endStr.split('T')[0],
                month: startDate.toLocaleString('default', { month: 'long', year: 'numeric' })
            },
            metrics: {
                total_attendance: totalAttendance,
                unique_members: uniqueMembers,
                average_per_session: avgAttendance,
                change_from_previous_month: changePercent
            },
            weekly_breakdown: weeklyBreakdown,
            sessions_breakdown: sessionsCount,
            birthday_members: monthBirthdays
        });
    });

    fastify.get('/patterns', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const db = getDb();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const ninetyDaysStr = ninetyDaysAgo.toISOString();

        const topAttendees = resultToObjects(db.exec(`
      SELECT m.id, m.full_name, COUNT(ar.id) as attendance_count
      FROM members m
      JOIN attendance_records ar ON m.id = ar.member_id
      WHERE ar.checked_in_at >= '${ninetyDaysStr}'
      GROUP BY m.id, m.full_name
      ORDER BY attendance_count DESC
      LIMIT 20
    `));

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysStr = thirtyDaysAgo.toISOString();

        const atRiskMembers = resultToObjects(db.exec(`
      SELECT m.id, m.full_name, m.phone_number,
        (SELECT MAX(ar.checked_in_at) FROM attendance_records ar WHERE ar.member_id = m.id) as last_attendance
      FROM members m
      WHERE m.is_active = 1
        AND m.id NOT IN (
          SELECT DISTINCT member_id FROM attendance_records WHERE checked_in_at >= '${thirtyDaysStr}'
        )
      ORDER BY last_attendance DESC
      LIMIT 50
    `));

        const allMembers = resultToObjects(db.exec(`SELECT id, full_name FROM members WHERE is_active = 1`));
        const streakLeaderboard = [];

        for (const member of allMembers) {
            const streak = calculateStreak(member.id);
            if (streak > 0) {
                streakLeaderboard.push({
                    id: member.id,
                    full_name: member.full_name,
                    streak_weeks: streak
                });
            }
        }

        streakLeaderboard.sort((a, b) => b.streak_weeks - a.streak_weeks);

        return reply.send({
            top_attendees: topAttendees,
            at_risk_members: atRiskMembers,
            streak_leaderboard: streakLeaderboard.slice(0, 20)
        });
    });

    fastify.post('/export', {
        preHandler: [fastify.authenticateAdmin]
    }, async (request, reply) => {
        const { type, start_date, end_date, format = 'json' } = request.body;
        const db = getDb();

        let data;
        let filename;

        switch (type) {
            case 'members':
                data = resultToObjects(db.exec(`
          SELECT id, phone_number, email, full_name, birthday, created_at, is_active
          FROM members
          ORDER BY full_name ASC
        `));
                filename = `members_export_${new Date().toISOString().split('T')[0]}`;
                break;

            case 'attendance':
                let query = `
          SELECT ar.id, m.full_name, m.phone_number, s.name as session_name, ar.checked_in_at
          FROM attendance_records ar
          JOIN members m ON ar.member_id = m.id
          LEFT JOIN attendance_sessions s ON ar.session_id = s.id
        `;

                if (start_date && end_date) {
                    query += ` WHERE ar.checked_in_at >= '${start_date}' AND ar.checked_in_at <= '${end_date}'`;
                }

                query += ' ORDER BY ar.checked_in_at DESC';
                data = resultToObjects(db.exec(query));
                filename = `attendance_export_${new Date().toISOString().split('T')[0]}`;
                break;

            default:
                return reply.status(400).send({ error: 'Invalid export type. Use: members, attendance' });
        }

        if (format === 'csv') {
            const csv = convertToCSV(data);
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename="${filename}.csv"`);
            return reply.send(csv);
        }

        return reply.send({
            filename: `${filename}.json`,
            data,
            count: data.length
        });
    });
}

function getBirthdaysForMonth(month) {
    const db = getDb();
    const members = resultToObjects(db.exec(`
    SELECT id, full_name, birthday FROM members WHERE is_active = 1
  `));

    return members.filter(m => {
        if (!m.birthday) return false;
        const bday = new Date(m.birthday);
        return bday.getMonth() + 1 === month;
    }).sort((a, b) => {
        const dayA = new Date(a.birthday).getDate();
        const dayB = new Date(b.birthday).getDate();
        return dayA - dayB;
    });
}

function calculateStreak(memberId) {
    const db = getDb();
    const records = resultToObjects(db.exec(`
    SELECT DISTINCT date(checked_in_at) as attendance_date
    FROM attendance_records
    WHERE member_id = '${memberId}'
    ORDER BY attendance_date DESC
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

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
        headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
        }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
}
