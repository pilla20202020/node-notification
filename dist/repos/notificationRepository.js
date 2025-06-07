// src/repos/notificationRepository.ts
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
export default class NotificationRepository {
    constructor() {
        this.init();
    }
    async init() {
        // Open (and create) the SQLite file
        this.db = await open({
            filename: path.resolve(__dirname, '../../data/notifications.db'),
            driver: sqlite3.Database,
        });
        // Create table if missing
        await this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload TEXT,
        scheduled_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    }
    async create(data) {
        const result = await this.db.run(`INSERT INTO notifications (user_id, type, payload, scheduled_at)
       VALUES (?, ?, ?, ?);`, data.user_id, data.type, JSON.stringify(data.payload), data.scheduled_at || null);
        return this.findById(result.lastID);
    }
    async findById(id) {
        return this.db.get(`SELECT * FROM notifications WHERE id = ?;`, id);
    }
    async updateStatus(id, status) {
        await this.db.run(`UPDATE notifications
         SET status = ?, updated_at = datetime('now')
       WHERE id = ?;`, status, id);
    }
    async incrementAttempts(id) {
        await this.db.run(`UPDATE notifications
         SET attempts = attempts + 1, updated_at = datetime('now')
       WHERE id = ?;`, id);
        const row = await this.findById(id);
        return row.attempts;
    }
}
