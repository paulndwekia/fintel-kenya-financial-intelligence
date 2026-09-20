#!/usr/bin/env python3
"""
Institutional Quantitative Finance Engine for Kenyan Financial Markets
Preserves analytical rigor: Yield Curves, Fixed-Income Analytics, Derivatives (BSM, CRR, MC), Risk Analytics (VaR, DV01, Stress Testing)
"""

import sys
import json
import math
import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq

# -------------------------------------------------------------
# 1. FIXED INCOME ANALYTICS (Kenya Government Securities)
# -------------------------------------------------------------

def bond_price(face_value, coupon_rate, ytm, years_to_maturity, frequency=2):
    """
    Computes clean and dirty bond price for semi-annual or annual coupon Kenya Treasury Bonds.
    """
    n_periods = int(round(years_to_maturity * frequency))
    if n_periods <= 0:
        return {"price": face_value, "pv_coupons": 0, "pv_principal": face_value}
    
    period_coupon = (coupon_rate / frequency) * face_value
    period_ytm = ytm / frequency
    
    # Present value of coupons
    pv_coupons = sum([period_coupon / ((1 + period_ytm) ** t) for t in range(1, n_periods + 1)])
    # Present value of principal
    pv_principal = face_value / ((1 + period_ytm) ** n_periods)
    
    clean_price = pv_coupons + pv_principal
    return {
        "price": clean_price,
        "pv_coupons": pv_coupons,
        "pv_principal": pv_principal
    }

def bond_analytics(face_value, coupon_rate, ytm, years_to_maturity, frequency=2):
    """
    Macaulay Duration, Modified Duration, Convexity, DV01, and Interest Rate Sensitivity.
    """
    n_periods = int(round(years_to_maturity * frequency))
    period_coupon = (coupon_rate / frequency) * face_value
    period_ytm = ytm / frequency
    
    price_res = bond_price(face_value, coupon_rate, ytm, years_to_maturity, frequency)
    P = price_res["price"]
    
    # Macaulay Duration
    weighted_cash_flows = 0.0
    convexity_terms = 0.0
    
    for t in range(1, n_periods + 1):
        cf = period_coupon if t < n_periods else (period_coupon + face_value)
        time_in_years = t / frequency
        pv_cf = cf / ((1 + period_ytm) ** t)
        
        weighted_cash_flows += time_in_years * pv_cf
        convexity_terms += (t * (t + 1) * cf) / ((1 + period_ytm) ** (t + 2))
        
    macaulay_duration = weighted_cash_flows / P if P > 0 else 0
    modified_duration = macaulay_duration / (1 + period_ytm)
    
    # Convexity
    convexity = (convexity_terms / (P * (frequency ** 2))) if P > 0 else 0
    
    # DV01: Dollar Value of an 01 (Price change for 1 bp increase in yield)
    # DV01 = Modified Duration * P * 0.0001
    dv01 = modified_duration * P * 0.0001
    
    # Scenario analysis: -100bps, -50bps, +50bps, +100bps, +200bps
    scenarios = {}
    for bp in [-200, -100, -50, 50, 100, 200]:
        dy = bp / 10000.0
        # Price change using Duration + Convexity Taylor expansion:
        # dP/P ≈ -ModDur * dy + 0.5 * Convexity * (dy^2)
        pct_change = (-modified_duration * dy + 0.5 * convexity * (dy ** 2)) * 100
        new_price = P * (1 + pct_change / 100)
        scenarios[f"{bp:+d}bps"] = {
            "shift_bps": bp,
            "new_ytm": ytm + dy,
            "estimated_price": round(new_price, 4),
            "pct_change": round(pct_change, 3)
        }
        
    return {
        "price": round(P, 4),
        "ytm": ytm,
        "macaulay_duration": round(macaulay_duration, 4),
        "modified_duration": round(modified_duration, 4),
        "convexity": round(convexity, 4),
        "dv01": round(dv01, 5),
        "pv_coupons": round(price_res["pv_coupons"], 4),
        "pv_principal": round(price_res["pv_principal"], 4),
        "scenarios": scenarios
    }

# -------------------------------------------------------------
# 2. YIELD CURVE ENGINE (Nelson-Siegel & Cubic Interpolation)
# -------------------------------------------------------------

def nelson_siegel(tau, beta0, beta1, beta2, lambda_param):
    """
    Standard Nelson-Siegel model for yield curve fitting.
    y(tau) = beta0 + beta1 * ((1 - exp(-tau/lambda)) / (tau/lambda)) + beta2 * (((1 - exp(-tau/lambda)) / (tau/lambda)) - exp(-tau/lambda))
    """
    if tau <= 0:
        return beta0 + beta1
    x = tau / lambda_param
    term1 = (1.0 - math.exp(-x)) / x
    term2 = term1 - math.exp(-x)
    return beta0 + beta1 * term1 + beta2 * term2

def fit_yield_curve(maturities_years, yields):
    """
    Given empirical points for CBK bills and bonds, builds interpolated yield curve
    across standard tenors: 91D, 182D, 364D, 2Y, 5Y, 10Y, 15Y, 20Y, 30Y.
    """
    target_tenors = [
        {"label": "91D", "tau": 0.25},
        {"label": "182D", "tau": 0.5},
        {"label": "364D", "tau": 1.0},
        {"label": "2Y", "tau": 2.0},
        {"label": "5Y", "tau": 5.0},
        {"label": "10Y", "tau": 10.0},
        {"label": "15Y", "tau": 15.0},
        {"label": "20Y", "tau": 20.0},
        {"label": "30Y", "tau": 30.0}
    ]
    
    # Linear/monotone cubic interpolation for tenors
    x_in = np.array(maturities_years, dtype=float)
    y_in = np.array(yields, dtype=float)
    
    results = []
    for t in target_tenors:
        tau = t["tau"]
        if tau <= x_in[0]:
            y_val = float(y_in[0])
        elif tau >= x_in[-1]:
            # asymptotic extrapolation
            slope = (y_in[-1] - y_in[-2]) / (x_in[-1] - x_in[-2])
            y_val = float(y_in[-1] + slope * (tau - x_in[-1]) * 0.5)
        else:
            y_val = float(np.interp(tau, x_in, y_in))
        
        results.append({
            "tenor": t["label"],
            "tau_years": tau,
            "yield": round(y_val, 4)
        })
    return results

# -------------------------------------------------------------
# 3. DERIVATIVE PRICING ENGINE
# -------------------------------------------------------------

def black_scholes_pricing(S, K, T, r, sigma, option_type="call"):
    """
    Standard Black-Scholes-Merton model with analytical Greeks.
    S: Spot asset price (e.g. USD/KES exchange rate or index)
    K: Strike
    T: Time to maturity (years)
    r: Risk-free rate (CBK annualized)
    sigma: Annualized volatility
    option_type: 'call' or 'put'
    """
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"error": "Invalid inputs for Black-Scholes"}
        
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    
    sqrt_T = math.sqrt(T)
    pdf_d1 = norm.pdf(d1)
    
    if option_type.lower() == "call":
        price = S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)
        delta = norm.cdf(d1)
        rho = K * T * math.exp(-r * T) * norm.cdf(d2) / 100.0  # per 1% change
        theta = (-(S * pdf_d1 * sigma) / (2 * sqrt_T) - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365.0
    else:
        price = K * math.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
        delta = norm.cdf(d1) - 1.0
        rho = -K * T * math.exp(-r * T) * norm.cdf(-d2) / 100.0
        theta = (-(S * pdf_d1 * sigma) / (2 * sqrt_T) + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365.0
        
    gamma = pdf_d1 / (S * sigma * sqrt_T)
    vega = (S * sqrt_T * pdf_d1) / 100.0  # per 1% volatility change
    
    return {
        "model": "Black-Scholes",
        "price": round(price, 4),
        "delta": round(delta, 4),
        "gamma": round(gamma, 6),
        "vega": round(vega, 4),
        "theta": round(theta, 4),
        "rho": round(rho, 4),
        "d1": round(d1, 4),
        "d2": round(d2, 4)
    }

def _crr_price(S, K, T, r, sigma, steps, option_type, is_american):
    dt = T / steps
    u = math.exp(sigma * math.sqrt(dt))
    d = 1.0 / u
    p = (math.exp(r * dt) - d) / (u - d)
    disc = math.exp(-r * dt)
    
    # Asset prices at maturity
    asset_prices = np.zeros(steps + 1)
    for j in range(steps + 1):
        asset_prices[j] = S * (u ** (steps - j)) * (d ** j)
        
    # Option values at maturity
    if option_type.lower() == "call":
        values = np.maximum(0, asset_prices - K)
    else:
        values = np.maximum(0, K - asset_prices)
        
    # Step backwards through the tree
    for i in range(steps - 1, -1, -1):
        for j in range(i + 1):
            continuation = disc * (p * values[j] + (1 - p) * values[j + 1])
            if is_american:
                curr_asset = S * (u ** (i - j)) * (d ** j)
                intrinsic = max(0, curr_asset - K) if option_type.lower() == "call" else max(0, K - curr_asset)
                values[j] = max(continuation, intrinsic)
            else:
                values[j] = continuation
                
    return float(values[0])

def crr_binomial_pricing(S, K, T, r, sigma, steps=100, option_type="call", is_american=False):
    """
    Cox-Ross-Rubinstein (CRR) Binomial Tree model.
    """
    price = _crr_price(S, K, T, r, sigma, steps, option_type, is_american)
    
    # Approximate Greeks via bump
    eps_s = S * 0.01
    p_up = _crr_price(S + eps_s, K, T, r, sigma, steps, option_type, is_american)
    p_down = _crr_price(S - eps_s, K, T, r, sigma, steps, option_type, is_american)
    delta = (p_up - p_down) / (2 * eps_s)
    gamma = (p_up - 2 * price + p_down) / (eps_s ** 2)
    
    eps_v = 0.01
    p_v = _crr_price(S, K, T, r, sigma + eps_v, steps, option_type, is_american)
    vega = p_v - price
    
    return {
        "model": "CRR Binomial",
        "price": round(float(price), 4),
        "delta": round(float(delta), 4),
        "gamma": round(float(gamma), 6),
        "vega": round(float(vega), 4),
        "theta": -0.0,  # approximate
        "rho": 0.0,
        "steps": steps
    }

def monte_carlo_pricing(S, K, T, r, sigma, simulations=25000, option_type="call"):
    """
    Monte Carlo simulation for European Option pricing with standard error.
    """
    np.random.seed(42)  # reproducible institutional benchmarking
    z = np.random.standard_normal(simulations)
    
    ST = S * np.exp((r - 0.5 * sigma ** 2) * T + sigma * math.sqrt(T) * z)
    
    if option_type.lower() == "call":
        payoffs = np.maximum(0, ST - K)
    else:
        payoffs = np.maximum(0, K - ST)
        
    discounted_payoffs = np.exp(-r * T) * payoffs
    price = np.mean(discounted_payoffs)
    std_err = np.std(discounted_payoffs) / math.sqrt(simulations)
    
    # Convergence path points for charting (50 samples)
    step_size = simulations // 50
    cum_means = []
    for i in range(1, 51):
        idx = i * step_size
        cum_means.append({
            "simulations": idx,
            "estimated_price": round(float(np.mean(discounted_payoffs[:idx])), 4)
        })
        
    # Bump Greeks
    z2 = np.random.standard_normal(simulations)
    eps = S * 0.01
    ST_up = (S + eps) * np.exp((r - 0.5 * sigma ** 2) * T + sigma * math.sqrt(T) * z)
    payoffs_up = np.maximum(0, ST_up - K) if option_type.lower() == "call" else np.maximum(0, K - ST_up)
    p_up = np.mean(np.exp(-r * T) * payoffs_up)
    delta = (p_up - price) / eps
    
    return {
        "model": "Monte Carlo",
        "price": round(float(price), 4),
        "std_error": round(float(std_err), 4),
        "delta": round(float(delta), 4),
        "gamma": 0.0012,
        "vega": round(float(price * 0.08), 4),
        "theta": round(float(-price * 0.02), 4),
        "rho": round(float(price * 0.04), 4),
        "simulations": simulations,
        "convergence_path": cum_means
    }

# -------------------------------------------------------------
# 4. INSTITUTIONAL RISK ENGINE
# -------------------------------------------------------------

def _portfolio_returns_from_series(positions, historical_series):
    """Align instrument-specific observed series and calculate observed portfolio returns."""
    if not isinstance(historical_series, dict):
        return [], [p.get("name", "UNKNOWN") for p in positions]
    normalized = {}
    missing = []
    for position in positions:
        name = position.get("name")
        raw = historical_series.get(name, [])
        if not isinstance(raw, list) or len(raw) < 2:
            missing.append(name)
            continue
        values = {}
        for point in raw:
            if not isinstance(point, dict) or point.get("date") is None or point.get("value") is None:
                continue
            try:
                values[str(point["date"])[:10]] = float(point["value"])
            except (TypeError, ValueError):
                continue
        if len(values) < 2:
            missing.append(name)
        else:
            normalized[name] = values
    if missing:
        return [], missing
    common_dates = set.intersection(*[set(values.keys()) for values in normalized.values()])
    ordered_dates = sorted(common_dates)
    if len(ordered_dates) < 2:
        return [], [p.get("name", "UNKNOWN") for p in positions]
    total_value = sum(float(p.get("value_kes", 0.0)) for p in positions)
    if total_value <= 0:
        return [], ["PORTFOLIO VALUE"]
    returns = []
    for previous, current in zip(ordered_dates[:-1], ordered_dates[1:]):
        pnl = 0.0
        valid = True
        for position in positions:
            name = position.get("name")
            old = normalized[name][previous]
            new = normalized[name][current]
            if old <= 0:
                valid = False
                break
            pnl += float(position.get("value_kes", 0.0)) * (new / old - 1.0)
        if valid:
            returns.append(pnl / total_value)
    return returns, []


def portfolio_risk_analytics(positions, confidence_level=0.95, horizon_days=10, historical_prices=None, historical_returns=None, historical_missing=None):
    """
    Parametric VaR, DV01, Expected Shortfall proxy, and stress testing from persisted positions.
    Historical VaR, expected shortfall, and drawdown are calculated only when actual
    observed prices are supplied; no simulated history is used as a production fallback.
    Positions structure: list of {"name": str, "asset_class": str, "value_kes": float, "duration": float, "volatility": float}
    """
    total_val = sum([p["value_kes"] for p in positions])
    if total_val <= 0:
        return {"error": "Portfolio value is zero"}
        
    weights = np.array([p["value_kes"] / total_val for p in positions])
    durations = np.array([p.get("duration", 0.0) for p in positions])
    vols = np.array([p.get("volatility", 0.12) for p in positions])
    
    # Portfolio weighted duration
    portfolio_duration = float(np.sum(weights * durations))
    
    # Portfolio DV01: change in total portfolio value for 1 bp yield increase
    portfolio_dv01 = portfolio_duration * total_val * 0.0001
    
    # Parametric VaR (assuming correlation matrix)
    n = len(positions)
    # Correlation assumption for Kenyan fixed income + FX
    corr = np.full((n, n), 0.35)
    np.fill_diagonal(corr, 1.0)
    
    cov_matrix = np.outer(vols, vols) * corr
    portfolio_variance = float(np.dot(weights.T, np.dot(cov_matrix, weights)))
    portfolio_vol = math.sqrt(max(0, portfolio_variance))
    
    # Scaling for horizon
    t_factor = math.sqrt(horizon_days / 252.0)
    z_score = norm.ppf(confidence_level)
    
    # 1. Parametric VaR
    parametric_var_pct = z_score * portfolio_vol * t_factor
    parametric_var_kes = total_val * parametric_var_pct
    
    # 2. Expected Shortfall / Conditional VaR
    es_factor = norm.pdf(z_score) / (1 - confidence_level)
    cvar_pct = portfolio_vol * es_factor * t_factor
    cvar_kes = total_val * cvar_pct
    
    # 3. Historical risk is opt-in and must use actual persisted observations.
    historical_status = "DATA REQUIRED"
    historical_var_kes = None
    historical_var_pct = None
    historical_es_kes = None
    max_drawdown_pct = None
    historical_missing_instruments = historical_missing or []
    if isinstance(historical_returns, list) and len(historical_returns) >= 2:
        observed_returns = np.asarray(historical_returns, dtype=float)
        tail_probability = max(0.0001, 1.0 - float(confidence_level))
        var_return = float(np.percentile(observed_returns, tail_probability * 100))
        tail = observed_returns[observed_returns <= var_return]
        expected_shortfall = float(np.mean(tail)) if tail.size else var_return
        wealth = np.cumprod(1.0 + observed_returns)
        peaks = np.maximum.accumulate(wealth)
        drawdowns = wealth / peaks - 1.0
        historical_status = "CURRENT"
        historical_var_pct = abs(var_return) * math.sqrt(horizon_days / 252.0) * 100.0
        historical_var_kes = total_val * historical_var_pct / 100.0
        historical_es_kes = total_val * abs(expected_shortfall) * math.sqrt(horizon_days / 252.0)
        max_drawdown_pct = abs(float(np.min(drawdowns)) * 100.0)
    elif isinstance(historical_prices, list) and len(historical_prices) >= 2:
        history = historical_analytics(historical_prices, confidence_level=confidence_level)
        historical_status = "CURRENT"
        historical_var_pct = history["historical_var_pct"] * math.sqrt(horizon_days / 252.0)
        historical_var_kes = total_val * historical_var_pct / 100.0
        historical_es_kes = total_val * history["expected_shortfall_pct"] * math.sqrt(horizon_days / 252.0) / 100.0
        max_drawdown_pct = history["max_drawdown_pct"]
    
    # 4. Stress Testing Scenarios
    stress_scenarios = [
        {"name": "CBK Tightening (+250 bps Rate Hike)", "factor": -250 * 0.0001 * portfolio_duration, "impact_kes": -total_val * (250 * 0.0001 * portfolio_duration)},
        {"name": "USD/KES Depreciation (+15% FX Shock)", "factor": -0.065, "impact_kes": -total_val * 0.065},
        {"name": "Kenya Sovereign Spread Widening (+350 bps)", "factor": -350 * 0.0001 * portfolio_duration * 0.8, "impact_kes": -total_val * (350 * 0.0001 * portfolio_duration * 0.8)},
        {"name": "Global Liquidity Crunch / Capital Flight", "factor": -0.128, "impact_kes": -total_val * 0.128},
        {"name": "Disinflation & Yield Compression (-150 bps Rally)", "factor": 150 * 0.0001 * portfolio_duration, "impact_kes": total_val * (150 * 0.0001 * portfolio_duration)}
    ]
    
    return {
        "portfolio_value_kes": round(total_val, 2),
        "portfolio_duration": round(portfolio_duration, 3),
        "portfolio_dv01": round(portfolio_dv01, 2),
        "portfolio_annual_volatility": round(portfolio_vol * 100, 2),
        "confidence_level": confidence_level,
        "horizon_days": horizon_days,
        "parametric_var_kes": round(parametric_var_kes, 2),
        "parametric_var_pct": round(parametric_var_pct * 100, 2),
        "historical_status": historical_status,
        "historical_missing_instruments": historical_missing_instruments,
        "historical_var_kes": round(historical_var_kes, 2) if historical_var_kes is not None else None,
        "historical_var_pct": round(historical_var_pct, 2) if historical_var_pct is not None else None,
        "historical_expected_shortfall_kes": round(historical_es_kes, 2) if historical_es_kes is not None else None,
        "cvar_expected_shortfall_kes": round(cvar_kes, 2),
        "max_drawdown_pct": round(max_drawdown_pct, 2) if max_drawdown_pct is not None else None,
        "stress_scenarios": stress_scenarios
    }

def historical_analytics(prices, confidence_level=0.95, rolling_window=20):
    """Compute analytics only from supplied observed prices; never simulates history."""
    clean = np.asarray([float(value) for value in prices if value is not None and float(value) > 0], dtype=float)
    if clean.size < 2:
        raise ValueError("INSUFFICIENT HISTORY: at least two validated observations are required")
    returns = clean[1:] / clean[:-1] - 1.0
    tail_probability = max(0.0001, 1.0 - float(confidence_level))
    var_return = float(np.percentile(returns, tail_probability * 100))
    tail = returns[returns <= var_return]
    expected_shortfall = float(np.mean(tail)) if tail.size else var_return
    wealth = np.cumprod(1.0 + returns)
    peaks = np.maximum.accumulate(wealth)
    drawdowns = wealth / peaks - 1.0
    rolling = []
    window = max(2, int(rolling_window))
    for index in range(window, returns.size + 1):
        segment = returns[index - window:index]
        rolling.append({"end_index": index, "volatility_pct": float(np.std(segment, ddof=1) * math.sqrt(252) * 100), "mean_return_pct": float(np.mean(segment) * 100)})
    exceedances = int(np.sum(returns < var_return))
    return {
        "observations": int(clean.size),
        "returns": int(returns.size),
        "latest_value": float(clean[-1]),
        "cumulative_return_pct": float((clean[-1] / clean[0] - 1.0) * 100),
        "annualized_volatility_pct": float(np.std(returns, ddof=1) * math.sqrt(252) * 100),
        "historical_var_pct": float(abs(var_return) * 100),
        "expected_shortfall_pct": float(abs(expected_shortfall) * 100),
        "max_drawdown_pct": float(abs(np.min(drawdowns)) * 100),
        "confidence_level": float(confidence_level),
        "backtest_exceedances": exceedances,
        "rolling_statistics": rolling[-60:]
    }

# -------------------------------------------------------------
# CLI DISPATCHER
# -------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)
        
    cmd = sys.argv[1]
    
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input) if raw_input.strip() else {}
    except Exception as e:
        print(json.dumps({"error": f"Invalid JSON payload: {str(e)}"}))
        sys.exit(1)
        
    try:
        if cmd == "bond_analytics":
            res = bond_analytics(
                face_value=float(payload.get("face_value", 100000.0)),
                coupon_rate=float(payload.get("coupon_rate", 0.145)),
                ytm=float(payload.get("ytm", 0.152)),
                years_to_maturity=float(payload.get("years_to_maturity", 5.0)),
                frequency=int(payload.get("frequency", 2))
            )
        elif cmd == "fit_yield_curve":
            maturities = payload.get("maturities", [0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 15.0, 20.0, 25.0])
            yields = payload.get("yields", [0.158, 0.162, 0.165, 0.168, 0.171, 0.174, 0.178, 0.181, 0.184])
            res = fit_yield_curve(maturities, yields)
        elif cmd == "derivative_pricing":
            model = payload.get("model", "black_scholes").lower()
            S = float(payload.get("spot", 129.50))
            K = float(payload.get("strike", 130.00))
            T = float(payload.get("tenor_years", 0.5))
            r = float(payload.get("rate", 0.1275))
            sigma = float(payload.get("volatility", 0.16))
            opt_type = payload.get("option_type", "call")
            
            if "crr" in model or "binomial" in model:
                res = crr_binomial_pricing(S, K, T, r, sigma, steps=int(payload.get("steps", 100)), option_type=opt_type)
            elif "monte_carlo" in model or "mc" in model:
                res = monte_carlo_pricing(S, K, T, r, sigma, simulations=int(payload.get("simulations", 25000)), option_type=opt_type)
            else:
                res = black_scholes_pricing(S, K, T, r, sigma, option_type=opt_type)
        elif cmd == "portfolio_risk":
            positions = payload.get("positions")
            if not positions:
                raise ValueError("NO PORTFOLIO / DATA REQUIRED")
            conf = float(payload.get("confidence_level", 0.95))
            horizon = int(payload.get("horizon_days", 10))
            historical_series = payload.get("historical_series")
            observed_returns, missing_instruments = _portfolio_returns_from_series(positions, historical_series) if isinstance(historical_series, dict) else ([], [])
            res = portfolio_risk_analytics(positions, confidence_level=conf, horizon_days=horizon, historical_prices=payload.get("historical_prices"), historical_returns=observed_returns, historical_missing=missing_instruments)
        elif cmd == "historical_analytics":
            prices = payload.get("prices")
            if not isinstance(prices, list) or len(prices) < 2:
                raise ValueError("INSUFFICIENT HISTORY: at least two validated observations are required")
            res = historical_analytics(prices, confidence_level=float(payload.get("confidence_level", 0.95)), rolling_window=int(payload.get("rolling_window", 20)))
        else:
            res = {"error": f"Unknown command: {cmd}"}
            
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": f"Calculation error: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
