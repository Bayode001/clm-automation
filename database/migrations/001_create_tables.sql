-- database/migrations/001_create_tables.sql
BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Contracts Table (Core)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number VARCHAR(100) UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Parties
    counterparty_name VARCHAR(255) NOT NULL,
    counterparty_email VARCHAR(255),
    counterparty_address TEXT,
    owner_user_id VARCHAR(100) NOT NULL,
    owner_department VARCHAR(100),
    
    -- Status and Type
    status VARCHAR(50) DEFAULT 'draft' 
        CHECK (status IN ('draft', 'in_review', 'approved', 'active', 'expired', 'terminated', 'pending_renewal')),
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    
    -- Key Dates
    effective_date DATE,
    expiration_date DATE,
    renewal_date DATE,
    next_review_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    signed_date DATE,
    
    -- Financial
    contract_value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    payment_terms VARCHAR(100),
    
    -- Document Storage
    document_path VARCHAR(500),
    document_url TEXT,
    document_size INTEGER,
    document_name VARCHAR(255),
    
    -- Metadata
    tags VARCHAR(255)[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    
    -- Search Optimization
    search_vector tsvector
);

-- 2. Milestones Table (for tracking dates)
CREATE TABLE contract_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    milestone_type VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    due_date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_date TIMESTAMP,
    notification_sent BOOLEAN DEFAULT FALSE,
    assignee_email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    user_email VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Templates Table (for document generation)
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    template_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500),
    variables JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_expiration ON contracts(expiration_date);
CREATE INDEX idx_contracts_owner ON contracts(owner_user_id);
CREATE INDEX idx_contracts_counterparty ON contracts(counterparty_name);
CREATE INDEX idx_contracts_created_at ON contracts(created_at DESC);
CREATE INDEX idx_milestones_due_date ON contract_milestones(due_date);
CREATE INDEX idx_milestones_contract_id ON contract_milestones(contract_id);
CREATE INDEX idx_audit_contract_id ON audit_logs(contract_id);

-- Create Full-Text Search Index
CREATE INDEX idx_contracts_search ON contracts USING GIN(search_vector);

-- Function to update search_vector
CREATE OR REPLACE FUNCTION contracts_search_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector = 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.counterparty_name, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for search updates
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON contracts FOR EACH ROW EXECUTE FUNCTION contracts_search_update();

-- Function to auto-update updated_at
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

COMMIT;