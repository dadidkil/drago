import { describe, expect, it } from "vitest";
import {
  SURVEY_TEMPLATES,
  alertTriggered,
  currentSurveyPeriod,
  lastSurveyPeriodIndex,
  surveyQuestionsSchema,
  validateSurveyAnswers,
  type SurveyQuestion,
} from "./index";

const day = 86_400_000;
const start = new Date("2026-10-05T07:00:00Z"); // понедельник, 10:00 МСК

describe("survey periods", () => {
  const s = { startsAt: start, endsAt: null, periodDays: 14, dueDays: 3 };
  it("no period before start", () => {
    expect(currentSurveyPeriod(s, new Date(start.getTime() - 1))).toBeNull();
    expect(lastSurveyPeriodIndex(s, new Date(start.getTime() - 1))).toBe(-1);
  });
  it("first period and due date", () => {
    const p = currentSurveyPeriod(s, new Date(start.getTime() + 2 * day))!;
    expect(p.index).toBe(0);
    expect(p.start).toEqual(start);
    expect(p.dueAt).toEqual(new Date(start.getTime() + 3 * day));
    expect(p.end).toEqual(new Date(start.getTime() + 14 * day));
  });
  it("every 14 days a new period", () => {
    expect(currentSurveyPeriod(s, new Date(start.getTime() + 14 * day))!.index).toBe(1);
    expect(currentSurveyPeriod(s, new Date(start.getTime() + 29 * day))!.index).toBe(2);
  });
  it("due is capped by period length", () => {
    const p = currentSurveyPeriod({ ...s, periodDays: 7, dueDays: 30 }, start)!;
    expect(p.dueAt).toEqual(new Date(start.getTime() + 7 * day));
  });
  it("ends at endsAt", () => {
    const ended = { ...s, endsAt: new Date(start.getTime() + 20 * day) };
    expect(currentSurveyPeriod(ended, new Date(start.getTime() + 21 * day))).toBeNull();
    expect(lastSurveyPeriodIndex(ended, new Date(start.getTime() + 100 * day))).toBe(1);
  });
  it("one-time survey has a single period", () => {
    const once = { ...s, periodDays: null, dueDays: 5 };
    const p = currentSurveyPeriod(once, new Date(start.getTime() + 40 * day))!;
    expect(p.index).toBe(0);
    expect(p.end).toBeNull();
    expect(p.dueAt).toEqual(new Date(start.getTime() + 5 * day));
  });
});

describe("survey answers", () => {
  const wellbeing = SURVEY_TEMPLATES.find((t) => t.key === "wellbeing")!.questions;

  it("templates are valid", () => {
    for (const t of SURVEY_TEMPLATES) expect(surveyQuestionsSchema.safeParse(t.questions).success).toBe(true);
  });
  it("required questions are enforced", () => {
    const r = validateSurveyAnswers(wellbeing, {});
    expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(["mood", "energy", "team", "health", "talk"]));
    expect(r.errors.healthtext).toBeUndefined(); // скрыт условием
  });
  it("conditional question: hidden answer is dropped, shown one is kept", () => {
    const base = { mood: "4", energy: "4", team: "5", talk: "Нет, всё хорошо" };
    const hidden = validateSurveyAnswers(wellbeing, { ...base, health: "no", healthtext: "секрет" });
    expect(hidden.errors).toEqual({});
    expect(hidden.answers.healthtext).toBeUndefined();
    const shown = validateSurveyAnswers(wellbeing, { ...base, health: "yes", healthtext: "болит колено" });
    expect(shown.answers.healthtext).toBe("болит колено");
    expect(shown.alerts).toEqual(["health"]);
  });
  it("scale range and alerts", () => {
    const r = validateSurveyAnswers(wellbeing, { mood: "2", energy: "9", team: "5", health: "no", talk: "Да, с командиром" });
    expect(r.errors.energy).toMatch(/от 1 до 5/);
    expect(r.answers.mood).toBe(2);
    expect(r.alerts).toEqual(expect.arrayContaining(["mood", "talk"]));
  });
  it("options must come from the list", () => {
    const q: SurveyQuestion[] = [{ id: "pick", type: "MULTI", label: "Что?", required: true, options: ["a", "b"] }];
    expect(validateSurveyAnswers(q, { pick: ["a", "x"] }).errors.pick).toBeDefined();
    expect(validateSurveyAnswers(q, { pick: ["b", "a", "a"] }).answers.pick).toEqual(["b", "a"]);
  });
  it("number bounds", () => {
    const q: SurveyQuestion[] = [{ id: "hours", type: "NUMBER", label: "Часов сна", required: true, number: { min: 0, max: 24 }, alert: { op: "lte", value: "5" } }];
    expect(validateSurveyAnswers(q, { hours: "25" }).errors.hours).toBeDefined();
    const ok = validateSurveyAnswers(q, { hours: "4,5" });
    expect(ok.answers.hours).toBe(4.5);
    expect(ok.alerts).toEqual(["hours"]);
    expect(alertTriggered(q[0]!, 8)).toBe(false);
  });
  it("condition may reference only earlier questions", () => {
    const bad = surveyQuestionsSchema.safeParse([
      { id: "first", type: "TEXT", label: "A", required: false, showIf: { questionId: "second", values: ["x"] } },
      { id: "second", type: "TEXT", label: "B", required: false },
    ]);
    expect(bad.success).toBe(false);
  });
});
