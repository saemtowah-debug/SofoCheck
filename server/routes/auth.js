import bcrypt from 'bcrypt';
import { getDb, saveDatabase, resultToObject, resultToObjects } from '../db/init.js';
import { formatPhoneNumber } from '../utils/helpers.js';

export async function authRoutes(fastify, options) {
    // Member Registration
    fastify.post('/register', async (request, reply) => {
        const { phone_number, password, full_name, birthday, email } = request.body;
        const db = getDb();

        if (!phone_number || !password || !full_name || !birthday) {
            return reply.status(400).send({
                error: 'Missing required fields',
                required: ['phone_number', 'password', 'full_name', 'birthday']
            });
        }

        if (password.length < 8) {
            return reply.status(400).send({ error: 'Password must be at least 8 characters' });
        }

        const formattedPhone = formatPhoneNumber(phone_number);

        const existing = resultToObject(db.exec(`SELECT id FROM members WHERE phone_number = '${formattedPhone}'`));
        if (existing) {
            return reply.status(409).send({ error: 'Phone number already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();

        try {
            db.run(`
        INSERT INTO members (id, phone_number, email, password_hash, full_name, birthday)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, formattedPhone, email || null, hashedPassword, full_name, birthday]);
            saveDatabase();

            const token = fastify.jwt.sign({
                id,
                phone_number: formattedPhone,
                role: 'member'
            }, { expiresIn: '30d' });

            return reply.status(201).send({
                message: 'Registration successful',
                token,
                member: { id, phone_number: formattedPhone, full_name, birthday, email }
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Registration failed' });
        }
    });

    // Member Login
    fastify.post('/login', async (request, reply) => {
        const { phone_number, password } = request.body;
        const db = getDb();

        if (!phone_number || !password) {
            return reply.status(400).send({ error: 'Phone number and password required' });
        }

        const formattedPhone = formatPhoneNumber(phone_number);

        const member = resultToObject(db.exec(`
      SELECT id, phone_number, password_hash, full_name, birthday, email, is_active
      FROM members WHERE phone_number = '${formattedPhone}'
    `));

        if (!member) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        if (!member.is_active) {
            return reply.status(403).send({ error: 'Account deactivated' });
        }

        const valid = await bcrypt.compare(password, member.password_hash);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = fastify.jwt.sign({
            id: member.id,
            phone_number: member.phone_number,
            role: 'member'
        }, { expiresIn: '30d' });

        return reply.send({
            message: 'Login successful',
            token,
            member: {
                id: member.id,
                phone_number: member.phone_number,
                full_name: member.full_name,
                birthday: member.birthday,
                email: member.email
            }
        });
    });

    // Admin Login
    fastify.post('/admin/login', async (request, reply) => {
        const { phone_number, password } = request.body;
        const db = getDb();

        if (!phone_number || !password) {
            return reply.status(400).send({ error: 'Phone number and password required' });
        }

        const formattedPhone = formatPhoneNumber(phone_number);

        const admin = resultToObject(db.exec(`
      SELECT id, phone_number, password_hash, full_name, role, is_active
      FROM admins WHERE phone_number = '${formattedPhone}'
    `));

        if (!admin) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        if (!admin.is_active) {
            return reply.status(403).send({ error: 'Account deactivated' });
        }

        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid credentials' });
        }

        const token = fastify.jwt.sign({
            id: admin.id,
            phone_number: admin.phone_number,
            role: admin.role
        }, { expiresIn: '7d' });

        return reply.send({
            message: 'Login successful',
            token,
            admin: {
                id: admin.id,
                phone_number: admin.phone_number,
                full_name: admin.full_name,
                role: admin.role
            }
        });
    });

    // Refresh token
    fastify.post('/refresh', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const token = fastify.jwt.sign({
            id: request.user.id,
            phone_number: request.user.phone_number,
            role: request.user.role
        }, { expiresIn: request.user.role === 'member' ? '30d' : '7d' });

        return reply.send({ token });
    });

    // Get current user
    fastify.get('/me', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const { id, role } = request.user;
        const db = getDb();

        if (role === 'member') {
            const member = resultToObject(db.exec(`
        SELECT id, phone_number, email, full_name, birthday, created_at
        FROM members WHERE id = '${id}'
      `));
            return reply.send({ user: member, role });
        } else {
            const admin = resultToObject(db.exec(`
        SELECT id, phone_number, full_name, role, created_at
        FROM admins WHERE id = '${id}'
      `));
            return reply.send({ user: admin, role });
        }
    });
}
