# Commerce admission

New paid purchases and services are retired. Price research, free participation,
existing records and agreed obligations remain supported.

- `POST /api/digital-marketplace/[listingId]` and `POST /api/digitisation` return
  410 before creating a purchase or paid request. Their service entry points
  reject direct calls too. Delisting, redemption and existing request handling
  remain available.
- New proposal-to-trade admission and matching auto-accept permit only DIRECT
  trades with zero net settlement for every participant. AUTHENTICATED trades
  create verification-fee obligations and cannot be newly admitted.
- Both admission paths record `admission: unpaid-direct-v1` on the initial
  PROPOSED history event. Only marked records receive the later price/hold and
  paid-authentication-upgrade checks. No date cutoff, migration or backfill is
  used; unmarked records from older releases retain their existing lifecycle.
- Shared Stripe adapters, existing trade payments, capture, cancellation,
  refunds, webhook reconciliation, withdrawals and payout onboarding remain.

## Legacy funding limitation

`POST /api/wallet/deposit` and `POST /api/wallet/create-payment-intent` remain
available because earlier wallet-funded obligations may need a top-up. The UI
labels this flow for existing obligations. The API accepts an amount and payment
method without a trade reference: this wording is not an enforced spending cap.
Do not describe fresh wallet funding as technically closed.

A later change can bind funding to an authenticated existing obligation, derive
its outstanding amount from authoritative records and test concurrent payment,
cancellation and settlement before retiring the unbound endpoints. Do not remove
those endpoints first and strand existing participants.
