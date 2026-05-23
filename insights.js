/**
 * Insights and Analytics Generation Engine
 */

const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");
const { parseNumeric } = require("./utils/dataCleaner");

/**
 * Generates summary insights from the scraped bids data.
 * @param {Array<Object>} bids Cleaned bid records
 * @param {string} outputDir Directory where outputs should be saved
 * @returns {Object} Calculated insights
 */
function generateInsights(bids, outputDir = path.join(__dirname, "outputs")) {
    logger.info("Generating procurement insights...");

    if (!Array.isArray(bids) || bids.length === 0) {
        logger.warn("No bids available to generate insights.");
        return null;
    }

    const totalBids = bids.length;

    // 1. Calculate % of bids with more than 3 participants
    const bidsWithMoreThan3 = bids.filter(bid => bid.num_bidders > 3).length;
    const participationRateMoreThan3 = totalBids > 0 ? (bidsWithMoreThan3 / totalBids) * 100 : 0;

    // 2. Calculate L1 vs L2 price gap
    let totalPriceGapAbs = 0;
    let totalPriceGapPct = 0;
    let bidsWithL2Count = 0;

    for (const bid of bids) {
        // Find L1 vendor
        const l1Vendor = bid.vendors.find(v => v.rank === "L1");
        // Find L2 vendor
        const l2Vendor = bid.vendors.find(v => v.rank === "L2");

        if (l1Vendor && l2Vendor) {
            const l1Price = parseNumeric(l1Vendor.vendor_price);
            const l2Price = parseNumeric(l2Vendor.vendor_price);

            if (l1Price > 0 && l2Price > 0) {
                const gapAbs = l2Price - l1Price;
                const gapPct = (gapAbs / l1Price) * 100;

                totalPriceGapAbs += gapAbs;
                totalPriceGapPct += gapPct;
                bidsWithL2Count++;
            }
        } else if (bid.vendors.length >= 2) {
            // Fallback: If ranks are not explicitly labeled, find the lowest and second lowest qualified vendor prices
            const qualified = bid.vendors
                .filter(v => v.status_flag === "Qualified" && typeof v.vendor_price === "number")
                .map(v => v.vendor_price)
                .sort((a, b) => a - b);

            if (qualified.length >= 2) {
                const l1Price = qualified[0];
                const l2Price = qualified[1];

                if (l1Price > 0) {
                    const gapAbs = l2Price - l1Price;
                    const gapPct = (gapAbs / l1Price) * 100;

                    totalPriceGapAbs += gapAbs;
                    totalPriceGapPct += gapPct;
                    bidsWithL2Count++;
                }
            }
        }
    }

    const avgL1L2GapAbs = bidsWithL2Count > 0 ? totalPriceGapAbs / bidsWithL2Count : 0;
    const avgL1L2GapPct = bidsWithL2Count > 0 ? totalPriceGapPct / bidsWithL2Count : 0;

    // 3. Repeat winners analysis
    const winnerCounts = {};
    for (const bid of bids) {
        const winner = bid.winner_name;
        if (winner && winner !== "N/A") {
            winnerCounts[winner] = (winnerCounts[winner] || 0) + 1;
        }
    }

    const repeatWinners = Object.entries(winnerCounts)
        .map(([name, wins]) => ({ vendor_name: name, win_count: wins }))
        .sort((a, b) => b.win_count - a.win_count);

    const insights = {
        total_bids_analyzed: totalBids,
        high_participation: {
            bids_with_gt_3_participants: bidsWithMoreThan3,
            percentage: parseFloat(participationRateMoreThan3.toFixed(2))
        },
        l1_l2_price_gap: {
            bids_with_l1_l2_comparison: bidsWithL2Count,
            average_absolute_gap: parseFloat(avgL1L2GapAbs.toFixed(2)),
            average_percentage_gap: parseFloat(avgL1L2GapPct.toFixed(2))
        },
        repeat_winners: repeatWinners
    };

    try {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const insightsPath = path.join(outputDir, "insights.json");
        fs.writeFileSync(insightsPath, JSON.stringify(insights, null, 2), "utf8");
        logger.success(`Successfully exported insights to ${insightsPath}`);
    } catch (err) {
        logger.error("Failed to write insights output", err);
    }

    return insights;
}

module.exports = {
    generateInsights
};
