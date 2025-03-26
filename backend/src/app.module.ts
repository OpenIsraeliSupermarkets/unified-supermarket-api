import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ChainsModule } from './chains/chains.module.js';
import { ItemsModule } from './items/items.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { EtlPipelineModule } from './etl-pipeline/etl-pipeline.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        PrismaModule,
        ChainsModule,
        ItemsModule,
        EtlPipelineModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { } 
