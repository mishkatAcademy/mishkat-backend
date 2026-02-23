// src/routes/adminInstructorRoutes.ts
import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/authMiddleware';
import { validateRequest } from '../middlewares/validate';
import { adminCreateInstructorSchema } from '../validations/adminInstructor.schema';
import { adminCreateInstructorCtrl } from '../controllers/adminInstructorController';

const router = Router();

router.use(protect, isAdmin);

router.post(
  '/instructors',
  validateRequest({ body: adminCreateInstructorSchema }),
  adminCreateInstructorCtrl,
);

export default router;
