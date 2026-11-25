import { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { AppDataSource } from '../config/database';
import { UserEntity } from '../models/UserEntity';
import { PeriodEntity } from '../models/PeriodEntity';
import { RequiredDocumentEntity } from '../models/RequiredDocumentEntity';
import { DocumentEntity } from '../models/DocumentEntity';
import { PasswordResetEntity } from '../models/PasswordResetEntity';
import { hashPassword, comparePassword } from '../utils/hash';
import { ok, fail } from '../utils/response';
import { In, IsNull, Not } from 'typeorm';
import { getCatalog } from '../utils/catalog';

const users = () => AppDataSource.getRepository(UserEntity);
const periods = () => AppDataSource.getRepository(PeriodEntity);
const requiredDocs = () => AppDataSource.getRepository(RequiredDocumentEntity);
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const required = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const todayInMexico = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City' }).format(new Date());
const validIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const optionalDate = (value: unknown) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!validIsoDate(text)) throw new Error(`La fecha "${text}" no es válida`);
  return text;
};
const optionalNumber = (value: unknown, field: string, min = 0, max = 9999) => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${field} debe ser un número entero entre ${min} y ${max}`);
  return number;
};
const optionalBoolean = (value: unknown) => {
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (!normalized) return null;
  if (['si', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['no', 'false', '0'].includes(normalized)) return false;
  throw new Error('Usa Sí o No en los campos de respuesta');
};
const DELIVERY_ORDINALS = ['Primera entrega', 'Segunda entrega', 'Tercera entrega', 'Cuarta entrega', 'Quinta entrega', 'Sexta entrega', 'Séptima entrega', 'Octava entrega', 'Novena entrega', 'Décima entrega'];
const LEGACY_SERVICE_SOCIAL_CATEGORIES = new Set([
  'Solicitud de Servicio Social', 'Carta de Aceptacion', 'Carta de Presentacion', 'Carta de Asignacion',
  'Plan de Trabajo', 'Cronograma de Actividades', 'Reporte Mensual 1', 'Reporte Mensual 2',
  'Reporte Mensual 3', 'Reporte Mensual 4', 'Reporte Mensual 5', 'Reporte Mensual 6', 'Informe Final',
  'Carta de Terminacion', 'Carta de Liberacion', 'Evaluacion del Prestador',
  'Evaluacion de la Institucion', 'Constancia de Servicio Social',
  'Carta de Presentación',
  ...['1', '2', '3'].flatMap((copy) => [
    `Reporte Bimestral (Formato XXII) — ejemplar ${copy}`,
    `Evaluación Cualitativa del Prestador (Formato XXIII) — ejemplar ${copy}`,
    `Autoevaluación Cualitativa (Formato XXIV) — ejemplar ${copy}`,
    `Evaluación de Actividades por el Prestador (Formato XXV) — ejemplar ${copy}`,
  ]),
]);
const validDate = (value: unknown) => typeof value === 'string' && validIsoDate(value);

export async function bootstrapStatus(_req: Request, res: Response) {
    ok(res, { initialized: (await users().countBy({ role: 'encargado' })) > 0 });
}

export async function bootstrapManager(req: Request, res: Response) {
  try {
    const { name, password, email } = req.body;
    if (!required(name) || !required(password) || !required(email)) return fail(res, 'Nombre, correo y contraseña son obligatorios', 400);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return fail(res, 'Escribe un correo válido', 400);
    const missing = [];
    if (password.length < 12) missing.push('al menos 12 caracteres');
    if (!/[A-Z]/.test(password)) missing.push('una mayúscula');
    if (!/[a-z]/.test(password)) missing.push('una minúscula');
    if (!/\d/.test(password)) missing.push('un número');
    if (!/[^A-Za-z0-9]/.test(password)) missing.push('un símbolo');
    if (missing.length) return fail(res, `A la contraseña le falta: ${missing.join(', ')}`, 400);
    const saved = await AppDataSource.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(76820431)');
      if (await tx.getRepository(UserEntity).countBy({ role: 'encargado' })) throw new Error('El encargado ya fue creado');
      if (await tx.getRepository(UserEntity).findOneBy({ email: normalizedEmail })) throw new Error('Ese correo ya está registrado');
      return tx.getRepository(UserEntity).save(tx.getRepository(UserEntity).create({
        controlNumber: `ENC-${randomBytes(12).toString('hex')}`, name: name.trim(), role: 'encargado',
        passwordHash: await hashPassword(password), carrera: '', encargadoSection: '', email: normalizedEmail, active: true, mustChangePassword: false,
      }));
    });
    ok(res, { id: saved.id, name: saved.name, email: saved.email }, 201);
  } catch (e: any) { fail(res, e.message, 400); }
}

export async function createStudent(req: Request, res: Response) {
  try {
    const data = req.body || {};
    const controlNumber = String(data.controlNumber || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    const carrera = String(data.carrera || '').trim();
    const currentSemester = String(data.currentSemester || '').trim();
    const gender = String(data.gender || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    if (!controlNumber || !name || !carrera || !currentSemester || !gender || !email) {
      return fail(res, 'Completa matrícula, nombre, carrera, semestre, género y correo electrónico', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'Escribe un correo electrónico válido', 400);
    if (await users().findOneBy({ controlNumber })) return fail(res, 'La matrícula ya existe; no se creó otra cuenta', 409);
    if (await users().findOneBy({ email })) return fail(res, 'Ese correo ya está registrado', 409);
    const serviceYear = optionalNumber(data.serviceYear, 'Año de servicio', 2000, 2100);
    const peopleSupported = optionalNumber(data.peopleSupported, 'Personas que apoya', 0, 1000000);
    const user = await users().save(users().create({
      controlNumber, name, carrera, currentSemester, gender, email,
      serviceOrganization: String(data.serviceOrganization || '').trim() || null,
      serviceSector: String(data.serviceSector || '').trim() || null,
      serviceDepartment: String(data.serviceDepartment || '').trim() || null,
      serviceCity: String(data.serviceCity || '').trim() || null,
      serviceProgram: String(data.serviceProgram || '').trim() || null,
      serviceActivities: String(data.serviceActivities || '').trim() || null,
      hasDisability: optionalBoolean(data.hasDisability),
      indigenousLanguageSpeaker: optionalBoolean(data.indigenousLanguageSpeaker),
      phone: String(data.phone || '').replace(/\D/g, '').slice(0, 30) || null,
      serviceEnrollmentDate: optionalDate(data.serviceEnrollmentDate),
      serviceEndDate: optionalDate(data.serviceEndDate),
      serviceYear, servicePeriod: String(data.servicePeriod || '').trim() || null,
      supportedCommunity: String(data.supportedCommunity || '').trim() || null,
      peopleSupported, role: 'estudiante', passwordHash: await hashPassword('itsur123'),
      active: true, mustChangePassword: true,
    }));
    ok(res, { id: user.id, controlNumber: user.controlNumber, name: user.name, mustChangePassword: true }, 201);
  } catch (e: any) { fail(res, e.message, 400); }
}

export async function importStudents(req: Request, res: Response) {
  const rows = req.body?.students;
  if (!Array.isArray(rows) || !rows.length) return fail(res, 'Envía students como una lista de filas del Excel con controlNumber y name', 400);
  const initialPassword = 'itsur123';
  const result = { created: 0, skipped: [] as Array<{ row: number; reason: string }> };
  const seenNumbers = new Set<string>(); const seenEmails = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const rowNumber = i + 2;
    const controlNumber = String(row.controlNumber || row.noControl || row.matricula || '').trim().toUpperCase();
    const name = String(row.name || row.nombre || '').trim();
    const carrera = String(row.carrera || '').trim();
    const currentSemester = String(row.currentSemester || row.semestre || row.semester || '').trim();
    const gender = String(row.gender || row.genero || '').trim();
    const email = String(row.email || row.correo || '').trim().toLowerCase();
    if (!controlNumber || !name || !carrera || !currentSemester || !gender || !email) {
      result.skipped.push({ row: rowNumber, reason: 'Falta matrícula, nombre, carrera, semestre, género o correo electrónico' }); continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { result.skipped.push({ row: rowNumber, reason: 'Correo electrónico inválido' }); continue; }
    if (controlNumber.length > 30 || name.length > 140 || carrera.length > 140) { result.skipped.push({ row: rowNumber, reason: 'Matrícula, nombre o carrera excede el tamaño permitido' }); continue; }
    if (seenNumbers.has(controlNumber) || await users().findOneBy({ controlNumber })) { result.skipped.push({ row: rowNumber, reason: 'Matrícula repetida' }); continue; }
    if (seenEmails.has(email) || await users().findOneBy({ email })) { result.skipped.push({ row: rowNumber, reason: 'Correo electrónico repetido' }); continue; }
    try {
      const serviceYear = optionalNumber(row.serviceYear || row.ano, 'Año de servicio', 2000, 2100);
      const peopleSupported = optionalNumber(row.peopleSupported || row.personasQueApoya, 'Personas que apoya', 0, 1000000);
      await users().save(users().create({
        controlNumber, name, carrera, currentSemester, gender, email,
        serviceOrganization: String(row.serviceOrganization || row.organizacion || '').trim() || null,
        serviceSector: String(row.serviceSector || row.sector || '').trim() || null,
        serviceDepartment: String(row.serviceDepartment || row.departamento || '').trim() || null,
        serviceCity: String(row.serviceCity || row.ciudad || '').trim() || null,
        serviceProgram: String(row.serviceProgram || row.programa || '').trim() || null,
        serviceActivities: String(row.serviceActivities || row.actividades || '').trim() || null,
        hasDisability: optionalBoolean(row.hasDisability ?? row.discapacidad),
        indigenousLanguageSpeaker: optionalBoolean(row.indigenousLanguageSpeaker ?? row.hablanteLenguasIndigenas),
        phone: String(row.phone || row.celular || '').replace(/\D/g, '').slice(0, 30) || null,
        serviceEnrollmentDate: optionalDate(row.serviceEnrollmentDate || row.fechaInscripcion),
        serviceEndDate: optionalDate(row.serviceEndDate || row.fechaTermino),
        serviceYear, servicePeriod: String(row.servicePeriod || row.periodoServicio || '').trim() || null,
        supportedCommunity: String(row.supportedCommunity || row.comunidad || '').trim() || null,
        peopleSupported, role: 'estudiante', passwordHash: await hashPassword(initialPassword),
        active: true, mustChangePassword: true,
      }));
      seenNumbers.add(controlNumber); seenEmails.add(email); result.created++;
    } catch (e: any) { result.skipped.push({ row: rowNumber, reason: e.message || 'Datos inválidos' }); }
  }
  ok(res, result, 201);
}

export async function updateStudent(req: Request, res: Response) {
  try {
    const student = await users().findOneBy({ id: req.params.id, role: 'estudiante' });
    if (!student) return fail(res, 'Alumno no encontrado', 404);
    const data = req.body || {};
    if (data.controlNumber !== undefined) { if (!required(data.controlNumber)) return fail(res, 'La matrícula es obligatoria', 400); student.controlNumber = data.controlNumber.trim().toUpperCase(); }
    if (data.name !== undefined) { if (!required(data.name)) return fail(res, 'El nombre es obligatorio', 400); student.name = data.name.trim(); }
    if (data.carrera !== undefined) student.carrera = String(data.carrera).trim();
    if (data.currentSemester !== undefined) student.currentSemester = String(data.currentSemester).trim();
    if (data.gender !== undefined) student.gender = String(data.gender).trim();
    if (data.email !== undefined) {
      const email = String(data.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 'Escribe un correo electrónico válido', 400);
      if (await users().findOne({ where: { email, id: Not(student.id) } })) return fail(res, 'Ese correo ya está registrado', 409);
      student.email = email;
    }
    for (const [key, max] of [['serviceOrganization', 500], ['serviceSector', 100], ['serviceDepartment', 500], ['serviceCity', 120], ['serviceProgram', 500], ['serviceActivities', 5000], ['phone', 30], ['servicePeriod', 40], ['supportedCommunity', 140]] as const) {
      if (data[key] !== undefined) {
        const value = key === 'phone' ? String(data[key]).replace(/\D/g, '').slice(0, max) : String(data[key]).trim();
        (student as any)[key] = value || null;
      }
    }
    if (data.hasDisability !== undefined) student.hasDisability = optionalBoolean(data.hasDisability);
    if (data.indigenousLanguageSpeaker !== undefined) student.indigenousLanguageSpeaker = optionalBoolean(data.indigenousLanguageSpeaker);
    if (data.serviceEnrollmentDate !== undefined) student.serviceEnrollmentDate = optionalDate(data.serviceEnrollmentDate);
    if (data.serviceEndDate !== undefined) student.serviceEndDate = optionalDate(data.serviceEndDate);
    if (data.serviceYear !== undefined) student.serviceYear = optionalNumber(data.serviceYear, 'Año de servicio', 2000, 2100);
    if (data.peopleSupported !== undefined) student.peopleSupported = optionalNumber(data.peopleSupported, 'Personas que apoya', 0, 1000000);
    await users().save(student);
    const { passwordHash: _passwordHash, ...publicStudent } = student;
    ok(res, publicStudent);
  } catch (e: any) { fail(res, e.message, 409); }
}

export async function deactivateStudent(req: Request, res: Response) {
  const student = await users().findOneBy({ id: req.params.id, role: 'estudiante' });
  if (!student) return fail(res, 'Alumno no encontrado', 404);
  student.active = false; await users().save(student); ok(res, { id: student.id, active: false, historyPreserved: true });
}

export async function listRequiredDocs(req: Request, res: Response) {
  const programType = String(req.query.programType || 'servicio_social');
  ok(res, await requiredDocs().find({ where: programType === 'all' ? {} : { programType }, order: { stage: 'ASC', category: 'ASC' } }));
}

export async function listDocumentCatalog(_req: Request, res: Response) {
  const base = [...new Map(getCatalog('servicio_social').map((item) => [item.category, item])).values()];
  const known = new Set(base.map((item) => item.category));
  const records = await requiredDocs().findBy({ programType: 'servicio_social' });
  const disabledBase = new Set(records.filter((item) => !item.enabled && known.has(item.category)).map((item) => item.category));
  const custom = new Map<string, RequiredDocumentEntity>();
  for (const item of records) if (item.enabled && !known.has(item.category) && !LEGACY_SERVICE_SOCIAL_CATEGORIES.has(item.category)) custom.set(item.category, item);
  ok(res, [
    ...base.filter((item) => !disabledBase.has(item.category)).map((item) => ({ ...item, custom: false })),
    ...[...custom.values()].map((item) => ({ id: item.id, category: item.category, description: item.description, stage: 'disponible', custom: true })),
  ]);
}

export async function addCatalogDocument(req: Request, res: Response) {
  const { category, description = '' } = req.body;
  if (!required(category) || category.trim().length > 120) return fail(res, 'Escribe el nombre del documento (máximo 120 caracteres)', 400);
  if (getCatalog('servicio_social').some((item) => item.category === category.trim()) || await requiredDocs().findOneBy({ programType: 'servicio_social', category: category.trim() })) {
    return fail(res, 'Ese documento ya está en el catálogo', 409);
  }
  const item = await requiredDocs().save(requiredDocs().create({
    programType: 'servicio_social', category: category.trim(), description: String(description).trim(),
    stage: 'disponible', dueDate: null, startDate: null, endDate: null, instructions: '', active: false, enabled: true,
  }));
  ok(res, { category: item.category, description: item.description, stage: item.stage }, 201);
}

export async function updateCatalogDocument(req: Request, res: Response) {
  const oldCategory = String(req.params.category || '').trim();
  const category = String(req.body.category || '').trim();
  const description = String(req.body.description || '').trim();
  if (!required(category) || category.length > 120) return fail(res, 'El nombre debe tener entre 1 y 120 caracteres', 400);
  if (getCatalog('servicio_social').some((item) => item.category === oldCategory)) return fail(res, 'Los formatos integrados no se pueden renombrar desde el catálogo', 400);
  if (category !== oldCategory && (getCatalog('servicio_social').some((item) => item.category === category) || await requiredDocs().findOneBy({ programType: 'servicio_social', category }))) return fail(res, 'Ya existe un documento con ese nombre', 409);
  const records = await requiredDocs().findBy({ programType: 'servicio_social', category: oldCategory });
  if (!records.length) return fail(res, 'Documento del catálogo no encontrado', 404);
  const activeStages = [...new Set(records.filter((item) => item.active).map((item) => item.stage))];
  await AppDataSource.transaction(async (tx) => {
    await tx.getRepository(RequiredDocumentEntity).update({ programType: 'servicio_social', category: oldCategory }, { category, description });
    if (activeStages.length) {
      await tx.getRepository(DocumentEntity).createQueryBuilder().update(DocumentEntity)
        .set({ category, description })
        .where({ programType: 'servicio_social', category: oldCategory, stage: In(activeStages), status: 'pendiente', fileName: IsNull(), filePath: IsNull(), externalUrl: IsNull(), observations: '' })
        .execute();
    }
  });
  ok(res, { category, description });
}

export async function deactivateCatalogDocument(req: Request, res: Response) {
  const category = String(req.params.category || '').trim();
  const repo = requiredDocs();
  const records = await repo.findBy({ programType: 'servicio_social', category });
  if (getCatalog('servicio_social').some((item) => item.category === category) && !records.length) {
    await repo.save(repo.create({ programType: 'servicio_social', category, description: '', stage: 'catalogo', active: false, enabled: false, dueDate: null, startDate: null, endDate: null, instructions: '' }));
  } else if (records.length) {
    await repo.update({ programType: 'servicio_social', category }, { active: false, enabled: false });
  } else return fail(res, 'Documento del catálogo no encontrado', 404);
  ok(res, { category, enabled: false, historyPreserved: true });
}

export async function saveDelivery(req: Request, res: Response) {
  try {
    const originalName = String(req.params.deliveryName || '').trim();
    const { startDate, endDate, instructions = '', documents } = req.body;
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return fail(res, 'Indica fechas válidas; la fecha de inicio debe ser anterior o igual al fin', 400);
    if (!Array.isArray(documents) || !documents.length || documents.some((value) => typeof value !== 'string')) return fail(res, 'Selecciona al menos un documento para la entrega', 400);
    const selected = [...new Set(documents.map((value: string) => value.trim()))];
    if (selected.length !== documents.length) return fail(res, 'No repitas documentos en la misma entrega', 400);
    const baseCatalog = getCatalog('servicio_social');
    const baseCategories = new Set(baseCatalog.map((item) => item.category));
    const customCatalog = await requiredDocs().findBy({ programType: 'servicio_social', active: false, enabled: true });
    const catalog = [...baseCatalog, ...customCatalog.filter((item) => !baseCategories.has(item.category) && !LEGACY_SERVICE_SOCIAL_CATEGORIES.has(item.category))];
    if (selected.some((category) => !catalog.some((item) => item.category === category))) return fail(res, 'Hay documentos que no pertenecen al catálogo', 400);
    const disabled = await requiredDocs().findBy({ programType: 'servicio_social', enabled: false });
    if (selected.some((category) => disabled.some((item) => item.category === category))) return fail(res, 'Hay formatos desactivados que no se pueden asignar a nuevas entregas', 400);

    const result = await AppDataSource.transaction(async (tx) => {
      const requiredRepo = tx.getRepository(RequiredDocumentEntity);
      const activeRows = await requiredRepo.findBy({ programType: 'servicio_social', active: true });
      const currentRows = originalName ? activeRows.filter((row) => row.stage === originalName) : [];
      if (originalName && !currentRows.length) throw new Error('No se encontró la entrega que quieres editar');
      let name = originalName;
      if (!name) {
        const deliveryNames = [...new Set(activeRows.map((row) => row.stage).filter((stage) => stage !== 'inicio'))];
        name = DELIVERY_ORDINALS[deliveryNames.length] || `Entrega ${deliveryNames.length + 1}`;
      }
      const nowSelected = new Set(selected);
      const removed = currentRows.filter((row) => !nowSelected.has(row.category));
      if (removed.length) await requiredRepo.update(removed.map((row) => row.id), { active: false });

      const rowsToSave = [] as RequiredDocumentEntity[];
      for (const category of selected) {
        const template = catalog.find((item) => item.category === category)!;
        const row = currentRows.find((item) => item.category === category)
          // Reutiliza, si existe, la fila del mismo formato y esta misma
          // entrega. No muevas accidentalmente la fila de otra entrega.
          || await requiredRepo.findOne({ where: { programType: 'servicio_social', category, stage: name } })
          || requiredRepo.create();
        Object.assign(row, {
          programType: 'servicio_social', category, description: template.description,
          stage: name, dueDate: endDate, startDate, endDate,
          instructions: String(instructions).trim(), active: true,
        });
        rowsToSave.push(row);
      }
      const saved = await requiredRepo.save(rowsToSave);

      // Retira de la vista actual solo los placeholders vacíos que se quitaron
      // de la entrega. Si tienen archivo, liga, revisión o comentarios quedan intactos.
      if (removed.length) {
        const studentDocs = tx.getRepository(DocumentEntity);
        for (const row of removed) {
          await studentDocs.createQueryBuilder().delete().from(DocumentEntity)
            .where('program_type = :programType AND category = :category AND stage = :stage AND status = :status', {
              programType: 'servicio_social', category: row.category, stage: name, status: 'pendiente',
            })
            .andWhere('file_name IS NULL AND file_path IS NULL AND external_url IS NULL')
            .andWhere("(observations IS NULL OR observations = '')")
            .execute();
        }
      }
      return { name, startDate, endDate, instructions: String(instructions).trim(), documents: saved };
    });
    ok(res, result, originalName ? 200 : 201);
  } catch (e: any) { fail(res, e.message, 400); }
}

export async function saveRequiredDoc(req: Request, res: Response) {
  try {
    const { programType, category, description = '', stage, dueDate = null } = req.body;
    if (!['servicio_social', 'residencias'].includes(programType) || !required(category) || !required(stage)) return fail(res, 'Programa, nombre y etapa son obligatorios', 400);
    const repo = requiredDocs();
    const item = req.params.id ? await repo.findOneBy({ id: req.params.id }) : repo.create();
    if (!item) return fail(res, 'Documento requerido no encontrado', 404);
    let effectiveDueDate = dueDate;
    if (!req.params.id && effectiveDueDate == null) {
      const sibling = await repo.findOneBy({ programType, stage: stage.trim(), active: true });
      effectiveDueDate = sibling?.dueDate ?? null;
    }
    Object.assign(item, { programType, category: category.trim(), description: String(description), stage: stage.trim(), dueDate: effectiveDueDate });
    await repo.save(item); ok(res, item, req.params.id ? 200 : 201);
  } catch (e: any) { fail(res, e.message, 400); }
}

export async function saveStageDeadline(req: Request, res: Response) {
  const { programType, stage, dueDate = null } = req.body;
  if (!['servicio_social', 'residencias'].includes(programType) || !required(stage) ||
      (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))) {
    return fail(res, 'Indica programa, etapa y una fecha válida (o déjala vacía para quitar el plazo)', 400);
  }
  const result = await requiredDocs().update({ programType, stage: stage.trim(), active: true }, { dueDate });
  if (!result.affected) return fail(res, 'No hay documentos activos configurados para esa etapa', 404);
  ok(res, { programType, stage: stage.trim(), dueDate, updated: result.affected });
}

export async function deactivateRequiredDoc(req: Request, res: Response) {
  const item = await requiredDocs().findOneBy({ id: req.params.id });
  if (!item) return fail(res, 'Documento requerido no encontrado', 404);
  item.active = false; await requiredDocs().save(item); ok(res, item);
}

export async function listPeriods(req: Request, res: Response) {
  const where = req.query.all === 'true' ? {} : { active: true };
  ok(res, await periods().find({ where, order: { startsOn: 'DESC' } }));
}

export async function createPeriod(req: Request, res: Response) {
  try {
    const { programType, name, startsOn, endsOn } = req.body;
    if (!['servicio_social', 'residencias'].includes(programType) || !required(name) || !validIsoDate(startsOn || '') || !validIsoDate(endsOn || '') || startsOn > endsOn) return fail(res, 'Indica programa, nombre y fechas válidas; el inicio no puede ser posterior al fin', 400);
    const clash = await periods().createQueryBuilder('p').where('p.program_type = :programType', { programType }).andWhere('p.active = true').andWhere('p.starts_on <= :endsOn AND p.ends_on >= :startsOn', { startsOn, endsOn }).getOne();
    if (clash) return fail(res, `El periodo se traslapa con «${clash.name}»`, 409);
    const period = await periods().save(periods().create({ programType, name: name.trim(), startsOn, endsOn, active: true })); ok(res, period, 201);
  } catch (e: any) { fail(res, e.message, 400); }
}

export async function updatePeriod(req: Request, res: Response) {
  const existing = await periods().findOneBy({ id: req.params.id });
  if (!existing) return fail(res, 'Periodo no encontrado', 404);
  const { name, startsOn, endsOn } = req.body;
  const nextStart = startsOn || existing.startsOn; const nextEnd = endsOn || existing.endsOn;
  if (!validIsoDate(nextStart) || !validIsoDate(nextEnd) || nextStart > nextEnd || !required(name || existing.name)) return fail(res, 'Indica un nombre y un rango de fechas válido', 400);
  const clash = await periods().createQueryBuilder('p').where('p.id <> :id AND p.program_type = :type AND p.active = true', { id: existing.id, type: existing.programType }).andWhere('p.starts_on <= :end AND p.ends_on >= :start', { start: nextStart, end: nextEnd }).getOne();
  if (clash) return fail(res, `El periodo se traslapa con «${clash.name}»`, 409);
  existing.name = name || existing.name; existing.startsOn = nextStart; existing.endsOn = nextEnd; await periods().save(existing); ok(res, existing);
}

export async function deactivatePeriod(req: Request, res: Response) {
  const period = await periods().findOneBy({ id: req.params.id });
  if (!period) return fail(res, 'Periodo no encontrado', 404);
  period.active = false; await periods().save(period); ok(res, period);
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, password, confirmPassword } = req.body;
  if (typeof confirmPassword !== 'string' || password !== confirmPassword) return fail(res, 'La nueva contraseña y su confirmación no coinciden', 400);
  const messages = [];
  if (typeof password !== 'string' || password.length < 12) messages.push('al menos 12 caracteres');
  if (!/[A-Z]/.test(password || '')) messages.push('una mayúscula');
  if (!/[a-z]/.test(password || '')) messages.push('una minúscula');
  if (!/\d/.test(password || '')) messages.push('un número');
  if (!/[^A-Za-z0-9]/.test(password || '')) messages.push('un símbolo');
  if (messages.length) return fail(res, `A la contraseña le falta: ${messages.join(', ')}`, 400);
  const user = await users().findOneBy({ id: req.user!.userId });
  if (!user || !(await comparePassword(currentPassword || '', user.passwordHash))) return fail(res, 'La contraseña actual no es correcta', 400);
  user.passwordHash = await hashPassword(password); user.mustChangePassword = false; await users().save(user); ok(res, { changed: true });
}

export async function requestPasswordReset(req: Request, res: Response) {
  if (!process.env.RESEND_API_KEY || !process.env.RESET_PUBLIC_URL || !process.env.RESEND_FROM_EMAIL) {
    return fail(res, 'La recuperación de contraseña no está configurada. Configura Resend y la URL pública.', 503);
  }
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = email ? await users().findOneBy({ email, active: true }) : null;
  if (user && process.env.RESEND_API_KEY && process.env.RESET_PUBLIC_URL && process.env.RESEND_FROM_EMAIL) {
    const token = randomBytes(32).toString('hex');
    await AppDataSource.getRepository(PasswordResetEntity).save({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000), usedAt: null });
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject: 'Recupera tu contraseña de SISSEP', html: `<p>Solicitaste recuperar tu contraseña.</p><p><a href="${process.env.RESET_PUBLIC_URL}?token=${token}">Crear contraseña nueva</a></p><p>Este enlace vence en 30 minutos. Si no hiciste esta solicitud, ignora este correo.</p>` }) });
    if (!response.ok) return fail(res, 'No se pudo enviar el correo de recuperación. Intenta más tarde.', 503);
  }
  ok(res, { message: 'Si la cuenta existe, recibirás un enlace de recuperación.' });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;
  const messages = [];
  if (typeof password !== 'string' || password.length < 12) messages.push('al menos 12 caracteres');
  if (!/[A-Z]/.test(password || '')) messages.push('una mayúscula');
  if (!/[a-z]/.test(password || '')) messages.push('una minúscula');
  if (!/\d/.test(password || '')) messages.push('un número');
  if (!/[^A-Za-z0-9]/.test(password || '')) messages.push('un símbolo');
  if (messages.length) return fail(res, `A la contraseña le falta: ${messages.join(', ')}`, 400);
  const reset = await AppDataSource.getRepository(PasswordResetEntity).findOneBy({ tokenHash: hashToken(String(token || '')) });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return fail(res, 'El enlace no es válido o ya expiró', 400);
  const user = await users().findOneBy({ id: reset.userId });
  if (!user) return fail(res, 'Cuenta no encontrada', 404);
  user.passwordHash = await hashPassword(password); user.mustChangePassword = false;
  await users().save(user); reset.usedAt = new Date(); await AppDataSource.getRepository(PasswordResetEntity).save(reset); ok(res, { changed: true });
}

export async function periodHistory(req: Request, res: Response) {
  const period = await periods().findOneBy({ id: req.params.id });
  if (!period) return fail(res, 'Periodo no encontrado', 404);
  const docs = await AppDataSource.getRepository(DocumentEntity).createQueryBuilder('d')
    .innerJoin('d.submissions', 'submission').innerJoin('d.student', 'student')
    .select('submission.id', 'id').addSelect('d.category', 'category')
    .addSelect('d.stage', 'stage').addSelect('submission.file_name', 'fileName').addSelect('submission.status', 'status')
    .addSelect('submission.observations', 'observations').addSelect('submission.submitted_at', 'submittedAt')
    .addSelect('student.name', 'studentName').addSelect('student.control_number', 'controlNumber')
    .where('submission.period_id = :id', { id: period.id }).orderBy('submission.submitted_at', 'ASC').addOrderBy('student.name', 'ASC').getRawMany();
  ok(res, docs);
}

export async function currentStudentPeriod(req: Request, res: Response) {
  const type = String(req.query.programType || 'servicio_social');
  const today = todayInMexico();
  const period = await periods().createQueryBuilder('p').where('p.program_type = :type', { type }).andWhere('p.active = true').andWhere('p.starts_on <= :today AND p.ends_on >= :today', { today }).getOne();
  ok(res, period ? { ...period, acceptsUploads: true } : { acceptsUploads: false, message: 'No hay un periodo activo para recibir documentos hoy.' });
}
