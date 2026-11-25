import { Request, Response }       from 'express';
import * as DocumentService        from '../services/document.service';
import { ok, fail }                from '../utils/response';
import { toRelative }              from '../utils/folders';
import { DocStatus, ProgramType }  from '../types';
import { PeriodEntity } from '../models/PeriodEntity';
import { AppDataSource } from '../config/database';
import fs from 'fs';
import { DocumentSubmissionEntity } from '../models/DocumentSubmissionEntity';

async function activePeriod(programType: ProgramType) {
  const today = todayInMexico();
  return AppDataSource.getRepository(PeriodEntity).createQueryBuilder('p')
    .where('p.program_type = :programType', { programType }).andWhere('p.active = true')
    .andWhere('p.starts_on <= :today AND p.ends_on >= :today', { today }).getOne();
}

const todayInMexico = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date());

export async function listMyDocs(req: Request, res: Response): Promise<void> {
  try {
    const pt = (req.query.programType as ProgramType) || 'servicio_social';
    ok(res, await DocumentService.getMyDocuments(req.user!.userId, pt));
  } catch (e: any) { fail(res, e.message); }
}

export async function listMySubmissionHistory(req: Request, res: Response): Promise<void> {
  try {
    const programType = (req.query.programType as ProgramType) || 'servicio_social';
    const history = await AppDataSource.getRepository(DocumentSubmissionEntity).createQueryBuilder('s')
      .innerJoin('s.document', 'd')
      .select('s.id', 'id').addSelect('d.category', 'category').addSelect('d.stage', 'stage')
      .addSelect('s.fileName', 'fileName').addSelect('s.filePath', 'filePath')
      .addSelect('s.fileSize', 'fileSize').addSelect('s.periodId', 'periodId').addSelect('s.status', 'status')
      .addSelect('s.observations', 'observations').addSelect('s.submittedAt', 'submittedAt')
      .where('d.student_id = :studentId AND d.program_type = :programType', { studentId: req.user!.userId, programType })
      .orderBy('s.submitted_at', 'DESC').getRawMany();
    ok(res, history);
  } catch (e: any) { fail(res, e.message); }
}

export async function uploadFile(req: Request, res: Response): Promise<void> {
  let uploadedPath: string | undefined;
  try {
    if (!req.file) { fail(res, 'Archivo requerido'); return; }
    uploadedPath = req.file.path;
    const fd = fs.openSync(req.file.path, 'r');
    const signature = Buffer.alloc(5);
    fs.readSync(fd, signature, 0, 5, 0);
    fs.closeSync(fd);
    if (signature.toString('ascii') !== '%PDF-') {
      throw new Error('El archivo no tiene un contenido PDF válido.');
    }
    const { category, stage, programType = 'servicio_social' } = req.body;
    if (!category || !stage) throw new Error('Los campos category y stage son requeridos');
    const period = await activePeriod(programType as ProgramType);
    if (!period) throw new Error('No hay un periodo bimestral vigente para recibir documentos.');

    const doc = await DocumentService.submitFile({
      studentId:   req.user!.userId,
      programType: programType as ProgramType,
      category,
      stage,
      fileName:    req.file.originalname,
      filePath:    toRelative(req.file.path),
      fileSize:    req.file.size,
      periodId: period?.id,
    });
    ok(res, doc, 201);
  } catch (e: any) {
    if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    fail(res, e.message);
  }
}

export async function submitUrl(req: Request, res: Response): Promise<void> {
  fail(res, 'La entrega de documentos debe realizarse mediante un archivo PDF.', 400);
}

export async function progress(req: Request, res: Response): Promise<void> {
  try {
    const pt = (req.query.programType as ProgramType) || 'servicio_social';
    ok(res, await DocumentService.getStudentsProgress(pt));
  } catch (e: any) { fail(res, e.message); }
}

export async function studentDocs(req: Request, res: Response): Promise<void> {
  try {
    const { studentId } = req.params;
    const pt = (req.query.programType as ProgramType) || 'servicio_social';
    ok(res, await DocumentService.getStudentDocuments(studentId, pt));
  } catch (e: any) { fail(res, e.message); }
}

export async function reviewDoc(req: Request, res: Response): Promise<void> {
  try {
    const { docId }                = req.params;
    const { status, observations } = req.body;
    const valid: DocStatus[]       = ['aprobado', 'rechazado'];

    if (!valid.includes(status)) {
      fail(res, 'El campo status debe ser "aprobado" o "rechazado"');
      return;
    }
    if (status === 'rechazado' && (typeof observations !== 'string' || !observations.trim())) {
      fail(res, 'Escribe las observaciones que expliquen qué debe corregir el alumno.', 400);
      return;
    }

    ok(res, await DocumentService.reviewDocument(
      docId, status, observations || '', req.user!.userId,
    ));
  } catch (e: any) { fail(res, e.message); }
}
