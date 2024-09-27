import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'organisation_user' })
export class OrganisationUser extends BaseEntity {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'organisation_id' })
  organisationId: number;

  @Column({ width: 20 })
  status: string;
}
