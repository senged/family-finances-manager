const crypto = require('crypto');
const { initializeDatabase } = require('./database/initializeDatabase');

class PartnerManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
    this._initializing = false;
  }

  async initialize() {
    if (this._initializing) {
      console.log('Already initializing, skipping...');
      return;
    }

    try {
      this._initializing = true;
      console.log('Initializing PartnerManager...');
      
      if (!this.db) {
        this.db = await initializeDatabase(this.dataManager.getDataPath());
      }
      
      // Ensure the partners table exists with all required columns
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          is_internal INTEGER NOT NULL DEFAULT 0,
          aliases TEXT,
          categories TEXT,
          metadata TEXT,
          transaction_count INTEGER DEFAULT 0,
          total_debits REAL DEFAULT 0,
          total_credits REAL DEFAULT 0,
          net_amount REAL DEFAULT 0,
          last_summary_update DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes if they don't exist
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(type);
        CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);
        CREATE INDEX IF NOT EXISTS idx_partners_internal ON partners(is_internal);
      `);

      // Check if summary columns exist, add them if they don't
      const tableInfo = await this.db.all("PRAGMA table_info(partners)");
      const hasTransactionCount = tableInfo.some(col => col.name === 'transaction_count');
      const hasTotalDebits = tableInfo.some(col => col.name === 'total_debits');
      const hasTotalCredits = tableInfo.some(col => col.name === 'total_credits');
      const hasNetAmount = tableInfo.some(col => col.name === 'net_amount');
      const hasLastSummaryUpdate = tableInfo.some(col => col.name === 'last_summary_update');

      if (!hasTransactionCount || !hasTotalDebits || !hasTotalCredits || !hasNetAmount || !hasLastSummaryUpdate) {
        console.log('Adding missing summary columns to partners table...');
        try {
          await this.db.exec('BEGIN TRANSACTION');
          
          // Add each column individually, catching errors for each in case it already exists
          if (!hasTransactionCount) {
            try {
              await this.db.exec('ALTER TABLE partners ADD COLUMN transaction_count INTEGER DEFAULT 0');
            } catch (e) {
              console.log('transaction_count column might already exist:', e.message);
            }
          }
          
          if (!hasTotalDebits) {
            try {
              await this.db.exec('ALTER TABLE partners ADD COLUMN total_debits REAL DEFAULT 0');
            } catch (e) {
              console.log('total_debits column might already exist:', e.message);
            }
          }
          
          if (!hasTotalCredits) {
            try {
              await this.db.exec('ALTER TABLE partners ADD COLUMN total_credits REAL DEFAULT 0');
            } catch (e) {
              console.log('total_credits column might already exist:', e.message);
            }
          }
          
          if (!hasNetAmount) {
            try {
              await this.db.exec('ALTER TABLE partners ADD COLUMN net_amount REAL DEFAULT 0');
            } catch (e) {
              console.log('net_amount column might already exist:', e.message);
            }
          }
          
          if (!hasLastSummaryUpdate) {
            try {
              await this.db.exec('ALTER TABLE partners ADD COLUMN last_summary_update DATETIME');
            } catch (e) {
              console.log('last_summary_update column might already exist:', e.message);
            }
          }
          
          await this.db.exec('COMMIT');
        } catch (error) {
          await this.db.exec('ROLLBACK');
          throw error;
        }
      }

      console.log('PartnerManager initialization complete.');
    } catch (error) {
      console.error('Failed to initialize PartnerManager:', error);
      throw error;
    } finally {
      this._initializing = false;
    }
  }

  async ensureInitialized() {
    if (!this.db) {
      await this.initialize();
    }
  }

  async syncInternalAccountPartners() {
    await this.ensureInitialized();
    
    try {
      // Get all accounts from the accounts table
      const accounts = await this.db.all('SELECT * FROM accounts');
      console.log(`Found ${accounts.length} accounts to sync...`);
      
      // For each account, ensure there's a corresponding internal partner
      for (const account of accounts) {
        try {
          const existingPartner = await this.db.get(`
            SELECT * FROM partners 
            WHERE is_internal = 1 
            AND type = 'ACCOUNT'
            AND json_extract(metadata, '$.accountId') = ?
          `, [account.id]);

          if (!existingPartner) {
            console.log(`Creating internal partner for account: ${account.name}`);
            await this.createPartner({
              type: 'ACCOUNT',
              name: account.name,
              isInternal: true,
              aliases: [],
              categories: [],
              metadata: {
                accountId: account.id,
                accountType: account.type
              }
            });
          } else {
            console.log(`Internal partner already exists for account: ${account.name}`);
          }
        } catch (error) {
          console.error(`Error syncing partner for account ${account.name}:`, error);
          // Continue with other accounts even if one fails
        }
      }
    } catch (error) {
      console.error('Error in syncInternalAccountPartners:', error);
      throw error;
    }
  }

  async listPartners({ type = null, includeInternal = true } = {}) {
    await this.ensureInitialized();
    
    let query = 'SELECT * FROM partners';
    const params = [];
    
    const conditions = [];
    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }
    if (!includeInternal) {
      conditions.push('is_internal = 0');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY name';
    
    const partners = await this.db.all(query, params);

    console.log(`Found ${partners.length} partners.`);
    // Parse JSON fields
    return partners.map(partner => ({
      ...partner,
      aliases: partner.aliases ? JSON.parse(partner.aliases) : [],
      categories: partner.categories ? JSON.parse(partner.categories) : [],
      metadata: partner.metadata ? JSON.parse(partner.metadata) : {}
    }));
  }

  async createPartner({ type, name, isInternal = false, aliases = [], categories = [], metadata = {} }) {
    await this.ensureInitialized();
    const id = `partner_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    await this.db.run(`
      INSERT INTO partners (
        id, type, name, is_internal, aliases, categories, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      type,
      name,
      isInternal ? 1 : 0,
      JSON.stringify(aliases),
      JSON.stringify(categories),
      JSON.stringify(metadata)
    ]);

    return this.getPartner(id);
  }

  async getPartner(id) {
    await this.ensureInitialized();
    const partner = await this.db.get('SELECT * FROM partners WHERE id = ?', [id]);
    if (!partner) return null;

    return {
      ...partner,
      aliases: partner.aliases ? JSON.parse(partner.aliases) : [],
      categories: partner.categories ? JSON.parse(partner.categories) : [],
      metadata: partner.metadata ? JSON.parse(partner.metadata) : {}
    };
  }

  async getTransactionPartners(transactionIds) {
    await this.ensureInitialized();
    
    // Handle both single ID and array of IDs
    const ids = Array.isArray(transactionIds) ? transactionIds : [transactionIds];
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const results = await this.db.all(`
      SELECT 
        t.global_id as transactionId,
        p.id,
        p.name,
        p.type,
        p.is_internal
      FROM transactions t
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.global_id IN (${placeholders})
    `, ids);

    // For single ID, return array of partners
    if (!Array.isArray(transactionIds)) {
      return results.map(row => ({
        transactionId: row.transactionId,
        partner: row.id ? {
          id: row.id,
          name: row.name,
          type: row.type,
          is_internal: row.is_internal
        } : null
      }));
    }

    // For multiple IDs, return array of { transactionId, partner } objects
    return results.map(row => ({
      transactionId: row.transactionId,
      partner: row.id ? {
        id: row.id,
        name: row.name,
        type: row.type,
        is_internal: row.is_internal
      } : null
    }));
  }

  async assignPartnerToTransaction(transactionId, partnerId) {
    await this.ensureInitialized();
    try {
      await this.db.run(
        'UPDATE transactions SET partner_id = ? WHERE global_id = ?',
        [partnerId, transactionId]
      );
      await this.updatePartnerStats(partnerId);
    } catch (error) {
      console.error('Error assigning partner to transaction:', error);
      throw error;
    }
  }

  async removePartnerFromTransaction(transactionId) {
    await this.ensureInitialized();
    try {
      // Get the current partner_id before removing it
      const transaction = await this.db.get(
        'SELECT partner_id FROM transactions WHERE global_id = ?',
        [transactionId]
      );
      
      if (transaction?.partner_id) {
        await this.db.run(
          'UPDATE transactions SET partner_id = NULL WHERE global_id = ?',
          [transactionId]
        );
        await this.updatePartnerStats(transaction.partner_id);
      }
    } catch (error) {
      console.error('Error removing partner from transaction:', error);
      throw error;
    }
  }

  async updatePartnerStats(partnerId) {
    await this.ensureInitialized();
    try {
      const stats = await this.db.get(`
        SELECT 
          COUNT(*) as transaction_count,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
          SUM(amount) as net_amount
        FROM transactions 
        WHERE partner_id = ?
      `, [partnerId]);

      await this.db.run(`
        UPDATE partners 
        SET 
          transaction_count = ?,
          total_debits = ?,
          total_credits = ?,
          net_amount = ?,
          last_summary_update = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        stats.transaction_count || 0,
        stats.total_debits || 0,
        stats.total_credits || 0,
        stats.net_amount || 0,
        partnerId
      ]);
    } catch (error) {
      console.error('Error updating partner stats:', error);
      throw error;
    }
  }

  async refreshPartnerSummary(partnerId) {
    await this.ensureInitialized();
    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as transaction_count,
        SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_debits,
        SUM(CASE WHEN t.amount >= 0 THEN t.amount ELSE 0 END) as total_credits,
        SUM(t.amount) as net_amount
      FROM transactions t
      WHERE t.partner_id = ?
    `, [partnerId]);

    await this.db.run(`
      UPDATE partners
      SET 
        transaction_count = ?,
        total_debits = ?,
        total_credits = ?,
        net_amount = ?,
        last_summary_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      stats.transaction_count || 0,
      stats.total_debits || 0,
      stats.total_credits || 0,
      stats.net_amount || 0,
      partnerId
    ]);

    return this.getPartner(partnerId);
  }

  async refreshAllPartnerSummaries() {
    await this.ensureInitialized();
    const partners = await this.listPartners();
    const results = [];
    
    for (const partner of partners) {
      results.push(await this.refreshPartnerSummary(partner.id));
    }

    return results;
  }

  async bulkUpdatePartnerTransactions(partnerId, { addTransactionIds = [], removeTransactionIds = [] }) {
    await this.ensureInitialized();
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Remove unassigned transactions
      if (removeTransactionIds.length > 0) {
        await this.db.run(`
          DELETE FROM transactions 
          WHERE partner_id = ? AND global_id IN (${removeTransactionIds.map(() => '?').join(',')})
        `, [partnerId, ...removeTransactionIds]);
      }

      // Add new assignments
      for (const transactionId of addTransactionIds) {
        await this.assignPartnerToTransaction(transactionId, partnerId);
      }

      // Refresh summary data
      await this.refreshPartnerSummary(partnerId);
      
      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async getTransactionPartner(transactionId) {
    const partners = await this.getTransactionPartners(transactionId);
    return partners.length > 0 ? partners[0] : null;
  }

  async getUnassignedTransactions() {
    return this.db.all(`
      SELECT t.*
      FROM transactions t
      LEFT JOIN (
        SELECT global_id, COUNT(*) as partner_count
        FROM transactions
        GROUP BY global_id
      ) pc ON t.global_id = pc.global_id
      WHERE pc.partner_count IS NULL OR pc.partner_count < 2
      ORDER BY t.date DESC
    `);
  }

  async searchSimilarTransactions(description, amount = null, limit = 10) {
    const params = [`%${description}%`];
    let amountClause = '';
    
    if (amount !== null) {
      amountClause = 'AND ABS(t.amount - ?) < 0.01';
      params.push(amount);
    }

    return this.db.all(`
      SELECT t.*, p.id as partner_id, p.name as partner_name
      FROM transactions t
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.description LIKE ?
      ${amountClause}
      ORDER BY 
        CASE WHEN t.partner_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        t.date DESC
      LIMIT ?
    `, [...params, limit]);
  }

  async findSimilarTransactionsWithPartner(description, partnerId = null) {
    const params = [`%${description}%`];
    let partnerClause = '';
    
    if (partnerId) {
      partnerClause = 'AND t.partner_id = ?';
      params.push(partnerId);
    }

    return this.db.all(`
      SELECT t.*, p.id as partner_id, p.name as partner_name,
             COUNT(*) OVER (PARTITION BY t.partner_id) as partner_count
      FROM transactions t
      LEFT JOIN partners p ON t.partner_id = p.id
      WHERE t.description LIKE ?
      ${partnerClause}
      AND t.partner_id IS NOT NULL
      ORDER BY partner_count DESC, t.date DESC
    `, params);
  }

  async bulkAssignPartner(transactionIds, partnerId, isSource) {
    const role = isSource ? 'source' : 'destination';
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Remove existing assignments for the specified role
      await this.db.run(`
        DELETE FROM transactions 
        WHERE global_id IN (${transactionIds.map(() => '?').join(',')})
        AND partner_id IS NOT NULL
      `, [...transactionIds]);

      // Add new assignments
      for (const transactionId of transactionIds) {
        await this.db.run(`
          UPDATE transactions SET partner_id = ? WHERE global_id = ?
        `, [partnerId, transactionId]);
      }

      // Refresh partner summary
      await this.refreshPartnerSummary(partnerId);
      
      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async suggestPartnerByDescription(description) {
    const results = await this.db.all(`
      SELECT p.*, COUNT(*) as match_count
      FROM transactions t
      JOIN partners p ON t.partner_id = p.id
      WHERE t.description LIKE ?
      GROUP BY p.id
      ORDER BY match_count DESC
      LIMIT 1
    `, [`%${description}%`]);

    return results.length > 0 ? results[0] : null;
  }
}

module.exports = PartnerManager; 