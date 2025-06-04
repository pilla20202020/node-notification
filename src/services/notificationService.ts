import Redis from 'ioredis';
import axios from 'axios';
import { retryWithExponentialBackoff } from '../utils/retryHelper.js';
import dotenv from 'dotenv';

dotenv.config();

const {
  REDIS_HOST = '127.0.0.1',
  REDIS_PORT = '6379',
  REDIS_PASSWORD,
  REDIS_CHANNEL = 'notifications',
  LARAVEL_API_BASE_URL,
  MAX_RETRY_ATTEMPTS = '3' // keep as string for parseInt
} = process.env;

const redis = new Redis({
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT, 10),
  password: REDIS_PASSWORD || undefined,
});

interface NotificationMessage {
  notification_id: number;
  user_id: number;
  type: string;
  payload: Record<string, any>;
  scheduled_at?: string;
}

async function processNotification(message: string): Promise<void> {
  let parsed: NotificationMessage;

  try {
    parsed = JSON.parse(message);
  } catch (err: unknown) {
    console.error('❌ Failed to parse message as JSON:', (err as Error).message);
    return;
  }

  const { notification_id, user_id, type, payload, scheduled_at } = parsed;

  console.log(`📩 Processing notification #${notification_id} for user ${user_id}`);
  console.log(`Type: ${type}, Payload:`, payload, `Scheduled At: ${scheduled_at}`);

  const randomFail = Math.random() < 0.2;
  const status = randomFail ? 'failed' : 'sent';
  const retries = parseInt(MAX_RETRY_ATTEMPTS, 10);

  try {
    await retryWithExponentialBackoff(() =>
      axios.put(`${LARAVEL_API_BASE_URL}/api/notifications/${notification_id}/status`, { status }),
      retries
    );
    console.log(`✅ Notification #${notification_id} marked as ${status}`);
  } catch (error: unknown) {
    console.error(
      `❌ Failed to update Laravel for notification #${notification_id} after ${retries} attempts`,
      (error as Error).message
    );
  }
}

function subscribeToNotificationsChannel(): void {
  redis.subscribe(REDIS_CHANNEL)
    .then((count) => {
      console.log(`✅ Subscribed to Redis channel: ${REDIS_CHANNEL} (${count})`);
    })
    .catch((err: Error) => {
      console.error('❌ Redis subscribe error:', err.message);
    });

  redis.on('message', async (channel: string, message: string) => {
    console.log(`📨 New message on ${channel}:`, message);
    await processNotification(message);
  });
}


export {
  subscribeToNotificationsChannel
};
