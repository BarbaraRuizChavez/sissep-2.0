import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { UserRole }       from '../types';
import { DocumentEntity } from './DocumentEntity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'control_number', unique: true, length: 30 })
  controlNumber!: string;

  @Column({ name: 'name', length: 140 })
  name!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'role', type: 'varchar', default: 'estudiante' })
  role!: UserRole;

  @Column({ name: 'carrera', length: 140, nullable: true, default: '' })
  carrera!: string;

  @Column({ name: 'current_semester', type: 'varchar', length: 30, nullable: true })
  currentSemester!: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 40, nullable: true })
  gender!: string | null;

  @Column({ name: 'service_organization', type: 'text', nullable: true })
  serviceOrganization!: string | null;

  @Column({ name: 'service_sector', type: 'varchar', length: 100, nullable: true })
  serviceSector!: string | null;

  @Column({ name: 'service_department', type: 'text', nullable: true })
  serviceDepartment!: string | null;

  @Column({ name: 'service_city', type: 'varchar', length: 120, nullable: true })
  serviceCity!: string | null;

  @Column({ name: 'service_program', type: 'text', nullable: true })
  serviceProgram!: string | null;

  @Column({ name: 'service_activities', type: 'text', nullable: true })
  serviceActivities!: string | null;

  @Column({ name: 'has_disability', type: 'boolean', nullable: true })
  hasDisability!: boolean | null;

  @Column({ name: 'indigenous_language_speaker', type: 'boolean', nullable: true })
  indigenousLanguageSpeaker!: boolean | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'service_enrollment_date', type: 'date', nullable: true })
  serviceEnrollmentDate!: string | null;

  @Column({ name: 'service_end_date', type: 'date', nullable: true })
  serviceEndDate!: string | null;

  @Column({ name: 'service_year', type: 'int', nullable: true })
  serviceYear!: number | null;

  @Column({ name: 'service_period', type: 'varchar', length: 40, nullable: true })
  servicePeriod!: string | null;

  @Column({ name: 'supported_community', type: 'varchar', length: 140, nullable: true })
  supportedCommunity!: string | null;

  @Column({ name: 'people_supported', type: 'int', nullable: true })
  peopleSupported!: number | null;

  // Solo relevante para usuarios con role = 'encargado'
  @Column({ name: 'encargado_section', length: 80, nullable: true, default: '' })
  encargadoSection!: string;

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  mustChangePassword!: boolean;

  @Column({ type: 'varchar', length: 254, nullable: true, unique: true })
  email!: string | null;

  @Column({ name: 'active', type: 'boolean', default: true })
  active!: boolean;

  @OneToMany(() => DocumentEntity, (doc) => doc.student)
  documents!: DocumentEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
