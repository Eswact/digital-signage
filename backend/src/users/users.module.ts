import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, OrganizationsModule],
  providers: [UsersService, AdminBootstrapService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
