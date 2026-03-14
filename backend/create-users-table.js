const { Pool } = require('pg');

// Use the same database configuration as your server
const pool = new Pool({
    host: 'localhost',
    port: 5433,
    database: 'clm_automation',
    user: 'clm_admin',
    password: 'clm123',
});

async function createUsersTable() {
    try {
        console.log('Connecting to database...');
        
        // SQL to create the users table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                role VARCHAR(50) DEFAULT 'user',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        await pool.query(createTableSQL);
        console.log('✅ Users table created successfully (or already exists).');

        // Optional: Verify by counting rows
        const result = await pool.query('SELECT COUNT(*) FROM users');
        console.log(`Total users in table: ${result.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error creating users table:', error);
    } finally {
        await pool.end(); // Close the database connection
        console.log('Database connection closed.');
    }
}

createUsersTable();