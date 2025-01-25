const crypto = require('crypto');
const { initializeDatabase } = require('./database/initializeDatabase');

class PartnerManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = await initializeDatabase(this.dataManager.getDataPath());
    }
  }

  async listPartners({ type = null } = {}) {
    console.log('partnerManager.listPartners() ...');
    await this.initialize();
    const query = type 
      ? 'SELECT * FROM partners WHERE type = ? ORDER BY name'
      : 'SELECT * FROM partners ORDER BY name';
    
    const params = type ? [type] : [];
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

  async createPartner({ type, name, aliases = [], categories = [], metadata = {} }) {
    await this.initialize();
    const id = `partner_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    await this.db.run(`
      INSERT INTO partners (
        id, type, name, aliases, categories, metadata
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      id,
      type,
      name,
      JSON.stringify(aliases),
      JSON.stringify(categories),
      JSON.stringify(metadata)
    ]);

    return this.getPartner(id);
  }

  async getPartner(id) {
    await this.initialize();
    const partner = await this.db.get('SELECT * FROM partners WHERE id = ?', [id]);
    if (!partner) return null;

    return {
      ...partner,
      aliases: partner.aliases ? JSON.parse(partner.aliases) : [],
      categories: partner.categories ? JSON.parse(partner.categories) : [],
      metadata: partner.metadata ? JSON.parse(partner.metadata) : {}
    };
  }

  async getTransactionPartners(transactionId) {
    await this.initialize();
    return this.db.all(`
      SELECT p.*, tp.role
      FROM transaction_partners tp
      JOIN partners p ON tp.partner_id = p.id
      WHERE tp.transaction_id = ?
    `, [transactionId]);
  }

  async assignPartnerToTransaction(transactionId, partnerId, role) {
    await this.initialize();
    await this.db.run(`
      INSERT OR REPLACE INTO transaction_partners (
        transaction_id, partner_id, role
      ) VALUES (?, ?, ?)
    `, [transactionId, partnerId, role]);

    // Update partner summary after assignment
    await this.refreshPartnerSummary(partnerId);
  }

  async removePartnerFromTransaction(transactionId, partnerId) {
    await this.initialize();
    await this.db.run(`
      DELETE FROM transaction_partners 
      WHERE transaction_id = ? AND partner_id = ?
    `, [transactionId, partnerId]);

    // Update partner summary after removal
    await this.refreshPartnerSummary(partnerId);
  }

  async refreshPartnerSummary(partnerId) {
    await this.initialize();
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
    await this.initialize();
    const partners = await this.listPartners();
    const results = [];
    
    for (const partner of partners) {
      results.push(await this.refreshPartnerSummary(partner.id));
    }

    return results;
  }

  async bulkUpdatePartnerTransactions(partnerId, { addTransactionIds = [], removeTransactionIds = [] }) {
    await this.initialize();
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
      LEFT JOIN transaction_partners tp ON t.global_id = tp.transaction_id
      WHERE tp.transaction_id IS NULL
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

  async bulkAssignPartner(transactionIds, partnerId, role = 'destination') {
    await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Remove any existing assignments for these transactions
      await this.db.run(`
        DELETE FROM transaction_partners 
        WHERE transaction_id IN (${transactionIds.map(() => '?').join(',')})
      `, transactionIds);

      // Add new assignments
      for (const transactionId of transactionIds) {
        await this.assignPartnerToTransaction(transactionId, partnerId, role);
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