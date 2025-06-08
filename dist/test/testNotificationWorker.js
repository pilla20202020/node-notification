import Fastify from 'fastify';
import Redis from 'ioredis';
import NotificationRepository from '../repos/notificationRepository.js';
import NotificationService from '../services/notificationService.js';
(async () => {
    const repo = new NotificationRepository();
    await repo.ready;
    const redisPub = new Redis();
    const redisSub = new Redis();
    const svc = new NotificationService(repo, redisPub, 'http://localhost:8000', 'notifications', 3);
    // ✅ 1. Redis subscriber
    redisSub.on('message', async (channel, msg) => {
        console.log(`📥 [${channel}] Received message:`, msg);
        await svc.handleMessage(msg);
    });
    await redisSub.subscribe('notifications');
    console.log('🔔 Subscribed to Redis channel "notifications".\n');
    // ✅ 2. Publish a test message
    const notif = await svc.publishNotification({
        user_id: 1,
        type: 'email',
        payload: { subject: 'Hello!', body: 'This is a test message.' },
    });
    console.log('✅ Notification published:', notif);
    console.log('⏳ Waiting for it to be consumed...\n');
    // ✅ 3. Fastify APIs
    const app = Fastify();
    // GET /notifications/recent?user_id=1
    app.get('/notifications/recent', async (req, reply) => {
        const userId = parseInt(req.query.user_id);
        const page = parseInt(req.query.page || '1');
        const perPage = parseInt(req.query.per_page || '10');
        const [rows] = await repo['pool'].query(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?, ?`, [userId, (page - 1) * perPage, perPage]);
        reply.send({
            status: 'success',
            data: rows,
            current_page: page,
            per_page: perPage,
        });
    });
    // GET /notifications/summary?user_id=1
    app.get('/notifications/summary', async (req, reply) => {
        const userId = req.query.user_id ? parseInt(req.query.user_id) : null;
        const whereClause = userId ? `WHERE user_id = ?` : ``;
        const [rows] = await repo['pool'].query(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'sent') as sent,
        SUM(status = 'failed') as failed,
        SUM(status = 'pending') as pending
      FROM notifications ${whereClause}
      `, userId ? [userId] : []);
        reply.send({
            status: 'success',
            summary: rows[0],
        });
    });
    await app.listen({ port: 3001 });
    console.log(`
    🚀 Fastify API running at: http://localhost:3001

    🔎 Test these endpoints in your browser or Postman:
    • Recent:  http://localhost:3001/notifications/recent?user_id=1
    • Summary: http://localhost:3001/notifications/summary?user_id=1
    `);
})();
