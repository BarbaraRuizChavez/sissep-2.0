import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[ERROR]', err.stack || err.message);
  const multerError = err as Error & { code?: string };
  const status = multerError.code === 'LIMIT_FILE_SIZE' ? 413 : err.message.startsWith('Solo se permiten archivos PDF') ? 400 : 500;
  res.status(status).json({ ok: false, message: err.message || 'Error interno del servidor' });
}
