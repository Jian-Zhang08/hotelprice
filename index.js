require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');

/**
 * Hotel Price Monitor for Yellowstone National Park
 * Monitors hotel availability and prices, alerting when prices drop below threshold
 */
class YellowstoneHotelMonitor {
    constructor() {
        // Load configuration
        this.config = this.loadConfig();
        
        // Override Discord webhook from environment variable if available
        if (process.env.DISCORD_WEBHOOK_URL) {
            this.config.notifications.discordWebhook = process.env.DISCORD_WEBHOOK_URL;
        }
        
        this.baseUrl = this.config.api.baseUrl;
        this.priceThreshold = this.config.monitoring.priceThreshold;
        this.excludedHotels = this.config.exclusions.hotelCodes;
        this.excludedSuffixes = this.config.exclusions.suffixes;
        this.dateRange = this.generateDateRange(
            this.config.monitoring.startDate, 
            this.config.monitoring.endDate
        );
        this.previousPrices = new Map();
        this.nextCheckTime = null;
        this.countdownInterval = null;
        
        // Rate limiting for Discord notifications
        this.discordQueue = [];
        this.isProcessingDiscordQueue = false;
        this.lastDiscordNotification = 0;
        this.discordRateLimit = 2000; // Minimum time between notifications (2 seconds)
        
        console.log('🏨 Yellowstone Hotel Price Monitor initialized');
        console.log(`📅 Monitoring dates: ${this.dateRange.join(', ')}`);
        console.log(`💰 Alert threshold: $${this.priceThreshold}`);
        console.log(`🚫 Excluded hotels: ${this.excludedHotels.join(', ')}, and hotels ending with ${this.excludedSuffixes.join(', ')}`);
    }

    /**
     * Load configuration from config.json file
     * @returns {Object} Configuration object
     */
    loadConfig() {
        try {
            const configData = fs.readFileSync('config.json', 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            console.error('❌ Error loading config.json:', error.message);
            console.log('📝 Using default configuration...');
            return {
                monitoring: {
                    startDate: "06/28/2025",
                    endDate: "07/01/2025",
                    priceThreshold: 225,
                    checkIntervalMinutes: 30
                },
                exclusions: {
                    hotelCodes: ["YLMH", "YLRL"],
                    suffixes: [":RV"]
                },
                api: {
                    baseUrl: "https://webapi.xanterra.net/v1/api/availability/hotels/yellowstonenationalparklodges",
                    timeout: 5000,
                    userAgent: "Yellowstone-Hotel-Monitor/1.0.0"
                }
            };
        }
    }

    /**
     * Generate array of dates between start and end date
     * @param {string} startDate - Start date in MM/DD/YYYY format
     * @param {string} endDate - End date in MM/DD/YYYY format
     * @returns {Array<string>} Array of date strings
     */
    generateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dates = [];
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            dates.push(`${month}/${day}/${year}`);
        }
        
        return dates;
    }

    /**
     * Format date for URL encoding
     * @param {string} date - Date in MM/DD/YYYY format
     * @returns {string} URL encoded date
     */
    formatDateForUrl(date) {
        return date.replace(/\//g, '%2F');
    }

    /**
     * Check if hotel should be excluded from monitoring
     * @param {string} hotelCode - Hotel code to check
     * @returns {boolean} True if hotel should be excluded
     */
    shouldExcludeHotel(hotelCode) {
        return this.excludedHotels.includes(hotelCode) || 
               this.excludedSuffixes.some(suffix => hotelCode.endsWith(suffix));
    }

    /**
     * Fetch availability data (single request returns multiple dates)
     * @param {string} startDate - Start date in MM/DD/YYYY format
     * @param {number} maxRetries - Maximum number of retry attempts
     * @returns {Promise<Object|null>} Availability data or null if error
     */
    async fetchAvailability(startDate, maxRetries = 5) {
        const encodedDate = this.formatDateForUrl(startDate);
        // const url = `${this.baseUrl}?date=${encodedDate}&limit=1&is_group=false`;
        const url ="https://webapi.xanterra.net/v1/api/availability/hotels/yellowstonenationalparklodges?date=06%2F28%2F2025&limit=31&is_group=false";
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 Fetching data (attempt ${attempt}/${maxRetries})...`);
                
                const response = await axios.get(url, {
                    timeout: this.config.api.timeout,
                    headers: {
                        'User-Agent': this.config.api.userAgent
                    }
                });
                
                console.log(`✅ Data fetched successfully on attempt ${attempt}`);
                return response.data;
                
            } catch (error) {
                const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
                const isLastAttempt = attempt === maxRetries;
                
                if (isTimeout && !isLastAttempt) {
                    const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                    console.log(`⏱️  Timeout on attempt ${attempt}/${maxRetries}, retrying in ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    console.error(`❌ Error fetching availability data (attempt ${attempt}/${maxRetries}):`, error.message);
                    if (isLastAttempt) {
                        console.log(`🚫 All ${maxRetries} attempts failed`);
                        return null;
                    }
                }
            }
        }
        
        return null;
    }



    /**
     * Send Discord webhook notification
     * @param {string} message - Message to send
     * @param {string} [type='info'] - Type of notification (info, alert, error)
     */
    async sendDiscordAlert(message, type = 'info') {
        if (!this.config.notifications.discordWebhook) {
            console.log('⚠️ Discord webhook URL not configured');
            return;
        }

        try {
            const color = {
                info: 0x3498db,    // Blue
                alert: 0xe74c3c,    // Red
                error: 0xe67e22     // Orange
            }[type] || 0x3498db;

            const embed = {
                title: '🏨 Yellowstone Hotel Monitor',
                description: message,
                color: color,
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Yellowstone Hotel Price Monitor'
                }
            };

            const payload = { embeds: [embed] };

            await axios.post(this.config.notifications.discordWebhook, payload);
            console.log('💬 Discord alert sent successfully!');
        } catch (error) {
            console.error('❌ Discord webhook error:', error.message);
            if (error.response?.status === 429) {
                // If we hit rate limit, wait longer and retry
                await new Promise(resolve => setTimeout(resolve, 5000));
                this.discordQueue.unshift({ message, type });
            }
        }
    }

    /**
     * Process hotel data and check for price alerts
     * @param {Object} availabilityData - Raw availability data from API
     * @param {string} date - Date being processed
     */
    processHotelData(availabilityData, date) {
        if (!availabilityData?.availability?.[date]) {
            console.log(`⚠️  No availability data found for ${date}`);
            return;
        }

        const hotels = availabilityData.availability[date];
        let alertsFound = false;

        // Special check for YLRL on 06/29/2025
        const isSpecialDate = date === '06/29/2025';
        const specialHotelCode = 'YLRL';
        const specialPriceThreshold = 200;

        Object.entries(hotels).forEach(async ([hotelCode, hotelData]) => {
            // Special case handling for YLRL on 06/29/2025
            if (isSpecialDate && hotelCode === specialHotelCode) {
                if (hotelData.status === 'OPEN' && typeof hotelData.min === 'number' && hotelData.min > 0) {
                    const minPrice = hotelData.min;
                    const maxPrice = hotelData.max;
                    
                    // Only send notification if price is below special threshold
                    if (minPrice < specialPriceThreshold) {
                        const alertMessage = `**SPECIAL PRICE ALERT!** 🚨\nHotel: ${hotelCode}\nDate: ${date}\nPrice: $${minPrice}\nStatus: Below $${specialPriceThreshold} threshold!\nTime: ${new Date().toLocaleString()}`;
                        this.sendDiscordAlert(alertMessage, 'alert');
                        console.log(`🚨 SPECIAL ALERT! ${hotelCode} on ${date}: $${minPrice} (below $${specialPriceThreshold} threshold)`);
                    }
                }
            }

            // Regular hotel processing
            if (this.shouldExcludeHotel(hotelCode)) {
                return; // Skip excluded hotels
            }

            if (hotelData.status !== 'OPEN') {
                return; // Skip closed hotels
            }

            const minPrice = hotelData.min;
            const maxPrice = hotelData.max;

            if (typeof minPrice === 'number' && minPrice > 0) {
                const priceKey = `${hotelCode}-${date}`;
                const previousPrice = this.previousPrices.get(priceKey);
                
                // Store current price
                this.previousPrices.set(priceKey, minPrice);

                // Check if price is below threshold
                if (minPrice < this.priceThreshold) {
                    console.log(`🚨 PRICE ALERT! ${hotelCode} on ${date}: $${minPrice} (below $${this.priceThreshold} threshold)`);
                    alertsFound = true;
                    this.sendAlert(hotelCode, date, minPrice, maxPrice);
                }

                // Check for price drops
                if (previousPrice && minPrice < previousPrice) {
                    const savings = previousPrice - minPrice;
                    console.log(`📉 Price drop detected! ${hotelCode} on ${date}: $${previousPrice} → $${minPrice} (saved $${savings.toFixed(2)})`);
                    const dropMessage = `**Price Drop Alert!** 📉\nHotel: ${hotelCode}\nDate: ${date}\nOld Price: $${previousPrice}\nNew Price: $${minPrice}\nSavings: $${savings.toFixed(2)}\nTime: ${new Date().toLocaleString()}`;
                    this.sendDiscordAlert(dropMessage, 'alert');
                }

                console.log(`📊 ${hotelCode} on ${date}: $${minPrice} - $${maxPrice}`);
            }
        });

        if (!alertsFound) {
            console.log(`✅ No price alerts for ${date} - all monitored hotels above $${this.priceThreshold}`);
        }
    }

    /**
     * Send alert notification
     * @param {string} hotelCode - Hotel code
     * @param {string} date - Date
     * @param {number} minPrice - Minimum price
     * @param {number} maxPrice - Maximum price
     */
    async sendAlert(hotelCode, date, minPrice, maxPrice) {
        const alertMessage = `**Price Alert!** 🚨
Hotel: ${hotelCode}
Date: ${date}
Price Range: $${minPrice} - $${maxPrice}
Status: Below $${this.priceThreshold} threshold!
Time: ${new Date().toLocaleString()}`;
        
        // Console notification
        if (this.config.notifications.console) {
            console.log(alertMessage);
        }

        // Discord notification
        await this.sendDiscordAlert(alertMessage, 'alert');
    }

    /**
     * Run a complete check cycle for all monitored dates
     */
    async runCheck() {
        const timestamp = new Date().toLocaleString();
        console.log(`\n🕐 Starting price check cycle at ${timestamp}`);
        console.log('═'.repeat(60));

        try {
            // Make single API request - the response includes all dates
            const data = await this.fetchAvailability(this.dateRange[0]); // Use first date, response includes all dates
            
            if (data && data.availability) {
                // Process each date from the single response
                for (const date of this.dateRange) {
                    console.log(`📊 Processing ${date}...`);
                    this.processHotelData(data, date);
                }
            } else {
                console.log('❌ No availability data received');
            }
            
        } catch (error) {
            console.error(`❌ Error fetching availability data:`, error.message);
        }

        console.log('═'.repeat(60));
        console.log(`✅ Check cycle completed at ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}`);
        
        // Set next check time
        this.setNextCheckTime();
    }

    /**
     * Set the next check time and start countdown
     */
    setNextCheckTime() {
        this.nextCheckTime = new Date();
        this.nextCheckTime.setMinutes(this.nextCheckTime.getMinutes() + this.config.monitoring.checkIntervalMinutes);
        
        this.startCountdown();
    }

    /**
     * Start countdown timer that updates every minute
     */
    startCountdown() {
        // Clear existing countdown if any
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        // Update countdown immediately
        this.updateCountdown();

        // Update countdown every minute
        this.countdownInterval = setInterval(() => {
            this.updateCountdown();
        }, 60000); // Update every minute
    }

    /**
     * Update and display countdown to next check
     */
    updateCountdown() {
        if (!this.nextCheckTime) return;

        const now = new Date();
        const timeLeft = this.nextCheckTime - now;
        
        if (timeLeft <= 0) {
            console.log('⏰ Next check starting now...');
            return;
        }

        const minutesLeft = Math.ceil(timeLeft / (1000 * 60));
        const nextCheckFormatted = this.nextCheckTime.toLocaleTimeString();
        
        // Clear previous line and write new countdown
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        process.stdout.write(`⏰ Next check in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} (at ${nextCheckFormatted})`);
    }

    async sendStartupNotification() {
        const now = new Date();
        const localTime = now.toLocaleString();
        const message = `**🏨 Yellowstone Hotel Price Monitor Started**
The monitor is now running and will check prices every ${this.config.monitoring.checkIntervalMinutes} minutes.

📅 Monitoring Dates: ${this.config.monitoring.startDate} to ${this.config.monitoring.endDate}
💰 Price Threshold: $${this.config.monitoring.priceThreshold}
⏰ Local Time: ${localTime}`;

        await this.sendDiscordAlert(message, 'info');
    }

    /**
     * Start the monitoring service
     */
    async start() {
        console.log('🏨 Yellowstone Hotel Price Monitor initialized');
        console.log(`📅 Monitoring dates: ${this.config.monitoring.startDate}, ${this.config.monitoring.endDate}`);
        console.log(`💰 Alert threshold: $${this.config.monitoring.priceThreshold}`);
        console.log(`🚫 Excluded hotels: ${this.config.exclusions.hotelCodes.join(', ')}, and hotels ending with ${this.config.exclusions.suffixes.join(', ')}`);
        
        // Send startup notification
        await this.sendStartupNotification();
        
        console.log('🚀 Starting Yellowstone Hotel Price Monitor...');
        console.log(`⏰ Monitor scheduled to run every ${this.config.monitoring.checkIntervalMinutes} minutes`);
        console.log('Press Ctrl+C to stop monitoring\n');

        // Initial check
        await this.runCheck();

        // Schedule regular checks
        const cronPattern = `*/${this.config.monitoring.checkIntervalMinutes} * * * *`;
        cron.schedule(cronPattern, () => {
            console.log(''); // New line before starting check
            this.runCheck();
        });
    }

    /**
     * Stop the monitoring service gracefully
     */
    stop() {
        console.log('\n🛑 Stopping Yellowstone Hotel Price Monitor...');
        
        // Clear countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received shutdown signal...');
    if (global.monitor && global.monitor.countdownInterval) {
        clearInterval(global.monitor.countdownInterval);
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received termination signal...');
    if (global.monitor && global.monitor.countdownInterval) {
        clearInterval(global.monitor.countdownInterval);
    }
    process.exit(0);
});

// Initialize and start the monitor
async function startMonitor() {
    const monitor = new YellowstoneHotelMonitor();
    global.monitor = monitor; // Make it accessible for cleanup
    await monitor.start();
}

startMonitor(); 
