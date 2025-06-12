const axios = require('axios');
const fs = require('fs');

/**
 * Test price notifications by simulating hotel price data
 */
async function testPriceNotifications() {
    try {
        // Load configuration
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        
        if (!config.notifications.discordWebhook) {
            console.error('❌ Discord webhook URL not found in config.json');
            return;
        }

        console.log('🔍 Testing price notifications...');

        // Test data with different price scenarios
        const testData = [
            {
                hotelCode: 'YLCL',
                date: '06/28/2025',
                minPrice: 452.61,
                maxPrice: 452.61
            },
            {
                hotelCode: 'YLGV',
                date: '06/29/2025',
                minPrice: 328.89,
                maxPrice: 328.89
            },
            {
                hotelCode: 'YLXX',
                date: '06/30/2025',
                minPrice: 180.00,
                maxPrice: 180.00
            }
        ];

        for (const test of testData) {
            const message = `**Price Found** 🏨
Hotel: ${test.hotelCode}
Date: ${test.date}
Price Range: $${test.minPrice} - $${test.maxPrice}
Time: ${new Date().toLocaleString()}`;

            const embed = {
                title: '🏨 Yellowstone Hotel Monitor - Test',
                description: message,
                color: 0x3498db, // Blue for info
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Test Notification'
                }
            };

            await axios.post(config.notifications.discordWebhook, {
                embeds: [embed]
            });

            console.log(`✅ Sent test notification for ${test.hotelCode} at $${test.minPrice}`);
            // Wait 2 seconds between messages
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('✨ All test notifications sent successfully!');
        console.log('📝 Check your Discord channel to verify the notifications were received.');

    } catch (error) {
        console.error('❌ Error testing price notifications:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testPriceNotifications(); 