const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    database: process.env.DB_NAME || 'clm_automation',
    user: process.env.DB_USER || 'clm_admin',
    password: process.env.DB_PASSWORD || 'clm123',
});

// Test database connection
async function testDB() {
    try {
        await pool.query('SELECT 1');
        console.log('✅ Database connected');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Middleware
app.use(express.json());

// Health endpoint
app.get('/health', async (req, res) => {
    const dbConnected = await testDB();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbConnected ? 'connected' : 'disconnected',
        version: '1.0.0'
    });
});

// Simple contracts endpoint
app.get('/api/contracts', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, title, counterparty_name, status, type FROM contracts ORDER BY created_at DESC LIMIT 20');
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contracts',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create contract endpoint
app.post('/api/contracts', async (req, res) => {
    try {
        const { title, counterparty_name, owner_user_id, type = 'Other', status = 'draft' } = req.body;
        
        if (!title || !counterparty_name || !owner_user_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: title, counterparty_name, owner_user_id' 
            });
        }

        const result = await pool.query(
            'INSERT INTO contracts (title, counterparty_name, owner_user_id, type, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [title, counterparty_name, owner_user_id, type, status]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Contract created successfully'
        });
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create contract',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Stats endpoint
app.get('/api/contracts/stats', async (req, res) => {
    try {
        const [total, active, byType] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM contracts'),
            pool.query("SELECT COUNT(*) as count FROM contracts WHERE status = 'active'"),
            pool.query('SELECT type, COUNT(*) as count FROM contracts GROUP BY type')
        ]);

        res.json({
            success: true,
            data: {
                total: parseInt(total.rows[0].count),
                active: parseInt(active.rows[0].count),
                byType: byType.rows
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch stats' 
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found',
        availableRoutes: ['/health', '/api/contracts', '/api/contracts/stats']
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📄 API: http://localhost:${PORT}/api/contracts`);
    
    // Test database connection
    await testDB();
});

// Handle shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    pool.end();
    process.exit(0);
});
