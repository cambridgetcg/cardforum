/**
 * Domain Event Bus — In-process pub/sub for decoupling services.
 *
 * Replaces direct service-to-service imports with event-driven side effects.
 * Events are processed synchronously (in-process) to maintain transaction guarantees.
 * Async processing can be layered on top via queue adapters when needed.
 *
 * Usage:
 *   // Publishing:
 *   eventBus.emit("trade.status_changed", { tradeId, from, to, userId });
 *
 *   // Subscribing (typically in a startup/init file):
 *   eventBus.on("trade.status_changed", async (event) => {
 *     await notifyUser(event.tradeId, event.to);
 *   });
 */

// ─── Event Definitions ──────────────────────────────

export interface DomainEvents {
  // Trade lifecycle
  "trade.proposed": { tradeId: string; proposalId: string; participantIds: string[] };
  "trade.status_changed": { tradeId: string; from: string; to: string; userId?: string };
  "trade.completed": { tradeId: string; participantIds: string[] };
  "trade.cancelled": { tradeId: string; reason?: string; cancelledBy?: string };

  // Matching
  "matching.run_completed": { proposalCount: number; autoAcceptedCount: number };
  "matching.proposal_created": { proposalId: string; score: number; cycleLength: number };

  // Listings
  "listing.created": { listingId: string; type: "have" | "want"; userId: string; cardId: string };
  "listing.deactivated": { listingId: string; type: "have" | "want"; reason: string };

  // Wallet
  "wallet.deposited": { userId: string; amountCents: number; transactionId: string };
  "wallet.withdrawn": { userId: string; amountCents: number; transactionId: string };
  "wallet.hold_placed": { userId: string; amountCents: number; tradeId: string };
  "wallet.hold_released": { userId: string; amountCents: number; tradeId: string };

  // Escrow
  "escrow.created": { escrowId: string; tradeId: string; totalCents: number };
  "escrow.released": { escrowId: string; tradeId: string };
  "escrow.refunded": { escrowId: string; tradeId: string };

  // Authentication
  "authenticator.assigned": { authenticatorId: string; tradeLegId: string; tradeId: string };
  "authenticator.verified": { tradeLegId: string; tradeId: string; authentic: boolean };

  // Shipping
  "shipping.shipped": { tradeLegId: string; trackingNumber: string };
  "shipping.delivered": { tradeLegId: string; tradeId: string };

  // Payout
  "payout.initiated": { payoutId: string; userId: string; amountCents: number };
  "payout.completed": { payoutId: string; userId: string };
  "payout.failed": { payoutId: string; userId: string; reason: string };

  // KYC
  "kyc.status_changed": { userId: string; from: string; to: string };

  // Photos
  "photo.uploaded": { tradeLegId: string; photoCount: number };
  "photo.reviewed": { tradeLegId: string; approved: boolean };
}

// ─── Types ───────────────────────────────────────────

export type EventName = keyof DomainEvents;
export type EventPayload<E extends EventName> = DomainEvents[E];
export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => void | Promise<void>;

interface Subscription {
  id: number;
  handler: EventHandler<EventName>;
}

// ─── Event Bus Implementation ────────────────────────

class DomainEventBus {
  private handlers = new Map<EventName, Subscription[]>();
  private nextId = 1;

  /**
   * Subscribe to a domain event.
   * Returns an unsubscribe function.
   */
  on<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    const id = this.nextId++;
    const subs = this.handlers.get(event) ?? [];
    subs.push({ id, handler: handler as EventHandler<EventName> });
    this.handlers.set(event, subs);

    return () => {
      const current = this.handlers.get(event);
      if (current) {
        this.handlers.set(event, current.filter((s) => s.id !== id));
      }
    };
  }

  /**
   * Subscribe to a domain event, but only fire once.
   */
  once<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    const unsub = this.on(event, (payload) => {
      unsub();
      return handler(payload);
    });
    return unsub;
  }

  /**
   * Emit a domain event. Handlers are called in subscription order.
   * Async handlers are awaited sequentially to preserve ordering guarantees.
   */
  async emit<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    const subs = this.handlers.get(event);
    if (!subs || subs.length === 0) return;

    for (const sub of subs) {
      try {
        await sub.handler(payload);
      } catch (error) {
        console.error(`[EventBus] Handler error for "${event}":`, error);
      }
    }
  }

  /**
   * Emit without awaiting handlers (fire-and-forget).
   * Useful for non-critical side effects like analytics.
   */
  emitAsync<E extends EventName>(event: E, payload: EventPayload<E>): void {
    this.emit(event, payload).catch((err) => {
      console.error(`[EventBus] Async emit error for "${event}":`, err);
    });
  }

  /**
   * Remove all handlers (useful for testing).
   */
  clear(): void {
    this.handlers.clear();
    this.nextId = 1;
  }

  /**
   * Get the number of handlers for an event (useful for testing).
   */
  listenerCount(event: EventName): number {
    return this.handlers.get(event)?.length ?? 0;
  }
}

// ─── Singleton ───────────────────────────────────────

export const eventBus = new DomainEventBus();
