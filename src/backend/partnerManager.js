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
      SELECT tp.transaction_id, p.*, tp.role
      FROM transaction_partners tp
      JOIN partners p ON tp.partner_id = p.id
      WHERE tp.transaction_id IN (${placeholders})
      ORDER BY tp.role
    `, ids);

    // For single ID, return array of partners
    if (!Array.isArray(transactionIds)) {
      return results;
    }

    // For multiple IDs, return array of { transactionId, partner } objects
    return results.map(row => ({
      transactionId: row.transaction_id,
      partner: {
        id: row.id,
        type: row.type,
        name: row.name,
        role: row.role,
        aliases: row.aliases ? JSON.parse(row.aliases) : [],
        categories: row.categories ? JSON.parse(row.categories) : [],
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
      }
    }));
  }

  async assignPartnerToTransaction(transactionId, partnerId, role) {
    await this.ensureInitialized();
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Get the transaction to determine if it's a credit or debit
      const transaction = await this.db.get(
        'SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON t.account_id = a.id WHERE t.global_id = ?',
        [transactionId]
      );

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // For credits (positive amount), the source is the partner
      // For debits (negative amount), the destination is the partner
      const isCredit = transaction.amount >= 0;
      const partnerRole = isCredit ? 'source' : 'destination';
      const accountRole = isCredit ? 'destination' : 'source';

      // Get the account's partner record
      let accountPartner = await this.db.get(`
        SELECT p.* FROM partners p
        WHERE p.is_internal = 1 
        AND p.type = 'ACCOUNT'
        AND json_extract(p.metadata, '$.accountId') = ?
      `, [transaction.account_id]);

      if (!accountPartner) {
        // If no partner record exists for this account, create one
        accountPartner = await this.createPartner({
          type: 'ACCOUNT',
          name: transaction.account_name,
          isInternal: true,
          aliases: [],
          categories: [],
          metadata: {
            accountId: transaction.account_id
          }
        });
      }

      // Remove any existing partner assignments
      await this.db.run(
        'DELETE FROM transaction_partners WHERE transaction_id = ?',
        [transactionId]
      );

      // Add partner assignment
      await this.db.run(`
        INSERT INTO transaction_partners (
          transaction_id, partner_id, role
        ) VALUES (?, ?, ?)
      `, [transactionId, partnerId, partnerRole]);

      // Add account assignment
      await this.db.run(`
        INSERT INTO transaction_partners (
          transaction_id, partner_id, role
        ) VALUES (?, ?, ?)
      `, [transactionId, accountPartner.id, accountRole]);

      // Update summaries for both partners
      await this.refreshPartnerSummary(partnerId);
      await this.refreshPartnerSummary(accountPartner.id);
      
      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async removePartnerFromTransaction(transactionId, partnerId) {
    await this.ensureInitialized();
    await this.db.run(`
      DELETE FROM transaction_partners 
      WHERE transaction_id = ? AND partner_id = ?
    `, [transactionId, partnerId]);

    // Update partner summary after removal
    await this.refreshPartnerSummary(partnerId);
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
      JOIN transaction_partners tp ON t.global_id = tp.transaction_id
      WHERE tp.partner_id = ?
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
          DELETE FROM transaction_partners 
          WHERE partner_id = ? AND transaction_id IN (${removeTransactionIds.map(() => '?').join(',')})
        `, [partnerId, ...removeTransactionIds]);
      }

      // Add new assignments
      for (const transactionId of addTransactionIds) {
        await this.assignPartnerToTransaction(transactionId, partnerId, 'destination');
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
        SELECT transaction_id, COUNT(*) as partner_count
        FROM transaction_partners
        GROUP BY transaction_id
      ) pc ON t.global_id = pc.transaction_id
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
      LEFT JOIN transaction_partners tp ON t.global_id = tp.transaction_id
      LEFT JOIN partners p ON tp.partner_id = p.id
      WHERE t.description LIKE ?
      ${amountClause}
      ORDER BY 
        CASE WHEN tp.partner_id IS NOT NULL THEN 1 ELSE 0 END DESC,
        t.date DESC
      LIMIT ?
    `, [...params, limit]);
  }

  async findSimilarTransactionsWithPartner(description, partnerId = null) {
    const params = [`%${description}%`];
    let partnerClause = '';
    
    if (partnerId) {
      partnerClause = 'AND tp.partner_id = ?';
      params.push(partnerId);
    }

    return this.db.all(`
      SELECT t.*, p.id as partner_id, p.name as partner_name,
             COUNT(*) OVER (PARTITION BY tp.partner_id) as partner_count
      FROM transactions t
      LEFT JOIN transaction_partners tp ON t.global_id = tp.transaction_id
      LEFT JOIN partners p ON tp.partner_id = p.id
      WHERE t.description LIKE ?
      ${partnerClause}
      AND tp.partner_id IS NOT NULL
      ORDER BY partner_count DESC, t.date DESC
    `, params);
  }

  async bulkAssignPartner(transactionIds, partnerId, isSource) {
    const role = isSource ? 'source' : 'destination';
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Remove existing assignments for the specified role
      await this.db.run(`
        DELETE FROM transaction_partners 
        WHERE transaction_id IN (${transactionIds.map(() => '?').join(',')})
        AND role = ?
      `, [...transactionIds, role]);

      // Add new assignments
      for (const transactionId of transactionIds) {
        await this.db.run(`
          INSERT INTO transaction_partners (
            transaction_id, partner_id, role
          ) VALUES (?, ?, ?)
        `, [transactionId, partnerId, role]);
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
      JOIN transaction_partners tp ON t.global_id = tp.transaction_id
      JOIN partners p ON tp.partner_id = p.id
      WHERE t.description LIKE ?
      GROUP BY p.id
      ORDER BY match_count DESC
      LIMIT 1
    `, [`%${description}%`]);

    return results.length > 0 ? results[0] : null;
  }
}

module.exports = PartnerManager; 