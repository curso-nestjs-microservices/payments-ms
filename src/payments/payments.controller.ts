import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { PaymentSessionDto } from './dto';
import { PaymentPatterns } from './enums';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-payment-session')
  @MessagePattern(PaymentPatterns.createPaymentSession)
  createPaymentSession(@Body() paymentSessionDto: PaymentSessionDto) {
    return this.paymentsService.createPaymentSession(paymentSessionDto);
  }

  @Get('success')
  success() {
    return this.paymentsService.success();
  }

  @Get('cancel')
  cancel() {
    return this.paymentsService.cancel();
  }

  @Post('webhook')
  async stripeHebhook(@Req() req: Request, @Res() res: Response) {
    return this.paymentsService.stripeWebhook(req, res);
  }
}
