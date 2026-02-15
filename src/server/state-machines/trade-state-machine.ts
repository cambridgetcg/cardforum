/**
 * Trade State Machine — Extracted from domain.ts hardcoded transition maps.
 *
 * Provides a configurable, event-driven state machine for trade lifecycle.
 * The transition definitions can be overridden at runtime via config service,
 * enabling per-TCG flows, A/B testing, and new state additions without code changes.
 *
 * Usage:
 *   const machine = createTradeStateMachine("AUTHENTICATED");
 *   const result = machine.transition("PROPOSED", "ACCEPTED", context);
 *   if (result.allowed) { ... }
 */

import type { TradeStatus, TradeMode } from "@/types/domain";

// ─── Types ───────────────────────────────────────────

export interface TransitionContext {
  tradeId: string;
  userId: string;
  mode: TradeMode;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  allowed: boolean;
  from: TradeStatus;
  to: TradeStatus;
  reason?: string;
}

export type TransitionGuard = (
  from: TradeStatus,
  to: TradeStatus,
  context: TransitionContext,
) => boolean | string; // true = allowed, string = rejection reason

export type TransitionEffect = (
  from: TradeStatus,
  to: TradeStatus,
  context: TransitionContext,
) => void | Promise<void>;

export interface TransitionDefinition {
  targets: TradeStatus[];
  guards?: TransitionGuard[];
  effects?: TransitionEffect[];
}

export interface StateMachineConfig {
  transitions: Record<TradeStatus, TransitionDefinition>;
  terminalStates: TradeStatus[];
}

// ─── Default Configurations ──────────────────────────

const AUTHENTICATED_CONFIG: StateMachineConfig = {
  transitions: {
    PROPOSED: { targets: ["ACCEPTED", "REJECTED", "CANCELLED"] },
    ACCEPTED: { targets: ["ESCROWED", "CANCELLED", "DISPUTED"] },
    ESCROWED: { targets: ["CARDS_SUBMITTED", "CANCELLED", "DISPUTED"] },
    CARDS_SUBMITTED: { targets: ["AUTHENTICATING", "CANCELLED", "DISPUTED"] },
    AUTHENTICATING: { targets: ["VERIFIED", "DISPUTED"] },
    VERIFIED: { targets: ["DELIVERING", "DISPUTED"] },
    DELIVERING: { targets: ["DELIVERED", "DISPUTED"] },
    SHIPPING: { targets: [] },
    DELIVERED: { targets: ["COMPLETED", "DISPUTED"] },
    COMPLETED: { targets: [] },
    REJECTED: { targets: [] },
    CANCELLED: { targets: [] },
    DISPUTED: { targets: ["COMPLETED", "CANCELLED"] },
  },
  terminalStates: ["COMPLETED", "REJECTED", "CANCELLED"],
};

const DIRECT_CONFIG: StateMachineConfig = {
  transitions: {
    PROPOSED: { targets: ["ACCEPTED", "REJECTED", "CANCELLED"] },
    ACCEPTED: { targets: ["ESCROWED", "CANCELLED", "DISPUTED"] },
    ESCROWED: { targets: ["SHIPPING", "CANCELLED", "DISPUTED"] },
    SHIPPING: { targets: ["DELIVERED", "CANCELLED", "DISPUTED"] },
    DELIVERED: { targets: ["COMPLETED", "DISPUTED"] },
    COMPLETED: { targets: [] },
    REJECTED: { targets: [] },
    CANCELLED: { targets: [] },
    DISPUTED: { targets: ["COMPLETED", "CANCELLED"] },
    CARDS_SUBMITTED: { targets: [] },
    AUTHENTICATING: { targets: [] },
    VERIFIED: { targets: [] },
    DELIVERING: { targets: [] },
  },
  terminalStates: ["COMPLETED", "REJECTED", "CANCELLED"],
};

// ─── State Machine ───────────────────────────────────

export class TradeStateMachine {
  private config: StateMachineConfig;
  private globalGuards: TransitionGuard[] = [];
  private globalEffects: TransitionEffect[] = [];

  constructor(config: StateMachineConfig) {
    this.config = config;
  }

  /** Check if a transition is valid without executing it */
  canTransition(from: TradeStatus, to: TradeStatus): boolean {
    const def = this.config.transitions[from];
    return def?.targets.includes(to) ?? false;
  }

  /** Get valid target states from current state */
  getValidTransitions(from: TradeStatus): TradeStatus[] {
    return this.config.transitions[from]?.targets ?? [];
  }

  /** Whether the given state is terminal (no further transitions) */
  isTerminal(state: TradeStatus): boolean {
    return this.config.terminalStates.includes(state);
  }

  /** Attempt a transition, running guards and effects */
  async transition(
    from: TradeStatus,
    to: TradeStatus,
    context: TransitionContext,
  ): Promise<TransitionResult> {
    if (!this.canTransition(from, to)) {
      return { allowed: false, from, to, reason: `Invalid transition: ${from} -> ${to}` };
    }

    const def = this.config.transitions[from];

    // Run guards (global + transition-specific)
    const allGuards = [...this.globalGuards, ...(def.guards ?? [])];
    for (const guard of allGuards) {
      const result = guard(from, to, context);
      if (result !== true) {
        return {
          allowed: false,
          from,
          to,
          reason: typeof result === "string" ? result : `Guard rejected: ${from} -> ${to}`,
        };
      }
    }

    // Run effects (global + transition-specific)
    const allEffects = [...this.globalEffects, ...(def.effects ?? [])];
    for (const effect of allEffects) {
      await effect(from, to, context);
    }

    return { allowed: true, from, to };
  }

  /** Add a global guard that runs on every transition */
  addGuard(guard: TransitionGuard): void {
    this.globalGuards.push(guard);
  }

  /** Add a global effect that runs after every successful transition */
  addEffect(effect: TransitionEffect): void {
    this.globalEffects.push(effect);
  }

  /** Add a guard to a specific transition source state */
  addTransitionGuard(from: TradeStatus, guard: TransitionGuard): void {
    const def = this.config.transitions[from];
    if (def) {
      def.guards = [...(def.guards ?? []), guard];
    }
  }

  /** Add an effect to a specific transition source state */
  addTransitionEffect(from: TradeStatus, effect: TransitionEffect): void {
    const def = this.config.transitions[from];
    if (def) {
      def.effects = [...(def.effects ?? []), effect];
    }
  }

  /** Get the raw configuration (for serialization/storage) */
  getConfig(): StateMachineConfig {
    return this.config;
  }

  /** Replace the configuration (for runtime updates from config service) */
  setConfig(config: StateMachineConfig): void {
    this.config = config;
  }
}

// ─── Factory ─────────────────────────────────────────

export function createTradeStateMachine(mode: TradeMode): TradeStateMachine {
  const config = mode === "DIRECT" ? DIRECT_CONFIG : AUTHENTICATED_CONFIG;
  // Deep clone to prevent shared mutation
  return new TradeStateMachine(JSON.parse(JSON.stringify(config)));
}

export function getDefaultConfig(mode: TradeMode): StateMachineConfig {
  return mode === "DIRECT" ? DIRECT_CONFIG : AUTHENTICATED_CONFIG;
}
