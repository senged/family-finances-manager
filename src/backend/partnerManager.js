const crypto = require('crypto');
const dbService = require('./database/databaseService');

class PartnerManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
  }

  async initialize() {
    this.db = await dbService.getDb();
  }

  async ensureInitialized() {
    if (!this.db) await this.initialize();
  }

  async syncInternalAccountPartners() {
    await this.ensureInitialized();
    const accounts = await this.db.all('SELECT * FROM accounts');

    for (const account of accounts) {
      const existingPartner = await this.db.get(`
        SELECT * FROM partners 
        WHERE is_internal = 1 
        AND type = 'ACCOUNT'
        AND json_extract(metadata, '$.accountId') = ?
      `, [account.id]);

      if (!existingPartner) {
        await this.createPartner({
          type: 'ACCOUNT',
          name: account.name,
          isInternal: true,
          metadata: { accountId: account.id, accountType: account.type }
        });
      }
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
    return partners.map(p => ({
      ...p,
      aliases: p.aliases ? JSON.parse(p.aliases) : [],
      categories: p.categories ? JSON.parse(p.categories) : [],
      metadata: p.metadata ? JSON.parse(p.metadata) : {}
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
      id, type, name, isInternal ? 1 : 0,
      JSON.stringify(aliases), JSON.stringify(categories), JSON.stringify(metadata)
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

  async assignPartnerToTransaction(transactionId, partnerId) {
    await this.ensureInitialized();
    await this.db.run('UPDATE transactions SET partner_id = ? WHERE global_id = ?', [partnerId, transactionId]);
    await this.updatePartnerStats(partnerId);
  }

  async removePartnerFromTransaction(transactionId) {
    await this.ensureInitialized();
    const transaction = await this.db.get('SELECT partner_id FROM transactions WHERE global_id = ?', [transactionId]);
    if (transaction?.partner_id) {
      await this.db.run('UPDATE transactions SET partner_id = NULL WHERE global_id = ?', [transactionId]);
      await this.updatePartnerStats(transaction.partner_id);
    }
  }

  async updatePartnerStats(partnerId) {
    await this.ensureInitialized();
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
        transaction_count = ?, total_debits = ?, total_credits = ?, 
        net_amount = ?, last_summary_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      stats.transaction_count || 0, stats.total_debits || 0,
      stats.total_credits || 0, stats.net_amount || 0, partnerId
    ]);
  }

  async refreshAllPartnerSummaries() {
    await this.ensureInitialized();
    const partners = await this.listPartners();
    for (const partner of partners) {
      await this.updatePartnerStats(partner.id);
    }
  }
}

module.exports = PartnerManager;
