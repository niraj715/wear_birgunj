import { Inject, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../db/database.service.js';
import { AuditService } from '../../common/audit.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import { sanitizeText } from '../../common/crypto.util.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  reply: string;
  source: 'gemini' | 'rule_based_fallback';
  suggestedActions?: Array<{ label: string; action: string; payload?: any }>;
}

@Injectable()
export class GeminiSupportService {
  private readonly logger = new Logger(GeminiSupportService.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  private checkRateLimit(key: string, max = 15, windowMs = 60_000): void {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    if (!entry || entry.resetAt < now) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      throw new AppDomainError(
        'SUPPORT_RATE_LIMITED',
        'You have sent too many support requests in a short time. Please wait a minute.',
        429,
      );
    }
  }

  /**
   * Safe rule-based FAQ fallback that answers customer questions accurately
   * when Gemini API is unconfigured or temporarily unavailable.
   */
  private generateFaqFallback(
    query: string,
    customerOrders: any[],
  ): ChatResponse {
    const q = query.toLowerCase();

    // 1. Order Tracking queries
    if (q.includes('track') || q.includes('order') || q.includes('where is')) {
      if (customerOrders.length > 0) {
        const latest = customerOrders[0];
        const orderNum = latest.order_number.startsWith('#') ? latest.order_number : `#${latest.order_number}`;
        return {
          reply: `Here is the status of your recent order ${orderNum}:\n` +
            `• Status: ${latest.status}\n` +
            `• Delivery ETA: ${latest.estimated_delivery_text || '2-4 Hours in Birgunj'}\n` +
            `• Courier: Rajesh Kumar (Birgunj Express Local, +977 9812345678)\n` +
            `• Total: NPR ${(latest.total_paisa / 100).toLocaleString()}`,
          source: 'rule_based_fallback',
          suggestedActions: [
            { label: 'View Order Tracking', action: 'NAVIGATE', payload: `/track/${latest.id}` },
            { label: 'Request Return / Exchange', action: 'NAVIGATE', payload: `/returns?orderId=${latest.id}` },
          ],
        };
      }
      return {
        reply: "You don't have any active orders right now. When you place an order, deliveries within Birgunj Wards 1-32 arrive within 2-4 hours via our local courier partner Rajesh Kumar.",
        source: 'rule_based_fallback',
        suggestedActions: [
          { label: 'Browse Products', action: 'NAVIGATE', payload: '/products' },
        ],
      };
    }

    // 2. Returns and Exchanges
    if (q.includes('return') || q.includes('exchange') || q.includes('refund') || q.includes('damage') || q.includes('size')) {
      return {
        reply: "Wear Birgunj offers a 36-Hour Easy Return & Exchange policy! For delivered items, you can request an exchange for another size/color or request a return for a refund within 36 hours of delivery. Our courier will pick up the item right from your address in Birgunj.",
        source: 'rule_based_fallback',
        suggestedActions: [
          { label: 'Open Return / Exchange Form', action: 'MODAL', payload: 'RETURN_EXCHANGE' },
          { label: 'View Return Policy', action: 'MODAL', payload: 'POLICY' },
        ],
      };
    }

    // 3. Payment Methods
    if (q.includes('pay') || q.includes('esewa') || q.includes('khalti') || q.includes('cod') || q.includes('cash')) {
      return {
        reply: "We support three trusted payment methods in Birgunj:\n1. eSewa (instant digital wallet)\n2. Khalti (instant digital wallet)\n3. Cash on Delivery (pay our delivery partner Rajesh Kumar upon arrival). All prices include 13% Nepal VAT.",
        source: 'rule_based_fallback',
        suggestedActions: [
          { label: 'View Cart', action: 'NAVIGATE', payload: '/cart' },
        ],
      };
    }

    // 4. Delivery SLA
    if (q.includes('delivery') || q.includes('time') || q.includes('fast') || q.includes('hours') || q.includes('shipping')) {
      return {
        reply: "All orders in Birgunj are fulfilled via our Express Local Delivery partner, Rajesh Kumar, with a guaranteed 2 to 4 hour delivery window across Wards 1 through 32 (Ghantaghar, Adarsh Nagar, Pipra, Maisthan, Murli, and surrounding toles).",
        source: 'rule_based_fallback',
      };
    }

    // Default Fallback
    return {
      reply: "Namaste! I am your Wear Birgunj Support Assistant. I can help you with tracking your Birgunj local orders, our 36-hour return/exchange policy, payment options (eSewa, Khalti, COD), or connecting you with a human support agent.",
      source: 'rule_based_fallback',
      suggestedActions: [
        { label: 'Track My Order', action: 'PROMPT', payload: 'Where is my order?' },
        { label: 'Return / Exchange Policy', action: 'PROMPT', payload: 'How do returns work?' },
        { label: 'Speak with Support Agent', action: 'MODAL', payload: 'TICKET' },
      ],
    };
  }

  /**
   * Processes a customer chat interaction with strict authorization and rate limiting.
   */
  async handleChat(
    message: string,
    customerContext?: { userId: string; email: string },
    ipAddress = '127.0.0.1',
  ): Promise<ChatResponse> {
    const sanitizedMsg = sanitizeText(message).trim();
    if (!sanitizedMsg || sanitizedMsg.length > 1000) {
      throw new AppDomainError(
        'INVALID_MESSAGE_LENGTH',
        'Support message must be between 1 and 1000 characters.',
        400,
      );
    }

    const rateKey = customerContext?.userId || ipAddress;
    this.checkRateLimit(rateKey);

    // Fetch authenticated customer's own recent orders (IDOR protected: strictly WHERE customer_id = $1)
    let customerOrders: any[] = [];
    if (customerContext?.userId) {
      const ordersRes = await this.db.query(
        `SELECT id, order_number, status, total_paisa, estimated_delivery_text, created_at
         FROM orders
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 3`,
        [customerContext.userId],
      );
      customerOrders = ordersRes.rows;
    }

    // If Gemini API is not configured or in fallback mode:
    if (!this.isConfigured()) {
      return this.generateFaqFallback(sanitizedMsg, customerOrders);
    }

    // Call upstream Gemini API using official Google Generative AI REST endpoint
    try {
      const systemInstruction = `You are the polite, helpful customer service assistant for "Wear Birgunj", a premium multivendor e-commerce fashion marketplace in Birgunj, Madhesh Province, Nepal.
Platform Rules:
1. Delivery SLA: 2 to 4 hours in Birgunj Wards 1-32 via courier Rajesh Kumar (+977 9812345678).
2. Payments: eSewa, Khalti, and Cash on Delivery (COD). All prices in NPR including 13% VAT.
3. Returns/Exchanges: Easy 36-hour exchange/return window for delivered items.
4. You CANNOT cancel orders, issue refunds, or approve returns yourself. Always guide the user to the official Return form or to open a support case.
5. Customer order context: ${JSON.stringify(customerOrders.map(o => ({ orderNumber: o.order_number, status: o.status, totalNpr: o.total_paisa / 100 })))}.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\nCustomer question: ${sanitizedMsg}` }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 500,
              temperature: 0.3,
            },
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Gemini API call failed with status ${response.status}. Falling back to rule-based engine.`);
        return this.generateFaqFallback(sanitizedMsg, customerOrders);
      }

      const data: any = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedText) {
        return this.generateFaqFallback(sanitizedMsg, customerOrders);
      }

      return {
        reply: generatedText.trim(),
        source: 'gemini',
        suggestedActions: [
          { label: 'Track Order', action: 'NAVIGATE', payload: '/orders' },
          { label: 'Return / Exchange', action: 'MODAL', payload: 'RETURN_EXCHANGE' },
          { label: 'Create Support Ticket', action: 'MODAL', payload: 'TICKET' },
        ],
      };
    } catch (err) {
      this.logger.warn('Error calling Gemini API, using safe FAQ fallback', err);
      return this.generateFaqFallback(sanitizedMsg, customerOrders);
    }
  }

  /**
   * Persists a customer support case and initial message in the database.
   */
  async createSupportTicket(opts: {
    customerId: string;
    orderId?: string;
    subject: string;
    category: string;
    description: string;
  }): Promise<any> {
    const caseId = `case-${crypto.randomUUID()}`;
    const caseNumber = `CASE-${Date.now().toString().slice(-6)}`;
    const msgId = `msg-${crypto.randomUUID()}`;

    return this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO support_cases (
          id, case_number, customer_id, order_id, subject, category,
          description, status, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', 'MEDIUM')`,
        [
          caseId,
          caseNumber,
          opts.customerId,
          opts.orderId || null,
          sanitizeText(opts.subject),
          opts.category,
          sanitizeText(opts.description),
        ],
      );

      await tx.query(
        `INSERT INTO support_messages (
          id, case_id, sender_role, sender_id, message_text, is_internal
        ) VALUES ($1, $2, 'CUSTOMER', $3, $4, FALSE)`,
        [msgId, caseId, opts.customerId, sanitizeText(opts.description)],
      );

      await this.audit.log(
        {
          actorId: opts.customerId,
          actorRole: 'CUSTOMER',
          action: 'SUPPORT_CASE_CREATED',
          targetType: 'SUPPORT_CASE',
          targetId: caseId,
          reason: sanitizeText(opts.subject),
        },
        tx,
      );

      const created = await tx.query('SELECT * FROM support_cases WHERE id = $1', [caseId]);
      return created.rows[0];
    });
  }
}
