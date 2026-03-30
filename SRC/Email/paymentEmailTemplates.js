// services/Email/paymentEmailTemplates.js

import { appConfig } from './emailConfig.js';

/**
 * ════════════════════════════════════════════════════════════════
 *              💰 PAYMENT EMAIL TEMPLATES
 *         Professional Invoices & Receipts with GST
 * ════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
//              BASE INVOICE TEMPLATE (WITH GST)
// ═══════════════════════════════════════════════════════════════
const invoiceTemplate = (content, invoiceData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - ${invoiceData.invoiceNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
        }
        .email-wrapper {
            background-color: #f4f4f4;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .header-left h1 {
            font-size: 28px;
            margin-bottom: 5px;
        }
        .header-left p {
            opacity: 0.9;
            font-size: 14px;
        }
        .header-right {
            text-align: right;
        }
        .invoice-badge {
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 50px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .invoice-number {
            font-size: 20px;
            font-weight: bold;
        }
        .content {
            padding: 40px 30px;
        }
        
        /* Invoice Specific Styles */
        .invoice-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .invoice-party {
            flex: 1;
        }
        .invoice-party h3 {
            color: #667eea;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        .invoice-party p {
            margin: 5px 0;
            font-size: 14px;
            line-height: 1.8;
        }
        .invoice-party strong {
            font-size: 16px;
            display: block;
            margin-bottom: 5px;
        }
        
        /* Table Styles */
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
        }
        .invoice-table thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .invoice-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .invoice-table th:last-child,
        .invoice-table td:last-child {
            text-align: right;
        }
        .invoice-table tbody tr {
            border-bottom: 1px solid #e0e0e0;
        }
        .invoice-table tbody tr:hover {
            background: #f8f9fa;
        }
        .invoice-table td {
            padding: 15px;
            font-size: 14px;
        }
        .invoice-table .item-description {
            color: #666;
            font-size: 13px;
            margin-top: 5px;
        }
        
        /* Totals Section */
        .invoice-totals {
            margin-top: 30px;
            margin-left: auto;
            width: 350px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 20px;
            font-size: 14px;
        }
        .total-row.subtotal {
            background: #f8f9fa;
            border-radius: 8px 8px 0 0;
        }
        .total-row.tax {
            background: #f8f9fa;
            border-top: 1px solid #e0e0e0;
        }
        .total-row.discount {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .total-row.grand-total {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 18px;
            font-weight: bold;
            border-radius: 0 0 8px 8px;
            padding: 20px;
        }
        
        /* GST Breakdown */
        .gst-breakdown {
            background: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        .gst-breakdown h4 {
            color: #1565c0;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .gst-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            color: #1565c0;
        }
        .gst-row strong {
            font-weight: 600;
        }
        
        /* Payment Info */
        .payment-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
        }
        .payment-info h4 {
            color: #333;
            margin-bottom: 15px;
            font-size: 16px;
        }
        .payment-detail {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            border-bottom: 1px solid #e0e0e0;
        }
        .payment-detail:last-child {
            border-bottom: none;
        }
        .payment-detail .label {
            color: #666;
        }
        .payment-detail .value {
            font-weight: 600;
            font-family: monospace;
        }
        
        /* Notes Section */
        .notes-section {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
        }
        .notes-section h4 {
            color: #e65100;
            margin-bottom: 10px;
            font-size: 14px;
            text-transform: uppercase;
        }
        .notes-section p {
            color: #e65100;
            font-size: 13px;
            line-height: 1.8;
        }
        
        /* Terms & Conditions */
        .terms-section {
            background: #f8f9fa;
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
            font-size: 12px;
            color: #666;
        }
        .terms-section h4 {
            color: #333;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .terms-section ul {
            padding-left: 20px;
            margin: 10px 0;
        }
        .terms-section li {
            margin: 5px 0;
        }
        
        /* Stamp Section */
        .stamp-section {
            text-align: right;
            margin-top: 40px;
            padding: 20px;
        }
        .stamp {
            display: inline-block;
            border: 2px solid #667eea;
            padding: 15px 25px;
            border-radius: 8px;
            text-align: center;
        }
        .stamp-text {
            font-size: 12px;
            color: #667eea;
            font-weight: 600;
            text-transform: uppercase;
        }
        .stamp-signature {
            margin-top: 30px;
            font-size: 14px;
        }
        
        /* Footer */
        .invoice-footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
            font-size: 13px;
            color: #666;
        }
        .invoice-footer p {
            margin: 5px 0;
        }
        
        /* Download Button */
        .download-section {
            text-align: center;
            margin: 30px 0;
        }
        .download-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        
        /* Print Styles */
        @media print {
            .email-wrapper {
                background: white;
                padding: 0;
            }
            .download-section {
                display: none;
            }
        }
        
        @media only screen and (max-width: 600px) {
            .header {
                flex-direction: column;
            }
            .header-right {
                text-align: left;
                margin-top: 20px;
            }
            .invoice-header {
                flex-direction: column;
            }
            .invoice-party {
                margin-bottom: 20px;
            }
            .invoice-totals {
                width: 100%;
            }
            .invoice-table {
                font-size: 12px;
            }
            .invoice-table th,
            .invoice-table td {
                padding: 10px 5px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="container">
            ${content}
        </div>
    </div>
</body>
</html>
`;

// ═══════════════════════════════════════════════════════════════
//          1️⃣ CLIENT: PAYMENT SUCCESS + INVOICE (WITH GST)
// ═══════════════════════════════════════════════════════════════

export const clientPaymentSuccessInvoiceTemplate = ({
  clientName,
  clientEmail,
  clientAddress,
  clientGSTIN,
  invoiceNumber,
  invoiceDate,
  dueDate,
  projectName,
  projectDescription,
  employeeName,
  amount,
  platformFee,
  gstPercentage = 18,
  cgst,
  sgst,
  igst,
  totalAmount,
  paymentId,
  orderId,
  paymentMethod,
  paymentDate,
  companyDetails = {
    name: appConfig.appName,
    address: "123 Business Park, Tech City, Mumbai - 400001",
    gstin: "27AABCU9603R1ZX",
    pan: "AABCU9603R",
    email: appConfig.supportEmail,
    phone: "+91 1234567890",
  }
}) => {
  const content = `
    <div class="header">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">TAX INVOICE</div>
        <div class="invoice-number">#${invoiceNumber}</div>
      </div>
    </div>

    <div class="content">
      <!-- Invoice Header with Parties -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>From (Service Provider)</h3>
          <strong>${companyDetails.name}</strong>
          <p>${companyDetails.address}</p>
          <p><strong>GSTIN:</strong> ${companyDetails.gstin}</p>
          <p><strong>PAN:</strong> ${companyDetails.pan}</p>
          <p><strong>Email:</strong> ${companyDetails.email}</p>
          <p><strong>Phone:</strong> ${companyDetails.phone}</p>
        </div>

        <div class="invoice-party">
          <h3>Bill To (Customer)</h3>
          <strong>${clientName}</strong>
          <p>${clientEmail}</p>
          ${clientAddress ? `<p>${clientAddress}</p>` : ''}
          ${clientGSTIN ? `<p><strong>GSTIN:</strong> ${clientGSTIN}</p>` : '<p><em>Unregistered (No GSTIN)</em></p>'}
        </div>
      </div>

      <!-- Invoice Details -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <p style="font-size: 14px; color: #666;"><strong>Invoice Date:</strong> ${new Date(invoiceDate).toLocaleDateString('en-IN')}</p>
          <p style="font-size: 14px; color: #666;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-IN')}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; color: #666;"><strong>Payment Status:</strong> <span style="color: #4caf50; font-weight: bold;">✅ PAID</span></p>
          <p style="font-size: 14px; color: #666;"><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      <!-- Services Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th style="width: 15%;">HSN/SAC</th>
            <th style="width: 15%;">Qty</th>
            <th style="width: 20%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${projectName}</strong>
              <div class="item-description">${projectDescription}</div>
              <div class="item-description"><em>Editor: ${employeeName}</em></div>
            </td>
            <td>998599</td>
            <td>1</td>
            <td style="text-align: right;">₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td>
              <strong>Platform Service Fee</strong>
              <div class="item-description">Transaction processing & platform maintenance</div>
            </td>
            <td>998599</td>
            <td>1</td>
            <td style="text-align: right;">₹${platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- GST Breakdown -->
      <div class="gst-breakdown">
        <h4>📊 GST Breakdown (@ ${gstPercentage}%)</h4>
        ${cgst && sgst ? `
          <div class="gst-row">
            <span>CGST @ ${gstPercentage/2}%</span>
            <strong>₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div class="gst-row">
            <span>SGST @ ${gstPercentage/2}%</span>
            <strong>₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        ${igst ? `
          <div class="gst-row">
            <span>IGST @ ${gstPercentage}%</span>
            <strong>₹${igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        <div class="gst-row" style="border-top: 2px solid #2196f3; margin-top: 10px; padding-top: 10px;">
          <span><strong>Total GST</strong></span>
          <strong>₹${(cgst + sgst + igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Totals -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Subtotal</span>
          <strong>₹${(amount + platformFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax">
          <span>GST (${gstPercentage}%)</span>
          <strong>₹${(cgst + sgst + igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL AMOUNT PAID</span>
          <strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 14px; color: #666;">
          <strong>Amount in Words:</strong> 
          <span style="color: #333; text-transform: capitalize;">Rupees ${numberToWords(totalAmount)} Only</span>
        </p>
      </div>

      <!-- Payment Information -->
      <div class="payment-info">
        <h4>💳 Payment Details</h4>
        <div class="payment-detail">
          <span class="label">Payment Method:</span>
          <span class="value">${paymentMethod}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Transaction ID:</span>
          <span class="value">${paymentId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Order ID:</span>
          <span class="value">${orderId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Payment Date:</span>
          <span class="value">${new Date(paymentDate).toLocaleString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color: #4caf50; font-weight: bold;">✅ PAID</span>
        </div>
      </div>

      <!-- Notes -->
      <div class="notes-section">
        <h4>📝 Important Notes</h4>
        <p>
          • This is a computer-generated invoice and does not require a physical signature.<br>
          • Payment has been processed through Razorpay payment gateway.<br>
          • For any queries regarding this invoice, please contact us at ${companyDetails.email}<br>
          • Please retain this invoice for your tax records.
        </p>
      </div>

      <!-- Terms & Conditions -->
      <div class="terms-section">
        <h4>Terms & Conditions</h4>
        <ul>
          <li>All payments are processed through Razorpay</li>
          <li>Platform fee is non-refundable</li>
          <li>Project amount will be held in escrow until completion</li>
          <li>Refunds (if applicable) will be processed as per our refund policy</li>
          <li>Subject to Mumbai Jurisdiction</li>
        </ul>
      </div>

      <!-- Digital Stamp -->
      <div class="stamp-section">
        <div class="stamp">
          <div class="stamp-text">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top: 20px; font-style: italic; color: #667eea;">For ${companyDetails.name}</p>
          </div>
        </div>
      </div>

      <!-- Download Button -->
      <div class="download-section">
        <a href="${appConfig.appUrl}/invoices/${invoiceNumber}/download" class="download-button">
          📄 Download PDF Invoice
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
      <p style="margin-top: 15px; font-size: 12px; color: #999;">
        This is a system-generated invoice. For queries, contact support.
      </p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber });
};

// ═══════════════════════════════════════════════════════════════
//       HELPER: Convert Number to Words (Indian System)
// ═══════════════════════════════════════════════════════════════
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  let words = '';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  if (crore > 0) words += numberToWords(crore) + ' Crore ';
  if (lakh > 0) words += numberToWords(lakh) + ' Lakh ';
  if (thousand > 0) words += numberToWords(thousand) + ' Thousand ';
  if (hundred > 0) words += ones[hundred] + ' Hundred ';

  if (remainder >= 20) {
    words += tens[Math.floor(remainder / 10)] + ' ';
    if (remainder % 10 > 0) words += ones[remainder % 10];
  } else if (remainder >= 10) {
    words += teens[remainder - 10];
  } else if (remainder > 0) {
    words += ones[remainder];
  }

  return words.trim();
}



// services/Email/paymentEmailTemplates.js

// ... (your existing invoice template code)

// ═══════════════════════════════════════════════════════════════
//     💳 SUBSCRIPTION PAYMENT TEMPLATES (ADD BELOW INVOICES)
// ═══════════════════════════════════════════════════════════════

/**
 * Subscription Payment Invoice - Premium Subscription
 */
export const subscriptionPaymentInvoiceTemplate = ({
  clientName,
  clientEmail,
  clientAddress,
  clientGSTIN,
  invoiceNumber,
  invoiceDate,
  planName,
  planType,
  planPrice,
  startDate,
  endDate,
  gstPercentage = 18,
  cgst,
  sgst,
  igst,
  totalAmount,
  paymentId,
  orderId,
  paymentMethod,
  paymentDate,
  companyDetails = {
    name: appConfig.appName,
    address: "123 Business Park, Tech City, Mumbai - 400001",
    gstin: "27AABCU9603R1ZX",
    pan: "AABCU9603R",
    email: appConfig.supportEmail,
    phone: "+91 1234567890",
  }
}) => {
  const content = `
    <div class="header">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">SUBSCRIPTION INVOICE</div>
        <div class="invoice-number">#${invoiceNumber}</div>
      </div>
    </div>

    <div class="content">
      <!-- Invoice Header -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>From (Service Provider)</h3>
          <strong>${companyDetails.name}</strong>
          <p>${companyDetails.address}</p>
          <p><strong>GSTIN:</strong> ${companyDetails.gstin}</p>
          <p><strong>PAN:</strong> ${companyDetails.pan}</p>
          <p><strong>Email:</strong> ${companyDetails.email}</p>
          <p><strong>Phone:</strong> ${companyDetails.phone}</p>
        </div>

        <div class="invoice-party">
          <h3>Bill To (Customer)</h3>
          <strong>${clientName}</strong>
          <p>${clientEmail}</p>
          ${clientAddress ? `<p>${clientAddress}</p>` : ''}
          ${clientGSTIN ? `<p><strong>GSTIN:</strong> ${clientGSTIN}</p>` : '<p><em>Unregistered (No GSTIN)</em></p>'}
        </div>
      </div>

      <!-- Invoice Details -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <p style="font-size: 14px; color: #666;"><strong>Invoice Date:</strong> ${new Date(invoiceDate).toLocaleDateString('en-IN')}</p>
          <p style="font-size: 14px; color: #666;"><strong>Subscription Period:</strong> ${new Date(startDate).toLocaleDateString('en-IN')} - ${new Date(endDate).toLocaleDateString('en-IN')}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; color: #666;"><strong>Payment Status:</strong> <span style="color: #4caf50; font-weight: bold;">✅ PAID</span></p>
          <p style="font-size: 14px; color: #666;"><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      <!-- Services Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 50%;">Description</th>
            <th style="width: 15%;">HSN/SAC</th>
            <th style="width: 15%;">Period</th>
            <th style="width: 20%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${planName} Subscription</strong>
              <div class="item-description">Premium platform access with enhanced features</div>
              <div class="item-description"><em>Plan Type: ${planType}</em></div>
            </td>
            <td>998599</td>
            <td>30 Days</td>
            <td style="text-align: right;">₹${planPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- GST Breakdown -->
      <div class="gst-breakdown">
        <h4>📊 GST Breakdown (@ ${gstPercentage}%)</h4>
        ${cgst && sgst ? `
          <div class="gst-row">
            <span>CGST @ ${gstPercentage/2}%</span>
            <strong>₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div class="gst-row">
            <span>SGST @ ${gstPercentage/2}%</span>
            <strong>₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        ${igst ? `
          <div class="gst-row">
            <span>IGST @ ${gstPercentage}%</span>
            <strong>₹${igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        <div class="gst-row" style="border-top: 2px solid #2196f3; margin-top: 10px; padding-top: 10px;">
          <span><strong>Total GST</strong></span>
          <strong>₹${((cgst || 0) + (sgst || 0) + (igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Totals -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Subtotal</span>
          <strong>₹${planPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax">
          <span>GST (${gstPercentage}%)</span>
          <strong>₹${((cgst || 0) + (sgst || 0) + (igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL AMOUNT PAID</span>
          <strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 14px; color: #666;">
          <strong>Amount in Words:</strong> 
          <span style="color: #333; text-transform: capitalize;">Rupees ${numberToWords(totalAmount)} Only</span>
        </p>
      </div>

      <!-- Payment Information -->
      <div class="payment-info">
        <h4>💳 Payment Details</h4>
        <div class="payment-detail">
          <span class="label">Payment Method:</span>
          <span class="value">${paymentMethod}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Transaction ID:</span>
          <span class="value">${paymentId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Order ID:</span>
          <span class="value">${orderId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Payment Date:</span>
          <span class="value">${new Date(paymentDate).toLocaleString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color: #4caf50; font-weight: bold;">✅ PAID</span>
        </div>
      </div>

      <!-- Subscription Details -->
      <div class="payment-info" style="background: #e8f5e9; border: 1px solid #4caf50;">
        <h4 style="color: #2e7d32;">🎯 Subscription Details</h4>
        <div class="payment-detail">
          <span class="label">Plan:</span>
          <span class="value">${planName}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Valid From:</span>
          <span class="value">${new Date(startDate).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Valid Until:</span>
          <span class="value">${new Date(endDate).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Auto-Renewal:</span>
          <span class="value">Enabled</span>
        </div>
      </div>

      <!-- Notes -->
      <div class="notes-section">
        <h4>📝 Important Notes</h4>
        <p>
          • This is a computer-generated invoice for subscription services.<br>
          • Payment has been processed through Razorpay payment gateway.<br>
          • Subscription will auto-renew unless cancelled before expiry date.<br>
          • For cancellation or queries, contact us at ${companyDetails.email}<br>
          • Please retain this invoice for your tax records.
        </p>
      </div>

      <!-- Terms & Conditions -->
      <div class="terms-section">
        <h4>Terms & Conditions</h4>
        <ul>
          <li>All payments are processed through Razorpay</li>
          <li>Subscription fees are non-refundable after activation</li>
          <li>Auto-renewal can be cancelled anytime before expiry</li>
          <li>Premium features are active for the subscription period only</li>
          <li>Subject to Mumbai Jurisdiction</li>
        </ul>
      </div>

      <!-- Digital Stamp -->
      <div class="stamp-section">
        <div class="stamp">
          <div class="stamp-text">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top: 20px; font-style: italic; color: #667eea;">For ${companyDetails.name}</p>
          </div>
        </div>
      </div>

      <!-- Download Button -->
      <div class="download-section">
        <a href="${appConfig.appUrl}/invoices/subscription/${invoiceNumber}/download" class="download-button">
          📄 Download PDF Invoice
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
      <p style="margin-top: 15px; font-size: 12px; color: #999;">
        This is a system-generated invoice. For queries, contact support.
      </p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber });
};

/**
 * Subscription Refund Credit Note
 */
export const subscriptionRefundCreditNoteTemplate = ({
  clientName,
  clientEmail,
  clientGSTIN,
  creditNoteNumber,
  originalInvoiceNumber,
  issueDate,
  planName,
  refundAmount,
  refundReason,
  gstPercentage = 18,
  cgst,
  sgst,
  igst,
  totalRefund,
  refundMethod,
  refundDate,
  companyDetails = {
    name: appConfig.appName,
    address: "123 Business Park, Tech City, Mumbai - 400001",
    gstin: "27AABCU9603R1ZX",
    pan: "AABCU9603R",
    email: appConfig.supportEmail,
    phone: "+91 1234567890",
  }
}) => {
  const content = `
    <div class="header" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">CREDIT NOTE</div>
        <div class="invoice-number">#${creditNoteNumber}</div>
      </div>
    </div>

    <div class="content">
      <!-- Header -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>From (Service Provider)</h3>
          <strong>${companyDetails.name}</strong>
          <p>${companyDetails.address}</p>
          <p><strong>GSTIN:</strong> ${companyDetails.gstin}</p>
          <p><strong>PAN:</strong> ${companyDetails.pan}</p>
          <p><strong>Email:</strong> ${companyDetails.email}</p>
          <p><strong>Phone:</strong> ${companyDetails.phone}</p>
        </div>

        <div class="invoice-party">
          <h3>Credit To (Customer)</h3>
          <strong>${clientName}</strong>
          <p>${clientEmail}</p>
          ${clientGSTIN ? `<p><strong>GSTIN:</strong> ${clientGSTIN}</p>` : ''}
        </div>
      </div>

      <!-- Credit Note Details -->
      <div style="background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
          <div>
            <p style="margin: 5px 0;"><strong>Credit Note Date:</strong> ${new Date(issueDate).toLocaleDateString('en-IN')}</p>
            <p style="margin: 5px 0;"><strong>Original Invoice:</strong> #${originalInvoiceNumber}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 5px 0;"><strong>Reason:</strong></p>
            <p style="margin: 5px 0; color: #e65100;">${refundReason}</p>
          </div>
        </div>
      </div>

      <!-- Refund Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 60%;">Description</th>
            <th style="width: 20%;">HSN/SAC</th>
            <th style="width: 20%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Subscription Refund - ${planName}</strong>
              <div class="item-description">Pro-rated refund for unused subscription period</div>
            </td>
            <td>998599</td>
            <td style="text-align: right;">₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tbody>
      </table>

      <!-- GST Reversal -->
      <div class="gst-breakdown" style="background: #ffebee; border-color: #f44336;">
        <h4 style="color: #c62828;">📊 GST Reversal (@ ${gstPercentage}%)</h4>
        ${cgst && sgst ? `
          <div class="gst-row" style="color: #c62828;">
            <span>CGST @ ${gstPercentage/2}%</span>
            <strong>₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div class="gst-row" style="color: #c62828;">
            <span>SGST @ ${gstPercentage/2}%</span>
            <strong>₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        ${igst ? `
          <div class="gst-row" style="color: #c62828;">
            <span>IGST @ ${gstPercentage}%</span>
            <strong>₹${igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        <div class="gst-row" style="border-top: 2px solid #f44336; margin-top: 10px; padding-top: 10px; color: #c62828;">
          <span><strong>Total GST Refund</strong></span>
          <strong>₹${((cgst || 0) + (sgst || 0) + (igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Totals -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Refund Amount</span>
          <strong>₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax">
          <span>GST Refund (${gstPercentage}%)</span>
          <strong>₹${((cgst || 0) + (sgst || 0) + (igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);">
          <span>TOTAL REFUND AMOUNT</span>
          <strong>₹${totalRefund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 14px; color: #666;">
          <strong>Amount in Words:</strong> 
          <span style="color: #333; text-transform: capitalize;">Rupees ${numberToWords(totalRefund)} Only</span>
        </p>
      </div>

      <!-- Refund Information -->
      <div class="payment-info">
        <h4>🔄 Refund Details</h4>
        <div class="payment-detail">
          <span class="label">Refund Method:</span>
          <span class="value">${refundMethod}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Processing Date:</span>
          <span class="value">${new Date(refundDate).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Expected Credit:</span>
          <span class="value">5-7 Business Days</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color: #ff9800; font-weight: bold;">🔄 PROCESSING</span>
        </div>
      </div>

      <!-- Notes -->
      <div class="notes-section">
        <h4>📝 Important Information</h4>
        <p>
          • This credit note is issued against original invoice #${originalInvoiceNumber}<br>
          • Refund amount will be credited to your original payment method<br>
          • Processing time: 5-7 business days for bank transfers<br>
          • GST credit will be reversed in your tax records<br>
          • For queries, contact ${companyDetails.email}
        </p>
      </div>

      <!-- Digital Stamp -->
      <div class="stamp-section">
        <div class="stamp" style="border-color: #ff9800;">
          <div class="stamp-text" style="color: #ff9800;">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top: 20px; font-style: italic; color: #ff9800;">For ${companyDetails.name}</p>
          </div>
        </div>
      </div>

      <!-- Download Button -->
      <div class="download-section">
        <a href="${appConfig.appUrl}/credit-notes/${creditNoteNumber}/download" class="download-button" style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);">
          📄 Download Credit Note
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber: creditNoteNumber });
};
















// NEW ================================================================================










// ═══════════════════════════════════════════════════════════════
// 1️⃣  ESCROW FUNDED — Client GST Invoice
//     Triggered: verifyPayment() in escrow.controller.js
// ═══════════════════════════════════════════════════════════════
export const escrowPaymentInvoiceTemplate = ({
  clientName,
  clientEmail,
  clientAddress,
  clientGSTIN,
  invoiceNumber,
  invoiceDate,
  jobTitle,
  jobDescription,
  employeeName,
  baseAmount,
  platformFee,
  gstPercentage = 18,
  cgst,
  sgst,
  igst,
  totalAmount,
  paymentId,
  orderId,
  paymentMethod,
  paymentDate,
  escrowId,
  companyDetails = {
    name:    appConfig.appName,
    address: '123 Business Park, Tech City, Mumbai - 400001',
    gstin:   '27AABCU9603R1ZX',
    pan:     'AABCU9603R',
    email:   appConfig.supportEmail,
    phone:   '+91 1234567890',
  }
}) => {
  const totalGST = (cgst || 0) + (sgst || 0) + (igst || 0);

  const content = `
    <div class="header">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">ESCROW INVOICE</div>
        <div class="invoice-number">#${invoiceNumber}</div>
      </div>
    </div>

    <div class="content">

      <!-- Parties -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>From (Service Provider)</h3>
          <strong>${companyDetails.name}</strong>
          <p>${companyDetails.address}</p>
          <p><strong>GSTIN:</strong> ${companyDetails.gstin}</p>
          <p><strong>PAN:</strong> ${companyDetails.pan}</p>
          <p><strong>Email:</strong> ${companyDetails.email}</p>
          <p><strong>Phone:</strong> ${companyDetails.phone}</p>
        </div>
        <div class="invoice-party">
          <h3>Bill To (Client)</h3>
          <strong>${clientName}</strong>
          <p>${clientEmail}</p>
          ${clientAddress ? `<p>${clientAddress}</p>` : ''}
          ${clientGSTIN
            ? `<p><strong>GSTIN:</strong> ${clientGSTIN}</p>`
            : '<p><em>Unregistered (No GSTIN)</em></p>'
          }
        </div>
      </div>

      <!-- Dates -->
      <div style="display:flex; justify-content:space-between; margin-bottom:30px;">
        <div>
          <p style="font-size:14px; color:#666;">
            <strong>Invoice Date:</strong>
            ${new Date(invoiceDate).toLocaleDateString('en-IN')}
          </p>
          <p style="font-size:14px; color:#666;">
            <strong>Escrow ID:</strong>
            <span style="font-family:monospace;">${escrowId}</span>
          </p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:14px; color:#666;">
            <strong>Status:</strong>
            <span style="color:#4caf50; font-weight:bold;">✅ FUNDS SECURED</span>
          </p>
          <p style="font-size:14px; color:#666;">
            <strong>Payment Date:</strong>
            ${new Date(paymentDate).toLocaleDateString('en-IN')}
          </p>
        </div>
      </div>

      <!-- Escrow Notice -->
      <div style="background:#e8f5e9; border:2px solid #4caf50; border-radius:8px;
                  padding:20px; margin-bottom:30px;">
        <p style="color:#2e7d32; margin:0; font-size:14px;">
          <strong>🔐 Escrow Notice:</strong> Funds are securely held in escrow and will be
          released to the editor only upon your approval of completed work.
          You are protected throughout this transaction.
        </p>
      </div>

      <!-- Line Items -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:50%;">Description</th>
            <th style="width:15%;">HSN/SAC</th>
            <th style="width:15%;">Qty</th>
            <th style="width:20%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${jobTitle}</strong>
              <div class="item-description">${jobDescription || 'Video editing services'}</div>
              <div class="item-description"><em>Editor: ${employeeName}</em></div>
            </td>
            <td>998599</td>
            <td>1</td>
            <td style="text-align:right;">
              ₹${baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr>
            <td>
              <strong>Platform Service Fee</strong>
              <div class="item-description">Escrow protection, payment processing & platform</div>
            </td>
            <td>998599</td>
            <td>1</td>
            <td style="text-align:right;">
              ₹${platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- GST Breakdown -->
      <div class="gst-breakdown">
        <h4>📊 GST Breakdown (@ ${gstPercentage}%)</h4>
        ${cgst && sgst ? `
          <div class="gst-row">
            <span>CGST @ ${gstPercentage / 2}%</span>
            <strong>₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div class="gst-row">
            <span>SGST @ ${gstPercentage / 2}%</span>
            <strong>₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        ${igst ? `
          <div class="gst-row">
            <span>IGST @ ${gstPercentage}%</span>
            <strong>₹${igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        <div class="gst-row"
             style="border-top:2px solid #2196f3; margin-top:10px; padding-top:10px;">
          <span><strong>Total GST</strong></span>
          <strong>₹${totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Totals -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Subtotal</span>
          <strong>₹${(baseAmount + platformFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax">
          <span>GST (${gstPercentage}%)</span>
          <strong>₹${totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total">
          <span>TOTAL AMOUNT PAID</span>
          <strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0;">
        <p style="font-size:14px; color:#666;">
          <strong>Amount in Words:</strong>
          <span style="color:#333; text-transform:capitalize;">
            Rupees ${numberToWords(Math.round(totalAmount))} Only
          </span>
        </p>
      </div>

      <!-- Payment Details -->
      <div class="payment-info">
        <h4>💳 Payment Details</h4>
        <div class="payment-detail">
          <span class="label">Payment Method:</span>
          <span class="value">${paymentMethod}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Transaction ID:</span>
          <span class="value">${paymentId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Order ID:</span>
          <span class="value">${orderId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Payment Date:</span>
          <span class="value">${new Date(paymentDate).toLocaleString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color:#4caf50; font-weight:bold;">✅ PAID</span>
        </div>
      </div>

      <div class="notes-section">
        <h4>📝 Important Notes</h4>
        <p>
          • Funds are held securely in escrow until you approve the delivered work.<br>
          • Platform fee covers escrow protection and payment processing.<br>
          • Release payment only after you are satisfied with the delivered work.<br>
          • For disputes, contact ${companyDetails.email}
        </p>
      </div>

      <div class="terms-section">
        <h4>Terms &amp; Conditions</h4>
        <ul>
          <li>Escrow funds are released only upon client approval</li>
          <li>Platform fee is non-refundable</li>
          <li>Project amount refundable per dispute resolution policy</li>
          <li>Subject to Mumbai Jurisdiction</li>
        </ul>
      </div>

      <div class="stamp-section">
        <div class="stamp">
          <div class="stamp-text">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top:20px; font-style:italic; color:#667eea;">
              For ${companyDetails.name}
            </p>
          </div>
        </div>
      </div>

      <div class="download-section">
        <a href="${appConfig.appUrl}/invoices/escrow/${invoiceNumber}/download"
           class="download-button">
          📄 Download PDF Invoice
        </a>
      </div>
    </div>

    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber });
};


// ═══════════════════════════════════════════════════════════════
// 2️⃣  ESCROW RELEASED — Employee Formal Receipt
//     Triggered: releaseEscrow() in escrow.controller.js
// ═══════════════════════════════════════════════════════════════
export const escrowReleaseReceiptTemplate = ({
  employeeName,
  employeeEmail,
  clientName,
  receiptNumber,
  receiptDate,
  jobTitle,
  jobDescription,
  grossAmount,
  platformFee,
  netAmount,
  paymentId,
  escrowId,
  companyDetails = {
    name:    appConfig.appName,
    address: '123 Business Park, Tech City, Mumbai - 400001',
    gstin:   '27AABCU9603R1ZX',
    pan:     'AABCU9603R',
    email:   appConfig.supportEmail,
    phone:   '+91 1234567890',
  }
}) => {
  const content = `
    <div class="header" style="background:linear-gradient(135deg,#4caf50 0%,#388e3c 100%);">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">PAYMENT RECEIPT</div>
        <div class="invoice-number">#${receiptNumber}</div>
      </div>
    </div>

    <div class="content">

      <!-- Parties -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>Paid By</h3>
          <strong>${clientName}</strong>
          <p><em>Via ${companyDetails.name} Escrow</em></p>
        </div>
        <div class="invoice-party">
          <h3>Paid To (Employee)</h3>
          <strong>${employeeName}</strong>
          <p>${employeeEmail}</p>
        </div>
      </div>

      <!-- Success Banner -->
      <div style="background:#e8f5e9; border:2px solid #4caf50; border-radius:8px;
                  padding:30px; text-align:center; margin-bottom:30px;">
        <div style="font-size:48px; margin-bottom:10px;">✅</div>
        <div style="font-size:36px; font-weight:bold; color:#4caf50;">
          ₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
        <div style="color:#666; margin-top:8px;">Successfully Credited to Your Wallet</div>
      </div>

      <!-- Earnings Breakdown -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:60%;">Description</th>
            <th style="width:20%;">HSN/SAC</th>
            <th style="width:20%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>${jobTitle}</strong>
              <div class="item-description">${jobDescription || 'Video editing services'}</div>
              <div class="item-description"><em>Client: ${clientName}</em></div>
            </td>
            <td>998599</td>
            <td style="text-align:right;">
              ₹${grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr style="color:#f44336;">
            <td>
              <strong>Platform Fee Deducted</strong>
              <div class="item-description">10% platform commission</div>
            </td>
            <td>—</td>
            <td style="text-align:right; color:#f44336;">
              - ₹${platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Net Payout -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Gross Amount</span>
          <strong>₹${grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax" style="color:#f44336;">
          <span>Platform Fee (10%)</span>
          <strong>- ₹${platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total"
             style="background:linear-gradient(135deg,#4caf50 0%,#388e3c 100%);">
          <span>NET AMOUNT RECEIVED</span>
          <strong>₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0;">
        <p style="font-size:14px; color:#666;">
          <strong>Amount in Words:</strong>
          <span style="color:#333; text-transform:capitalize;">
            Rupees ${numberToWords(Math.round(netAmount))} Only
          </span>
        </p>
      </div>

      <!-- Payment Details -->
      <div class="payment-info">
        <h4>💳 Transaction Details</h4>
        <div class="payment-detail">
          <span class="label">Transaction ID:</span>
          <span class="value">${paymentId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Escrow ID:</span>
          <span class="value">${escrowId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Receipt Date:</span>
          <span class="value">${new Date(receiptDate).toLocaleString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Credited To:</span>
          <span class="value">${companyDetails.name} Wallet</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color:#4caf50; font-weight:bold;">✅ CREDITED</span>
        </div>
      </div>

      <div class="notes-section">
        <h4>📝 Notes</h4>
        <p>
          • Funds are now available in your ${companyDetails.name} wallet.<br>
          • Minimum withdrawal: ₹500. Processing time: 2-5 business days.<br>
          • Keep this receipt for your income tax records.<br>
          • For queries contact ${companyDetails.email}
        </p>
      </div>

      <div class="stamp-section">
        <div class="stamp" style="border-color:#4caf50;">
          <div class="stamp-text" style="color:#4caf50;">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top:20px; font-style:italic; color:#4caf50;">
              For ${companyDetails.name}
            </p>
          </div>
        </div>
      </div>

      <div class="download-section">
        <a href="${appConfig.appUrl}/receipts/escrow/${receiptNumber}/download"
           class="download-button"
           style="background:linear-gradient(135deg,#4caf50 0%,#388e3c 100%);">
          📄 Download Receipt
        </a>
      </div>
    </div>

    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber: receiptNumber });
};


// ═══════════════════════════════════════════════════════════════
// 3️⃣  ESCROW REFUNDED — Client Credit Note
//     Triggered: resolveDispute('refund_to_client') OR
//                processExpiredEscrows auto-refund (cron)
// ═══════════════════════════════════════════════════════════════
export const escrowRefundCreditNoteTemplate = ({
  clientName,
  clientEmail,
  clientGSTIN,
  creditNoteNumber,
  originalInvoiceNumber,
  issueDate,
  jobTitle,
  employeeName,
  refundAmount,
  platformFee,
  refundReason,
  gstPercentage = 18,
  cgst,
  sgst,
  igst,
  totalRefund,
  refundMethod,
  estimatedCreditDays = 7,
  escrowId,
  companyDetails = {
    name:    appConfig.appName,
    address: '123 Business Park, Tech City, Mumbai - 400001',
    gstin:   '27AABCU9603R1ZX',
    pan:     'AABCU9603R',
    email:   appConfig.supportEmail,
    phone:   '+91 1234567890',
  }
}) => {
  const totalGST = (cgst || 0) + (sgst || 0) + (igst || 0);

  const content = `
    <div class="header" style="background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);">
      <div class="header-left">
        <h1>${companyDetails.name}</h1>
        <p>Professional Video Editing Platform</p>
      </div>
      <div class="header-right">
        <div class="invoice-badge">ESCROW CREDIT NOTE</div>
        <div class="invoice-number">#${creditNoteNumber}</div>
      </div>
    </div>

    <div class="content">

      <!-- Parties -->
      <div class="invoice-header">
        <div class="invoice-party">
          <h3>From (Service Provider)</h3>
          <strong>${companyDetails.name}</strong>
          <p>${companyDetails.address}</p>
          <p><strong>GSTIN:</strong> ${companyDetails.gstin}</p>
          <p><strong>PAN:</strong> ${companyDetails.pan}</p>
          <p><strong>Email:</strong> ${companyDetails.email}</p>
          <p><strong>Phone:</strong> ${companyDetails.phone}</p>
        </div>
        <div class="invoice-party">
          <h3>Credit To (Client)</h3>
          <strong>${clientName}</strong>
          <p>${clientEmail}</p>
          ${clientGSTIN
            ? `<p><strong>GSTIN:</strong> ${clientGSTIN}</p>`
            : ''
          }
        </div>
      </div>

      <!-- Credit Note Info -->
      <div style="background:#fff3e0; border:2px solid #ff9800; border-radius:8px;
                  padding:20px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between;">
          <div>
            <p style="margin:5px 0; font-size:14px;">
              <strong>Credit Note Date:</strong>
              ${new Date(issueDate).toLocaleDateString('en-IN')}
            </p>
            <p style="margin:5px 0; font-size:14px;">
              <strong>Original Invoice:</strong> #${originalInvoiceNumber}
            </p>
            <p style="margin:5px 0; font-size:14px;">
              <strong>Escrow ID:</strong>
              <span style="font-family:monospace;">${escrowId}</span>
            </p>
          </div>
          <div style="text-align:right;">
            <p style="margin:5px 0; font-size:14px;"><strong>Reason:</strong></p>
            <p style="margin:5px 0; color:#e65100;">${refundReason}</p>
          </div>
        </div>
      </div>

      <!-- Refund Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width:55%;">Description</th>
            <th style="width:15%;">HSN/SAC</th>
            <th style="width:15%;">Type</th>
            <th style="width:15%;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Escrow Refund — ${jobTitle}</strong>
              <div class="item-description">
                Full project amount refunded to client
              </div>
              <div class="item-description">
                <em>Editor: ${employeeName}</em>
              </div>
            </td>
            <td>998599</td>
            <td>Refund</td>
            <td style="text-align:right;">
              ₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
          <tr style="color:#999;">
            <td>
              <strong>Platform Fee</strong>
              <div class="item-description">Non-refundable per Terms of Service</div>
            </td>
            <td>—</td>
            <td>Retained</td>
            <td style="text-align:right; color:#f44336;">
              ₹${platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- GST Reversal -->
      <div class="gst-breakdown" style="background:#ffebee; border-color:#f44336;">
        <h4 style="color:#c62828;">📊 GST Reversal (@ ${gstPercentage}%)</h4>
        ${cgst && sgst ? `
          <div class="gst-row" style="color:#c62828;">
            <span>CGST @ ${gstPercentage / 2}%</span>
            <strong>₹${cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div class="gst-row" style="color:#c62828;">
            <span>SGST @ ${gstPercentage / 2}%</span>
            <strong>₹${sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        ${igst ? `
          <div class="gst-row" style="color:#c62828;">
            <span>IGST @ ${gstPercentage}%</span>
            <strong>₹${igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        ` : ''}
        <div class="gst-row"
             style="border-top:2px solid #f44336; margin-top:10px; padding-top:10px; color:#c62828;">
          <span><strong>Total GST Refund</strong></span>
          <strong>₹${totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Totals -->
      <div class="invoice-totals">
        <div class="total-row subtotal">
          <span>Project Refund</span>
          <strong>₹${refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row tax">
          <span>GST Refund (${gstPercentage}%)</span>
          <strong>₹${totalGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
        <div class="total-row grand-total"
             style="background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);">
          <span>TOTAL REFUND AMOUNT</span>
          <strong>₹${totalRefund.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin:20px 0;">
        <p style="font-size:14px; color:#666;">
          <strong>Amount in Words:</strong>
          <span style="color:#333; text-transform:capitalize;">
            Rupees ${numberToWords(Math.round(totalRefund))} Only
          </span>
        </p>
      </div>

      <!-- Refund Details -->
      <div class="payment-info">
        <h4>🔄 Refund Details</h4>
        <div class="payment-detail">
          <span class="label">Refund Method:</span>
          <span class="value">${refundMethod}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Processing Date:</span>
          <span class="value">${new Date(issueDate).toLocaleDateString('en-IN')}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Expected Credit:</span>
          <span class="value">${estimatedCreditDays} Business Days</span>
        </div>
        <div class="payment-detail">
          <span class="label">Escrow ID:</span>
          <span class="value" style="font-family:monospace;">${escrowId}</span>
        </div>
        <div class="payment-detail">
          <span class="label">Status:</span>
          <span class="value" style="color:#ff9800; font-weight:bold;">🔄 PROCESSING</span>
        </div>
      </div>

      <div class="notes-section">
        <h4>📝 Important Information</h4>
        <p>
          • Refund issued against original invoice #${originalInvoiceNumber}.<br>
          • Platform fee of ₹${platformFee.toLocaleString('en-IN')} is non-refundable.<br>
          • Refund will be credited to your original payment method.<br>
          • Processing time: ${estimatedCreditDays} business days.<br>
          • GST credit will be reversed in your records.<br>
          • For queries, contact ${companyDetails.email}
        </p>
      </div>

      <div class="stamp-section">
        <div class="stamp" style="border-color:#ff9800;">
          <div class="stamp-text" style="color:#ff9800;">Authorized Signatory</div>
          <div class="stamp-signature">
            <p style="margin-top:20px; font-style:italic; color:#ff9800;">
              For ${companyDetails.name}
            </p>
          </div>
        </div>
      </div>

      <div class="download-section">
        <a href="${appConfig.appUrl}/credit-notes/escrow/${creditNoteNumber}/download"
           class="download-button"
           style="background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);">
          📄 Download Credit Note
        </a>
      </div>
    </div>

    <div class="invoice-footer">
      <p><strong>${companyDetails.name}</strong></p>
      <p>${companyDetails.address}</p>
      <p>GSTIN: ${companyDetails.gstin} | PAN: ${companyDetails.pan}</p>
      <p>Email: ${companyDetails.email} | Phone: ${companyDetails.phone}</p>
    </div>
  `;

  return invoiceTemplate(content, { invoiceNumber: creditNoteNumber });
};






