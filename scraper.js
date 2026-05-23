/**
 * GeM BidPlus Scraper
 * Main controller file
 */

const { chromium } = require("playwright");
const path = require("path");

const {
    extractListingData,
    extractBidDetails
} = require("./scraper/extractors");

const { cleanBidRecord } = require("./utils/dataCleaner");
const { exportData } = require("./saveCsv");
const { generateInsights } = require("./insights");
const logger = require("./utils/logger");


const MIN_BIDS = 40;


/* ---------------------------------------------------
   PAGE NAVIGATION WITH RETRY
--------------------------------------------------- */

async function openPage(page, url, retries = 3) {

    for (let attempt = 1; attempt <= retries; attempt++) {

        try {

            logger.info(`Opening: ${url}`);

            await page.goto(url, {
                waitUntil: "networkidle",
                timeout: 30000
            });

            return;

        } catch (error) {

            logger.warn(
                `Attempt ${attempt} failed: ${error.message}`
            );

            if (attempt === retries) {
                throw error;
            }

            const delay = 2000 * attempt;

            logger.info(`Retrying in ${delay}ms...`);

            await page.waitForTimeout(delay);
        }
    }
}


/* ---------------------------------------------------
   MAIN SCRAPER
--------------------------------------------------- */

async function runScraper() {

    logger.info("Starting scraper...");

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext({
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

        viewport: {
            width: 1280,
            height: 800
        }
    });

    const page = await context.newPage();

    const allBids = [];

    try {

        /* ------------------------------------------
           OPEN MAIN PAGE
        ------------------------------------------ */

        const mainUrl =
            "https://bidplus.gem.gov.in/all-bids";

        await openPage(page, mainUrl);


        /* ------------------------------------------
           APPLY FILTERS
        ------------------------------------------ */

        logger.info("Applying filters...");

        await page.locator("#bidrastatus").check();

        await page.locator("#bid_awarded").check();

        await page.waitForTimeout(5000);


        /* ------------------------------------------
           SCRAPE LISTINGS
        ------------------------------------------ */

        let currentPage = 1;

        while (allBids.length < MIN_BIDS) {

            logger.info(`Reading page ${currentPage}...`);

            const bids = await extractListingData(page);

            const validBids = bids.filter(
                bid => bid.result_url
            );

            logger.info(
                `Found ${validBids.length} valid bids`
            );

            allBids.push(...validBids);

            logger.info(
                `Collected ${allBids.length}/${MIN_BIDS}`
            );

            if (allBids.length >= MIN_BIDS) {
                break;
            }


            /* --------------------------------------
               GO TO NEXT PAGE
            -------------------------------------- */

            const nextBtn =
                page.locator("a.page-link.next");

            if (await nextBtn.count() === 0) {

                logger.warn("No more pages found");

                break;
            }

            const oldFirstBid =
                bids[0]?.bid_id || null;

            await nextBtn.click();

            logger.info("Loading next page...");

            let loaded = false;

            for (let i = 0; i < 20; i++) {

                await page.waitForTimeout(500);

                const newBids =
                    await extractListingData(page);

                const newFirstBid =
                    newBids[0]?.bid_id || null;

                if (
                    newFirstBid &&
                    newFirstBid !== oldFirstBid
                ) {
                    loaded = true;
                    currentPage++;
                    break;
                }
            }

            if (!loaded) {

                logger.warn(
                    "Next page failed to load"
                );

                break;
            }
        }

        logger.success(
            `Collected ${allBids.length} listings`
        );


        /* ------------------------------------------
           EXTRACT DETAILS
        ------------------------------------------ */

        const finalData = [];

        logger.info("Starting detail extraction...");

        for (let i = 0; i < allBids.length; i++) {

            const bid = allBids[i];

            logger.info(
                `[${i + 1}/${allBids.length}] ${bid.bid_id}`
            );

            const detailsPage =
                await context.newPage();

            try {

                await openPage(
                    detailsPage,
                    bid.result_url
                );

                const details =
                    await extractBidDetails(detailsPage);

                logger.info(
                    `Winner: ${details.winner_name}`
                );

                const mergedBid = {
                    ...bid,
                    winner_name: details.winner_name,
                    winner_price: details.winner_price,
                    num_bidders: details.num_bidders,
                    vendors: details.vendors
                };

                const cleaned =
                    cleanBidRecord(mergedBid);

                finalData.push(cleaned);

            } catch (error) {

                logger.error(
                    `Failed bid ${bid.bid_id}`,
                    error
                );

            } finally {

                await detailsPage.close();
            }

            // Small delay
            await page.waitForTimeout(1000);
        }

        logger.success(
            `Processed ${finalData.length} bids`
        );


        /* ------------------------------------------
           EXPORT FILES
        ------------------------------------------ */

        const outputDir = path.join(
            __dirname,
            "outputs"
        );

        await exportData(finalData, outputDir);

        generateInsights(finalData, outputDir);

        logger.success("Scraper completed!");

    } catch (error) {

        logger.error(
            "Scraper crashed",
            error
        );

    } finally {

        logger.info("Closing browser...");

        await browser.close();

        logger.success("Done.");
    }
}


/* ---------------------------------------------------
   AUTO RUN
--------------------------------------------------- */

if (require.main === module) {
    runScraper();
}

module.exports = {
    runScraper
};