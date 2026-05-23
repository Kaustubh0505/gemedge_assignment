# GeM BidPlus Procurement Scraper & Analytics

A modular **Node.js + Playwright** scraper for extracting and analyzing procurement bid results from the GeM BidPlus portal.

## Features
- Supports both **single-packet** and **multi-packet** bid result tables.
- Dynamic **header-based column mapping** for reliable parsing.
- Opens bid details in isolated tabs to preserve pagination state.
- Cleans vendor data and detects pricing anomalies automatically.
- Includes retry handling with exponential backoff for stability.

## Project Structure
```bash
gemedge_assignment/
├── outputs/
├── scraper/
│   └── extractors.js
├── utils/
│   ├── dataCleaner.js
│   └── logger.js
├── scraper.js
├── saveCsv.js
└── insights.js
```

## Setup

### Prerequisites
- Node.js v16+
- npm

### Install
```bash
npm install
npx playwright install chromium
```

## Run
```bash
node scraper.js
```

## Output Files
Generated inside `outputs/`:
- `bids_data.json` → Structured bid data
- `bids_data.csv` → Flattened CSV export
- `insights.json` → Procurement analytics

## Analytics Included
- High participation rate detection
- L1 vs L2 price gap analysis
- Repeat winner tracking

## Reliability Features
- Retry mechanism with exponential backoff
- Sequential scraping to avoid session blocking
- Safe cleanup using try/catch/finally blocks