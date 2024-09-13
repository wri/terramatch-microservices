import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity({ name: 'users' })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('uuid')
  uuid: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date;

  // TODO: relate this to the organisations table
  // Note: this is a bigint(20) unsigned according to describe users, but TypeORM claims that
  // unsigned big int isn't supported by MariaDB.
  @Column('bigint')
  organisation_id: number;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column()
  email_address: string;

  @Column()
  password: string;

  @Column()
  email_address_verified_at: Date;

  @Column()
  last_logged_in_at: Date;

  @Column()
  job_role: string;

  @Column()
  facebook: string;

  @Column()
  twitter: string;

  @Column()
  linkedin: string;

  @Column()
  instagram: string;

  @Column()
  avatar: string;

  @Column()
  phone_number: string;

  @Column()
  whatsapp_phone: string;

  @Column('bool')
  is_subscribed: boolean;

  @Column('bool')
  has_consented: boolean;

  @Column()
  banners: string;

  @Column()
  api_key: string;

  @Column()
  country: string;

  @Column()
  program: string;
}
