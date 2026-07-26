const Redis = require('ioredis');

// URLni to'g'ridan-to'g'ri process.env dan olish
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    throw new Error('REDIS_URL muhit o\'zgaruvchisi (.env) topilmadi!');
}

const redis = new Redis(redisUrl, {
    // Upstash uchun TLS shart
    tls: {
        rejectUnauthorized: false
    },
    retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    connectTimeout: 10000 // Ulanish uchun 10 soniya kutish
});

// Xatolarni ushlash uchun listener (MUHIM!)
redis.on('error', (err) => {
    console.error('❌ Redis xatosi:', err.message);
});

redis.on('connect', () => {
    console.log('🚀 Redis ga ulanish o\'rnatildi');
});

redis.on('ready', () => {
    console.log('✅ Redis ma\'lumotlar almashishga tayyor');
});

module.exports = redis;