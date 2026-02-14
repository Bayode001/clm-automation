const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Database connection
const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'clm_automation',
    user: 'clm_admin',
    password: 'clm123',
});

// Middleware
app.use(cors());
app.use(express.json());

// 1. Health endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            port: PORT,
            database: 'connected' 
        });
    } catch (error) {
        res.json({ 
            status: 'unhealthy', 
            timestamp: new Date().toISOString(),
            port: PORT,
            error: error.message 
        });
    }
});

// 2. GET all contracts
app.get('/api/contracts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contracts ORDER BY created_at DESC');
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('GET /api/contracts error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contracts'
        });
    }
});

// 3. POST create contract
app.post('/api/contracts', async (req, res) => {
    try {
        const { 
            title, 
            counterparty_name, 
            owner_user_id,
            description,
            counterparty_email,
            status = 'draft',
            type = 'Other',
            effective_date,
            expiration_date,
            contract_value,
            currency = 'USD'
        } = req.body;

        // Required fields validation
        if (!title || !counterparty_name || !owner_user_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: title, counterparty_name, owner_user_id' 
            });
        }

        const query = `
            INSERT INTO contracts (
                title, description, counterparty_name, counterparty_email,
                owner_user_id, status, type, effective_date, expiration_date,
                contract_value, currency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const values = [
            title,
            description || null,
            counterparty_name,
            counterparty_email || null,
            owner_user_id,
            status,
            type,
            effective_date || null,
            expiration_date || null,
            contract_value || null,
            currency
        ];

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Contract created successfully'
        });
    } catch (error) {
        console.error('POST /api/contracts error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create contract'
        });
    }
});

// 4. GET dashboard statistics - MOVED ABOVE :id
app.get('/api/contracts/stats', async (req, res) => {
    try {
        const [total, active, byType] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM contracts'),
            pool.query("SELECT COUNT(*) FROM contracts WHERE status = 'active'"),
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
        console.error('GET /api/contracts/stats error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics'
        });
    }
});

// 5. GET expiring contracts - MOVED ABOVE :id
app.get('/api/contracts/expiring-soon', async (req, res) => {
    try {
        const days = req.query.days || 30;
        const result = await pool.query(`
            SELECT * FROM contracts 
            WHERE status = 'active' 
            AND expiration_date IS NOT NULL
            AND expiration_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
            ORDER BY expiration_date ASC
        `, [days]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('GET /api/contracts/expiring-soon error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch expiring contracts'
        });
    }
});

// 6. Search contracts by keyword
app.get('/api/contracts/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query parameter "q" is required'
            });
        }

        const result = await pool.query(`
            SELECT * FROM contracts 
            WHERE 
                title ILIKE $1 OR 
                description ILIKE $1 OR 
                counterparty_name ILIKE $1 OR 
                counterparty_email ILIKE $1
            ORDER BY created_at DESC
        `, [`%${q}%`]);

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
            query: q
        });
    } catch (error) {
        console.error('GET /api/contracts/search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to search contracts'
        });
    }
});

// 7. Filter contracts by multiple criteria
app.get('/api/contracts/filter', async (req, res) => {
    try {
        const { status, type, owner_user_id, min_value, max_value } = req.query;
        
        let query = 'SELECT * FROM contracts WHERE 1=1';
        const values = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            query += ` AND status = $${paramCount}`;
            values.push(status);
        }

        if (type) {
            paramCount++;
            query += ` AND type = $${paramCount}`;
            values.push(type);
        }

        if (owner_user_id) {
            paramCount++;
            query += ` AND owner_user_id = $${paramCount}`;
            values.push(owner_user_id);
        }

        if (min_value) {
            paramCount++;
            query += ` AND contract_value >= $${paramCount}`;
            values.push(min_value);
        }

        if (max_value) {
            paramCount++;
            query += ` AND contract_value <= $${paramCount}`;
            values.push(max_value);
        }

        query += ' ORDER BY created_at DESC';

        const result = await pool.query(query, values);

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
            filters: req.query
        });
    } catch (error) {
        console.error('GET /api/contracts/filter error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to filter contracts'
        });
    }
});

// 8.  Get contracts with upcoming review dates
app.get('/api/contracts/upcoming-reviews', async (req, res) => {
    try {
        const days = req.query.days || 30;
        const result = await pool.query(`
            SELECT * FROM contracts 
            WHERE next_review_date IS NOT NULL
            AND next_review_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
            ORDER BY next_review_date ASC
        `, [days]);

        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length,
            days: days
        });
    } catch (error) {
        console.error('GET /api/contracts/upcoming-reviews error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch upcoming reviews'
        });
    }
});

// 9.  Export contracts to CSV
app.get('/api/contracts/export/csv', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contracts ORDER BY created_at DESC');
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No contracts to export'
            });
        }

        // Convert to CSV
        const headers = Object.keys(result.rows[0]).join(',');
        const rows = result.rows.map(row => 
            Object.values(row).map(value => 
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
        );
        
        const csv = [headers, ...rows].join('\n');

        res.header('Content-Type', 'text/csv');
        res.attachment('contracts_export.csv');
        res.send(csv);
    } catch (error) {
        console.error('GET /api/contracts/export/csv error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to export contracts'
        });
    }
});

// 10. PUT update contract
app.put('/api/contracts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Build dynamic update query
        const fields = [];
        const values = [];
        let paramCount = 0;

        Object.keys(updates).forEach(key => {
            if (key !== 'id' && updates[key] !== undefined) {
                paramCount++;
                fields.push(`${key} = $${paramCount}`);
                values.push(updates[key]);
            }
        });

        if (fields.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No fields to update' 
            });
        }

        paramCount++;
        values.push(id);

        const query = `
            UPDATE contracts 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Contract updated successfully'
        });
    } catch (error) {
        console.error('PUT /api/contracts/:id error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update contract'
        });
    }
});

// 11. GET contract by ID - NOW COMES AFTER SPECIFIC ROUTES
app.get('/api/contracts/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({ 
            success: true, 
            data: result.rows[0] 
        });
    } catch (error) {
        console.error('GET /api/contracts/:id error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contract'
        });
    }
});

// 12. DELETE contract
app.delete('/api/contracts/:id', async (req, res) => {
    try {
        const result = await pool.query(
            "UPDATE contracts SET status = 'terminated', updated_at = NOW() WHERE id = $1 RETURNING *",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({
            success: true,
            message: 'Contract terminated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('DELETE /api/contracts/:id error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete contract'
        });
    }
});

// 13. API documentation
app.get('/api-docs', (req, res) => {
    res.json({
        message: 'CLM Automation API Documentation',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            contracts: {
                'GET /api/contracts': 'List all contracts',
                'POST /api/contracts': 'Create new contract',
                'GET /api/contracts/:id': 'Get contract by ID',
                'PUT /api/contracts/:id': 'Update contract',
                'DELETE /api/contracts/:id': 'Delete contract',
                'GET /api/contracts/stats': 'Dashboard statistics',
                'GET /api/contracts/search': 'Search contracts by keyword',
                'GET /api/contracts/filter': 'Filter contracts by criteria',
                'GET /api/contracts/upcoming-reviews': 'Upcoming review dates',
                'GET /api/contracts/export/csv': 'Export to CSV',
                'GET /api/contracts/expiring-soon': 'Expiring contracts'
            }
        }
    });
});

// 14. 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Route not found',
        availableRoutes: [
            'GET /health',
            'GET /api-docs',
            'GET /api/contracts',
            'GET /api/contracts/:id',
            'POST /api/contracts',
            'PUT /api/contracts/:id',
            'DELETE /api/contracts/:id',
            'GET /api/contracts/stats',
            'GET /api/contracts/search',
            'GET /api/contracts/filter',
            'GET /api/contracts/upcoming-reviews',
            'GET /api/contracts/export/csv',
            'GET /api/contracts/expiring-soon'

        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ CLM Automation Backend Started!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    console.log(`📄 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`📊 Contracts API: http://localhost:${PORT}/api/contracts`);
    console.log(`🎯 Dashboard Stats: http://localhost:${PORT}/api/contracts/stats`);
    console.log(`\n🔄 Ready for frontend on http://localhost:3000`);
});
