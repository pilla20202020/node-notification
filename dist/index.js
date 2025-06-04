import Fastify from 'fastify';
import dotenv from 'dotenv';
import { subscribeToNotificationsChannel } from './services/notificationService.js';
dotenv.config();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const fastify = Fastify({ logger: true });
fastify.get('/', async () => {
    return { status: 'ok', message: 'Notification Microservice Running' };
});
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`Fastify server listening on port ${PORT}`);
        // After server is up, start Redis subscriber
        subscribeToNotificationsChannel();
    }
    catch (err) {
        fastify.log.error(err.message);
        process.exit(1);
    }
};
start();
