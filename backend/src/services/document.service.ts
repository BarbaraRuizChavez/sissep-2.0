import { AppDataSource }  from '../config/database';
import { DocumentEntity } from '../models/DocumentEntity';
import { DocStatus, ProgramType } from '../types';
import { RequiredDocumentEntity } from '../models/RequiredDocumentEntity';
import { DocumentSubmissionEntity } from '../models/DocumentSubmissionEntity';

const repo = () => AppDataSource.getRepository(DocumentEntity);
const todayInMexico = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date());
function assertDeliveryOpen(doc: DocumentEntity) {
  const today = todayInMexico();
  if (!doc.startDate || !doc.endDate) throw new Error(`El encargado aún no configura las fechas de ${doc.stage.toLowerCase()}.`);
  if (doc.startDate && today < doc.startDate) throw new Error(`La ${doc.stage.toLowerCase()} comienza el ${doc.startDate}.`);
  if (doc.endDate && today > doc.endDate) throw new Error(`El plazo de la ${doc.stage.toLowerCase()} terminó el ${doc.endDate}.`);
}

/**
 * Crea las filas del catalogo para un estudiante si aun no existen.
 * Se llama automaticamente al listar documentos.
 */
export async function seedCatalog(
  studentId:   string,
  programType: ProgramType,
): Promise<void> {
  const configured = await AppDataSource.getRepository(RequiredDocumentEntity).find({ where: { programType, active: true }, order: { stage: 'ASC' } });
  const catalog = configured;
  for (const item of catalog) {
    const exists = await repo().findOne({
      where: { studentId, programType, category: item.category, stage: item.stage },
    });
    if (!exists) {
      await repo().save(
      repo().create({
        studentId, programType, category: item.category, description: item.description,
        stage: item.stage, dueDate: item.dueDate, startDate: item.startDate || null,
        endDate: item.endDate || null, instructions: item.instructions || '', status: 'pendiente',
      }),
      );
    } else if (configured.length) {
      exists.description = item.description;
      exists.stage = item.stage;
      exists.dueDate = item.dueDate;
      exists.startDate = item.startDate || null;
      exists.endDate = item.endDate || null;
      exists.instructions = item.instructions || '';
      await repo().save(exists);
    }
  }
}

// Devuelve los documentos del estudiante autenticado, creando el catalogo si no existe
export async function getMyDocuments(studentId: string, programType: ProgramType) {
  await seedCatalog(studentId, programType);
  const configured = await AppDataSource.getRepository(RequiredDocumentEntity).find({ where: { programType, active: true } });
  const assigned = new Set(configured.map((item) => `${item.category}\u0000${item.stage}`));
  const studentDocuments = await repo().find({
    where: { studentId, programType },
    order: { createdAt: 'ASC' },
  });
  // Los documentos que el encargado quitó dejan de solicitarse en el panel
  // activo del alumno. Los archivos enviados siguen visibles en su historial.
  return studentDocuments.filter((item) => assigned.has(`${item.category}\u0000${item.stage}`));
}

// Devuelve los documentos de cualquier estudiante (uso del encargado)
export async function getStudentDocuments(studentId: string, programType: ProgramType) {
  await seedCatalog(studentId, programType);
  return repo().find({
    where: { studentId, programType },
    order: { createdAt: 'ASC' },
  });
}

// Registra un archivo fisico subido por el estudiante
export async function submitFile(data: {
  studentId:   string;
  programType: ProgramType;
  category:    string;
  stage:       string;
  fileName:    string;
  filePath:    string;
  fileSize:    number;
  periodId?:   string;
}) {
  const doc = await repo().findOne({
    where: {
      studentId:   data.studentId,
      programType: data.programType,
      category:    data.category,
      stage:       data.stage,
    },
  });
  if (!doc) throw new Error(`Documento "${data.category}" no encontrado en el catalogo`);
  assertDeliveryOpen(doc);

  if (doc.status === 'aprobado' || (doc.status === 'pendiente' && (doc.filePath || doc.externalUrl))) {
    throw new Error('Solo puedes reemplazar un documento rechazado.');
  }

  doc.fileName     = data.fileName;
  doc.filePath     = data.filePath;
  doc.fileSize     = data.fileSize;
  doc.externalUrl  = null;
  doc.periodId     = data.periodId || null;
  doc.submittedAt  = new Date();
  doc.status       = 'pendiente';
  doc.observations = '';
  doc.submittedAt  = new Date();
  const saved = await repo().save(doc);
  await AppDataSource.getRepository(DocumentSubmissionEntity).save({
    documentId: saved.id, fileName: data.fileName, filePath: data.filePath,
    fileSize: data.fileSize, periodId: data.periodId || null, status: 'pendiente', observations: '', reviewedBy: null,
  });
  return saved;
}

// Registra una URL externa (Google Drive, OneDrive, Dropbox)
export async function submitUrl(data: {
  studentId:   string;
  programType: ProgramType;
  category:    string;
  stage:       string;
  externalUrl: string;
  periodId?: string;
}) {
  const doc = await repo().findOne({
    where: {
      studentId:   data.studentId,
      programType: data.programType,
      category:    data.category,
      stage:       data.stage,
    },
  });
  if (!doc) throw new Error(`Documento "${data.category}" no encontrado en el catalogo`);
  assertDeliveryOpen(doc);

  doc.externalUrl  = data.externalUrl;
  doc.periodId     = data.periodId || null;
  doc.status       = 'pendiente';
  doc.observations = '';

  return repo().save(doc);
}

// Aprueba o rechaza un documento (solo encargados)
export async function reviewDocument(
  docId:        string,
  status:       DocStatus,
  observations: string,
  reviewedBy:   string,
) {
  const doc = await repo().findOne({ where: { id: docId } });
  if (!doc) throw new Error('Documento no encontrado');

  if (doc.status !== 'pendiente' || (!doc.filePath && !doc.externalUrl)) {
    throw new Error('Solo se pueden revisar documentos enviados que sigan pendientes.');
  }
  if (status === 'rechazado' && !observations.trim()) {
    throw new Error('Las observaciones son obligatorias al rechazar un documento.');
  }

  doc.status       = status;
  doc.observations = observations || '';
  doc.reviewedBy   = reviewedBy;
  const saved = await repo().save(doc);
  const latestSubmission = await AppDataSource.getRepository(DocumentSubmissionEntity).findOne({
    where: { documentId: doc.id }, order: { submittedAt: 'DESC' },
  });
  if (latestSubmission) {
    latestSubmission.status = status;
    latestSubmission.observations = observations || '';
    latestSubmission.reviewedBy = reviewedBy;
    await AppDataSource.getRepository(DocumentSubmissionEntity).save(latestSubmission);
  }
  return saved;
}

// Progreso agregado de todos los estudiantes (query SQL directa para eficiencia)
export async function getStudentsProgress(programType: ProgramType) {
  return AppDataSource.query(
    `SELECT
       u.id,
       u.control_number                                              AS "controlNumber",
       u.name,
       u.carrera,
       COUNT(d.id)::int                                             AS total,
       SUM(CASE WHEN d.status = 'aprobado'  THEN 1 ELSE 0 END)::int AS approved,
       SUM(CASE WHEN d.status = 'pendiente' THEN 1 ELSE 0 END)::int AS pending,
       SUM(CASE WHEN d.status = 'rechazado' THEN 1 ELSE 0 END)::int AS rejected
     FROM users u
     LEFT JOIN documents d
            ON d.student_id  = u.id
           AND d.program_type = $1
     WHERE u.role = 'estudiante'
     GROUP BY u.id, u.control_number, u.name, u.carrera
     ORDER BY u.name ASC`,
    [programType],
  );
}
