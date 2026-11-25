import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { DocStatus } from '../types';
import { DocumentEntity } from './DocumentEntity';

@Entity('document_submissions')
@Index('idx_document_submissions_doc_date', ['documentId', 'submittedAt'])
export class DocumentSubmissionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;
  @ManyToOne(() => DocumentEntity, (document) => document.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' }) document!: DocumentEntity;
  @Column({ name: 'file_name', type: 'varchar', length: 260 }) fileName!: string;
  @Column({ name: 'file_path', type: 'text' }) filePath!: string;
  @Column({ name: 'file_size', type: 'int' }) fileSize!: number;
  @Column({ name: 'period_id', type: 'uuid', nullable: true }) periodId!: string | null;
  @Column({ type: 'varchar', default: 'pendiente' }) status!: DocStatus;
  @Column({ type: 'text', default: '' }) observations!: string;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy!: string | null;
  @CreateDateColumn({ name: 'submitted_at', type: 'timestamp' }) submittedAt!: Date;
}
