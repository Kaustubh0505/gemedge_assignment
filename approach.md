# Student Report: My Approach, Challenges, and Learnings

Hello! This document outlines my personal journey, technical approach, challenges, and the architectural decisions I made while building the GeM BidPlus Web Scraper & Analytics System.

---

## My Step-by-Step Approach

When I first opened the GeM BidPlus procurement portal, I realized it was a complex, dynamic government platform. Rather than diving straight into coding, I broke the problem down into five phases:

1. **DOM Exploration & Mapping**: I manually inspected the elements of the listings page (`https://bidplus.gem.gov.in/all-bids`) and examined how filters behaved under the hood. I saw that checking filters didn't reload the page but sent asynchronous AJAX updates.
2. **Details Page Discovery**: I collected URLs from the "View BID Results" button and noticed they led to two distinct layouts depending on packet structure (Single-Packet vs Multi-Packet).
3. **Modular Prototyping**: I created scratch verification scripts (`scratch/inspect_card.js`, `scratch/inspect_pagination_html.js`) to isolate elements and test selectors before writing the main orchestrator.
4. **Pipeline Implementation**: I separated the logic into distinct modules: data extraction, sanitization/cleaning, file serialization, and analytics computation.
5. **Robustness Integration**: I wrapped navigations in retry policies and isolated detail page visits in new browser tabs to preserve state.

---

## Tools Used & Rationale

* **Node.js**: Perfect for scripting pipelines due to its asynchronous runtime, fast file-system interaction, and lightweight package manager (`npm`).
* **Playwright**: I chose Playwright over Puppeteer because of its advanced `locator` APIs, cross-browser stability, and ease of managing multiple tab contexts (`newPage()`) in a single session.
* **csv-writer**: A simple, lightweight Node package that maps JavaScript arrays of objects directly to CSV formats, handling headers and cell escapes automatically.
* **Custom Logger (`logger.js`)**: Instead of printing raw text, I created a timestamped, format-colored console logger to clearly visual-trace scraper operations, warnings, and successes in real-time.

---

## Challenges I Faced & How I Solved Them

### 1. The Brittle Card Scoping Bug (The "Giant String" Problem)
* **Challenge**: Initially, when trying to extract the `Items` or `Quantity` rows, my helper function used the selector `card.locator(".row:has-text('...')")`. Since the card itself was contained within a `.row`, it returned the outer container row which holds the entire card's text. This caused `Items` to capture the entire card text, and parsing the numeric value for `Quantity` extracted digits from dates and addresses, corrupting the dataset.
* **Solution**: I scoped the selector queries specifically to the details column:
  ```javascript
  const row = card.locator(`.col-md-4 .row:has-text('${label}')`);
  ```
  This immediately isolated the inner column rows, yielding clean fields like `Quantity: 606` and `Items: Catering Service...`.

### 2. State Loss on Back-Navigation
* **Challenge**: If I clicked "View BID Results" in the same browser window, extracted details, and clicked the browser "Back" button, the portal lost the active checkboxes/filters and reset the listings to page 1.
* **Solution**: Instead of navigating back and forth on the main page, I opened each details URL in a separate tab context:
  ```javascript
  const detailsPage = await context.newPage();
  await detailsPage.goto(url);
  ...
  await detailsPage.close();
  ```
  This left the main listings page pagination completely undisturbed.

### 3. Dynamic Page Endpoints (Single vs Multi-Packet)
* **Challenge**: Some bids routed to `/getSinglePacketResultView/` (1 unified table for eligibility & prices) and others to `/getBidResultView/` (2 distinct tables). Hardcoding index selectors like `table[0]` or `table[1]` caused errors or lost data.
* **Solution**: I implemented **dynamic header-matching**. I fetched all tables, read their header text contents, and mapped them on-the-fly:
  * Headers with "status" or "participated" $\rightarrow$ Technical Table
  * Headers with "price" or "rank" $\rightarrow$ Financial Table
  * Headers with both $\rightarrow$ Combined Table

---

## Handling Failures & Building Resiliency

Scraping live public portals is prone to transient network issues. I handled this using three strategies:
1. **Exponential Backoff**: For page navigation, if the initial load fails, the scraper waits 2 seconds, then 4 seconds, then 8 seconds before timing out, giving servers a chance to recover.
2. **Error Boundary Isolation**: I placed the details scraping of each bid in an independent `try/catch` block. If one details page fails to open or is empty, the scraper logs the error, closes that specific tab, and moves on to the next bid rather than crashing the whole run.
3. **Politeness Delay**: Added a 1000ms delay between detail URL visits to avoid hammering the servers and getting the scraper IP temporarily rate-limited.

---

## What Would Break This Scraper? (Potential Failures)

If I were to run this scraper in production long-term, here is what could break it:
* **Anti-Bot / Captchas**: If the GeM portal implements Cloudflare, Akamai, or Google ReCaptcha walls, headless Chromium visits will be blocked at the firewall.
* **CSS Class Renovations**: If developers rename `.card`, `#bidCard`, `.page-link.next`, or the table structures, the selectors will fail to locate elements.
* **Header Renaming**: If "Seller Name" is changed to "Bidder Name" or "Eligibility Status" is changed to "Check-Mark", the dynamic header-matching will fail to classify tables.

---

## How I Would Improve It Next

If I had more time, I would take the system to the next level by:
1. **Adding Concurrent Tab Batching**: Instead of opening details tabs sequentially (which is slow), I would process them in concurrent batches of 3–5 tabs using `Promise.all` while maintaining a concurrency ceiling to prevent rate-limits.
2. **Implementing Proxy Rotation**: Integrate a pool of residential proxies and rotate user-agents dynamically to avoid IP fingerprinting.
3. **Adding a Database Layer**: Store results directly into an SQLite database with primary keys (Bid ID) to avoid duplicates across multiple subsequent crawls.
4. **Implementing visual monitoring**: Set up screenshots or email alerts if a selector fails, so I'm immediately notified of layout shifts on the procurement portal.