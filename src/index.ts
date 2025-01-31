import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';
import { experienceValidation } from './middleware/validate';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'RTD Travel Backend API is running' });
});

// Get all experiences across all countries
app.get('/api/experiences', async (req: Request, res: Response) => {
  try {
    const experiences = await prisma.countryExperience.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(experiences);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching all experiences' });
  }
});

// Get total count of experiences by country
app.get('/api/experiences/stats', async (req: Request, res: Response) => {
  try {
    const stats = await prisma.countryExperience.groupBy({
      by: ['country'],
      _count: {
        country: true
      },
      orderBy: {
        _count: {
          country: 'desc'
        }
      }
    });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching experience statistics' });
  }
});

// Get experiences for a specific country
app.get('/api/countries/:name/experiences', async (req: Request, res: Response) => {
  try {
    const experiences = await prisma.countryExperience.findMany({
      where: { country: req.params.name },
      orderBy: { createdAt: 'desc' }
    });
    res.json(experiences);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching experiences' });
  }
});

// Add new experience for a country
app.post('/api/countries/:name/experiences', experienceValidation, async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const experience = await prisma.countryExperience.create({
      data: {
        country: req.params.name,
        name: req.body.name,
        content: req.body.content
      }
    });
    res.json(experience);
  } catch (error) {
    res.status(500).json({ error: 'Error creating experience' });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
