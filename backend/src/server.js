// backend/src/server.js
const app = require('./app');
const db = require('./utils/db');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbHealth.healthy ? 'connected' : 'disconnected',
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📄 API Documentation: http://localhost:${PORT}/api-docs`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = server;