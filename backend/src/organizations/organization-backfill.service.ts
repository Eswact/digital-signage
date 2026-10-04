import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Membership } from './membership.entity';
import { OrganizationsService } from './organizations.service';

/**
 * Kullanıcı-sahipli eski veriyi organizasyon modeline taşır (idempotent).
 * Her açılışta çalışır; taşınacak bir şey yoksa hiçbir şey yapmaz:
 *  1. Üyeliği olmayan her kullanıcıya kişisel organizasyon (owner).
 *  2. organization_id boş ama eski user_id dolu cihaz/ekran/grup/API anahtarları,
 *     kullanıcının organizasyonuna bağlanır. Sahipsiz cihazlar sahipsiz kalır.
 */
@Injectable()
export class OrganizationBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OrganizationBackfillService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Membership) private readonly members: Repository<Membership>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly orgs: OrganizationsService,
  ) {}

  onApplicationBootstrap() {
    return this.run();
  }

  async run(): Promise<{ orgsCreated: number; rowsLinked: number }> {
    let orgsCreated = 0;
    for (const user of await this.users.find()) {
      if ((await this.members.count({ where: { userId: user.id } })) === 0) {
        await this.orgs.createPersonalOrg(user);
        orgsCreated++;
      }
    }

    let rowsLinked = 0;
    for (const table of ['devices', 'screens', 'groups', 'api_keys']) {
      const pending = `organization_id IS NULL AND user_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = ${table}.user_id)`;
      const [{ n }] = await this.ds.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${pending}`);
      if (!n) continue;
      await this.ds.query(
        `UPDATE ${table}
            SET organization_id = (
              SELECT m.organization_id FROM memberships m
               WHERE m.user_id = ${table}.user_id
               ORDER BY m.created_at ASC LIMIT 1)
          WHERE ${pending}`,
      );
      rowsLinked += Number(n);
    }

    if (orgsCreated > 0 || rowsLinked > 0) {
      this.logger.log(
        `Organization migration: ${orgsCreated} organizations created, ${rowsLinked} records linked`,
      );
    }
    return { orgsCreated, rowsLinked };
  }
}
