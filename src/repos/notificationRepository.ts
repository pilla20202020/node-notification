// src/repos/notificationRepository.ts
import mysql from 'mysql2/promise';

export interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  payload: string;
  scheduled_at: string | null;
  status: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export default class NotificationRepository {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'notification_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async create(data: {
    user_id: number;
    type: string;
    payload: Record<string, any>;
    scheduled_at?: string;
  }): Promise<NotificationRow> {
    const [result] = await this.pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO notifications (user_id, type, payload, scheduled_at, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', 0, NOW(), NOW())`,
      [
        data.user_id,
        data.type,
        JSON.stringify(data.payload),
        data.scheduled_at || null,
      ]
    );

    const insertId = (result as mysql.ResultSetHeader).insertId;
    return this.findById(insertId);
  }

  async findById(id: number): Promise<NotificationRow> {
    const [rows] = await this.pool.execute<NotificationRow[]>(
      'SELECT * FROM notifications WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  async updateStatus(id: number, status: 'sent' | 'failed') {
    await this.pool.execute(
      `UPDATE notifications
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, id]
    );
  }

  async incrementAttempts(id: number): Promise<number> {
    await this.pool.execute(
      `UPDATE notifications
       SET attempts = attempts + 1, updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    const row = await this.findById(id);
    return row.attempts;
  }
}
