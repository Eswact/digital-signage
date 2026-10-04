import { Module } from '@nestjs/common';
import { LiveController } from './live.controller';

@Module({ controllers: [LiveController] })
export class LiveModule {}
