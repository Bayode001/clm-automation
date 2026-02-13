const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const db = require('./utils/db');  // Add this line

// Import routes
const contractRoutes = require('./routes/contractRoutes');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbHealth.healthy ? 'connected' : 'disconnected',
            version: '1.0.0',
            error: dbHealth.error
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// API documentation route
app.get('/api-docs', (req, res) => {
    res.json({
        message: 'CLM Automation API Documentation',
        endpoints: {
            contracts: {
                GET: {
                    '/api/contracts': 'Get all contracts (with pagination)',
                    '/api/contracts/:id': 'Get contract by ID',
                    '/api/contracts/stats': 'Get dashboard statistics',
                    '/api/contracts/expiring-soon': 'Get contracts expiring soon'
                },
                POST: {
                    '/api/contracts': 'Create new contract'
                },
                PUT: {
                    '/api/contracts/:id': 'Update contract'
                },
                DELETE: {
                    '/api/contracts/:id': 'Delete contract'
                }
            }
        },
        version: '1.0.0'
    });
});

// Routes
app.use('/api/contracts', contractRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Internal server error'
    });
});

module.exports = app;
