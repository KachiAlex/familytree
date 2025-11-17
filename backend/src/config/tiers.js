// Subscription tier configurations
const TIER_LIMITS = {
  free: {
    name: 'Free',
    max_persons: 50,
    max_documents: 100,
    max_storage_mb: 500, // 500MB
    max_members: 10,
    max_stories: 50,
    features: {
      tree_views: ['vertical', 'horizontal', 'timeline'], // No radial view
      export: false,
      api_access: false,
      priority_support: false,
    }
  },
  premium: {
    name: 'Premium',
    max_persons: 500,
    max_documents: 1000,
    max_storage_mb: 10000, // 10GB
    max_members: 50,
    max_stories: 500,
    features: {
      tree_views: ['vertical', 'horizontal', 'radial', 'timeline'],
      export: true,
      api_access: true,
      priority_support: true,
    }
  },
  enterprise: {
    name: 'Enterprise',
    max_persons: -1, // Unlimited
    max_documents: -1, // Unlimited
    max_storage_mb: -1, // Unlimited
    max_members: -1, // Unlimited
    max_stories: -1, // Unlimited
    features: {
      tree_views: ['vertical', 'horizontal', 'radial', 'timeline'],
      export: true,
      api_access: true,
      priority_support: true,
      custom_branding: true,
    }
  }
};

// Get tier limits for a family
function getTierLimits(tier = 'free') {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

// Check if a value is within limit (-1 means unlimited)
function isWithinLimit(current, limit) {
  if (limit === -1) return true; // Unlimited
  return current < limit;
}

// Make isWithinLimit available on limits object
Object.keys(TIER_LIMITS).forEach(tier => {
  TIER_LIMITS[tier].isWithinLimit = isWithinLimit;
});

// Get current usage for a family
async function getFamilyUsage(pool, familyId) {
  const [personsCount, documentsCount, membersCount, storiesCount, storageBytes] = await Promise.all([
    pool.query('SELECT COUNT(*) as count FROM persons WHERE family_id = $1', [familyId]),
    pool.query('SELECT COUNT(*) as count FROM documents WHERE family_id = $1', [familyId]),
    pool.query('SELECT COUNT(*) as count FROM family_members WHERE family_id = $1', [familyId]),
    pool.query('SELECT COUNT(*) as count FROM stories WHERE family_id = $1', [familyId]),
    pool.query('SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE family_id = $1', [familyId])
  ]);

  return {
    persons: parseInt(personsCount.rows[0].count),
    documents: parseInt(documentsCount.rows[0].count),
    members: parseInt(membersCount.rows[0].count),
    stories: parseInt(storiesCount.rows[0].count),
    storage_mb: Math.ceil(parseInt(storageBytes.rows[0].total || 0) / (1024 * 1024))
  };
}

module.exports = {
  TIER_LIMITS,
  getTierLimits,
  isWithinLimit,
  getFamilyUsage
};

