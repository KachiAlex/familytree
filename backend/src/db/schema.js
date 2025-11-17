async function createTables(pool) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Families table (for grouping family trees) - Multi-tenant
    await client.query(`
      CREATE TABLE IF NOT EXISTS families (
        family_id SERIAL PRIMARY KEY,
        family_name VARCHAR(255) NOT NULL,
        clan_name VARCHAR(255),
        village_origin VARCHAR(255),
        subscription_tier VARCHAR(50) DEFAULT 'free',
        -- Tiers: 'free', 'premium', 'enterprise'
        subscription_status VARCHAR(50) DEFAULT 'active',
        -- Status: 'active', 'suspended', 'cancelled'
        subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_end_date TIMESTAMP,
        max_persons INTEGER DEFAULT 50,
        max_documents INTEGER DEFAULT 100,
        max_storage_mb INTEGER DEFAULT 500,
        max_members INTEGER DEFAULT 10,
        created_by_user_id INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Family members (many-to-many relationship)
    await client.query(`
      CREATE TABLE IF NOT EXISTS family_members (
        family_id INTEGER REFERENCES families(family_id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        invited_by INTEGER REFERENCES users(user_id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (family_id, user_id)
      )
    `);

    // Persons table (the core genealogy data)
    await client.query(`
      CREATE TABLE IF NOT EXISTS persons (
        person_id SERIAL PRIMARY KEY,
        family_id INTEGER REFERENCES families(family_id) ON DELETE CASCADE,
        full_name VARCHAR(255) NOT NULL,
        gender VARCHAR(20),
        date_of_birth DATE,
        date_of_death DATE,
        alive_status BOOLEAN DEFAULT true,
        profile_photo_url TEXT,
        place_of_birth VARCHAR(255),
        occupation VARCHAR(255),
        biography TEXT,
        clan_name VARCHAR(255),
        village_origin VARCHAR(255),
        migration_history JSONB,
        created_by_user_id INTEGER REFERENCES users(user_id),
        verified_by_elder BOOLEAN DEFAULT false,
        verified_by_user_id INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Relationships table (graph structure)
    await client.query(`
      CREATE TABLE IF NOT EXISTS relationships (
        relationship_id SERIAL PRIMARY KEY,
        person1_id INTEGER REFERENCES persons(person_id) ON DELETE CASCADE,
        person2_id INTEGER REFERENCES persons(person_id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) NOT NULL,
        -- Types: 'parent', 'spouse', 'sibling', 'cousin', 'uncle_aunt', 'in_law'
        verified BOOLEAN DEFAULT false,
        verified_by_user_id INTEGER REFERENCES users(user_id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (person1_id != person2_id),
        UNIQUE(person1_id, person2_id, relationship_type)
      )
    `);

    // Documents table (photos, certificates, audio, etc.)
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        document_id SERIAL PRIMARY KEY,
        person_id INTEGER REFERENCES persons(person_id) ON DELETE CASCADE,
        family_id INTEGER REFERENCES families(family_id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        -- Types: 'photo', 'certificate', 'audio', 'video', 'other'
        file_url TEXT NOT NULL,
        file_name VARCHAR(255),
        file_size INTEGER,
        mime_type VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        transcription TEXT,
        uploaded_by_user_id INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Oral history / stories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        story_id SERIAL PRIMARY KEY,
        person_id INTEGER REFERENCES persons(person_id) ON DELETE CASCADE,
        family_id INTEGER REFERENCES families(family_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        story_text TEXT,
        audio_url TEXT,
        narrator_name VARCHAR(255),
        narrator_relationship VARCHAR(255),
        recorded_date DATE,
        location VARCHAR(255),
        tags TEXT[],
        created_by_user_id INTEGER REFERENCES users(user_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        invitation_id SERIAL PRIMARY KEY,
        family_id INTEGER REFERENCES families(family_id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        invited_by_user_id INTEGER REFERENCES users(user_id),
        token VARCHAR(255) UNIQUE NOT NULL,
        role VARCHAR(50) DEFAULT 'member',
        status VARCHAR(50) DEFAULT 'pending',
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create basic indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_persons_family_id ON persons(family_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_person1 ON relationships(person1_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_person2 ON relationships(person2_id);
      CREATE INDEX IF NOT EXISTS idx_documents_person_id ON documents(person_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON family_members(family_id);
      CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
    `);

    await client.query('COMMIT');
    console.log('✅ All tables created successfully');
    
    // Create additional performance indexes
    const { createIndexes } = require('./indexes');
    await createIndexes(pool);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createTables };

