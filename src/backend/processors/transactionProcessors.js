// Base processor interface
class TransactionProcessor {
  constructor() {
    this.name = '';
    this.id = '';
    this.description = '';
    this.filePattern = /\.csv$/; // Default pattern
  }

  // Each processor must implement these methods
  validateFile(filePath) {
    throw new Error('Not implemented');
  }

  processTransaction(row) {
    throw new Error('Not implemented');
  }
}

class BoACheckingSavingsProcessor extends TransactionProcessor {
  constructor() {
    super();
    this.name = 'Bank of America Checking/Savings';
    this.id = 'boa_checking_savings';
    this.description = 'Processes Bank of America checking and savings account transactions';
    this.filePattern = /\.csv$/;
    this.summaryHeaders = ['Description', '', 'Summary Amt.'];
    this.transactionHeaders = ['Date', 'Description', 'Amount', 'Running Bal.'];
  }

  validateFile(headers, firstDataRow) {
    // First check if it's the summary section
    if (JSON.stringify(headers) === JSON.stringify(this.summaryHeaders)) {
      return true; // Skip validation for summary section
    }

    // Check transaction section headers
    return JSON.stringify(headers) === JSON.stringify(this.transactionHeaders);
  }

  isSummaryRow(row) {
    // Check if this is a summary section row
    return !row['Date'] && (
      row['Description']?.includes('Beginning balance') ||
      row['Description']?.includes('Total credits') ||
      row['Description']?.includes('Total debits') ||
      row['Description']?.includes('Ending balance')
    );
  }

  processTransaction(row) {
    // Skip summary rows
    if (this.isSummaryRow(row)) {
      return null;
    }

    // Skip rows without a date (like blank lines or headers)
    if (!row['Date']) {
      return null;
    }

    // Process actual transaction
    const amount = row['Amount'] 
      ? parseFloat(row['Amount'].replace(/[^0-9.-]+/g, ''))
      : 0;

    const balance = row['Running Bal.']
      ? parseFloat(row['Running Bal.'].replace(/[^0-9.-]+/g, ''))
      : null;

    return {
      date: new Date(row['Date']),
      description: row['Description']?.trim() || '',
      amount: amount,
      balance: balance,
      type: amount > 0 ? 'credit' : 'debit',
      raw: { ...row } // Keep original data for reference
    };
  }

  async processFile(filePath) {
    const csv = require('csv-parse');
    const fs = require('fs').promises;

    const content = await fs.readFile(filePath, 'utf-8');
    const records = await new Promise((resolve, reject) => {
      csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Process records and filter out null results (summary rows)
    return records
      .map(record => this.processTransaction(record))
      .filter(transaction => transaction !== null);
  }
}

class CapitalOneCreditProcessor extends TransactionProcessor {
  constructor() {
    super();
    this.name = 'Capital One Credit Card';
    this.id = 'capital_one_credit';
    this.description = 'Processes Capital One credit card transactions';
    this.filePattern = /\.csv$/;
  }

  validateFile(headers) {
    const requiredHeaders = [
      'Transaction Date',
      'Posted Date',
      'Card No.',
      'Description',
      'Category',
      'Debit',
      'Credit'
    ];
    return requiredHeaders.every(header => headers.includes(header));
  }

  processTransaction(row) {
    if (!row['Transaction Date']) {
      return null;
    }

    // Helper function to parse amounts
    const parseAmount = (value) => {
      if (!value) return 0;
      return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
    };

    // Get amount from either Debit or Credit column
    const debit = parseAmount(row['Debit']);
    const credit = parseAmount(row['Credit']);
    const amount = debit ? -debit : credit;

    return {
      date: new Date(row['Transaction Date']),
      postedDate: new Date(row['Posted Date']),
      description: row['Description']?.trim() || '',
      category: row['Category']?.trim() || 'Uncategorized',
      amount: amount,
      cardNumber: row['Card No.']?.trim(),
      type: amount > 0 ? 'credit' : 'debit',
      components: {
        debit: debit,
        credit: credit
      },
      raw: { ...row } // Keep original data for reference
    };
  }

  async processFile(filePath) {
    const csv = require('csv-parse');
    const fs = require('fs').promises;

    const content = await fs.readFile(filePath, 'utf-8');
    const records = await new Promise((resolve, reject) => {
      csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Process and filter out any null results
    return records
      .map(record => this.processTransaction(record))
      .filter(transaction => transaction !== null);
  }

  // Helper method for category analysis
  calculateCategoryTotals(transactions) {
    return transactions.reduce((totals, trans) => {
      const category = trans.category;
      if (!totals[category]) {
        totals[category] = {
          count: 0,
          total: 0
        };
      }
      totals[category].count++;
      totals[category].total += Math.abs(trans.amount);
      return totals;
    }, {});
  }
}

class BoAMortgageProcessor extends TransactionProcessor {
  constructor() {
    super();
    this.name = 'Bank of America Mortgage';
    this.id = 'boa_mortgage';
    this.description = 'Processes Bank of America mortgage statements';
    this.filePattern = /\.csv$/;
  }

  validateFile(headers) {
    const requiredHeaders = [
      'Date', 'Description', 'Type', 'Amount', 'Payment Due Date',
      'Principal Amount', 'Interest Paid', 'Escrow Amount'
    ];
    return requiredHeaders.every(header => headers.includes(header));
  }

  processTransaction(row) {
    if (!row['Date']) {
      return null;
    }

    // Helper function to parse amounts
    const parseAmount = (value) => {
      if (!value || value === '--') return 0;
      return parseFloat(value.replace(/[$,\s]/g, '')) || 0;
    };

    // Parse all monetary values
    const amount = parseAmount(row['Amount']);
    const principal = parseAmount(row['Principal Amount']);
    const interest = parseAmount(row['Interest Paid']);
    const escrow = parseAmount(row['Escrow Amount']);
    const fees = parseAmount(row['Fee(s) Amount']);

    // Determine transaction type
    const transactionType = row['Type']?.trim().toLowerCase() || '';
    const isPayment = transactionType === 'payment';
    const isEscrow = transactionType === 'escrow';

    return {
      date: new Date(row['Date']),
      description: row['Description']?.trim() || '',
      transactionType: row['Type']?.trim() || '',
      amount: amount,
      paymentDueDate: row['Payment Due Date'] ? new Date(row['Payment Due Date']) : null,
      components: {
        principal: principal,
        interest: interest,
        escrow: escrow,
        fees: fees
      },
      category: isPayment ? 'payment' : 
               isEscrow ? 'escrow' : 
               'other',
      type: amount > 0 ? 'credit' : 'debit',
      raw: { ...row } // Keep original data for reference
    };
  }

  async processFile(filePath) {
    const csv = require('csv-parse');
    const fs = require('fs').promises;

    const content = await fs.readFile(filePath, 'utf-8');
    const records = await new Promise((resolve, reject) => {
      csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Process and filter out any null results
    return records
      .map(record => this.processTransaction(record))
      .filter(transaction => transaction !== null);
  }

  // Additional helper methods for mortgage-specific analysis
  calculateMonthlyStats(transactions) {
    return transactions.reduce((stats, trans) => {
      if (trans.category === 'payment') {
        stats.totalPrincipal += trans.components.principal;
        stats.totalInterest += trans.components.interest;
        stats.totalEscrow += trans.components.escrow;
      }
      return stats;
    }, {
      totalPrincipal: 0,
      totalInterest: 0,
      totalEscrow: 0
    });
  }
}

// Registry of all available processors
const TRANSACTION_PROCESSORS = [
  new BoACheckingSavingsProcessor(),
  new CapitalOneCreditProcessor(),
  new BoAMortgageProcessor()
];

module.exports = {
  TRANSACTION_PROCESSORS,
  TransactionProcessor
}; 