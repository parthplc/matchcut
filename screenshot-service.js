require('dotenv').config();
const screenshotone = require('screenshotone-api-sdk');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

class ScreenshotService {
    constructor() {
        this.screenshotDir = path.join(__dirname, 'screenshots');
        this.tempDir = path.join(__dirname, 'screenshots', 'temp');
        this.processedDir = path.join(__dirname, 'screenshots', 'processed');
        this.maxRetries = 1;
        this.retryDelay = 500;
        
        // Initialize ScreenshotOne client
        this.client = new screenshotone.Client(process.env.ACCESS_KEY, process.env.SECRET_KEY);
        
        console.log('📸 ScreenshotOne API initialized');
        console.log(`   Access Key: ${process.env.ACCESS_KEY ? 'Set' : 'Missing'}`);
        console.log(`   Secret Key: ${process.env.SECRET_KEY ? 'Set' : 'Missing'}`);
    }

    generateFileName(articleId, timestamp = Date.now()) {
        return `${timestamp}_${articleId}.png`;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async captureScreenshot(url, articleId, options = {}) {
        const fileName = this.generateFileName(articleId);
        const filePath = path.join(this.screenshotDir, fileName);
        
        const defaultOptions = {
            format: 'png',
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

        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`Capturing screenshot for ${url} (attempt ${attempt}/${this.maxRetries})`);
                
                // Build ScreenshotOne request options using TakeOptions
                let opts = screenshotone.TakeOptions
                    .url(url)
                    .viewportWidth(defaultOptions.viewport_width)
                    .viewportHeight(defaultOptions.viewport_height)
                    .deviceScaleFactor(defaultOptions.device_scale_factor)
                    .format(defaultOptions.format)
                    .delay(defaultOptions.delay)
                    .timeout(defaultOptions.timeout)
                    .fullPage(defaultOptions.full_page);

                // Add blocking options - allow cookies and ads, but block popups
                opts = opts
                    .blockAds(defaultOptions.blockAds)
                    .blockCookieBanners(defaultOptions.blockCookieBanners)
                    .blockTrackers(false)
                    .hideSelectors(this.getSelectorsToHide(defaultOptions).join(','))
                    .scripts([this.getCleaningScript(defaultOptions)])
                    .styles(this.getCleaningCSS(defaultOptions));

                // Generate the screenshot URL
                const screenshotUrl = await this.client.generateTakeURL(opts);
                console.log(`📸 Using ScreenshotOne API: ${screenshotUrl.substring(0, 100)}...`);

                // Make the API request directly for the image
                const response = await axios.get(screenshotUrl, {
                    responseType: 'stream',
                    timeout: (defaultOptions.timeout + 10) * 1000 // Add buffer to timeout
                });

                // Save the image directly
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

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
                    api: 'ScreenshotOne',
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
            api: 'ScreenshotOne'
        };
    }

    async batchCapture(articles, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 5; // Optimized for API
        const batchDelay = options.batchDelay || 500; // Reduced delay for API
        const targetCount = options.targetCount || articles.length;

        console.log(`Starting batch capture of ${articles.length} articles with batch size ${batchSize}`);
        console.log(`📸 Using ScreenshotOne API with popup blocking (allowing cookies and ads)`);
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
                api: 'ScreenshotOne',
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

            console.log(`Cleaned up ${deletedCount} old screenshot files`);
            return deletedCount;
        } catch (error) {
            console.error(`Error cleaning up screenshots: ${error.message}`);
            return 0;
        }
    }

    // Test API connectivity
    async testConnection() {
        try {
            const testOptions = screenshotone.TakeOptions
                .url('https://example.com')
                .viewportWidth(800)
                .viewportHeight(600)
                .format('png');

            const testUrl = await this.client.generateTakeURL(testOptions);
            console.log('🧪 Testing ScreenshotOne API connection...');
            
            const response = await axios.get(testUrl, { 
                timeout: 10000,
                responseType: 'stream'
            });
            
            if (response.status === 200) {
                console.log('✅ ScreenshotOne API connection successful');
                return true;
            } else {
                console.log('❌ ScreenshotOne API test failed with status:', response.status);
                return false;
            }
        } catch (error) {
            console.log('❌ ScreenshotOne API connection failed:', error.message);
            return false;
        }
    }
}

module.exports = ScreenshotService;