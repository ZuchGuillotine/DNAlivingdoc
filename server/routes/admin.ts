import express from 'express';
import { db } from '@db';
import { users, supplements, supplementLogs } from '@db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import cors from 'cors';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';

const router = express.Router();

// Configure CORS for admin routes
router.use(cors({
  origin: process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Apply authentication and admin checks
router.use(requireAuth);
router.use(requireAdmin);

// Get all users' subscription information
router.get('/users/subscriptions', async (req, res) => {
  try {
    const userSubscriptions = await db
      .select({
        id: users.id,
        email: users.email,
        subscriptionTier: users.subscriptionTier,
        subscriptionId: users.subscriptionId
      })
      .from(users);

    res.json(userSubscriptions);
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch user subscriptions' });
  }
});

// Get specific user's subscription information
router.get('/users/:userId/subscription', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const userSubscription = await db
      .select({
        id: users.id,
        email: users.email,
        subscriptionTier: users.subscriptionTier,
        subscriptionId: users.subscriptionId
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userSubscription.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userSubscription[0]);
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({ error: 'Failed to fetch user subscription' });
  }
});

// Get all users with stats for user management dashboard
router.get('/users', async (req, res) => {
  try {
    const usersWithStats = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        name: users.name,
        subscriptionTier: users.subscriptionTier,
        subscriptionId: users.subscriptionId,
        isAdmin: users.isAdmin,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        aiInteractionsCount: users.aiInteractionsCount,
        labUploadsCount: users.labUploadsCount,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Get supplement counts for each user
    const userSupplementCounts = await db
      .select({
        userId: supplements.userId,
        totalSupplements: sql<number>`count(*)::int`,
      })
      .from(supplements)
      .where(eq(supplements.active, true))
      .groupBy(supplements.userId);

    // Get last activity for each user (last supplement log)
    const userLastActivity = await db
      .select({
        userId: supplementLogs.userId,
        lastActivity: sql<string>`max(${supplementLogs.createdAt})`,
      })
      .from(supplementLogs)
      .groupBy(supplementLogs.userId);

    // Combine the data
    const enrichedUsers = usersWithStats.map(user => {
      const supplementCount = userSupplementCounts.find(s => s.userId === user.id);
      const lastActivity = userLastActivity.find(a => a.userId === user.id);
      
      return {
        ...user,
        totalSupplements: supplementCount?.totalSupplements || 0,
        lastActivity: lastActivity?.lastActivity || null,
      };
    });

    res.json(enrichedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user growth analytics
router.get('/users/growth', async (req, res) => {
  try {
    // Get total user count
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Get active users (users with activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeUsersResult = await db
      .select({ count: sql<number>`count(distinct ${supplementLogs.userId})::int` })
      .from(supplementLogs)
      .where(gte(supplementLogs.createdAt, thirtyDaysAgo));
    const activeUsers = activeUsersResult[0]?.count || 0;

    // Get daily signups for last 30 days
    const dailySignups = await db
      .select({
        date: sql<string>`date(${users.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo))
      .groupBy(sql`date(${users.createdAt})`)
      .orderBy(sql`date(${users.createdAt})`);

    // Get monthly signups for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const monthlySignups = await db
      .select({
        month: sql<string>`to_char(${users.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .where(gte(users.createdAt, twelveMonthsAgo))
      .groupBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${users.createdAt}, 'YYYY-MM')`);

    // Get yearly signups
    const yearlySignups = await db
      .select({
        year: sql<string>`extract(year from ${users.createdAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .groupBy(sql`extract(year from ${users.createdAt})`)
      .orderBy(sql`extract(year from ${users.createdAt})`);

    res.json({
      totalUsers,
      activeUsers,
      daily: dailySignups,
      monthly: monthlySignups,
      yearly: yearlySignups,
    });
  } catch (error) {
    console.error('Error fetching user growth data:', error);
    res.status(500).json({ error: 'Failed to fetch user growth data' });
  }
});

// Update user information
router.put('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, subscriptionTier } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        name,
        email,
        subscriptionTier,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Check if user is an admin
    const [userToDelete] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userToDelete.isAdmin) {
      return res.status(403).json({ error: 'Cannot delete admin users' });
    }

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    res.json({ 
      message: 'User deleted successfully', 
      user: deletedUser 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;