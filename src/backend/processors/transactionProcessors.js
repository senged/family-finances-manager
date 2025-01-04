const fs = require('fs').promises;
const csv = require('csv-parse');

const TRANSACTION_PROCESSORS = {
  'boa_checking_savings': {
    id: 'boa_checking_savings',
    name: 'Bank of America Checking/Savings',
    description: 'Processor for Bank of America checking and savings accounts CSV exports',
    
    async processFile(filePath) {
      const content = await fs.readFile(filePath, 'utf8');
      
      // First, split content into sections
      const lines = content.split('\n');
      let transactionStartIndex = 0;

      // Find where the actual transactions start (after the summary section)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Date,Description,Amount,Running Bal.')) {
          transactionStartIndex = i;
          break;
        }
      }

      // Get just the transaction portion
      const transactionContent = lines.slice(transactionStartIndex).join('\n');
      
      return new Promise((resolve, reject) => {
        csv.parse(transactionContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err);
          
          const transactions = records
            .filter(record => record.Date && record.Date !== 'Date') // Skip any header rows
            .map(record => ({
              date: new Date(record.Date),
              description: record.Description,
              amount: record.Amount ? parseFloat(record.Amount.replace(/[^0-9.-]/g, '')) : 0,
              type: record.Amount ? 
                (parseFloat(record.Amount.replace(/[^0-9.-]/g, '')) >= 0 ? 'credit' : 'debit') : 
                'balance',
              balance: record['Running Bal.'] ? 
                parseFloat(record['Running Bal.'].replace(/[^0-9.-]/g, '')) : 
                null,
              raw: record
            }))
            .filter(tx => tx.type !== 'balance'); // Filter out balance-only rows
          
          resolve(transactions);
        });
      });
    }
  },

  'boa_mortgage': {
    id: 'boa_mortgage',
    name: 'Bank of America Mortgage',
    description: 'Processor for Bank of America mortgage statements',
    
    async processFile(filePath) {
      const content = await fs.readFile(filePath, 'utf8');
      
      return new Promise((resolve, reject) => {
        csv.parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true // Handle the quoted dates and amounts
        }, (err, records) => {
          if (err) reject(err);
          
          const transactions = records.map(record => {
            const amount = record.Amount ? 
              parseFloat(record.Amount.replace(/[$,]/g, '')) : 0;
            
            const baseTransaction = {
              date: new Date(record.Date),
              description: record.Description,
              type: record.Type.toLowerCase(),
              amount: -Math.abs(amount), // Always negative since it's an outflow
              raw: record
            };

            // Add specific fields based on transaction type
            if (record.Type === 'Payment') {
              return {
                ...baseTransaction,
                principalAmount: parseFloat(record['Principal Amount'].replace(/[$,]/g, '') || '0'),
                interestAmount: parseFloat(record['Interest Paid'].replace(/[$,]/g, '') || '0'),
                escrowAmount: parseFloat(record['Escrow Amount'].replace(/[$,]/g, '') || '0'),
                paymentDueDate: record['Payment Due Date'] ? new Date(record['Payment Due Date']) : null
              };
            } else if (record.Type === 'Escrow') {
              return {
                ...baseTransaction,
                escrowAmount: parseFloat(record['Escrow Amount'].replace(/[$,]/g, '') || '0')
              };
            }

            return baseTransaction;
          });
          
          resolve(transactions);
        });
      });
    }
  },

  'capital_one_credit': {
    id: 'capital_one_credit',
    name: 'Capital One Credit Card',
    description: 'Processor for Capital One credit card transaction exports',
    
    async processFile(filePath) {
      const content = await fs.readFile(filePath, 'utf8');
      
      return new Promise((resolve, reject) => {
        csv.parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err);
          
          const transactions = records.map(record => {
            // Handle amount - use Debit or Credit column
            const amount = record.Debit ? 
              -parseFloat(record.Debit) : // Make debits negative
              parseFloat(record.Credit || '0'); // Credits are positive
            
            return {
              date: new Date(record['Transaction Date']),
              postedDate: new Date(record['Posted Date']),
              amount: amount,
              description: record.Description,
              category: record.Category,
              cardNumber: record['Card No.'],
              type: amount >= 0 ? 'credit' : 'debit',
              raw: record
            };
          });
          
          resolve(transactions);
        });
      });
    }
  }
};

module.exports = { TRANSACTION_PROCESSORS }; 