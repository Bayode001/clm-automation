const { Client } = require('pg');
require('dotenv').config();

console.log('🔧 Testing PostgreSQL Connection');
console.log('================================');

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    database: process.env.DB_NAME || 'clm_automation',
    user: process.env.DB_USER || 'clm_admin',
    password: process.env.DB_PASSWORD || 'clm123',
};

console.log('Configuration:');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  Database: ${config.database}`);
console.log(`  User: ${config.user}`);

const client = new Client(config);

async function setupDatabase() {
    try {
        await client.connect();
        console.log('✅ Connection successful');
        
        // Check if contracts table exists
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'contracts'
            )
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('Creating contracts table...');
            
            await client.query(`
                CREATE TABLE contracts (
                    id SERIAL PRIMARY KEY,
                    contract_number VARCHAR(100) UNIQUE,
                    title VARCHAR(500) NOT NULL,
                    description TEXT,
                    counterparty_name VARCHAR(255) NOT NULL,
                    counterparty_email VARCHAR(255),
                    owner_user_id VARCHAR(100) NOT NULL,
                    status VARCHAR(50) DEFAULT 'draft',
                    type VARCHAR(100) NOT NULL,
                    effective_date DATE,
                    expiration_date DATE,
                    contract_value DECIMAL(15,2),
                    currency VARCHAR(3) DEFAULT 'USD',
                    document_url TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            `);
            
            await client.query(`
                CREATE INDEX idx_contracts_status ON contracts(status);
                CREATE INDEX idx_contracts_expiration ON contracts(expiration_date);
                CREATE INDEX idx_contracts_owner ON contracts(owner_user_id);
            `);
            
            console.log('✅ Contracts table created');
        } else {
            console.log('✅ Contracts table already exists');
        }
        
        // Insert sample data if table is empty
        const countResult = await client.query('SELECT COUNT(*) as count FROM contracts');
        const contractCount = parseInt(countResult.rows[0].count);
        
        if (contractCount === 0) {
            console.log('Inserting sample data...');
            
            await client.query(`
                INSERT INTO contracts (title, counterparty_name, counterparty_email, owner_user_id, status, type, effective_date, expiration_date, contract_value, currency) VALUES
                ('Software Development Agreement', 'TechCorp Inc.', 'contact@techcorp.com', 'john.doe@company.com', 'active', 'MSA', '2024-01-15', '2024-12-31', 50000.00, 'USD'),
                ('Office Lease Agreement', 'Prime Real Estate', 'leasing@primereal.com', 'jane.smith@company.com', 'active', 'Lease', '2024-02-01', '2026-01-31', 120000.00, 'USD'),
                ('Consulting Services NDA', 'Innovate Consulting', 'legal@innovate.com', 'alex.jones@company.com', 'draft', 'NDA', NULL, NULL, NULL, 'USD')
            `);
            
            console.log('✅ Sample data inserted');
        } else {
            console.log(`✅ Found ${contractCount} existing contracts`);
        }
        
        // Show sample contracts
        const sampleResult = await client.query('SELECT id, title, counterparty_name, status, type FROM contracts ORDER BY created_at DESC LIMIT 3');
        console.log('\n📋 Sample contracts:');
        sampleResult.rows.forEach((row, i) => {
            console.log(`  ${i + 1}. ${row.title}`);
            console.log(`     Counterparty: ${row.counterparty_name}`);
            console.log(`     Status: ${row.status}, Type: ${row.type}`);
        });
        
        await client.end();
        console.log('\n🎉 Database setup complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setupDatabase();
