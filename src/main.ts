import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
