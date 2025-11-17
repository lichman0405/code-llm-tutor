import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Redis connected'));

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

export default redisClient;
