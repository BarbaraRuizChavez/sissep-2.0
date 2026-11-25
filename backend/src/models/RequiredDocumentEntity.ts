import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('required_documents')
export class RequiredDocumentEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'program_type', type: 'varchar', length: 30 }) programType!: string;
  @Column({ length: 120 }) category!: string;
  @Column({ type: 'text', default: '' }) description!: string;
  @Column({ length: 80, default: 'inicio' }) stage!: string;
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null;
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null;
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null;
  @Column({ type: 'text', default: '' }) instructions!: string;
  @Column({ name: 'active', default: true }) active!: boolean;
  @Column({ name: 'enabled', default: true }) enabled!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
