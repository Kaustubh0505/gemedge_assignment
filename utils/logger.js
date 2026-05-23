/**
 * Logging Utility for the GeM BidPlus Scraper
 * Outputs structured logs with timestamps and log levels.
 */

const colors = {
    reset: "\x1b[0m",
    info: "\x1b[36m",    // Cyan
    success: "\x1b[32m", // Green
    warn: "\x1b[33m",    // Yellow
    error: "\x1b[31m"    // Red
};

function getTimestamp() {
    return new Date().toISOString();
}

const logger = {
    info: (msg) => {
        console.log(`${colors.info}[INFO] [${getTimestamp()}] ${msg}${colors.reset}`);
    },
    success: (msg) => {
        console.log(`${colors.success}[SUCCESS] [${getTimestamp()}] ${msg}${colors.reset}`);
    },
    warn: (msg) => {
        console.log(`${colors.warn}[WARNING] [${getTimestamp()}] ${msg}${colors.reset}`);
    },
    error: (msg, error = null) => {
        if (error) {
            console.error(`${colors.error}[ERROR] [${getTimestamp()}] ${msg}${colors.reset}`, error);
        } else {
            console.error(`${colors.error}[ERROR] [${getTimestamp()}] ${msg}${colors.reset}`);
        }
    }
};

module.exports = logger;
