import { createFastifyInstance } from './config/fastify';
import { healthRoutes } from './routes/health';
import { dropletRoutes } from './routes/droplet';
import { webhookRoutes } from './routes/webhook';
import { productRoutes } from './routes/products';
import { orderRoutes } from './routes/orders';
import { repRoutes } from './routes/reps';
import { testWebhookRoutes } from './routes/testWebhook';

// Create Fastify instance with all configuration
const fastify = createFastifyInstance();

// Register all routes
fastify.register(healthRoutes);
fastify.register(dropletRoutes);
fastify.register(webhookRoutes);
fastify.register(productRoutes);
fastify.register(orderRoutes);
fastify.register(repRoutes);
fastify.register(testWebhookRoutes);

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    // startup info log removed
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();