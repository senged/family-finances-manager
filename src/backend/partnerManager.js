const crypto = require('crypto');

class PartnerManager {
  constructor(db) {
    this.db = db;
  }

  async createPartner({ type, name, aliases = [], categories = [], metadata = {} }) {
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
    return this.db.get('SELECT * FROM partners WHERE id = ?', [id]);
  }

  async listPartners({ type = null } = {}) {
    const query = type 
      ? 'SELECT * FROM partners WHERE type = ? ORDER BY name'
      : 'SELECT * FROM partners ORDER BY name';
    
    const params = type ? [type] : [];
    return this.db.all(query, params);
  }

  async assignPartnerToTransaction(transactionId, partnerId, role) {
    await this.db.run(`
      INSERT INTO transaction_partners (
        transaction_id, partner_id, role
      ) VALUES (?, ?, ?)
    `, [transactionId, partnerId, role]);
  }

  async removePartnerFromTransaction(transactionId, partnerId) {
    await this.db.run(`
      DELETE FROM transaction_partners 
      WHERE transaction_id = ? AND partner_id = ?
    `, [transactionId, partnerId]);
  }

  async getTransactionPartners(transactionId) {
    return this.db.all(`
      SELECT p.*, tp.role
      FROM transaction_partners tp
      JOIN partners p ON tp.partner_id = p.id
      WHERE tp.transaction_id = ?
    `, [transactionId]);
  }
}

module.exports = PartnerManager; 