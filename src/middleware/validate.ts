import { body, param } from 'express-validator';

export const experienceValidation = [
  param('name').trim().notEmpty().withMessage('Country name is required'),
  body('name').trim().notEmpty().withMessage('User name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('content').trim().notEmpty().withMessage('Content is required')
    .isLength({ min: 10, max: 1000 }).withMessage('Content must be between 10 and 1000 characters'),
];
