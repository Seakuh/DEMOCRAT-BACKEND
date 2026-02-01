import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

 
  app.enableCors({
    origin: [
      'http://localhost:5000',
      'http://localhost:5176',
      'http://localhost:5173',
      'http://192.168.6.143:5173',
      'http://192.168.150.143:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://www.retromountainphangan.com',
      'https://avanti-kollektiv.de',
      'https://www.event-scanner.com',
      'https://api.event-scanner.com',
      'https://api.avanti-kollektiv.com',
      'https://vartakt.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`DEMOCRAT Backend running on http://localhost:${port}`);
}
bootstrap();
