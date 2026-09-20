# FINTEL Quantitative Models

The current quantitative implementation is in `server/quant_engine/engine.py` and is invoked by `server/quant_engine/client.ts`. Model outputs are not invented by the React layer.

| Model | Purpose and implementation | Inputs / outputs | Data dependency and status |
| --- | --- | --- | --- |
| Bond pricing | Present-value pricing of coupon and principal cash flows | Face value, coupon, YTM, maturity; price, cash-flow measures | Analyst inputs or persisted validated bond terms; IMPLEMENTED |
| YTM | Yield-to-maturity field and bond analytics input | Price/terms or observed bond yield; YTM | Treasury Bond source fields and analyst inputs; PARTIALLY CONNECTED |
| Macaulay duration | Measures weighted cash-flow timing | Coupon, YTM, maturity; duration | Bond terms; IMPLEMENTED |
| Modified duration | Rate-sensitivity approximation | Bond terms and yield; modified duration | Bond terms; IMPLEMENTED |
| Convexity | Second-order price/yield sensitivity | Bond terms and yield; convexity | Bond terms; IMPLEMENTED |
| DV01 | Approximate change for a one basis-point move | Bond or portfolio position fields; DV01 | Persisted positions required for portfolio output; IMPLEMENTED / DATA REQUIRED without positions |
| Yield curve / Nelson-Siegel-style interpolation | Interpolates a curve from validated tenor/yield points | Maturities and yields; curve values and target tenors | Persisted CBK bill/bond observations; CONNECTED |
| Black-Scholes-Merton | Closed-form European option pricing | Spot, strike, rate, volatility, tenor, call/put; price and Greeks | Analyst inputs; IMPLEMENTED, UI sample inputs are labelled |
| CRR Binomial | Discrete-tree option pricing and bumped Greeks | Spot, strike, rate, volatility, tenor, steps/model payload; price and Greeks | Analyst inputs; IMPLEMENTED |
| Monte Carlo option pricing | Simulated option price and convergence path | Spot, strike, rate, volatility, tenor, paths/seed payload; price and convergence | Pricing simulation, not historical market data; IMPLEMENTED |
| Greeks | Delta, gamma, vega and related derivative sensitivities | Derivative model inputs; sensitivities | Python engine; IMPLEMENTED |
| Parametric VaR | Position-based portfolio loss estimate | Positions, market values, volatility, confidence, horizon; VaR | Persisted authorised positions; IMPLEMENTED / DATA REQUIRED without positions |
| Expected Shortfall | Tail-loss estimate from portfolio risk inputs | Same risk inputs; expected shortfall | Persisted positions; IMPLEMENTED / DATA REQUIRED without positions |
| Historical VaR and ES | Observed-return tail-risk analytics | Validated historical prices; VaR and ES | Real aligned observations only; IMPLEMENTED / DATA REQUIRED when absent |
| Drawdown | Observed historical peak-to-trough loss | Validated historical prices; maximum drawdown | Real observed history only; IMPLEMENTED / DATA REQUIRED when absent |
| Stress testing | Deterministic rate, FX, spread, liquidity, and rally shocks | Portfolio positions and scenario shocks; impact estimates | Persisted positions; IMPLEMENTED / DATA REQUIRED without positions |
| Portfolio analytics | Aggregates market value, duration, DV01, volatility and risk | Position ledger; portfolio measures | Persisted positions; IMPLEMENTED / DATA REQUIRED without positions |
| Historical analytics/backtesting | Returns, rolling statistics, exceedance counts and coverage | Observed price series; analytics bundle | Historical database; PARTIALLY CONNECTED |

## Assumptions and limitations

Pricing models use the assumptions encoded in the Python implementation and accept analyst inputs. They are not claims of live derivatives market quotes. Portfolio risk requires explicit position fields and aligned observed historical series. A separate model-serving API does not yet exist; calculations run synchronously through the local process adapter.
