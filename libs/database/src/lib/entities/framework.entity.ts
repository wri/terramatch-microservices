import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// A quick stub to get access to a query builder for this table.
@Entity({ name: 'frameworks' })
export class Framework extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ width: 20 })
  slug: string;

  @Column()
  name: string;
}
