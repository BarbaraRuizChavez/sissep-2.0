import { AppDataSource }                 from '../config/database';
import { UserEntity }                    from '../models/UserEntity';
import { hashPassword, comparePassword } from '../utils/hash';
import { signToken }                     from '../utils/jwt';
import { UserRole }                      from '../types';

const repo = () => AppDataSource.getRepository(UserEntity);

export async function registerUser(data: {
  controlNumber:     string;
  name:              string;
  password:          string;
  role:              UserRole;
  carrera?:          string;
  encargadoSection?: string;
}) {
  const exists = await repo().findOne({
    where: { controlNumber: data.controlNumber.trim() },
  });
  if (exists) throw new Error('El numero de control ya esta registrado');

  const user = repo().create({
    controlNumber:    data.controlNumber.trim(),
    name:             data.name.trim(),
    passwordHash:     await hashPassword(data.password),
    role:             'estudiante',
    carrera:          data.carrera?.trim()          || '',
    encargadoSection: data.encargadoSection?.trim() || '',
    active: true,
    mustChangePassword: false,
  });

  await repo().save(user);
  return { id: user.id, name: user.name, role: user.role, carrera: user.carrera };
}

export async function loginUser(controlNumber: string, password: string) {
  const identifier = controlNumber.trim();
  const user = await repo().findOne({
    where: [
      { controlNumber: identifier },
      { email: identifier.toLowerCase() },
    ],
  });

  // El mismo mensaje para usuario no encontrado y password incorrecto
  // evita revelar si el numero de control existe o no.
  if (!user || !user.active) throw new Error('Credenciales incorrectas');

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) throw new Error('Credenciales incorrectas');

  const token = signToken({
    userId:  user.id,
    role:    user.role,
    carrera: user.carrera,
    name:    user.name,
    mustChangePassword: user.mustChangePassword,
  });

  return {
    token,
    user: {
      id:      user.id,
      name:    user.name,
      role:    user.role,
      carrera: user.carrera,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

export async function getAllStudents() {
  return repo().find({
    where:  { role: 'estudiante' },
    order:  { name: 'ASC' },
    select: [
      'id', 'controlNumber', 'name', 'carrera', 'currentSemester', 'gender', 'email',
      'serviceOrganization', 'serviceSector', 'serviceDepartment', 'serviceCity', 'serviceProgram',
      'serviceActivities', 'hasDisability', 'indigenousLanguageSpeaker', 'phone',
      'serviceEnrollmentDate', 'serviceEndDate', 'serviceYear', 'servicePeriod',
      'supportedCommunity', 'peopleSupported', 'createdAt', 'active',
    ],
  });
}
