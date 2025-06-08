# Laravel + Node.js Notification System

This repository contains a full-stack, event-driven notification system built with:

- 🧩 Laravel (PHP 8+) for RESTful API and Redis publishing
- ⚡ Fastify + TypeScript Node.js microservice for Redis consumption
- 🧠 MySQL and Redis for persistent storage and message brokering

---

## 📦 Repository Structure

```
├── laravel-notification-api/       # Laravel backend API
└── node-notification-microservice/ # Node.js microservice (TypeScript)
```

---

## 🚀 Features

### Laravel Notification API

- RESTful endpoints:
  - `POST /api/notifications/publish`
  - `GET /api/notifications/recent`
  - `GET /api/notifications/summary`
  - `PUT /api/notifications/{id}/status`
- Uses MySQL to store notifications
- Publishes to Redis Pub/Sub (`notifications` channel)
- Enforces **rate limiting**: max 10 notifications/user/hour
- Caches recent notifications and summary responses

### Node.js Notification Microservice

- Listens to Redis Pub/Sub `notifications` channel
- Simulates notification sending via `console.log()`
- Uses `axios` to update notification `status` in Laravel
- Implements **exponential backoff retry** (default 3 attempts)

---

## 🧰 Requirements

- PHP 8.1+ and Composer
- Node.js 16+ and npm
- MySQL (or compatible DB)
- Redis (via Docker or standalone)

---

## 🔧 Setup Instructions

### 1. Laravel Notification API

```bash
cd laravel-notification-api
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve --port=8000
```

API will be available at: `http://localhost:8000`

---

### 2. Node Notification Microservice

```bash
cd node-notification-microservice
cp .env.example .env
npm install
npx tsc
npm start
```

Ensure `.env` has:
```
LARAVEL_API_BASE_URL=http://localhost:8000/api
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_CHANNEL=notifications
MAX_RETRY_ATTEMPTS=3
```

---

## 🔁 End-to-End Message Flow

1. **Client** sends `POST /api/notifications/publish`
2. **Laravel**:
   - Validates and rate-limits the request
   - Saves the notification (`status = pending`)
   - Publishes message to Redis
3. **Node.js Microservice**:
   - Receives message via Redis subscription
   - Simulates sending
   - Updates Laravel via `PUT /api/notifications/{id}/status`
4. **Laravel** updates DB (`status = sent | failed`)

---

## 🧪 Sample Request

**Publish Notification**

```
POST /api/notifications/publish
Content-Type: application/json

{
  "user_id": 1,
  "type": "email",
  "payload": {
    "subject": "Welcome!",
    "message": "Thanks for signing up."
  },
  "scheduled_at": null
}
```

**Update Status (called by Node.js)**

```
PUT /api/notifications/5/status

{
  "status": "sent"
}
```

---

## 🛡️ Design Highlights

- Repository & Service layers (Laravel)
- Rate limiting & caching (Laravel)
- Exponential retry (Node.js)
- Redis Pub/Sub integration
- Fully decoupled producer/consumer

---

## 🚀 Extensibility

- Add new types (`in_app`, `webhook`) by updating validation rules
- Replace Redis Pub/Sub with RabbitMQ if needed
- Add dead-letter queue or metrics for observability

---

## 👥 Auth Note

For simplicity, requests use `user_id` in payload. In production, implement auth (e.g. Sanctum/JWT) to infer user identity.

---

## 📄 License

MIT