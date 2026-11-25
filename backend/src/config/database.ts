import 'reflect-metadata';
import { DataSource, In, IsNull } from 'typeorm';
import { ENV }            from './env';
import { UserEntity }     from '../models/UserEntity';
import { DocumentEntity } from '../models/DocumentEntity';
import { PeriodEntity } from '../models/PeriodEntity';
import { RequiredDocumentEntity } from '../models/RequiredDocumentEntity';
import { PasswordResetEntity } from '../models/PasswordResetEntity';
import { DocumentSubmissionEntity } from '../models/DocumentSubmissionEntity';
import { getCatalog } from '../utils/catalog';

export const AppDataSource = new DataSource({
  type:       'postgres',
  host:        ENV.DB.HOST,
  port:        ENV.DB.PORT,
  username:    ENV.DB.USER,
  password:    ENV.DB.PASS,
  database:    ENV.DB.NAME,
  // synchronize crea y actualiza las tablas automaticamente en desarrollo.
  // En produccion debe ser false y usar migraciones.
  synchronize: ENV.NODE_ENV === 'development',
  logging:     false,
  entities:    [UserEntity, DocumentEntity, PeriodEntity, RequiredDocumentEntity, PasswordResetEntity, DocumentSubmissionEntity],
});

export async function connectDB(): Promise<void> {
  await AppDataSource.initialize();
  await AppDataSource.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP');
  await AppDataSource.query("ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE");
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS document_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    file_name VARCHAR(260) NOT NULL, file_path TEXT NOT NULL, file_size INTEGER NOT NULL, period_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pendiente', observations TEXT NOT NULL DEFAULT '', reviewed_by UUID,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW())`);
  await AppDataSource.query('CREATE INDEX IF NOT EXISTS idx_document_submissions_doc_date ON document_submissions(document_id, submitted_at)');
  await AppDataSource.query('ALTER TABLE document_submissions ADD COLUMN IF NOT EXISTS period_id UUID');
  // Incorpora las entregas existentes al historial para no perder lo ya cargado.
  await AppDataSource.query(`
    INSERT INTO document_submissions (document_id, file_name, file_path, file_size, period_id, status, observations, reviewed_by, submitted_at)
    SELECT d.id, d.file_name, d.file_path, COALESCE(d.file_size, 0), d.period_id, d.status, d.observations, d.reviewed_by, COALESCE(d.submitted_at, d.created_at)
    FROM documents d
    WHERE d.file_path IS NOT NULL AND d.file_name IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM document_submissions s WHERE s.document_id = d.id)
  `);
  // Migración compatible con bases existentes que todavía tienen la unicidad
  // anterior (alumno + programa + categoría) y bloquean formatos repetidos.
  await AppDataSource.query('ALTER TABLE documents DROP CONSTRAINT IF EXISTS uq_student_doc');
  await AppDataSource.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_student_program_category_stage ON documents(student_id, program_type, category, stage)');
  const required = AppDataSource.getRepository(RequiredDocumentEntity);
  for (const programType of ['servicio_social', 'residencias'] as const) {
    const existing = await required.findBy({ programType });
    // Actualiza una sola vez el catálogo anterior, que era una lista genérica
    // de 18 documentos asignados a "inicio". Los catálogos personalizados se
    // conservan para que los encargados no pierdan su configuración.
    const legacyServiceSocialCategories = [
        'Solicitud de Servicio Social', 'Carta de Aceptacion', 'Carta de Presentacion',
        'Carta de Asignacion', 'Plan de Trabajo', 'Cronograma de Actividades',
        'Reporte Mensual 1', 'Reporte Mensual 2', 'Reporte Mensual 3', 'Reporte Mensual 4',
        'Reporte Mensual 5', 'Reporte Mensual 6', 'Informe Final', 'Carta de Terminacion',
        'Carta de Liberacion', 'Evaluacion del Prestador', 'Evaluacion de la Institucion',
        'Constancia de Servicio Social',
    ];
    const migratingLegacyCatalog = programType === 'servicio_social' && existing.length > 0 && existing.every((item) =>
      item.stage === 'inicio' && legacyServiceSocialCategories.includes(item.category),
    );
    if (migratingLegacyCatalog) {
      await required.update(existing.map((item) => item.id), { active: false });
      // Retira solo las filas placeholder antiguas: cualquier envío, revisión
      // o comentario queda intacto como parte del historial del alumno.
      await AppDataSource.getRepository(DocumentEntity).delete({
        programType: 'servicio_social', category: In(legacyServiceSocialCategories), stage: 'inicio',
        status: 'pendiente', fileName: IsNull(), filePath: IsNull(), externalUrl: IsNull(), observations: '',
      });
    }

    if (programType === 'servicio_social') {
      const deliveryNames: Record<string, string> = {
        'Etapa 1': 'Primera entrega', 'Etapa 2': 'Segunda entrega',
        'Etapa 3': 'Tercera entrega', 'Etapa 4': 'Cuarta entrega',
      };
      const repeatedFormats: Array<[string, string, string]> = [
        ['Reporte Bimestral (Formato XXII) — ejemplar 1', 'Reporte Bimestral (Formato XXII)', 'Segunda entrega'],
        ['Reporte Bimestral (Formato XXII) — ejemplar 2', 'Reporte Bimestral (Formato XXII)', 'Tercera entrega'],
        ['Reporte Bimestral (Formato XXII) — ejemplar 3', 'Reporte Bimestral (Formato XXII)', 'Cuarta entrega'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 1', 'Evaluación Cualitativa del Prestador (Formato XXIII)', 'Segunda entrega'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 2', 'Evaluación Cualitativa del Prestador (Formato XXIII)', 'Tercera entrega'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 3', 'Evaluación Cualitativa del Prestador (Formato XXIII)', 'Cuarta entrega'],
        ['Autoevaluación Cualitativa (Formato XXIV) — ejemplar 1', 'Autoevaluación Cualitativa (Formato XXIV)', 'Segunda entrega'],
        ['Autoevaluación Cualitativa (Formato XXIV) — ejemplar 2', 'Autoevaluación Cualitativa (Formato XXIV)', 'Tercera entrega'],
        ['Autoevaluación Cualitativa (Formato XXIV) — ejemplar 3', 'Autoevaluación Cualitativa (Formato XXIV)', 'Cuarta entrega'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 1', 'Evaluación de Actividades por el Prestador (Formato XXV)', 'Segunda entrega'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 2', 'Evaluación de Actividades por el Prestador (Formato XXV)', 'Tercera entrega'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 3', 'Evaluación de Actividades por el Prestador (Formato XXV)', 'Cuarta entrega'],
      ];
      for (const [oldCategory, category, stage] of repeatedFormats) {
        await required.update({ programType, category: oldCategory, stage }, { category });
        await AppDataSource.getRepository(DocumentEntity).update({ programType, category: oldCategory, stage }, { category });
      }
      await required.update({ programType, category: 'Carta de Presentación' }, { active: false, enabled: false });
      const documentCopies: Array<[string, string]> = [
        ['Reporte Bimestral (Formato XXII) — Etapa 2', 'Reporte Bimestral (Formato XXII) — ejemplar 1'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — Etapa 2', 'Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 1'],
        ['Autoevaluación Cualitativa (Formato XXIV) — Etapa 2', 'Autoevaluación Cualitativa (Formato XXIV) — ejemplar 1'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — Etapa 2', 'Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 1'],
        ['Reporte Bimestral (Formato XXII) — Etapa 3', 'Reporte Bimestral (Formato XXII) — ejemplar 2'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — Etapa 3', 'Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 2'],
        ['Autoevaluación Cualitativa (Formato XXIV) — Etapa 3', 'Autoevaluación Cualitativa (Formato XXIV) — ejemplar 2'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — Etapa 3', 'Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 2'],
        ['Reporte Bimestral (Formato XXII) — Etapa 4', 'Reporte Bimestral (Formato XXII) — ejemplar 3'],
        ['Evaluación Cualitativa del Prestador (Formato XXIII) — Etapa 4', 'Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar 3'],
        ['Autoevaluación Cualitativa (Formato XXIV) — Etapa 4', 'Autoevaluación Cualitativa (Formato XXIV) — ejemplar 3'],
        ['Evaluación de Actividades por el Prestador (Formato XXV) — Etapa 4', 'Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar 3'],
      ];
      for (const [oldCategory, category] of documentCopies) {
        const oldStage = oldCategory.match(/Etapa (\d)$/)?.[0];
        const stage = oldStage ? deliveryNames[oldStage] : undefined;
        if (!stage) continue;
        await required.update({ programType, category: oldCategory, stage: oldStage }, { category, stage });
        await AppDataSource.getRepository(DocumentEntity).update({ programType, category: oldCategory, stage: oldStage }, { category, stage });
      }
      // Normaliza los nombres heredados con sufijo de ejemplar al tipo único
      // del catálogo; la etapa sigue distinguiendo cada carga bimestral.
      for (const [oldCategory, category, stage] of repeatedFormats) {
        await required.update({ programType, category: oldCategory, stage }, { category });
        await AppDataSource.getRepository(DocumentEntity).update({ programType, category: oldCategory, stage }, { category });
      }
      for (const [oldStage, stage] of Object.entries(deliveryNames)) {
        await required.update({ programType, stage: oldStage }, { stage });
        await AppDataSource.getRepository(DocumentEntity).update({ programType, stage: oldStage }, { stage });
      }
    }

    // Solo se inicializa el catálogo en una base nueva o al reemplazar el
    // catálogo genérico antiguo. Las entregas que el encargado quite no se
    // vuelven a agregar cada vez que arranca el servidor.
    if (!existing.length || migratingLegacyCatalog) {
      await required.save(getCatalog(programType).map((item) => required.create({
        ...item, programType, dueDate: null, startDate: null, endDate: null, instructions: '', active: true,
      })));
    }
  }
  console.log('[DB] PostgreSQL conectado correctamente');
}
