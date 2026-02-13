// backend/src/routes/contractRoutes.js
const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const ContractModel = require('../models/ContractModel');

// Validation middleware
const validateContract = [
    body('title').notEmpty().withMessage('Title is required'),
    body('counterparty_name').notEmpty().withMessage('Counterparty name is required'),
    body('owner_user_id').notEmpty().withMessage('Owner is required'),
    body('type').notEmpty().withMessage('Contract type is required'),
    body('effective_date').optional().isDate().withMessage('Invalid effective date'),
    body('expiration_date').optional().isDate().withMessage('Invalid expiration date')
];

// GET /api/contracts - Get all contracts
router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isString(),
    query('type').optional().isString(),
    query('search').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { page = 1, limit = 20, status, type, search } = req.query;
        const result = await ContractModel.findAll({ page, limit, status, type, search });
        
        res.json({
            success: true,
            data: result.contracts,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contracts' 
        });
    }
});

// GET /api/contracts/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await ContractModel.getDashboardStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics' 
        });
    }
});

// GET /api/contracts/expiring-soon - Get contracts expiring soon
router.get('/expiring-soon', async (req, res) => {
    try {
        const days = req.query.days || 30;
        const contracts = await ContractModel.getExpiringSoon(days);
        res.json({ success: true, data: contracts });
    } catch (error) {
        console.error('Error fetching expiring contracts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch expiring contracts' 
        });
    }
});

// GET /api/contracts/:id - Get contract by ID
router.get('/:id', [
    param('id').isUUID().withMessage('Invalid contract ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const contract = await ContractModel.findById(req.params.id);
        
        if (!contract) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({ success: true, data: contract });
    } catch (error) {
        console.error('Error fetching contract:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contract' 
        });
    }
});

// POST /api/contracts - Create new contract
router.post('/', validateContract, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.headers['x-user-id'] || 'anonymous';
        const contract = await ContractModel.create({
            ...req.body,
            created_by: userId
        });

        res.status(201).json({ 
            success: true, 
            data: contract,
            message: 'Contract created successfully'
        });
    } catch (error) {
        console.error('Error creating contract:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to create contract' 
        });
    }
});

// PUT /api/contracts/:id - Update contract
router.put('/:id', [
    param('id').isUUID().withMessage('Invalid contract ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.headers['x-user-id'] || 'anonymous';
        const updatedContract = await ContractModel.update(
            req.params.id, 
            req.body, 
            userId
        );

        if (!updatedContract) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({ 
            success: true, 
            data: updatedContract,
            message: 'Contract updated successfully'
        });
    } catch (error) {
        console.error('Error updating contract:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update contract' 
        });
    }
});

// DELETE /api/contracts/:id - Delete contract
router.delete('/:id', [
    param('id').isUUID().withMessage('Invalid contract ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.headers['x-user-id'] || 'anonymous';
        const deletedContract = await ContractModel.delete(req.params.id, userId);

        if (!deletedContract) {
            return res.status(404).json({ 
                success: false, 
                error: 'Contract not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Contract terminated successfully'
        });
    } catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete contract' 
        });
    }
});

module.exports = router;