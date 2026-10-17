import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

 
  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription('Tài liệu API cho hệ thống BrewLite')
    .setVersion('1.0')
    .addBearerAuth() 
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); 
  

  app.enableCors(); 
  await app.listen(process.env.PORT ?? 4000); 
}
bootstrap();