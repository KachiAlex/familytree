async function createIndexes(pool) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Composite indexes for common queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_persons_family_birth 
      ON persons(family_id, date_of_birth);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_relationships_family_type 
      ON relationships(person1_id, relationship_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_family_type 
      ON documents(family_id, document_type, created_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_families_tier_status 
      ON families(subscription_tier, subscription_status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stories_family_date 
      ON stories(family_id, created_at DESC);
    `);

    // Full-text search index for person names
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_persons_name_search 
      ON persons USING gin(to_tsvector('english', full_name));
    `);

    // Index for user email lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email);
    `);

    // Index for family name lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_families_name_lower 
      ON families(LOWER(family_name));
    `);

    await client.query('COMMIT');
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createIndexes };

