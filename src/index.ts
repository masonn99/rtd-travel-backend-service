import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { validationResult } from 'express-validator';
import { experienceValidation } from './middleware/validate';

dotenv.config();

// Add these debug logs right after dotenv.config()
console.log('==== Environment Variables ====');
console.log('Frontend URL:', process.env.FRONTEND_URL);
console.log('Node ENV:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('============================');

// Add this debug log at the start after dotenv.config()
console.log('==== Initial Environment Check ====');
console.log('FRONTEND_URL from env:', process.env.FRONTEND_URL);
console.log('===============================');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 3000;

// Trust proxy - required for fly.io
app.set('trust proxy', 1);

// Rate limiting with proxy support
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.'
    });
  }
});

app.use(limiter);

// Add debug logging for environment variables
console.log('Frontend URL:', process.env.FRONTEND_URL);
console.log('Node ENV:', process.env.NODE_ENV);

const corsOptions = {
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Clean up the frontend URL (remove trailing slash and any paths)
    const frontendUrl = (process.env.FRONTEND_URL || 'https://rtd-travel-check.vercel.app')
      .replace(/\/$/, '')           // remove trailing slash
      .replace(/\/.*$/, '');        // remove any paths

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      frontendUrl,
      'https://rtd-travel-check.vercel.app',
      // Add preview deployments
      /^https:\/\/rtd-travel-check-.*\.vercel\.app$/
    ].filter(Boolean);
    
    console.log('==== CORS Debug ====');
    console.log('Request origin:', origin);
    console.log('Cleaned frontend URL:', frontendUrl);
    console.log('Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin - allowing request');
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      console.log('Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('Origin blocked:', origin);
      callback(new Error(`CORS error: ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'RTD Travel Backend API is running' });
});

// Add health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

// Get all experiences across all countries
app.get('/api/experiences', async (req: Request, res: Response) => {
  try {
    console.log('Attempting to fetch all experiences');
    const experiences = await prisma.countryExperience.findMany({
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Found ${experiences.length} experiences`);
    res.json(experiences);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ 
      error: 'Error fetching all experiences',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
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
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).json({ 
    error: 'Not Found',
    path: req.url
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Add logging for Prisma connection
prisma.$connect()
  .then(() => {
    console.log('Successfully connected to database');
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Database URL:', process.env.DATABASE_URL?.split('?')[0]); // Log DB URL without credentials
    });
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  });
