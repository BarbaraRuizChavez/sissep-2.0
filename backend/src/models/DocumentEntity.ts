import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index, OneToMany,
} from 'typeorm';
import { DocStatus, ProgramType } from '../types';
import { UserEntity }             from './UserEntity';
import { DocumentSubmissionEntity } from './DocumentSubmissionEntity';

@Entity('documents')
// Un mismo formato puede entregarse en varias etapas; cada etapa tiene su fila.
@Index('uq_documents_student_program_category_stage', ['studentId', 'programType', 'category', 'stage'], { unique: true })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id' })
  studentId!: string;

  @ManyToOne(() => UserEntity, (u) => u.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: UserEntity;

  @OneToMany(() => DocumentSubmissionEntity, (submission) => submission.document)
  submissions!: DocumentSubmissionEntity[];

  @Column({ name: 'program_type', type: 'varchar' })
  programType!: ProgramType;

  @Column({ name: 'category', length: 120 })
  category!: string;

  @Column({ name: 'description', type: 'text', default: '' })
  description!: string;

  @Column({ name: 'status', type: 'varchar', default: 'pendiente' })
  status!: DocStatus;

  // Archivo fisico subido por el estudiante
  @Column({ name: 'file_name', type: 'varchar', length: 260, nullable: true })
  fileName!: string | null;

  // Ruta relativa desde cwd(), e.g. uploads/servicio_social/ISC/Juan/archivo.pdf
  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath!: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize!: number | null;

  // URL de Google Drive, OneDrive o Dropbox
  @Column({ name: 'external_url', type: 'text', nullable: true })
  externalUrl!: string | null;

  // Comentario del encargado al aprobar o rechazar
  @Column({ name: 'observations', type: 'text', default: '' })
  observations!: string;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'period_id', type: 'uuid', nullable: true })
  periodId!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ type: 'text', default: '' })
  instructions!: string;

  @Column({ length: 80, default: 'inicio' })
  stage!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
