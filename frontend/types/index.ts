export type UserRole    = 'estudiante' | 'encargado';
export type DocStatus   = 'pendiente'  | 'aprobado' | 'rechazado';
export type ProgramType = 'servicio_social' | 'residencias';

export interface User {
  id:      string;
  name:    string;
  role:    UserRole;
  carrera: string;
  mustChangePassword?: boolean;
}

export interface DocumentRecord {
  id:           string;
  studentId:    string;
  programType:  ProgramType;
  category:     string;
  description:  string;
  status:       DocStatus;
  fileName?:    string | null;
  filePath?:    string | null;
  fileSize?:    number | null;
  externalUrl?: string | null;
  observations: string;
  stage?: string;
  dueDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string;
  createdAt:    string;
  updatedAt?: string;
  submittedAt?: string | null;
}

export interface StudentProgress {
  id:            string;
  controlNumber: string;
  name:          string;
  carrera:       string;
  total:         number;
  approved:      number;
  pending:       number;
  rejected:      number;
}
