import { BaseEntity, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A quick stub to get access to a query builder for this table.
@Entity({ name: 'v2_projects' })
export class Project extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;
}
