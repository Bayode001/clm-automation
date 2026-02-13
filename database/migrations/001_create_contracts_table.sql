-- Migration: 001_create_contracts_table.sql
-- Description: Create initial contracts table and insert sample data

BEGIN;

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    contract_number VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    counterparty_name VARCHAR(255) NOT NULL,
    counterparty_email VARCHAR(255),
    counterparty_address TEXT,
    owner_user_id VARCHAR(100) NOT NULL,
    owner_department VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft',
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    effective_date DATE,
    expiration_date DATE,
    renewal_date DATE,
    next_review_date DATE,
    contract_value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_terms VARCHAR(100),
    document_url TEXT,
    document_name VARCHAR(255),
    tags VARCHAR(255)[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    signed_date DATE
);

-- Create indexes
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_expiration ON contracts(expiration_date);
CREATE INDEX idx_contracts_owner ON contracts(owner_user_id);
CREATE INDEX idx_contracts_counterparty ON contracts(counterparty_name);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);

-- Insert sample data
INSERT INTO contracts (title, counterparty_name, counterparty_email, owner_user_id, status, type, effective_date, expiration_date, contract_value, currency) VALUES
('Software Development Agreement', 'TechCorp Inc.', 'contact@techcorp.com', 'john.doe@company.com', 'active', 'MSA', '2024-01-15', '2024-12-31', 50000.00, 'USD'),
('Office Lease Agreement', 'Prime Real Estate', 'leasing@primereal.com', 'jane.smith@company.com', 'active', 'Lease', '2024-02-01', '2026-01-31', 120000.00, 'USD'),
('Consulting Services NDA', 'Innovate Consulting', 'legal@innovate.com', 'alex.jones@company.com', 'draft', 'NDA', NULL, NULL, NULL, 'USD'),
('Vendor Service Agreement', 'Cloud Services Ltd.', 'sales@cloudservices.com', 'sarah.lee@company.com', 'active', 'Vendor', '2024-03-01', '2025-02-28', 75000.00, 'USD'),
('Employment Contract', 'John Developer', 'john.developer@example.com', 'hr@company.com', 'active', 'Employment', '2024-01-01', '2026-12-31', 95000.00, 'USD');

COMMIT;