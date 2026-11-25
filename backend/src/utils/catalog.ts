import { ProgramType } from '../types';

// Diez formatos distintos. Los cuatro formatos bimestrales se repiten por
// entrega, pero cada entrega conserva su propio registro y su propio archivo.
const SERVICIO_SOCIAL = [
  { category: 'Solicitud de Servicio Social (Formato XVIII)', description: 'Solicitud oficial de servicio social.', stage: 'Primera entrega' },
  { category: 'Carta Compromiso (Formato XX)', description: 'Carta compromiso del prestador.', stage: 'Primera entrega' },
  { category: 'Plan de Trabajo (Formato 04)', description: 'Plan de trabajo de servicio social.', stage: 'Primera entrega' },
  { category: 'Acuse de recibido de Carta de Presentación', description: 'Acuse individual correspondiente a la carta de presentación del alumno.', stage: 'Segunda entrega' },
  { category: 'Carta de Aceptación', description: 'Carta individual de aceptación de la institución receptora.', stage: 'Segunda entrega' },
  { category: 'Reporte Bimestral (Formato XXII)', description: 'Reporte bimestral.', stage: 'Segunda entrega' },
  { category: 'Evaluación Cualitativa del Prestador (Formato XXIII)', description: 'Evaluación cualitativa del prestador.', stage: 'Segunda entrega' },
  { category: 'Autoevaluación Cualitativa (Formato XXIV)', description: 'Autoevaluación cualitativa del prestador.', stage: 'Segunda entrega' },
  { category: 'Evaluación de Actividades por el Prestador (Formato XXV)', description: 'Evaluación de actividades por el prestador.', stage: 'Segunda entrega' },
  { category: 'Reporte Bimestral (Formato XXII)', description: 'Reporte bimestral.', stage: 'Tercera entrega' },
  { category: 'Evaluación Cualitativa del Prestador (Formato XXIII)', description: 'Evaluación cualitativa del prestador.', stage: 'Tercera entrega' },
  { category: 'Autoevaluación Cualitativa (Formato XXIV)', description: 'Autoevaluación cualitativa del prestador.', stage: 'Tercera entrega' },
  { category: 'Evaluación de Actividades por el Prestador (Formato XXV)', description: 'Evaluación de actividades por el prestador.', stage: 'Tercera entrega' },
  { category: 'Reporte Bimestral (Formato XXII)', description: 'Reporte bimestral.', stage: 'Cuarta entrega' },
  { category: 'Evaluación Cualitativa del Prestador (Formato XXIII)', description: 'Evaluación cualitativa del prestador.', stage: 'Cuarta entrega' },
  { category: 'Autoevaluación Cualitativa (Formato XXIV)', description: 'Autoevaluación cualitativa del prestador.', stage: 'Cuarta entrega' },
  { category: 'Evaluación de Actividades por el Prestador (Formato XXV)', description: 'Evaluación de actividades por el prestador.', stage: 'Cuarta entrega' },
  { category: 'Carta de Terminación', description: 'Carta de terminación del servicio social (Formato XIX).', stage: 'Cuarta entrega' },
];

const RESIDENCIAS = [
  { category: 'Solicitud de Residencias', description: 'Formato de solicitud oficial' },
  { category: 'Carta de Aceptacion', description: 'Carta de la empresa receptora' },
  { category: 'Anteproyecto', description: 'Documento de anteproyecto aprobado' },
  { category: 'Carta de Presentacion', description: 'Carta de presentacion del estudiante' },
  { category: 'Reporte Parcial 1', description: 'Primer reporte de avance' },
  { category: 'Reporte Parcial 2', description: 'Segundo reporte de avance' },
  { category: 'Reporte Parcial 3', description: 'Tercer reporte de avance' },
  { category: 'Reporte Final', description: 'Reporte final de la residencia' },
  { category: 'Carta de Terminacion', description: 'Carta de la empresa al finalizar' },
  { category: 'Evaluacion del Residente', description: 'Evaluacion del estudiante por la empresa' },
];

export const getCatalog = (programType: ProgramType) =>
  programType === 'servicio_social' ? SERVICIO_SOCIAL : RESIDENCIAS.map((item) => ({ ...item, stage: 'inicio' }));
