import Fastify from 'fastify';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import NotificationRepository from './repos/notificationRepository';
import NotificationService from './services/notificationService';

dotenv.config();

const {
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD,
  REDIS_DB = '0',
  REDIS_CHANNEL = 'notifications',
  LARAVEL_API_BASE_URL = 'http://localhost:8000',
  MAX_RETRY_ATTEMPTS = '3',
  PORT = '3000',
} = process.env;

const redisOptions = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD || undefined,
  db: Number(REDIS_DB),
};

const redisPub = new Redis(redisOptions);
const redisSub = new Redis(redisOptions);

const repo = new NotificationRepository();
const service = new NotificationService(
  repo,
  redisPub,
  LARAVEL_API_BASE_URL,
  REDIS_CHANNEL,
  Number(MAX_RETRY_ATTEMPTS)
);

const app = Fastify({ logger: true });

// 1. Health check
app.get('/health', async () => ({ status: 'ok' }));

// 2. Publish endpoint
app.post<{
  Body: { user_id: number; type: string; payload: Record<string, any>; scheduled_at?: string }
}>('/notifications', async (req, reply) => {
  const notif = await service.publishNotification(req.body);
  reply.code(201).send({ status: 'success', notification: notif });
});

// Start Redis subscriber
async function startSubscriber() {
  redisSub.on('message', (_ch, msg) => service.handleMessage(msg));
  await redisSub.subscribe(REDIS_CHANNEL);
  console.log(`Subscribed to Redis channel "${REDIS_CHANNEL}"`);
}

const start = async () => {
  try {
    await app.listen({ port: Number(PORT) });
    console.log(`🚀 Server listening on port ${PORT}`);
    await startSubscriber();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
