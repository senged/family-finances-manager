// src/backend/csvProcessor.js
const fs = require('fs');
const { parse } = require('csv-parse');

class Transaction {
  constructor(date, description, amount, category, account) {
    this.date = new Date(date);
    this.description = description;
    this.amount = parseFloat(amount);
    this.category = category;
    this.account = account;
    this.hash = this.generateHash();
  }

  generateHash() {
    // Create a unique hash based on transaction properties to detect duplicates
    return `${this.date.toISOString()}-${this.description}-${this.amount}-${this.account}`;
  }
}

class TransactionManager {
  constructor() {
    this.transactions = new Map(); // Use hash as key to prevent duplicates
    this.recurringPatterns = new Map();
  }

  addTransaction(transaction) {
    if (!this.transactions.has(transaction.hash)) {
      this.transactions.set(transaction.hash, transaction);
      this.detectRecurring(transaction);
    }
  }

  detectRecurring(transaction) {
    // Simple recurring detection based on description and amount
    const key = `${transaction.description}-${transaction.amount}`;
    if (!this.recurringPatterns.has(key)) {
      this.recurringPatterns.set(key, []);
    }
    this.recurringPatterns.get(key).push(transaction.date);
    
    // If we have 3 or more transactions with the same description and amount,
    // analyze their dates for patterns
    if (this.recurringPatterns.get(key).length >= 3) {
      this.analyzeRecurringPattern(key);
    }
  }

  analyzeRecurringPattern(key) {
    const dates = this.recurringPatterns.get(key).sort();
    // Calculate average days between transactions
    let totalDays = 0;
    let count = 0;
    
    for (let i = 1; i < dates.length; i++) {
      const daysDiff = (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
      totalDays += daysDiff;
      count++;
    }
    
    const avgDays = totalDays / count;
    if (avgDays > 25 && avgDays < 35) {
      // Likely monthly
      return { type: 'monthly', confidence: 'high' };
    }
    // Add more pattern detection as needed
    return null;
  }
}

async function processCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const transactions = [];
    
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row) => {
        // Adjust these field names based on your CSV structure
        const transaction = new Transaction(
          row.date,
          row.description,
          row.amount,
          row.category,
          row.account
        );
        transactions.push(transaction);
      })
      .on('end', () => resolve(transactions))
      .on('error', reject);
  });
}

module.exports = {
  processCSVFile,
  Transaction,
  TransactionManager
};
