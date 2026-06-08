import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, toCategory, type Category } from "@/lib/categories";

// Actions the chat assistant may PROPOSE. They are never executed until the
// user confirms in the UI, and execution always runs through executeAction
// against the user's RLS-scoped client. `summary` is a localized one-liner the
// model writes for the confirm card (display only).

export type AiAction =
  | {
      type: "add_expense";
      note: string;
      amount: number;
      category: Category;
      summary: string;
    }
  | { type: "add_income"; source: string; amount: number; summary: string }
  | {
      type: "add_debt";
      person: string;
      amount: number;
      direction: "lent" | "borrowed";
      summary: string;
    }
  | { type: "set_budget"; amount: number; summary: string }
  | {
      type: "create_goal";
      title: string;
      target_amount: number;
      target_date: string | null;
      summary: string;
    }
  | { type: "contribute_goal"; goal_id: string; amount: number; summary: string }
  | { type: "settle_debt"; debt_id: string; summary: string };

export type AiActionType = AiAction["type"];

// Human-readable action list for the system prompt.
export const ACTION_TYPES: AiActionType[] = [
  "add_expense",
  "add_income",
  "add_debt",
  "set_budget",
  "create_goal",
  "contribute_goal",
  "settle_debt",
];

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function posInt(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates one raw action object (from the model or the client) into a clean
 * AiAction, or null if it's malformed. Defensive on both the propose and the
 * execute path.
 */
export function normalizeAction(raw: unknown): AiAction | null {
  const r = rec(raw);
  if (!r) return null;
  const summary = str(r.summary).slice(0, 200);

  switch (r.type) {
    case "add_expense": {
      const note = str(r.note);
      const amount = posInt(r.amount);
      if (!note || amount === null) return null;
      return {
        type: "add_expense",
        note,
        amount,
        category: toCategory(r.category),
        summary: summary || `${note} — ${amount}`,
      };
    }
    case "add_income": {
      const source = str(r.source);
      const amount = posInt(r.amount);
      if (!source || amount === null) return null;
      return { type: "add_income", source, amount, summary: summary || source };
    }
    case "add_debt": {
      const person = str(r.person);
      const amount = posInt(r.amount);
      if (!person || amount === null) return null;
      if (r.direction !== "lent" && r.direction !== "borrowed") return null;
      return {
        type: "add_debt",
        person,
        amount,
        direction: r.direction,
        summary: summary || person,
      };
    }
    case "set_budget": {
      const amount = posInt(r.amount);
      if (amount === null) return null;
      return { type: "set_budget", amount, summary: summary || `${amount}` };
    }
    case "create_goal": {
      const title = str(r.title);
      const target = posInt(r.target_amount);
      if (!title || target === null) return null;
      const date = str(r.target_date);
      return {
        type: "create_goal",
        title,
        target_amount: target,
        target_date: DATE_RE.test(date) ? date : null,
        summary: summary || title,
      };
    }
    case "contribute_goal": {
      const goalId = str(r.goal_id);
      const amount = posInt(r.amount);
      if (!goalId || amount === null) return null;
      return {
        type: "contribute_goal",
        goal_id: goalId,
        amount,
        summary: summary || `${amount}`,
      };
    }
    case "settle_debt": {
      const debtId = str(r.debt_id);
      if (!debtId) return null;
      return { type: "settle_debt", debt_id: debtId, summary: summary || "" };
    }
    default:
      return null;
  }
}

export function normalizeActions(raw: unknown): AiAction[] {
  return Array.isArray(raw)
    ? raw.map(normalizeAction).filter((a): a is AiAction => a !== null)
    : [];
}

type ExecResult = { ok: boolean; error?: string };

/**
 * Performs a confirmed action against the user's RLS-scoped Supabase client.
 * Ownership of referenced goals/debts is re-checked here, not trusted.
 */
export async function executeAction(
  supabase: SupabaseClient,
  userId: string,
  action: AiAction,
): Promise<ExecResult> {
  switch (action.type) {
    case "add_expense": {
      const { error } = await supabase.from("expenses").insert({
        user_id: userId,
        raw_text: action.note,
        note: action.note,
        amount: action.amount,
        category: action.category,
        currency: "UZS",
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "add_income": {
      const { error } = await supabase.from("incomes").insert({
        user_id: userId,
        source: action.source,
        amount: action.amount,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "add_debt": {
      const { error } = await supabase.from("debts").insert({
        user_id: userId,
        person: action.person,
        amount: action.amount,
        direction: action.direction,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "set_budget": {
      // The app reads the most recent overall budget, so a new row wins.
      const { error } = await supabase.from("budgets").insert({
        user_id: userId,
        category: null,
        monthly_limit: action.amount,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "create_goal": {
      const { error } = await supabase.from("goals").insert({
        user_id: userId,
        title: action.title,
        target_amount: action.target_amount,
        saved_amount: 0,
        target_date: action.target_date,
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "contribute_goal": {
      const { data: goal } = await supabase
        .from("goals")
        .select("id, saved_amount")
        .eq("id", action.goal_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!goal) return { ok: false, error: "Goal not found" };
      const newSaved = Math.max(0, Number(goal.saved_amount) + action.amount);
      const { error } = await supabase
        .from("goals")
        .update({ saved_amount: newSaved })
        .eq("id", action.goal_id)
        .eq("user_id", userId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    case "settle_debt": {
      const { data: debt } = await supabase
        .from("debts")
        .select("id")
        .eq("id", action.debt_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!debt) return { ok: false, error: "Debt not found" };
      const { error } = await supabase
        .from("debts")
        .update({ settled: true })
        .eq("id", action.debt_id)
        .eq("user_id", userId);
      return error ? { ok: false, error: error.message } : { ok: true };
    }
    default:
      return { ok: false, error: "Unknown action" };
  }
}

// Used in the system prompt so the model knows the valid category values.
export const CATEGORY_LIST = CATEGORIES.join(", ");
