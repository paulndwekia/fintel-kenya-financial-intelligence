import { z } from "zod";
import { getLatestFxRates, getLatestMarketData, getLatestTreasuryBills, getLatestTreasuryBonds, getLatestYieldCurve, getHistoricalPriceSeries, getPortfolioRiskReadiness, getResearchSession, appendResearchMessage, createResearchSession, listResearchSessions, deleteResearchSession, writeAuditLog } from "./db";
import { invokeLLM, type Tool, type Message } from "./_core/llm";
import { derivativePayload, runEngine } from "./quant_engine/client";

export const researchMode = z.enum(["MARKET", "QUANT", "RISK", "FIXED INCOME", "MACRO", "PORTFOLIO", "ACADEMIC", "GENERAL FINANCE"]);
export type ResearchMode = z.infer<typeof researchMode>;

export type Evidence = { type: "FINTEL_DATABASE" | "QUANT_ENGINE" | "USER_DOCUMENT" | "WEB_SOURCE" | "AI_INTERPRETATION"; title: string; detail: string; observationDate?: string | null; sourceUrl?: string | null; status?: string };

function safeRows(rows: any[]) {
  return rows.slice(0, 40).map(row => JSON.parse(JSON.stringify(row, (_, value) => value instanceof Date ? value.toISOString() : value)));
}

export async function buildFintelContext(question: string, mode: ResearchMode, ownerUserId?: number) {
  const q = question.toLowerCase();
  const evidence: Evidence[] = [];
  const context: Record<string, unknown> = {};
  const limitations: string[] = [];

  const wantsFx = /fx|usd\s*\/\s*kes|dollar|exchange rate/.test(q);
  const wantsBills = /treasury bill|t-bill|91-day|182-day|364-day/.test(q);
  const wantsBonds = /treasury bond|bond yield|kenya bond|bond market/.test(q);
  const wantsCurve = /yield curve|term structure|tenor/.test(q);
  const wantsMarket = mode === "MARKET" || wantsFx || wantsBills || wantsBonds || wantsCurve || /cbk|central bank/.test(q);
  const wantsHistory = /historical|history|over time|trend|volatility|returns/.test(q);

  if (wantsMarket || mode === "FIXED INCOME" || mode === "MACRO") {
    const [market, fx, bills, bonds, curve] = await Promise.all([getLatestMarketData(), getLatestFxRates(), getLatestTreasuryBills(), getLatestTreasuryBonds(), getLatestYieldCurve()]);
    context.marketData = safeRows(market);
    context.fxRates = safeRows(fx);
    context.treasuryBills = safeRows(bills);
    context.treasuryBonds = safeRows(bonds);
    context.yieldCurve = safeRows(curve);
    const groups = [
      ["Market data", market], ["FX rates", fx], ["Treasury Bills", bills], ["Treasury Bonds", bonds], ["Yield curve", curve]
    ] as const;
    for (const [name, rows] of groups) {
      if (rows.length) evidence.push({ type: "FINTEL_DATABASE", title: name, detail: `${rows.length} persisted observations retrieved from FINTEL.`, observationDate: rows[0]?.observationDate?.toISOString?.() ?? null, sourceUrl: rows[0]?.sourceUrl ?? null, status: rows[0]?.ingestionStatus ?? rows[0]?.quality ?? "CURRENT" });
    }
    if (!fx.length && wantsFx) limitations.push("No persisted FX observation is available for the requested context.");
    if (!bills.length && wantsBills) limitations.push("No persisted Treasury Bill observation is available for the requested context.");
    if (!bonds.length && wantsBonds) limitations.push("No persisted Treasury Bond observation is available for the requested context.");
    if (!curve.length && wantsCurve) limitations.push("No persisted yield-curve observation is available for the requested context.");
  }

  if (wantsHistory) {
    const instrumentMatch = question.match(/(?:for|of|on)\s+([A-Za-z0-9_./-]{2,40})/i)?.[1];
    if (instrumentMatch) {
      const rows = await getHistoricalPriceSeries(instrumentMatch, 250);
      context.historicalSeries = safeRows(rows);
      if (rows.length) evidence.push({ type: "FINTEL_DATABASE", title: `Historical series: ${instrumentMatch}`, detail: `${rows.length} persisted price observations retrieved.`, observationDate: rows[0]?.observationDate?.toISOString?.() ?? null, sourceUrl: rows[0]?.sourceUrl ?? null, status: "CURRENT" });
      else limitations.push(`No persisted historical price series was found for ${instrumentMatch}.`);
    }
  }

  if (mode === "PORTFOLIO" && ownerUserId) {
    context.portfolioAccess = { status: "AUTHORIZED_SCOPE", ownerUserId };
    limitations.push("Portfolio-specific calculations require an explicit portfolio selection and authorized access. No portfolio is implicitly selected by research.");
  }

  if (!Object.keys(context).length) limitations.push("No FINTEL dataset was selected by the research router for this question.");
  return { context, evidence, limitations };
}

const researchTools: Tool[] = [
  { type: "function", function: { name: "get_fintel_market_snapshot", description: "Retrieve current persisted FINTEL Kenyan market observations. Never invent values.", parameters: { type: "object", properties: { dataset: { type: "string", enum: ["market", "fx", "treasury_bills", "treasury_bonds", "yield_curve"] } }, required: ["dataset"] } } },
  { type: "function", function: { name: "calculate_bond_analytics", description: "Calculate bond analytics using the FINTEL quantitative engine.", parameters: { type: "object", properties: { faceValue: { type: "number" }, couponRate: { type: "number" }, ytm: { type: "number" }, years: { type: "number" } }, required: ["faceValue", "couponRate", "ytm", "years"] } } },
  { type: "function", function: { name: "price_derivative", description: "Price an option with the FINTEL quantitative engine.", parameters: { type: "object", properties: { model: { type: "string", enum: ["black_scholes", "crr", "monte_carlo"] }, spot: { type: "number" }, strike: { type: "number" }, tenorYears: { type: "number" }, rate: { type: "number" }, volatility: { type: "number" }, optionType: { type: "string", enum: ["call", "put"] } }, required: ["model", "spot", "strike", "tenorYears", "rate", "volatility", "optionType"] } } },
  { type: "function", function: { name: "portfolio_risk_readiness", description: "Check whether an authorized portfolio has enough validated historical data for risk analysis.", parameters: { type: "object", properties: { portfolioId: { type: "number" } }, required: ["portfolioId"] } } },
];

async function executeResearchTool(name: string, args: any, ownerUserId: number) {
  if (name === "get_fintel_market_snapshot") {
    const datasets: Record<string, () => Promise<any[]>> = { market: getLatestMarketData, fx: getLatestFxRates, treasury_bills: getLatestTreasuryBills, treasury_bonds: getLatestTreasuryBonds, yield_curve: getLatestYieldCurve };
    const fn = datasets[args.dataset];
    if (!fn) throw new Error("Unsupported dataset");
    return { sourceType: "FINTEL_DATABASE", dataset: args.dataset, observations: safeRows(await fn()) };
  }
  if (name === "calculate_bond_analytics") {
    const result = runEngine("bond_analytics", { face_value: args.faceValue, coupon_rate: args.couponRate, ytm: args.ytm, years_to_maturity: args.years });
    return { sourceType: "QUANT_ENGINE", model: "Bond Analytics", inputs: args, result };
  }
  if (name === "price_derivative") {
    const result = runEngine("derivative_pricing", derivativePayload(args));
    return { sourceType: "QUANT_ENGINE", model: args.model, inputs: args, result };
  }
  if (name === "portfolio_risk_readiness") {
    const readiness = await getPortfolioRiskReadiness(Number(args.portfolioId), ownerUserId);
    return { sourceType: "FINTEL_DATABASE", model: "Portfolio Risk Readiness", result: readiness };
  }
  throw new Error(`Unsupported research tool: ${name}`);
}

const SYSTEM_PROMPT = `You are FINTEL AI, the research intelligence layer of FINTEL — Kenya Financial Intelligence. Kenya/KES is the default market context. You are an analytical research assistant, not an autonomous trader. Never invent market numbers, CBK statements, yields, FX rates, portfolio results, historical observations, citations, or sources. Treat supplied FINTEL database observations as factual data only with their metadata. Distinguish FINTEL_DATABASE, QUANT_ENGINE, USER_DOCUMENT, WEB_SOURCE, and AI_INTERPRETATION. If required data is absent, say DATA REQUIRED. Explain assumptions and limitations. Do not claim web research was performed unless actual web-source evidence is supplied. Do not expose private portfolio data outside the authenticated user's scope. Numerical calculations should be performed by FINTEL's quant engine when a calculation tool is supplied.`;

export async function runResearch(input: { ownerUserId: number; question: string; mode: ResearchMode; sessionId?: number }) {
  let sessionId = input.sessionId;
  if (!sessionId) {
    const session = await createResearchSession({ ownerUserId: input.ownerUserId, title: input.question.slice(0, 100), mode: input.mode });
    if (!session) throw new Error("Unable to create research session");
    sessionId = session.id;
  } else if (!(await getResearchSession(sessionId, input.ownerUserId))) {
    throw new Error("Research session not found or not accessible");
  }

  const context = await buildFintelContext(input.question, input.mode, input.ownerUserId);
  await appendResearchMessage({ sessionId, role: "user", content: input.question, status: "CURRENT" });

  const prompt = `${SYSTEM_PROMPT}\n\nResearch mode: ${input.mode}\n\nFINTEL evidence:\n${JSON.stringify(context.context)}\n\nKnown provenance:\n${JSON.stringify(context.evidence)}\n\nKnown limitations:\n${JSON.stringify(context.limitations)}\n\nUser question:\n${input.question}\n\nRespond with a concise research answer. Use only supplied factual evidence. If evidence is missing, state DATA REQUIRED. Do not fabricate external sources.`;

  let answer = "";
  let model: string | null = null;
  let status: "CURRENT" | "PARTIAL" | "DATA_REQUIRED" | "UNVERIFIED" | "ERROR" = context.limitations.length && context.evidence.length === 0 ? "DATA_REQUIRED" : "CURRENT";
  try {
    let messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }];
    let quantResults: unknown[] = [];
    for (let turn = 0; turn < 3; turn++) {
      const result = await invokeLLM({ messages, tools: researchTools, toolChoice: "auto", maxTokens: 1800 });
      model = result.model ?? null;
      const assistant = result.choices[0]?.message;
      if (!assistant) throw new Error("AI provider returned no message");
      if (!assistant.tool_calls?.length) {
        const content = assistant.content;
        answer = typeof content === "string" ? content : JSON.stringify(content);
        break;
      }
      messages.push({ role: "assistant", content: typeof assistant.content === "string" ? assistant.content : JSON.stringify(assistant.content), tool_calls: assistant.tool_calls });
      for (const call of assistant.tool_calls) {
        const args = JSON.parse(call.function.arguments || "{}");
        const toolResult = await executeResearchTool(call.function.name, args, input.ownerUserId);
        quantResults.push(toolResult);
        messages.push({ role: "tool", content: JSON.stringify(toolResult), tool_call_id: call.id });
        context.evidence.push({ type: toolResult.sourceType === "QUANT_ENGINE" ? "QUANT_ENGINE" : "FINTEL_DATABASE", title: call.function.name, detail: "Controlled FINTEL tool execution completed." });
      }
    }
    if (!answer) throw new Error("AI provider did not produce a final research answer");
  } catch (error) {
    status = "ERROR";
    answer = context.evidence.length ? `FINTEL research context is available, but the AI provider is unavailable. Review the evidence panel directly.\n\nDATA REQUIRED for AI synthesis: ${error instanceof Error ? error.message : "AI provider unavailable"}` : `DATA REQUIRED — AI provider and FINTEL evidence are unavailable.`;
  }

  const finalStatus = status === "CURRENT" && context.limitations.length ? "PARTIAL" : status;
  await appendResearchMessage({ sessionId, role: "assistant", content: answer, evidence: context.evidence, quantResults, sources: context.evidence.filter(e => e.sourceUrl).map(e => ({ title: e.title, url: e.sourceUrl })), assumptions: ["Kenya/KES is the default market context."], limitations: context.limitations, status: finalStatus, model });
  await writeAuditLog({ actorUserId: input.ownerUserId, action: "research.execute", resourceType: "research_session", resourceId: String(sessionId), result: finalStatus, metadata: { mode: input.mode, evidenceCount: context.evidence.length, providerModel: model } });

  return { sessionId, answer, evidence: context.evidence, quantResults, sources: context.evidence.filter(e => e.sourceUrl).map(e => ({ title: e.title, url: e.sourceUrl })), assumptions: ["Kenya/KES is the default market context."], limitations: context.limitations, status: finalStatus, model };
}

export { createResearchSession, listResearchSessions, getResearchSession, deleteResearchSession };
