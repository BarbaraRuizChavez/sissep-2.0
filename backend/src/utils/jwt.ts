import jwt, { SignOptions } from 'jsonwebtoken';
import { ENV }        from '../config/env';
import { JwtPayload } from '../types';

export const signToken = (payload: JwtPayload): string =>
  jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: ENV.JWT_EXPIRES as SignOptions['expiresIn'] });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
