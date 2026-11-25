import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('periods')
export class PeriodEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'program_type', type: 'varchar', length: 30 }) programType!: string;
  @Column({ length: 100 }) name!: string;
  @Column({ name: 'starts_on', type: 'date' }) startsOn!: string;
  @Column({ name: 'ends_on', type: 'date' }) endsOn!: string;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
