import Redis from 'ioredis';
import axios from 'axios';
import NotificationRepository, { NotificationRow } from '../repos/notificationRepository';
import { retryWithExponentialBackoff } from '../utils/retryHelper';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default class NotificationService {
  /* … your constructor … */

  async publishNotification(input: {
    user_id: number;
    type: string;
    payload: Record<string, any>;
    scheduled_at?: string;
  }): Promise<NotificationRow> {
    const notif = await this.repo.create(input);              // ← await here
    const msg = JSON.stringify({
      notification_id: notif.id,
      user_id: notif.user_id,
      type: notif.type,
      payload: JSON.parse(notif.payload),
      scheduled_at: notif.scheduled_at,
    });
    await this.redisPub.publish(this.channel, msg);
    return notif;
  }

  async handleMessage(message: string) {
    /* … parsing and skip test … */

    try {
      await retryWithExponentialBackoff(
        () =>
          axios.put(
            `${this.laravelBase}/api/notifications/${notification_id}/status`,
            { status: 'sent' }
          ),
        this.maxRetries
      );
      this.repo.updateStatus(notification_id, 'sent');
    } catch {
      const attempts = await this.repo.incrementAttempts(notification_id);  // ← await here
      if (attempts < this.maxRetries) {
        await this.redisPub.publish(this.channel, message);
      } else {
        this.repo.updateStatus(notification_id, 'failed');
      }
    }
  }
}

// ——— SMOKE TEST ———
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1]?.endsWith(__filename);

if (isMain) {
  (async () => {
    const repo = new NotificationRepository();
    await (repo as any).ready;
    const redis = new Redis();
    const svc = new NotificationService(
      repo,
      redis,
      'http://localhost:8000',
      'notifications',
      1
    );

    console.log('✨ Smoke: publishing a dummy notification...');
    const notif = await svc.publishNotification({
      user_id: 999,
      type: 'connection_test',
      payload: { test: true },
    });
    console.log('→ created:', notif);
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
