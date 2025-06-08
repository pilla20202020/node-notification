import axios from 'axios';
import { retryWithExponentialBackoff } from '../utils/retryHelper.js';
export default class NotificationService {
    constructor(repo, redisPub, laravelBase, channel, maxRetries) {
        this.repo = repo;
        this.redisPub = redisPub;
        this.laravelBase = laravelBase.replace(/\/$/, '');
        this.channel = channel;
        this.maxRetries = maxRetries;
    }
    async publishNotification(input) {
        const notif = await this.repo.create(input);
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
    async handleMessage(message) {
        let parsed;
        try {
            parsed = JSON.parse(message);
        }
        catch {
            console.error('❌ Invalid JSON in message, discarding:', message);
            return;
        }
        if (parsed.notification_id === 0 && parsed.type === 'connection_test') {
            console.log('⚠️ Skipping connection test message');
            return;
        }
        const { notification_id, user_id, type, payload } = parsed;
        console.log(`📨 Consuming notification #${notification_id}`);
        console.log(`📤 Simulating send → User #${user_id}, Type: ${type}, Payload:`, payload);
        try {
            await retryWithExponentialBackoff(() => axios.put(`${this.laravelBase}/api/notifications/${notification_id}/status`, { status: 'sent' }), this.maxRetries);
            await this.repo.updateStatus(notification_id, 'sent');
            console.log(`✅ Laravel updated: Notification #${notification_id} marked as "sent"`);
        }
        catch (err) {
            const attempts = await this.repo.incrementAttempts(notification_id);
            console.error(`❌ Error updating Laravel for #${notification_id}. Attempt: ${attempts}`);
            if (attempts < this.maxRetries) {
                console.log(`🔁 Retrying: re-publishing #${notification_id}`);
                await this.redisPub.publish(this.channel, message);
            }
            else {
                await this.repo.updateStatus(notification_id, 'failed');
                console.error(`💀 Max retries reached. Notification #${notification_id} marked as "failed"`);
            }
        }
    }
}
