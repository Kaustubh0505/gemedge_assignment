/**
 * Export data into JSON + CSV
 */

const fs = require("fs");
const path = require("path");

const createCsvWriter =
    require("csv-writer").createObjectCsvWriter;

const logger = require("./utils/logger");


/* ---------------------------------------------------
   CREATE OUTPUT FOLDER
--------------------------------------------------- */

function ensureFolder(folderPath) {

    if (!fs.existsSync(folderPath)) {

        fs.mkdirSync(folderPath, {
            recursive: true
        });
    }
}


/* ---------------------------------------------------
   CONVERT BIDS → FLAT CSV ROWS
--------------------------------------------------- */

function flattenBidData(bids) {

    const rows = [];

    for (const bid of bids) {

        // If vendors exist
        if (bid.vendors?.length) {

            for (const vendor of bid.vendors) {

                rows.push({
                    bid_id: bid.bid_id,
                    category: bid.category,
                    buyer: bid.buyer,
                    quantity: bid.quantity,
                    bid_value: bid.bid_value,
                    award_date: bid.award_date,

                    winner_name: bid.winner_name,
                    winner_price: bid.winner_price,
                    num_bidders: bid.num_bidders,

                    vendor_name: vendor.vendor_name,
                    vendor_price: vendor.vendor_price,
                    vendor_rank: vendor.rank,

                    status_flag: vendor.status_flag,
                });
            }

        } else {

            // Fallback if no vendors exist
            rows.push({
                bid_id: bid.bid_id,
                category: bid.category,
                buyer: bid.buyer,
                quantity: bid.quantity,
                bid_value: bid.bid_value,
                award_date: bid.award_date,

                winner_name: bid.winner_name,
                winner_price: bid.winner_price,
                num_bidders: bid.num_bidders,

                vendor_name: "N/A",
                vendor_price: "N/A",
                vendor_rank: "N/A",

                status_flag: "N/A",
            });
        }
    }

    return rows;
}


/* ---------------------------------------------------
   EXPORT FUNCTION
--------------------------------------------------- */

async function exportData(
    bids,
    outputDir = path.join(__dirname, "outputs")
) {

    try {

        ensureFolder(outputDir);

        const jsonFile =
            path.join(outputDir, "bids_data.json");

        const csvFile =
            path.join(outputDir, "bids_data.csv");


        /* ------------------------------------------
           SAVE JSON
        ------------------------------------------ */

        fs.writeFileSync(
            jsonFile,
            JSON.stringify(bids, null, 2),
            "utf8"
        );

        logger.success(
            `JSON saved → ${jsonFile}`
        );


        /* ------------------------------------------
           PREPARE CSV DATA
        ------------------------------------------ */

        const records = flattenBidData(bids);


        /* ------------------------------------------
           CSV WRITER
        ------------------------------------------ */

        const csvWriter = createCsvWriter({

            path: csvFile,

            header: [

                { id: "bid_id", title: "bid_id" },
                { id: "category", title: "category" },
                { id: "buyer", title: "buyer" },

                { id: "quantity", title: "quantity" },
                { id: "bid_value", title: "bid_value" },

                { id: "award_date", title: "award_date" },

                { id: "winner_name", title: "winner_name" },
                { id: "winner_price", title: "winner_price" },

                { id: "num_bidders", title: "num_bidders" },

                { id: "vendor_name", title: "vendor_name" },
                { id: "vendor_price", title: "vendor_price" },

                { id: "vendor_rank", title: "vendor_rank" },

                { id: "status_flag", title: "status_flag" },
            ]
        });


        /* ------------------------------------------
           WRITE CSV
        ------------------------------------------ */

        await csvWriter.writeRecords(records);

        logger.success(
            `CSV saved → ${csvFile} (${records.length} rows)`
        );

    } catch (error) {

        logger.error(
            "Export failed",
            error
        );

        throw error;
    }
}


module.exports = {
    exportData
};