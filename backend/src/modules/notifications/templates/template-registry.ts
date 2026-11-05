import { NotificationChannel, NotificationTriggerEvent } from '@prisma/client';

export interface DefaultTemplateDefinition {
  channel: NotificationChannel;
  event: NotificationTriggerEvent;
  name: string;
  templateIdentifier: string;
  bodyTemplate: string;
}

export const DEFAULT_NOTIFICATION_TEMPLATES: DefaultTemplateDefinition[] = [
  // 1. Customer Registration - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
    name: 'Customer Registration (WhatsApp)',
    templateIdentifier: 'customer_registration_whatsapp',
    bodyTemplate:
      '🌟 Welcome to {{companyName}}, {{customerName}}!\n\nYour client registration is complete.\n• Customer ID: {{customerNumber}}\n• Phone: {{telephone}}\n• Assigned Agent: {{agentName}} ({{agentPhone}})\n\nWe are committed to helping you secure your land with utmost peace of mind. For inquiries, contact us at {{companyPhone}}.',
  },
  // 1. Customer Registration - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.CUSTOMER_REGISTRATION,
    name: 'Customer Registration (Email)',
    templateIdentifier: 'customer_registration_email',
    bodyTemplate: `
      <h2>Welcome to {{companyName}}</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>Thank you for registering with {{companyName}}. Your client account has been successfully created in our management system.</p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #1e293b;">Your Account Details:</h4>
        <p><strong>Customer ID:</strong> {{customerNumber}}</p>
        <p><strong>Registered Telephone:</strong> {{telephone}}</p>
        <p><strong>Assigned Sales Agent:</strong> {{agentName}} ({{agentPhone}})</p>
      </div>
      <p>Your sales agent is ready to assist you through every step of site inspections, land selections, and documentation.</p>
      <p>Best regards,<br><strong>Customer Relations Team</strong><br>{{companyName}}</p>
    `,
  },

  // 2. Plot Allocation Confirmation - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.PLOT_ALLOCATION_CONFIRMATION,
    name: 'Plot Allocation Confirmation (WhatsApp)',
    templateIdentifier: 'plot_allocation_whatsapp',
    bodyTemplate:
      '📍 Plot Allocation Confirmed - {{companyName}}\n\nDear {{customerName}},\nYour land allocation has been successfully recorded!\n• Land Location: {{landLocation}}\n• Plot Number: {{plotNumber}} ({{plotType}})\n• Agreed Purchase Price: {{currency}} {{agreedPrice}}\n• Outstanding Balance: {{currency}} {{outstandingBalance}}\n\nYour assigned sales agent is {{agentName}} ({{agentPhone}}). Thank you for investing with us.',
  },
  // 2. Plot Allocation Confirmation - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.PLOT_ALLOCATION_CONFIRMATION,
    name: 'Plot Allocation Confirmation (Email)',
    templateIdentifier: 'plot_allocation_email',
    bodyTemplate: `
      <h2>Land Plot Allocation Confirmation</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>We are pleased to confirm that your land allocation has been formally recorded in our system.</p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #166534;">Allocation Details:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Location:</strong></td><td>{{landLocation}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Plot Number:</strong></td><td>{{plotNumber}} ({{plotType}})</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Agreed Price:</strong></td><td>{{currency}} {{agreedPrice}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Initial Paid:</strong></td><td>{{currency}} {{amountPaid}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Outstanding Balance:</strong></td><td><strong>{{currency}} {{outstandingBalance}}</strong></td></tr>
        </table>
      </div>
      <p>Please preserve this notice for your records. Official site plan and indenture processing commences upon payment schedule milestones.</p>
      <p>Best regards,<br><strong>{{companyName}}</strong></p>
    `,
  },

  // 3. Payment Received & Receipt Issued - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.PAYMENT_RECEIVED,
    name: 'Payment Receipt (WhatsApp)',
    templateIdentifier: 'payment_received_whatsapp',
    bodyTemplate:
      '🧾 Payment Confirmed - {{companyName}}\n\nDear {{customerName}},\nWe have received your payment of {{currency}} {{amountPaid}}.\n\n• Receipt Number: {{receiptNumber}}\n• Payment Channel: {{paymentMethod}}\n• External Reference: {{paymentReference}}\n• Land & Plot: {{plotNumber}} at {{landLocation}}\n• Outstanding Balance: {{currency}} {{outstandingBalance}}\n\nAn official electronic receipt has been generated. Thank you for your payment.',
  },
  // 3. Payment Received & Receipt Issued - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.PAYMENT_RECEIVED,
    name: 'Payment Receipt (Email)',
    templateIdentifier: 'payment_received_email',
    bodyTemplate: `
      <h2>Official Payment Confirmation & Receipt</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>We acknowledge receipt of your payment with sincere gratitude. Please find your transaction details summarized below:</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Receipt Number:</strong></td><td><strong>{{receiptNumber}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Amount Paid:</strong></td><td><span style="color: #15803d; font-size: 1.1em; font-weight: bold;">{{currency}} {{amountPaid}}</span></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Payment Method:</strong></td><td>{{paymentMethod}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>External Reference:</strong></td><td>{{paymentReference}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Plot Allocated:</strong></td><td>{{plotNumber}} ({{landLocation}})</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Remaining Balance:</strong></td><td><strong>{{currency}} {{outstandingBalance}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Payment Date:</strong></td><td>{{paymentDate}}</td></tr>
        </table>
      </div>
      <p>Your official PDF receipt has been issued and stored in your customer profile vault.</p>
      <p>Warm regards,<br><strong>Accounts & Finance Department</strong><br>{{companyName}}</p>
    `,
  },

  // 4. Invoice Generated - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.INVOICE_GENERATED,
    name: 'Invoice Notice (WhatsApp)',
    templateIdentifier: 'invoice_generated_whatsapp',
    bodyTemplate:
      '📄 Invoice Notice - {{companyName}}\n\nDear {{customerName}},\nAn invoice has been prepared for your plot purchase.\n\n• Invoice Number: {{invoiceNumber}}\n• Amount Due: {{currency}} {{invoiceAmount}}\n• Due Date: {{dueDate}}\n• Plot: {{plotNumber}} at {{landLocation}}\n\nPlease contact our accounts desk or your sales agent for settlement assistance.',
  },
  // 4. Invoice Generated - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.INVOICE_GENERATED,
    name: 'Invoice Notice (Email)',
    templateIdentifier: 'invoice_generated_email',
    bodyTemplate: `
      <h2>Invoice Notice: {{invoiceNumber}}</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>An official invoice has been issued for your land transaction at <strong>{{landLocation}}</strong>.</p>
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Invoice Number:</strong></td><td><strong>{{invoiceNumber}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Amount Due:</strong></td><td><strong style="color: #1d4ed8;">{{currency}} {{invoiceAmount}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Plot Number:</strong></td><td>{{plotNumber}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Due Date:</strong></td><td>{{dueDate}}</td></tr>
        </table>
      </div>
      <p>Approved settlement channels include Mobile Money Transfer, Direct Bank Transfer, or Cash deposit at our head office.</p>
      <p>Best regards,<br><strong>Accounts Department</strong><br>{{companyName}}</p>
    `,
  },

  // 5. Payment Reminder Due / Overdue Alert - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.PAYMENT_REMINDER_DUE,
    name: 'Payment Due Reminder (WhatsApp)',
    templateIdentifier: 'payment_reminder_whatsapp',
    bodyTemplate:
      '⏰ Payment Due Reminder - {{companyName}}\n\nDear {{customerName}},\nThis is a friendly reminder that your upcoming installment is due.\n\n• Due Amount: {{currency}} {{dueAmount}}\n• Due Date: {{dueDate}}\n• Plot: {{plotNumber}} at {{landLocation}}\n• Current Balance: {{currency}} {{outstandingBalance}}\n\nTimely payments ensure uninterrupted progress on your land documentation and allocation. Thank you!',
  },
  // 5. Payment Reminder Due / Overdue Alert - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.PAYMENT_REMINDER_DUE,
    name: 'Payment Due Reminder (Email)',
    templateIdentifier: 'payment_reminder_email',
    bodyTemplate: `
      <h2>Friendly Reminder: Installment Payment Due</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>This is a reminder regarding your scheduled land installment payment for <strong>{{plotNumber}}</strong> at <strong>{{landLocation}}</strong>.</p>
      <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Amount Due:</strong></td><td><strong style="color: #b45309;">{{currency}} {{dueAmount}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Due Date:</strong></td><td>{{dueDate}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Total Outstanding Balance:</strong></td><td>{{currency}} {{outstandingBalance}}</td></tr>
        </table>
      </div>
      <p>If you have already settled this installment, kindly inform your sales agent or forward the payment slip for reconciliation.</p>
      <p>Warm regards,<br><strong>Accounts & Finance Desk</strong><br>{{companyName}}</p>
    `,
  },

  // 6. Refund Request Submitted - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.REFUND_REQUEST_SUBMITTED,
    name: 'Refund Request Submitted (WhatsApp)',
    templateIdentifier: 'refund_submitted_whatsapp',
    bodyTemplate:
      '📋 Refund Request Received - {{companyName}}\n\nDear {{customerName}},\nYour refund application {{refundNumber}} for {{plotNumber}} at {{landLocation}} has been recorded in our system.\n\n• Requested Amount: {{currency}} {{requestedAmount}}\n• Status: PENDING MANAGING DIRECTOR APPROVAL\n\nYou will be notified immediately once executive review is complete.',
  },
  // 6. Refund Request Submitted - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.REFUND_REQUEST_SUBMITTED,
    name: 'Refund Request Submitted (Email)',
    templateIdentifier: 'refund_submitted_email',
    bodyTemplate: `
      <h2>Refund Request Formal Acknowledgment</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>This notice confirms that your refund request <strong>{{refundNumber}}</strong> has been formally submitted into our system and escalated for executive review.</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p><strong>Refund Reference:</strong> {{refundNumber}}</p>
        <p><strong>Associated Plot:</strong> {{plotNumber}} ({{landLocation}})</p>
        <p><strong>Total Cumulative Payments:</strong> {{currency}} {{totalPaid}}</p>
        <p><strong>Current Status:</strong> Pending Managing Director Audit & Approval</p>
      </div>
      <p>In accordance with company policy, refund applications require itemized deduction review and Managing Director authorization.</p>
      <p>Best regards,<br><strong>Audit & Compliance Desk</strong><br>{{companyName}}</p>
    `,
  },

  // 7. Refund Approval Status - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.REFUND_APPROVAL_STATUS,
    name: 'Refund Decision Notice (WhatsApp)',
    templateIdentifier: 'refund_decision_whatsapp',
    bodyTemplate:
      '⚖️ Refund Decision Notice - {{companyName}}\n\nDear {{customerName}},\nYour refund application {{refundNumber}} has been reviewed by the Managing Director.\n\n• Decision: {{approvalStatus}}\n• Net Refund Payable: {{currency}} {{netRefundAmount}}\n• Itemized Deductions: {{currency}} {{deductionsAmount}}\n\nContact the finance desk for disbursement scheduling.',
  },
  // 7. Refund Approval Status - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.REFUND_APPROVAL_STATUS,
    name: 'Refund Decision Notice (Email)',
    templateIdentifier: 'refund_decision_email',
    bodyTemplate: `
      <h2>Executive Decision on Refund Request {{refundNumber}}</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>The Managing Director has concluded the review of your refund application.</p>
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin-top: 0;">Decision Summary:</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Status:</strong></td><td><strong>{{approvalStatus}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Original Paid Amount:</strong></td><td>{{currency}} {{totalPaid}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Approved Deductions:</strong></td><td>{{currency}} {{deductionsAmount}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Net Refund Approved:</strong></td><td><strong style="color: #15803d; font-size: 1.1em;">{{currency}} {{netRefundAmount}}</strong></td></tr>
        </table>
        <p style="margin-top: 10px; font-size: 0.9em; color: #64748b;"><em>Audit Note: {{reviewNotes}}</em></p>
      </div>
      <p>Upon approval, the accounts department will schedule your disbursement through the approved payment channel.</p>
      <p>Sincerely,<br><strong>Office of the Managing Director</strong><br>{{companyName}}</p>
    `,
  },

  // 8. Refund Payment Disbursed - WhatsApp
  {
    channel: NotificationChannel.WHATSAPP,
    event: NotificationTriggerEvent.REFUND_PAYMENT_DISBURSED,
    name: 'Refund Disbursement (WhatsApp)',
    templateIdentifier: 'refund_disbursed_whatsapp',
    bodyTemplate:
      '💳 Refund Disbursed - {{companyName}}\n\nDear {{customerName}},\nYour approved refund payment has been successfully disbursed.\n\n• Disbursed Amount: {{currency}} {{disbursedAmount}}\n• Channel: {{disbursementChannel}}\n• Reference / Teller: {{disbursementReference}}\n• Transaction Number: {{transactionNumber}}\n\nThank you for doing business with {{companyName}}.',
  },
  // 8. Refund Payment Disbursed - Email
  {
    channel: NotificationChannel.EMAIL,
    event: NotificationTriggerEvent.REFUND_PAYMENT_DISBURSED,
    name: 'Refund Disbursement (Email)',
    templateIdentifier: 'refund_disbursed_email',
    bodyTemplate: `
      <h2>Official Notice of Refund Disbursement</h2>
      <p>Dear <strong>{{customerName}}</strong>,</p>
      <p>We confirm that your refund payment has been formally executed and disbursed as detailed below:</p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0;"><strong>Disbursement Reference:</strong></td><td><strong>{{transactionNumber}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Disbursed Amount:</strong></td><td><strong style="color: #15803d; font-size: 1.1em;">{{currency}} {{disbursedAmount}}</strong></td></tr>
          <tr><td style="padding: 6px 0;"><strong>Payment Channel:</strong></td><td>{{disbursementChannel}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>External Transaction / Teller:</strong></td><td>{{disbursementReference}}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Disbursement Date:</strong></td><td>{{disbursementDate}}</td></tr>
        </table>
      </div>
      <p>An official PDF payment voucher has been recorded in the company financial registry.</p>
      <p>Warm regards,<br><strong>Finance & Treasury Operations</strong><br>{{companyName}}</p>
    `,
  },
];
