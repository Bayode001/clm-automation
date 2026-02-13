-- database/seeds/001_sample_data.sql
BEGIN;

-- Insert sample contract templates
INSERT INTO contract_templates (name, description, template_type, variables, created_by) VALUES
('NDA Template', 'Non-Disclosure Agreement', 'nda', 
 '{"parties": ["Disclosing Party", "Receiving Party"], "effective_date": true, "term_months": true}', 'admin'),
('MSA Template', 'Master Service Agreement', 'msa',
 '{"parties": ["Client", "Service Provider"], "services": true, "payment_terms": true}', 'admin');

-- Insert sample contracts
INSERT INTO contracts (
    contract_number, title, counterparty_name, counterparty_email,
    owner_user_id, status, type, effective_date, expiration_date,
    contract_value, currency
) VALUES
('CON-2023-001', 'Software Development Agreement', 'TechCorp Inc.', 'contact@techcorp.com',
 'john.doe@company.com', 'active', 'MSA', '2023-01-15', '2024-01-14', 50000.00, 'USD'),
('CON-2023-002', 'Office Lease Agreement', 'Prime Real Estate', 'leasing@primereal.com',
 'jane.smith@company.com', 'active', 'Lease', '2023-03-01', '2026-02-28', 120000.00, 'USD'),
('CON-2023-003', 'Consulting Services NDA', 'Innovate Consulting', 'legal@innovate.com',
 'alex.jones@company.com', 'draft', 'NDA', NULL, NULL, NULL, 'USD');

-- Insert milestones for contracts
INSERT INTO contract_milestones (contract_id, milestone_type, name, due_date) 
SELECT id, 'review', 'Annual Review', expiration_date - INTERVAL '90 days'
FROM contracts WHERE status = 'active';

INSERT INTO contract_milestones (contract_id, milestone_type, name, due_date) 
SELECT id, 'renewal', 'Renewal Deadline', expiration_date - INTERVAL '60 days'
FROM contracts WHERE status = 'active';

COMMIT;