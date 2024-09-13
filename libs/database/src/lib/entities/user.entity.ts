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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  // TODO: relate this to the organisations table
  // Note: this is a bigint(20) unsigned according to describe users, but TypeORM claims that
  // unsigned big int isn't supported by MariaDB.
  @Column('bigint', { name: 'organisation_id' })
  organisationId: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'email_address' })
  emailAddress: string;

  @Column()
  password: string;

  @Column({ name: 'email_address_verified_at' })
  emailAddressVerifiedAt: Date;

  @Column({ name: 'last_logged_in_at' })
  lastLoggedInAt: Date;

  @Column({ name: 'job_role' })
  jobRole: string;

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

  @Column({ name: 'phone_number' })
  phoneNumber: string;

  @Column({ name: 'whatsapp_phone' })
  whatsappPhone: string;

  @Column('bool', { name: 'is_subscribed' })
  isSubscribed: boolean;

  @Column('bool', { name: 'has_consented' })
  hasConsented: boolean;

  @Column()
  banners: string;

  @Column({ name: 'api_key' })
  apiKey: string;

  @Column()
  country: string;

  @Column()
  program: string;
}
