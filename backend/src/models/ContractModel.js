// backend/src/models/ContractModel.js
const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

class ContractModel {
    // Create a new contract
    async create(contractData) {
        const contractId = uuidv4();
        const contractNumber = contractData.contract_number || this.generateContractNumber();
        
        const query = `
            INSERT INTO contracts (
                id, contract_number, title, description, counterparty_name, 
                counterparty_email, counterparty_address, owner_user_id, owner_department,
                status, type, category, effective_date, expiration_date, 
                contract_value, currency, payment_terms, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            RETURNING *;
        `;

        const values = [
            contractId,
            contractNumber,
            contractData.title,
            contractData.description || null,
            contractData.counterparty_name,
            contractData.counterparty_email || null,
            contractData.counterparty_address || null,
            contractData.owner_user_id,
            contractData.owner_department || null,
            contractData.status || 'draft',
            contractData.type || 'Other',
            contractData.category || null,
            contractData.effective_date || null,
            contractData.expiration_date || null,
            contractData.contract_value || null,
            contractData.currency || 'USD',
            contractData.payment_terms || null,
            contractData.tags || []
        ];

        try {
            const result = await db.query(query, values);
            
            // Create default milestones if expiration date exists
            if (contractData.expiration_date) {
                await this.createDefaultMilestones(contractId, contractData.expiration_date);
            }
            
            // Log the creation
            await this.logAudit(contractId, 'CREATE', contractData.created_by || 'system', {
                action: 'contract_created',
                details: contractData
            });

            return result.rows[0];
        } catch (error) {
            console.error('Error creating contract:', error);
            throw error;
        }
    }

    // Get all contracts with pagination
    async findAll({ page = 1, limit = 20, status, type, search } = {}) {
        const offset = (page - 1) * limit;
        let whereClauses = [];
        let values = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            whereClauses.push(`status = $${paramCount}`);
            values.push(status);
        }

        if (type) {
            paramCount++;
            whereClauses.push(`type = $${paramCount}`);
            values.push(type);
        }

        if (search) {
            paramCount++;
            whereClauses.push(`search_vector @@ plainto_tsquery('english', $${paramCount})`);
            values.push(search);
        }

        const whereClause = whereClauses.length > 0 
            ? `WHERE ${whereClauses.join(' AND ')}` 
            : '';

        const countQuery = `
            SELECT COUNT(*) as total 
            FROM contracts 
            ${whereClause}
        `;

        const dataQuery = `
            SELECT *,
            EXTRACT(EPOCH FROM (expiration_date - CURRENT_DATE)) / 86400 as days_until_expiry
            FROM contracts 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `;

        values.push(limit, offset);

        try {
            const [countResult, dataResult] = await Promise.all([
                db.query(countQuery, values.slice(0, paramCount)),
                db.query(dataQuery, values)
            ]);

            return {
                contracts: dataResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    totalPages: Math.ceil(countResult.rows[0].total / limit)
                }
            };
        } catch (error) {
            console.error('Error finding contracts:', error);
            throw error;
        }
    }

    // Get contract by ID with milestones
    async findById(id) {
        const contractQuery = `
            SELECT *,
            EXTRACT(EPOCH FROM (expiration_date - CURRENT_DATE)) / 86400 as days_until_expiry
            FROM contracts WHERE id = $1
        `;

        const milestonesQuery = `
            SELECT * FROM contract_milestones 
            WHERE contract_id = $1 
            ORDER BY due_date ASC
        `;

        const auditQuery = `
            SELECT * FROM audit_logs 
            WHERE contract_id = $1 
            ORDER BY created_at DESC 
            LIMIT 10
        `;

        try {
            const [contractResult, milestonesResult, auditResult] = await Promise.all([
                db.query(contractQuery, [id]),
                db.query(milestonesQuery, [id]),
                db.query(auditQuery, [id])
            ]);

            if (contractResult.rows.length === 0) {
                return null;
            }

            const contract = contractResult.rows[0];
            contract.milestones = milestonesResult.rows;
            contract.audit_logs = auditResult.rows;

            return contract;
        } catch (error) {
            console.error('Error finding contract by ID:', error);
            throw error;
        }
    }

    // Update contract
    async update(id, updateData, userId) {
        const fields = [];
        const values = [];
        let paramCount = 0;

        // Build dynamic update query
        Object.keys(updateData).forEach(key => {
            if (key !== 'id' && updateData[key] !== undefined) {
                paramCount++;
                fields.push(`${key} = $${paramCount}`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        paramCount++;
        values.push(id);

        const query = `
            UPDATE contracts 
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $${paramCount}
            RETURNING *
        `;

        try {
            const result = await db.query(query, values);
            
            // Log the update
            await this.logAudit(id, 'UPDATE', userId || 'system', {
                action: 'contract_updated',
                changes: updateData
            });

            return result.rows[0];
        } catch (error) {
            console.error('Error updating contract:', error);
            throw error;
        }
    }

    // Delete contract (soft delete by changing status)
    async delete(id, userId) {
        const query = `
            UPDATE contracts 
            SET status = 'terminated', updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;

        try {
            const result = await db.query(query, [id]);
            
            // Log the deletion
            await this.logAudit(id, 'DELETE', userId || 'system', {
                action: 'contract_terminated'
            });

            return result.rows[0];
        } catch (error) {
            console.error('Error deleting contract:', error);
            throw error;
        }
    }

    // Get contracts expiring soon
    async getExpiringSoon(days = 30) {
        const query = `
            SELECT *, 
            EXTRACT(EPOCH FROM (expiration_date - CURRENT_DATE)) / 86400 as days_until_expiry
            FROM contracts 
            WHERE status = 'active' 
            AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1 * INTERVAL '1 day'
            ORDER BY expiration_date ASC
        `;

        try {
            const result = await db.query(query, [days]);
            return result.rows;
        } catch (error) {
            console.error('Error getting expiring contracts:', error);
            throw error;
        }
    }

    // Create default milestones for a contract
    async createDefaultMilestones(contractId, expirationDate) {
        const milestones = [
            {
                milestone_type: 'review',
                name: '90-Day Review',
                due_date: new Date(expirationDate.getTime() - 90 * 24 * 60 * 60 * 1000)
            },
            {
                milestone_type: 'renewal',
                name: '60-Day Renewal Notice',
                due_date: new Date(expirationDate.getTime() - 60 * 24 * 60 * 60 * 1000)
            },
            {
                milestone_type: 'expiration',
                name: 'Contract Expiration',
                due_date: expirationDate
            }
        ];

        for (const milestone of milestones) {
            await this.createMilestone({
                contract_id: contractId,
                ...milestone
            });
        }
    }

    // Create a milestone
    async createMilestone(milestoneData) {
        const query = `
            INSERT INTO contract_milestones (
                id, contract_id, milestone_type, name, due_date, assignee_email, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const values = [
            uuidv4(),
            milestoneData.contract_id,
            milestoneData.milestone_type,
            milestoneData.name,
            milestoneData.due_date,
            milestoneData.assignee_email || null,
            milestoneData.notes || null
        ];

        return db.query(query, values);
    }

    // Log audit trail
    async logAudit(contractId, action, userId, details = {}) {
        const query = `
            INSERT INTO audit_logs (contract_id, action, user_id, details)
            VALUES ($1, $2, $3, $4)
        `;

        await db.query(query, [contractId, action, userId, details]);
    }

    // Generate contract number
    generateContractNumber() {
        const prefix = 'CON';
        const year = new Date().getFullYear();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${year}-${random}`;
    }

    // Get dashboard statistics
    async getDashboardStats() {
        const queries = {
            total: `SELECT COUNT(*) FROM contracts`,
            active: `SELECT COUNT(*) FROM contracts WHERE status = 'active'`,
            expiringSoon: `
                SELECT COUNT(*) FROM contracts 
                WHERE status = 'active' 
                AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 * INTERVAL '1 day'
            `,
            byType: `SELECT type, COUNT(*) FROM contracts GROUP BY type`,
            byStatus: `SELECT status, COUNT(*) FROM contracts GROUP BY status`
        };

        try {
            const results = await Promise.all(
                Object.values(queries).map(query => db.query(query))
            );

            return {
                total: parseInt(results[0].rows[0].count),
                active: parseInt(results[1].rows[0].count),
                expiringSoon: parseInt(results[2].rows[0].count),
                byType: results[3].rows,
                byStatus: results[4].rows
            };
        } catch (error) {
            console.error('Error getting dashboard stats:', error);
            throw error;
        }
    }
}

module.exports = new ContractModel();