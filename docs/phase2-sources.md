# FINTEL Phase 2 source notes

## Official sources

- CBK Treasury Bond auction/results page: https://www.centralbank.go.ke/bills-bonds/treasury-bonds/
- CBK Treasury Bond prospectuses page: https://www.centralbank.go.ke/securities/treasury-bonds/treasury-bonds-prospectuses/
- CBK historical FX rates page: https://www.centralbank.go.ke/rates/forex-exchange-rates/
- CBK historical FX CSV: https://www.centralbank.go.ke/uploads/fx_rates/historical_data.csv
- CBK Treasury Bill average-rates page: https://www.centralbank.go.ke/bills-bonds/treasury-bills-average-rates/

## Observed structures

The CBK Treasury Bond page publishes linked PDFs under `/uploads/historical_treasury_bond_results/`. A 07 September 2026 official result PDF was observed at `https://www.centralbank.go.ke/uploads/historical_treasury_bond_results/1225544087_RESULTS%20FXD3-2019-015%20AND%20SDB1-2011-030%20DATED%2007-09-2026.pdf`. Its extracted labels include ISSUE NUMBER, TENOR, ISIN, Due Dates, Total Amount Offered (Kshs. M), Total bids Received at cost (Kshs. M), Amount Accepted (Kshs. M), Market Weighted Average Rate (%), Weighted Average Rate of Accepted Bids (%), Price per Kshs 100 at average yield, and Coupon Rate (%).

The official FX CSV is comma-delimited with rows in the form `DD/MM/YYYY,CURRENCY,MEAN,BUY,SELL`. The source page reported 97,606 displayed entries at the time of inspection; the downloaded CSV contained 37,877 lines in the current response.

The official Treasury Bill average-rates HTML contains table rows with Issue Date, Issue Number, Tenor, Maturity Date, and Average Interest Rate. A sample row was `2016-01-04 | 2141 | 91 | [empty maturity] | [empty] | 10.845`.

These sources are authoritative CBK pages/files. No bond data is fabricated; PDF records that fail validation are quarantined for review.
