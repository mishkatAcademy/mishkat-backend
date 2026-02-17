// Placeholder واجهة تكامل Moyasar — استبدلها بنداء فعلي لـ API
// الفكرة: ترجع paymentId + paymentUrl + amount
export interface CreatePaymentInput {
  amountHalalas: number;
  currency: 'SAR';
  description?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  failUrl?: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  paymentUrl: string;
  amountHalalas: number;
}

export async function createMoyasarPayment(
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  // TODO: نفّذ نداء API الحقيقي هنا
  // مؤقتًا: رجّع نتائج وهمية (للاختبار المحلي)
  const paymentId = `pay_${Math.random().toString(36).slice(2, 10)}`;
  const paymentUrl = `https://pay.example.com/${paymentId}`;
  return {
    paymentId,
    paymentUrl,
    amountHalalas: input.amountHalalas,
  };
}

/** (Webhook) مثال توحيد payload */
export interface MoyasarWebhookPayload {
  id: string;
  status: 'paid' | 'failed';
  amount: number | string;
  currency?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}
