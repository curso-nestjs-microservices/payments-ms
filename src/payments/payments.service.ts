import Stripe from 'stripe';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { envs, NATS_SERVICE } from 'src/config';
import { PaymentSessionDto } from './dto';
import { PaymentPatterns } from './enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe = new Stripe(envs.stripeSecret);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {}

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {
    const { currency, items, orderId } = paymentSessionDto;
    // Transform DTO to lineItems for Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: currency,
        product_data: {
          name: item.name,
        },
        // Stripe dosen't accept values as decimals
        // For Stripe 9999 is equals to 99.99, but only takes 2 decimals so we round the rest of them
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Create payment on Stripe
    const session = await this.stripe.checkout.sessions.create({
      // Require oreder ID
      payment_intent_data: {
        metadata: { orderId },
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    // Return strictly necessary info
    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    };
  }

  success() {
    return `success`;
  }

  cancel() {
    return `cancel`;
  }

  stripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];

    const endpointSecret = envs.stripeEndpointSecret;

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        req['rawBody'],
        sig,
        endpointSecret,
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'charge.succeeded') {
      const chargeSucceeded = event.data.object;
      const payload = {
        stripeChargeId: chargeSucceeded.id,
        orderId: chargeSucceeded.metadata.orderId,
        receiptUrl: chargeSucceeded.receipt_url,
      };
      // this.logger.log(JSON.stringify(payload));
      this.client.emit(PaymentPatterns.paymentSucceeded, payload);
    } else {
      this.logger.warn(`Event ${event.type} not handled`);
    }

    return res.status(200).json({ sig });
  }
}
