require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// Middleware Setup
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// Utility: PII Masking
// ==========================================
const maskPII = (str) => {
  if (process.env.MASK_PII !== 'true' || !str) return str;
  if (typeof str !== 'string') str = String(str);
  
  // Mask numbers (e.g., verification codes) to show only last 4 digits (or 2 if short)
  if (/^\d+$/.test(str)) {
    if (str.length > 4) {
      return '*'.repeat(str.length - 4) + str.slice(-4);
    }
    if (str.length > 2) {
      return '*'.repeat(str.length - 2) + str.slice(-2);
    }
    return '*'.repeat(str.length);
  }
  
  // Mask names (keep first and last letter if length > 2)
  if (str.length > 2) {
    return `${str[0]}${'*'.repeat(str.length - 2)}${str[str.length - 1]}`;
  }
  
  return '***';
};

// ==========================================
// Request Logging Middleware
// ==========================================
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// GET /health Endpoint
// ==========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Kapture Collections Webhook',
    uptime: process.uptime()
  });
});

// ==========================================
// POST /webhook Endpoint (Vapi Tool Calls)
// ==========================================
app.post('/webhook', (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Invalid payload: missing message' });
    }

    // Acknowledge non-tool-call events gracefully
    if (message.type !== 'tool-calls') {
      console.log(`Received non-tool-call event: ${message.type}. Acknowledging.`);
      return res.status(200).send();
    }

    const { toolCalls } = message;
    if (!toolCalls || !Array.isArray(toolCalls)) {
      return res.status(400).json({ error: 'Invalid payload: missing or malformed toolCalls' });
    }

    // Process each tool call and collect results
    const results = toolCalls.map((toolCall) => {
      const { id: toolCallId, function: { name, arguments: args } } = toolCall;
      let result;

      console.log(`Processing tool call: ${name}`);

      switch (name) {
        // 1. verify_customer
        case 'verify_customer': {
          const { verification_code } = args;
          const validCodes = (process.env.VALID_VERIFICATION_CODES || '1234,1995').split(',');
          console.log(`Verifying code: ${maskPII(verification_code)}`);
          
          if (validCodes.includes(verification_code)) {
            result = {
              verified: true,
              customer_name: 'Rahul Sharma',
              message: 'Identity verified successfully.'
            };
          } else {
            result = {
              verified: false,
              customer_name: null,
              message: 'Verification failed. Incorrect code.'
            };
          }
          break;
        }
        
        // 2. log_promise_to_pay
        case 'log_promise_to_pay': {
          const { ptp_date, amount } = args;
          result = {
            success: true,
            ptp_id: `PTP-${Math.floor(1000 + Math.random() * 9000)}`,
            confirmed_date: ptp_date || new Date().toISOString().split('T')[0],
            amount: amount
          };
          console.log(`Logged PTP for amount: ₹${amount}, date: ${ptp_date}`);
          break;
        }
        
        // 3. send_payment_link
        case 'send_payment_link': {
          const { channel } = args;
          result = {
            success: true,
            link_sent: true,
            message: `Payment link sent via ${channel || 'SMS'}`
          };
          console.log(`Sent payment link via ${channel || 'SMS'}`);
          break;
        }
        
        // 4. escalate_to_agent
        case 'escalate_to_agent': {
          const { reason } = args;
          result = {
            success: true,
            ticket_id: `ESC-${Math.floor(Math.random() * 10000)}`,
            queue_position: Math.floor(Math.random() * 5) + 1,
            estimated_wait: `${Math.floor(Math.random() * 10) + 1} minutes`
          };
          console.log(`Escalated to agent. Reason: ${reason}`);
          break;
        }
        
        // 5. mark_disposition
        case 'mark_disposition': {
          const { status } = args;
          result = {
            success: true,
            disposition_logged: status || 'unknown',
            timestamp: new Date().toISOString()
          };
          console.log(`Marked disposition: ${status}`);
          break;
        }
        
        // Unknown tools
        default: {
          console.warn(`Unknown tool call received: ${name}`);
          result = { error: `Function ${name} not supported` };
          break;
        }
      }

      // Return the Vapi-compatible format for each tool call
      return {
        toolCallId,
        result: JSON.stringify(result)
      };
    });

    // Vapi expects { results: [...] }
    res.json({ results });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Error Handling Middleware
// ==========================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
  console.log('\n===================================================');
  console.log('  KAPTURE FINANCE COLLECTIONS MOCK WEBHOOK SERVER  ');
  console.log('===================================================');
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log('===================================================\n');
});
