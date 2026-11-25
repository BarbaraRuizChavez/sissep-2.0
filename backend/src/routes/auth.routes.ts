import { Router }                  from 'express';
import * as AuthController         from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import * as Management from '../controllers/management.controller';

const router = Router();

router.get('/setup-status', Management.bootstrapStatus);
router.post('/setup', Management.bootstrapManager);
router.post('/register', authenticate, authorize('encargado'), AuthController.register);
router.post('/login',    AuthController.login);
router.post('/password/forgot', Management.requestPasswordReset);
router.post('/password/reset', Management.resetPassword);
router.post('/password/change', authenticate, Management.changePassword);
router.get( '/me',       authenticate, AuthController.me);
router.get( '/students', authenticate, authorize('encargado'), AuthController.listStudents);
router.post('/students', authenticate, authorize('encargado'), Management.createStudent);
router.post('/students/import', authenticate, authorize('encargado'), Management.importStudents);
router.patch('/students/:id', authenticate, authorize('encargado'), Management.updateStudent);
router.delete('/students/:id', authenticate, authorize('encargado'), Management.deactivateStudent);

export default router;
