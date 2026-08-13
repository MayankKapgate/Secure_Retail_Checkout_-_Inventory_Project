// ──────────────────────────────────────────────
// Product Routes — CRUD Operations
// ──────────────────────────────────────────────
const express = require('express');
const prisma = require('../lib/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ─── GET /api/products — Public: list all products ───
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', order = 'asc' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: order },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          inventoryCount: true,
          createdAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.status(200).json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error('List products error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── GET /api/products/:id — Public: get single product ───
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    return res.status(200).json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/products — Admin only: create product ───
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, description, price, inventoryCount } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required.' });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ error: 'Price must be a non-negative number.' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || null,
        price,
        inventoryCount: inventoryCount || 0,
      },
    });

    return res.status(201).json({ message: 'Product created.', product });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── PUT /api/products/:id — Admin only: update product ───
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { name, description, price, inventoryCount } = req.body;

    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(inventoryCount !== undefined && { inventoryCount }),
      },
    });

    return res.status(200).json({ message: 'Product updated.', product });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── DELETE /api/products/:id — Admin only: delete product ───
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const existing = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await prisma.product.delete({ where: { id: req.params.id } });

    return res.status(200).json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
