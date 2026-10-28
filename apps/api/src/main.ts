import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001', /\.onrender\.com$/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'idempotency-key'],
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));
  
  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription('Tài liệu API cho hệ thống BrewLite')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();