const { pool } = require('../db/connection');
const { getTierLimits, isWithinLimit, getFamilyUsage } = require('../config/tiers');

// Middleware to check tier limits before operations
async function checkTierLimit(req, res, next) {
  try {
    const familyId = req.params.familyId || req.body.family_id;
    if (!familyId) {
      return res.status(400).json({ error: 'Family ID required' });
    }

    // Get family subscription tier
    const familyResult = await pool.query(
      'SELECT subscription_tier, subscription_status FROM families WHERE family_id = $1',
      [familyId]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const { subscription_tier, subscription_status } = familyResult.rows[0];

    // Check if subscription is active
    if (subscription_status !== 'active') {
      return res.status(403).json({
        error: 'Subscription is not active',
        subscription_status
      });
    }

    // Get tier limits
    const limits = getTierLimits(subscription_tier);
    req.tierLimits = limits;
    req.familyTier = subscription_tier;
    req.familyId = familyId;

    next();
  } catch (error) {
    console.error('Tier limit check error:', error);
    res.status(500).json({ error: 'Failed to check tier limits' });
  }
}

// Check specific limit before creating resource
function checkResourceLimit(resourceType) {
  return async (req, res, next) => {
    try {
      const familyId = req.params.familyId || req.body.family_id;
      if (!familyId) {
        return res.status(400).json({ error: 'Family ID required' });
      }

      // Get family subscription tier
      const familyResult = await pool.query(
        'SELECT subscription_tier, subscription_status FROM families WHERE family_id = $1',
        [familyId]
      );

      if (familyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Family not found' });
      }

      const { subscription_tier, subscription_status } = familyResult.rows[0];

      // Check if subscription is active
      if (subscription_status !== 'active') {
        return res.status(403).json({
          error: 'Subscription is not active',
          subscription_status
        });
      }

      // Get tier limits and usage
      const limits = getTierLimits(subscription_tier);
      const usage = await getFamilyUsage(pool, familyId);

      let current, limit, resourceName;
      
      switch (resourceType) {
        case 'person':
          current = usage.persons;
          limit = limits.max_persons;
          resourceName = 'persons';
          break;
        case 'document':
          current = usage.documents;
          limit = limits.max_documents;
          resourceName = 'documents';
          break;
        case 'member':
          current = usage.members;
          limit = limits.max_members;
          resourceName = 'family members';
          break;
        case 'story':
          current = usage.stories;
          limit = limits.max_stories;
          resourceName = 'stories';
          break;
        case 'storage':
          current = usage.storage_mb;
          limit = limits.max_storage_mb;
          resourceName = 'storage';
          break;
        default:
          return next();
      }

      // Check if adding one more would exceed limit
      if (!isWithinLimit(current, limit)) {
        return res.status(403).json({
          error: `Tier limit reached for ${resourceName}`,
          current,
          limit: limit === -1 ? 'Unlimited' : limit,
          tier: subscription_tier,
          upgrade_required: true
        });
      }

      req.tierLimits = limits;
      req.familyTier = subscription_tier;
      req.familyId = familyId;
      req.currentUsage = usage;
      next();
    } catch (error) {
      console.error('Resource limit check error:', error);
      res.status(500).json({ error: 'Failed to check resource limits' });
    }
  };
}

// Get family usage and limits
async function getFamilyUsageInfo(req, res, next) {
  try {
    const familyId = req.params.familyId || req.body.family_id;
    if (!familyId) {
      return res.status(400).json({ error: 'Family ID required' });
    }

    const familyResult = await pool.query(
      'SELECT subscription_tier, subscription_status FROM families WHERE family_id = $1',
      [familyId]
    );

    if (familyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const { subscription_tier, subscription_status } = familyResult.rows[0];
    const limits = getTierLimits(subscription_tier);
    const usage = await getFamilyUsage(pool, familyId);

    req.familyUsage = {
      usage,
      limits,
      tier: subscription_tier,
      status: subscription_status
    };

    next();
  } catch (error) {
    console.error('Get family usage error:', error);
    res.status(500).json({ error: 'Failed to get family usage' });
  }
}

module.exports = {
  checkTierLimit,
  checkResourceLimit,
  getFamilyUsageInfo
};

