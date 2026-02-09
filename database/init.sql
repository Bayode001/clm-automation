-- CLM Automation Database Schema v1.0
-- Created: $(date)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    contract_number VARCHAR(100) UNIQUE,
    status VARCHAR(50) DEFAULT 'draft' 
        CHECK (status IN ('draft', 'in_review', 'approved', 'active', 'expired', 'terminated', 'pending_renewal')),
    type VARCHAR(100),
    counterparty_name VARCHAR(255),
    counterparty_email VARCHAR(255),
    counterparty_phone VARCHAR(50),
    counterparty_address TEXT,
    
    owner_user_id VARCHAR(100) NOT NULL,
    owner_department VARCHAR(100),
    owner_email VARCHAR(255),
    
    effective_date DATE,
    expiration_date DATE,
    renewal_date DATE,
    next_review_date DATE,
    
    -- Financial terms
    contract_value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_terms VARCHAR(100),
    
    -- Document information
    document_url TEXT,
    document_name VARCHAR(255),
    document_key VARCHAR(500), -- S3 object key
    document_size INTEGER,
    document_mime_type VARCHAR(100),
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Full-text search
    search_vector tsvector
);

-- Indexes for performance
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_expiration ON contracts(expiration_date);
CREATE INDEX idx_contracts_owner ON contracts(owner_user_id);
CREATE INDEX idx_contracts_counterparty ON contracts(counterparty_name);
CREATE INDEX idx_contracts_type ON contracts(type);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_contracts_search ON contracts USING GIN(search_vector);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update search_vector
CREATE OR REPLACE FUNCTION contracts_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.counterparty_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.contract_number, '')), 'C');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for search vector
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_search_vector_update();

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for audit logs
CREATE INDEX idx_audit_logs_contract_id ON audit_logs(contract_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Users table (for future authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    department VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial admin user (password: admin123)
INSERT INTO users (email, full_name, role) 
VALUES ('admin@company.com', 'System Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE contracts IS 'Central repository for all contracts in the CLM system';
COMMENT ON COLUMN contracts.status IS 'Contract lifecycle status: draft, in_review, approved, active, expired, terminated, pending_renewal';
COMMENT ON COLUMN contracts.search_vector IS 'Full-text search vector for quick searching across title and counterparty';
