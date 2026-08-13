// ──────────────────────────────────────────────
// Checkout Route — Stripe Integration
// ──────────────────────────────────────────────
const express = require('express');
const Stripe = require('stripe');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/checkout
 *
 * Accepts an array of items: [{ productId: string, quantity: number }]
 * 1. Validates all products exist and have sufficient stock.
 * 2. Calculates the total from DB prices (never trust client-sent prices).
 * 3. Creates an Order + OrderItems in the database.
 * 4. Creates a Stripe Checkout Session.
 * 5. Returns the session URL for redirect.
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { items } = req.body;

    // ── Validate request body ──
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Request body must include a non-empty "items" array.',
        example: { items: [{ productId: 'uuid', quantity: 1 }] },
      });
    }

    // ── Extract product IDs and validate format ──
    const productIds = items.map((item) => item.productId);
    const quantityMap = {};
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({
          error: 'Each item must have a valid "productId" and a "quantity" >= 1.',
        });
      }
      // Merge duplicate product IDs
      quantityMap[item.productId] = (quantityMap[item.productId] || 0) + item.quantity;
    }

    // ── Fetch products from DB ──
    const products = await prisma.product.findMany({
      where: { id: { in: Object.keys(quantityMap) } },
    });

    if (products.length !== Object.keys(quantityMap).length) {
      const foundIds = products.map((p) => p.id);
      const missingIds = Object.keys(quantityMap).filter((id) => !foundIds.includes(id));
      return res.status(404).json({
        error: 'One or more products not found.',
        missingProductIds: missingIds,
      });
    }

    // ── Validate stock availability ──
    const insufficientStock = [];
    for (const product of products) {
      const requestedQty = quantityMap[product.id];
      if (product.inventoryCount < requestedQty) {
        insufficientStock.push({
          productId: product.id,
          name: product.name,
          available: product.inventoryCount,
          requested: requestedQty,
        });
      }
    }

    if (insufficientStock.length > 0) {
      return res.status(409).json({
        error: 'Insufficient stock for one or more products.',
        insufficientStock,
      });
    }

    // ── Calculate total from DB prices (never trust client) ──
    let totalAmount = 0;
    const lineItems = [];

    for (const product of products) {
      const qty = quantityMap[product.id];
      const priceInCents = Math.round(Number(product.price) * 100);
      totalAmount += priceInCents * qty;

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.description || undefined,
          },
          unit_amount: priceInCents,
        },
        quantity: qty,
      });
    }

    // ── Create Order + OrderItems in a transaction ──
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          totalAmount: totalAmount / 100, // store as dollars
          status: 'PENDING',
          items: {
            create: products.map((product) => ({
              productId: product.id,
              quantity: quantityMap[product.id],
            })),
          },
        },
        include: { items: true },
      });

      // Decrement inventory for each product
      for (const product of products) {
        await tx.product.update({
          where: { id: product.id },
          data: { inventoryCount: { decrement: quantityMap[product.id] } },
        });
      }

      return newOrder;
    });

    // ── Create Stripe Checkout Session ──
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      metadata: {
        orderId: order.id,
        userId: req.user.id,
      },
      success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/checkout/cancel`,
    });

    // Store Stripe session ID on the order
    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return res.status(200).json({
      message: 'Checkout session created successfully.',
      sessionUrl: session.url,
      sessionId: session.id,
      orderId: order.id,
      totalAmount: (totalAmount / 100).toFixed(2),
    });
  } catch (error) {
    console.error('Checkout error:', error);

    // Handle Stripe-specific errors
    if (error.type && error.type.startsWith('Stripe')) {
      return res.status(502).json({
        error: 'Payment processing error. Please try again later.',
      });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
