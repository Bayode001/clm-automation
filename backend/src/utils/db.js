// backend/src/utils/db.js
const { Pool } = require('pg');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'clm_automation',
            user: process.env.DB_USER || 'clm_admin',
            password: process.env.DB_PASSWORD || 'clm123',
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.pool.on('connect', () => {
            console.log('✅ Connected to PostgreSQL database');
        });

        this.pool.on('error', (err) => {
            console.error('❌ Database error:', err.message);
        });
    }

    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            console.log(`📊 Executed query in ${duration}ms: ${text.substring(0, 100)}...`);
            return result;
        } catch (error) {
            console.error('❌ Query error:', error.message);
            throw error;
        }
    }

    async getClient() {
        return await this.pool.connect();
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { healthy: true };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
}

// Singleton instance
module.exports = new Database();