require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class ScreenshotService {
    constructor() {
        this.screenshotDir = path.join(__dirname, 'screenshots', 'raw');
        this.tempDir = path.join(__dirname, 'screenshots', 'temp');
        this.processedDir = path.join(__dirname, 'screenshots', 'processed');
        this.maxRetries = 1;
        this.retryDelay = 500;
        
        // Ensure the raw directory exists
        fs.ensureDirSync(this.screenshotDir);
        
        // Initialize ScreenshotAPI client
        this.apiKey = process.env.API_KEY_SCREENSHOTAPI;
        this.baseUrl = 'https://shot.screenshotapi.net/v3/screenshot';
        
        console.log('📸 ScreenshotAPI.net initialized');
        console.log(`   API Key: ${this.apiKey ? 'Set' : 'Missing'}`);
    }

    generateFileName(articleId, timestamp = Date.now(), format = 'jpeg') {
        return `${timestamp}_${articleId}.${format}`;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async captureScreenshot(url, articleId, options = {}) {
        const defaultOptions = {
            format: 'jpeg',
            viewport_width: 1920,
            viewport_height: 1080,
            device_scale_factor: 1,
            wait_until: 'load',
            delay: 3,
            timeout: 30,
            full_page: true,
            blockAds: false,
            blockCookieBanners: false,
            blockPopups: true,
            ...options
        };

        const fileName = this.generateFileName(articleId, Date.now(), defaultOptions.format);
        const filePath = path.join(this.screenshotDir, fileName);

        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`Capturing screenshot for ${url} (attempt ${attempt}/${this.maxRetries})`);
                
                // Build ScreenshotAPI request parameters
                const params = new URLSearchParams({
                    token: this.apiKey,
                    url: url,
                    output: 'file',
                    file_type: defaultOptions.format,
                    viewport_width: defaultOptions.viewport_width,
                    viewport_height: defaultOptions.viewport_height,
                    full_page: defaultOptions.full_page,
                    delay: defaultOptions.delay * 1000, // Convert to milliseconds
                    timeout: defaultOptions.timeout * 1000, // Convert to milliseconds
                    device_scale_factor: defaultOptions.device_scale_factor
                });

                // Add blocking options if enabled
                if (defaultOptions.blockAds) {
                    params.append('block_ads', 'true');
                }
                if (defaultOptions.blockCookieBanners) {
                    params.append('block_cookie_banners', 'true');
                }
                if (defaultOptions.blockPopups) {
                    params.append('block_popups', 'true');
                }

                // Build the full API URL
                const screenshotUrl = `${this.baseUrl}?${params.toString()}`;
                console.log(`📸 Using ScreenshotAPI: ${screenshotUrl.substring(0, 100)}...`);

                // Make the API request to get the JSON response
                const response = await axios.get(screenshotUrl, {
                    timeout: (defaultOptions.timeout + 10) * 1000 // Add buffer to timeout
                });

                // Parse the JSON response to get the screenshot URL
                const screenshotData = response.data;
                if (!screenshotData || !screenshotData.screenshot) {
                    throw new Error('Invalid API response: missing screenshot URL');
                }

                console.log(`🔗 Screenshot URL: ${screenshotData.screenshot}`);

                // Download the actual image from the screenshot URL
                const imageResponse = await axios.get(screenshotData.screenshot, {
                    responseType: 'stream',
                    timeout: 30000 // 30 second timeout for image download
                });

                // Save the image to local file
                const writer = fs.createWriteStream(filePath);
                imageResponse.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                console.log(`Screenshot captured successfully: ${fileName}`);
                return {
                    success: true,
                    filePath: filePath,
                    fileName: fileName,
                    url: url,
                    articleId: articleId,
                    timestamp: Date.now(),
                    api: 'ScreenshotAPI',
                    options: defaultOptions
                };
                
            } catch (error) {
                lastError = error;
                console.log(`Screenshot attempt ${attempt} failed for ${url}: ${error.message}`);
                
                if (attempt < this.maxRetries) {
                    console.log(`Retrying in ${this.retryDelay}ms...`);
                    await this.delay(this.retryDelay);
                }
            }
        }

        console.error(`Failed to capture screenshot for ${url} after ${this.maxRetries} attempts: ${lastError.message}`);
        return {
            success: false,
            error: lastError.message,
            url: url,
            articleId: articleId,
            timestamp: Date.now(),
            api: 'ScreenshotAPI'
        };
    }

    async batchCapture(articles, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5; // Optimized for API
        const batchDelay = options.batchDelay || 500; // Reduced delay for API
        const targetCount = options.targetCount || articles.length;

        console.log(`Starting batch capture of ${articles.length} articles with batch size ${batchSize}`);
        console.log(`📸 Using ScreenshotAPI with popup blocking (allowing cookies and ads)`);
        console.log(`🎯 Target: ${targetCount} successful screenshots`);

        let articleIndex = 0;
        let successfulCount = 0;
        
        while (successfulCount < targetCount && articleIndex < articles.length) {
            const remainingNeeded = targetCount - successfulCount;
            const currentBatchSize = Math.min(batchSize, remainingNeeded, articles.length - articleIndex);
            const batch = articles.slice(articleIndex, articleIndex + currentBatchSize);
            
            console.log(`Processing batch: ${batch.length} articles (${successfulCount}/${targetCount} captured)`);

            // For API services, process sequentially to avoid rate limits
            const batchResults = [];
            for (const article of batch) {
                const articleId = article.id || article.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
                const result = await this.captureScreenshot(article.decodedUrl || article.url, articleId, options);
                batchResults.push(result);
                
                if (result.success) {
                    successfulCount++;
                    console.log(`✅ Success count: ${successfulCount}/${targetCount}`);
                    
                    // Check if we've reached target
                    if (successfulCount >= targetCount) {
                        console.log(`🎯 Target reached! Captured ${successfulCount} screenshots`);
                        break;
                    }
                }
                
                // Small delay between individual requests in batch
                if (batch.indexOf(article) < batch.length - 1) {
                    await this.delay(100);
                }
            }
            
            results.push(...batchResults);
            articleIndex += currentBatchSize;

            // Continue with next batch if we haven't reached target
            if (successfulCount < targetCount && articleIndex < articles.length) {
                console.log(`Waiting ${batchDelay}ms before next batch...`);
                await this.delay(batchDelay);
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`Batch capture completed: ${successful} successful, ${failed} failed`);
        
        return {
            results: results,
            summary: {
                total: results.length,
                successful: successful,
                failed: failed,
                successRate: ((successful / results.length) * 100).toFixed(2) + '%',
                api: 'ScreenshotAPI',
                targetReached: successful >= targetCount
            }
        };
    }

    getSelectorsToHide(options = {}) {
        const selectors = [];

        if (options.blockCookieBanners) {
            selectors.push(
                // Cookie banners and GDPR notices
                '[class*="cookie" i]', '[id*="cookie" i]', '[class*="gdpr" i]',
                '[id*="gdpr" i]', '[class*="consent" i]', '[id*="consent" i]',
                '[class*="privacy" i]', '[data-testid*="cookie" i]'
            );
        }

        if (options.blockAds) {
            selectors.push(
                // Advertisement containers
                '[class*="ad" i]:not([class*="read" i]):not([class*="head" i])',
                '[id*="ad" i]:not([id*="read" i]):not([id*="head" i])',
                '[class*="advertisement" i]', '[class*="sponsor" i]',
                '[class*="promo" i]', '.ad-container', '.ads', '.banner'
            );
        }

        if (options.blockPopups) {
            selectors.push(
                // Pop-ups and overlays that interrupt content
                '[class*="popup" i]', '[class*="modal" i]:not([class*="modal-content" i])', 
                '[class*="overlay" i]', '[class*="lightbox" i]', '[class*="dialog" i]',
                
                // Newsletter signups and subscription popups
                '[class*="newsletter" i][class*="popup" i]', '[class*="subscribe" i][class*="modal" i]',
                '[class*="signup" i][class*="overlay" i]'
            );
        }

        return selectors;
    }

    getCleaningCSS(options = {}) {
        let css = '';

        if (options.blockCookieBanners) {
            css += `
                /* Hide cookie banners and consent forms */
                [class*="cookie" i], [id*="cookie" i], [class*="gdpr" i],
                [class*="consent" i], [class*="privacy-banner" i] {
                    display: none !important; visibility: hidden !important;
                    opacity: 0 !important; height: 0 !important; overflow: hidden !important;
                }
            `;
        }

        if (options.blockAds) {
            css += `
                /* Hide advertisements */
                [class*="ad" i]:not([class*="read" i]):not([class*="head" i]),
                [id*="ad" i]:not([id*="read" i]):not([id*="head" i]),
                [class*="advertisement" i], [class*="sponsor" i], [class*="promo" i] {
                    display: none !important; visibility: hidden !important;
                }
            `;
        }

        if (options.blockPopups) {
            css += `
                /* Hide pop-ups and modals that interrupt content */
                [class*="popup" i], [class*="modal" i]:not([class*="modal-content" i]),
                [class*="overlay" i], [class*="lightbox" i] {
                    display: none !important; visibility: hidden !important;
                }
                
                /* Remove fixed positioning that might interfere with popups */
                [class*="fixed" i][class*="popup" i], [class*="sticky" i][class*="modal" i] {
                    position: static !important; display: none !important;
                }
                
                /* Hide newsletter signup popups */
                [class*="newsletter" i][class*="popup" i], [class*="subscribe" i][class*="modal" i] {
                    display: none !important;
                }
            `;
        }

        css += `
            /* Clean up body overflow and scrollbars */
            body { overflow-x: hidden !important; }
        `;

        return css;
    }

    getCleaningScript(options = {}) {
        let script = 'setTimeout(() => {\n';

        if (options.blockCookieBanners) {
            script += `
                const cookieSelectors = [
                    '[class*="cookie" i]', '[id*="cookie" i]', '[class*="gdpr" i]',
                    '[class*="consent" i]', '[data-testid*="cookie" i]'
                ];
                cookieSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        if (el.offsetHeight > 0 || el.offsetWidth > 0) el.remove();
                    });
                });
            `;
        }

        if (options.blockAds) {
            script += `
                const adSelectors = [
                    '[class*="ad"]:not([class*="read"]):not([class*="head"])', '[id*="ad"]:not([id*="read"]):not([id*="head"])',
                    '[class*="advertisement"]', '[class*="sponsor"]', 'iframe[src*="googlesyndication"]', 'iframe[src*="doubleclick"]'
                ];
                adSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => el.remove());
                });
            `;
        }

        if (options.blockPopups) {
            script += `
                const popupSelectors = [
                    '[class*="popup" i]', '[class*="modal" i]:not([class*="modal-content" i])',
                    '[class*="overlay" i]', '[class*="lightbox" i]', '[class*="dialog" i]'
                ];
                popupSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        if (el.style.position === 'fixed' || el.style.position === 'absolute') {
                            el.remove();
                        }
                    });
                });
            `;
        }

        script += `
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }, 1000);`;

        return script;
    }

    async cleanupOldScreenshots(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            const files = await fs.readdir(this.screenshotDir);
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.screenshotDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
                    await fs.remove(filePath);
                    deletedCount++;
                }
            }

            console.log(`Cleaned up ${deletedCount} old screenshot files from raw directory`);
            return deletedCount;
        } catch (error) {
            console.error(`Error cleaning up screenshots: ${error.message}`);
            return 0;
        }
    }

    // Test API connectivity
    async testConnection() {
        try {
            const params = new URLSearchParams({
                token: this.apiKey,
                url: 'https://example.com',
                output: 'file',
                file_type: 'png',
                viewport_width: 800,
                viewport_height: 600
            });

            const testUrl = `${this.baseUrl}?${params.toString()}`;
            console.log('🧪 Testing ScreenshotAPI connection...');
            
            const response = await axios.get(testUrl, { 
                timeout: 10000
            });
            
            if (response.status === 200 && response.data && response.data.screenshot) {
                console.log('✅ ScreenshotAPI connection successful');
                console.log(`📸 Test screenshot URL: ${response.data.screenshot}`);
                return true;
            } else {
                console.log('❌ ScreenshotAPI test failed with status:', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ ScreenshotAPI connection failed:', error.message);
            return false;
        }
    }
}

module.exports = ScreenshotService;