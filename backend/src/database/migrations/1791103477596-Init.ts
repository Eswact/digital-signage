import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791103477596 implements MigrationInterface {
    name = 'Init1791103477596'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "groups" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "user_id" varchar NOT NULL, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "screens" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "template" varchar NOT NULL DEFAULT ('info-board'), "orientation" varchar NOT NULL DEFAULT ('landscape'), "data" text NOT NULL DEFAULT ('{}'), "user_id" varchar NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "devices" ("id" varchar PRIMARY KEY NOT NULL, "device_id" varchar NOT NULL, "name" varchar, "secret_hash" varchar, "app_version" integer, "app_version_name" varchar, "templates" text, "status" varchar NOT NULL DEFAULT ('offline'), "last_seen_at" datetime, "paired_at" datetime, "user_id" varchar, "group_id" varchar, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2667f40edb344d6f274a0d42b6" ON "devices" ("device_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL, "password_hash" varchar NOT NULL, "name" varchar, "role" varchar NOT NULL DEFAULT ('user'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"))`);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "key" varchar, "key_hash" varchar, "prefix" varchar NOT NULL DEFAULT (''), "name" varchar NOT NULL, "user_id" varchar NOT NULL, "screen_id" varchar NOT NULL, "last_used_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON "api_keys" ("key_hash") `);
        await queryRunner.query(`CREATE TABLE "temporary_groups" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "user_id" varchar NOT NULL, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_9f71bda715870718997ed62f64b" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_groups"("id", "name", "user_id", "current_screen_id", "created_at") SELECT "id", "name", "user_id", "current_screen_id", "created_at" FROM "groups"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`ALTER TABLE "temporary_groups" RENAME TO "groups"`);
        await queryRunner.query(`CREATE TABLE "temporary_screens" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "template" varchar NOT NULL DEFAULT ('info-board'), "orientation" varchar NOT NULL DEFAULT ('landscape'), "data" text NOT NULL DEFAULT ('{}'), "user_id" varchar NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_78858e4e861c6747204b75ed9af" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_screens"("id", "name", "template", "orientation", "data", "user_id", "created_at", "updated_at") SELECT "id", "name", "template", "orientation", "data", "user_id", "created_at", "updated_at" FROM "screens"`);
        await queryRunner.query(`DROP TABLE "screens"`);
        await queryRunner.query(`ALTER TABLE "temporary_screens" RENAME TO "screens"`);
        await queryRunner.query(`DROP INDEX "IDX_2667f40edb344d6f274a0d42b6"`);
        await queryRunner.query(`CREATE TABLE "temporary_devices" ("id" varchar PRIMARY KEY NOT NULL, "device_id" varchar NOT NULL, "name" varchar, "secret_hash" varchar, "app_version" integer, "app_version_name" varchar, "templates" text, "status" varchar NOT NULL DEFAULT ('offline'), "last_seen_at" datetime, "paired_at" datetime, "user_id" varchar, "group_id" varchar, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_5e9bee993b4ce35c3606cda194c" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_d430332b2d61167e34a67b0cec1" FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9183950c3888c4a5c41d705cdbc" FOREIGN KEY ("current_screen_id") REFERENCES "screens" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_devices"("id", "device_id", "name", "secret_hash", "app_version", "app_version_name", "templates", "status", "last_seen_at", "paired_at", "user_id", "group_id", "current_screen_id", "created_at", "updated_at") SELECT "id", "device_id", "name", "secret_hash", "app_version", "app_version_name", "templates", "status", "last_seen_at", "paired_at", "user_id", "group_id", "current_screen_id", "created_at", "updated_at" FROM "devices"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`ALTER TABLE "temporary_devices" RENAME TO "devices"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2667f40edb344d6f274a0d42b6" ON "devices" ("device_id") `);
        await queryRunner.query(`DROP INDEX "IDX_57384430aa1959f4578046c9b8"`);
        await queryRunner.query(`CREATE TABLE "temporary_api_keys" ("id" varchar PRIMARY KEY NOT NULL, "key" varchar, "key_hash" varchar, "prefix" varchar NOT NULL DEFAULT (''), "name" varchar NOT NULL, "user_id" varchar NOT NULL, "screen_id" varchar NOT NULL, "last_used_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_a3baee01d8408cd3c0f89a9a973" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06778dc8bedde7cc44c98f1e4de" FOREIGN KEY ("screen_id") REFERENCES "screens" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_api_keys"("id", "key", "key_hash", "prefix", "name", "user_id", "screen_id", "last_used_at", "created_at") SELECT "id", "key", "key_hash", "prefix", "name", "user_id", "screen_id", "last_used_at", "created_at" FROM "api_keys"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`ALTER TABLE "temporary_api_keys" RENAME TO "api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON "api_keys" ("key_hash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_57384430aa1959f4578046c9b8"`);
        await queryRunner.query(`ALTER TABLE "api_keys" RENAME TO "temporary_api_keys"`);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "key" varchar, "key_hash" varchar, "prefix" varchar NOT NULL DEFAULT (''), "name" varchar NOT NULL, "user_id" varchar NOT NULL, "screen_id" varchar NOT NULL, "last_used_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "api_keys"("id", "key", "key_hash", "prefix", "name", "user_id", "screen_id", "last_used_at", "created_at") SELECT "id", "key", "key_hash", "prefix", "name", "user_id", "screen_id", "last_used_at", "created_at" FROM "temporary_api_keys"`);
        await queryRunner.query(`DROP TABLE "temporary_api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_57384430aa1959f4578046c9b8" ON "api_keys" ("key_hash") `);
        await queryRunner.query(`DROP INDEX "IDX_2667f40edb344d6f274a0d42b6"`);
        await queryRunner.query(`ALTER TABLE "devices" RENAME TO "temporary_devices"`);
        await queryRunner.query(`CREATE TABLE "devices" ("id" varchar PRIMARY KEY NOT NULL, "device_id" varchar NOT NULL, "name" varchar, "secret_hash" varchar, "app_version" integer, "app_version_name" varchar, "templates" text, "status" varchar NOT NULL DEFAULT ('offline'), "last_seen_at" datetime, "paired_at" datetime, "user_id" varchar, "group_id" varchar, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "devices"("id", "device_id", "name", "secret_hash", "app_version", "app_version_name", "templates", "status", "last_seen_at", "paired_at", "user_id", "group_id", "current_screen_id", "created_at", "updated_at") SELECT "id", "device_id", "name", "secret_hash", "app_version", "app_version_name", "templates", "status", "last_seen_at", "paired_at", "user_id", "group_id", "current_screen_id", "created_at", "updated_at" FROM "temporary_devices"`);
        await queryRunner.query(`DROP TABLE "temporary_devices"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2667f40edb344d6f274a0d42b6" ON "devices" ("device_id") `);
        await queryRunner.query(`ALTER TABLE "screens" RENAME TO "temporary_screens"`);
        await queryRunner.query(`CREATE TABLE "screens" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "template" varchar NOT NULL DEFAULT ('info-board'), "orientation" varchar NOT NULL DEFAULT ('landscape'), "data" text NOT NULL DEFAULT ('{}'), "user_id" varchar NOT NULL, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "screens"("id", "name", "template", "orientation", "data", "user_id", "created_at", "updated_at") SELECT "id", "name", "template", "orientation", "data", "user_id", "created_at", "updated_at" FROM "temporary_screens"`);
        await queryRunner.query(`DROP TABLE "temporary_screens"`);
        await queryRunner.query(`ALTER TABLE "groups" RENAME TO "temporary_groups"`);
        await queryRunner.query(`CREATE TABLE "groups" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "user_id" varchar NOT NULL, "current_screen_id" varchar, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "groups"("id", "name", "user_id", "current_screen_id", "created_at") SELECT "id", "name", "user_id", "current_screen_id", "created_at" FROM "temporary_groups"`);
        await queryRunner.query(`DROP TABLE "temporary_groups"`);
        await queryRunner.query(`DROP INDEX "IDX_57384430aa1959f4578046c9b8"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "IDX_2667f40edb344d6f274a0d42b6"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`DROP TABLE "screens"`);
        await queryRunner.query(`DROP TABLE "groups"`);
    }

}
