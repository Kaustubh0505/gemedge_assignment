/**
 * Data Cleaning & Anomaly Detection Utilities
 */

const logger = require("./logger");

/**
 * Normalizes vendor names to a standard, clean format.
 * - Trims whitespace
 * - Converts to uppercase
 * - Strips out tags like "(MII)", "(MSE)", "Under PMA", etc.
 * - Collapses multiple spaces
 */
function normalizeVendorName(name) {
    if (!name) return "N/A";
    let cleaned = name.toString();
    
    // Remove bracketed items containing procurement/category codes (e.g., MSE Social Category details)
    cleaned = cleaned.replace(/\((?:[^)]*?(?:mse|mii|pma|social category|general|sc|st|obc)[^)]*?)\)/gi, "");
    
    // Remove individual standalone suffixes
    cleaned = cleaned.replace(/under pma/gi, "");
    
    // Replace multiple spaces/non-breaking spaces with single space
    cleaned = cleaned.replace(/[\s\xa0]+/g, " ");
    
    // Trim and uppercase
    return cleaned.trim().toUpperCase();
}

/**
 * Parses numeric values safely, stripping currency symbols and commas.
 */
function parseNumeric(val) {
    if (val === null || val === undefined) return 0;
    const str = val.toString().replace(/[^0-9.]/g, "");
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Cleans a single bid record and runs anomaly checks.
 */
function cleanBidRecord(bid) {
    const cleaned = {
        bid_id: (bid.bid_id || "N/A").trim(),
        category: (bid.category || "N/A").trim().replace(/[\s\xa0]+/g, " "),
        buyer: (bid.buyer || "N/A").trim().replace(/[\s\xa0]+/g, " "),
        quantity: parseNumeric(bid.quantity),
        bid_value: parseNumeric(bid.bid_value),
        award_date: (bid.award_date || "N/A").trim(),
        winner_name: normalizeVendorName(bid.winner_name),
        winner_price: parseNumeric(bid.winner_price),
        num_bidders: parseNumeric(bid.num_bidders),
        vendors: []
    };

    // Use winner_price as fallback for bid_value if bid_value is empty/0
    if (cleaned.bid_value === 0 && cleaned.winner_price > 0) {
        cleaned.bid_value = cleaned.winner_price;
    }

    if (Array.isArray(bid.vendors)) {
        const seenNames = new Set();
        const duplicates = [];

        for (const vendor of bid.vendors) {
            const normalizedName = normalizeVendorName(vendor.vendor_name);
            const statusFlag = (vendor.status_flag || "Qualified").trim();
            const price = parseNumeric(vendor.vendor_price);
            
            // Check for duplicate vendors in the same bid
            if (seenNames.has(normalizedName)) {
                duplicates.push(normalizedName);
                continue; // Skip duplicate record to keep it clean
            }
            seenNames.add(normalizedName);

            cleaned.vendors.push({
                vendor_name: normalizedName,
                vendor_price: price > 0 ? price : "N/A",
                rank: (vendor.rank || "N/A").trim().toUpperCase(),
                status_flag: statusFlag,
            });
        }

        if (duplicates.length > 0) {
            logger.warn(`Duplicate vendor(s) detected in bid ${cleaned.bid_id}: ${duplicates.join(", ")}`);
        }
    }

    // Run anomaly detection: check if winner is NOT the lowest bidder among qualified ones
    cleaned.anomaly_winner_not_lowest = false;
    
    // Find all qualified vendors with a valid price
    const qualifiedVendors = cleaned.vendors.filter(v => v.status_flag === "Qualified" && typeof v.vendor_price === "number");
    
    if (qualifiedVendors.length > 0 && cleaned.winner_price > 0) {
        // Find the minimum price among qualified vendors
        const minQualifiedPrice = Math.min(...qualifiedVendors.map(v => v.vendor_price));
        
        // If winner's price is greater than the minimum qualified price, flag it!
        if (cleaned.winner_price > minQualifiedPrice) {
            cleaned.anomaly_winner_not_lowest = true;
            logger.warn(`Anomaly detected in bid ${cleaned.bid_id}: Winner '${cleaned.winner_name}' (price: ${cleaned.winner_price}) is NOT the lowest bidder (lowest qualified price: ${minQualifiedPrice})`);
        }
    }

    return cleaned;
}

module.exports = {
    normalizeVendorName,
    parseNumeric,
    cleanBidRecord
};
