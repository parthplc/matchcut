const axios = require('axios');
const cheerio = require('cheerio');

class GoogleNewsApiResolver {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        };
    }

    /**
     * Convert RSS URL to web URL
     */
    rssToWebUrl(rssUrl) {
        return rssUrl.replace('/rss/articles/', '/articles/').split('?')[0];
    }

    /**
     * Extract article ID from any Google News URL
     */
    extractArticleId(googleNewsUrl) {
        const match = googleNewsUrl.match(/\/articles\/([^?]+)/);
        return match ? match[1] : null;
    }

    /**
     * Get article URL using Google's internal API (your method)
     */
    async getArticleUrlViaApi(googleNewsUrl) {
        try {
            // Convert RSS URL to web URL if necessary
            const webUrl = this.rssToWebUrl(googleNewsUrl);
            console.log(`🔄 Converting to web URL: ${webUrl}`);

            // Fetch the Google News page
            const response = await axios.get(webUrl, { 
                headers: this.headers,
                timeout: 10000 
            });
            
            const $ = cheerio.load(response.data);
            
            // Look for the c-wiz element with data-p attribute
            const dataP = $('c-wiz[data-p]').attr('data-p');
            
            if (!dataP) {
                console.log('❌ No c-wiz[data-p] element found');
                return null;
            }

            console.log(`📊 Found data-p: ${dataP.substring(0, 100)}...`);

            // Parse the data-p attribute
            let obj;
            try {
                obj = JSON.parse(dataP.replace('%.@.', '["garturlreq",'));
            } catch (parseError) {
                console.log('❌ Failed to parse data-p JSON:', parseError.message);
                return null;
            }

            // Prepare the payload for Google's API
            const payload = {
                'f.req': JSON.stringify([[['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), 'null', 'generic']]])
            };

            const apiHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'User-Agent': this.headers['User-Agent'],
                'Referer': webUrl,
                'Origin': 'https://news.google.com'
            };

            console.log('🚀 Calling Google batch execute API...');

            // Call Google's internal API
            const postResponse = await axios.post(
                'https://news.google.com/_/DotsSplashUi/data/batchexecute', 
                new URLSearchParams(payload), 
                { 
                    headers: apiHeaders,
                    timeout: 10000
                }
            );

            console.log(`📡 API Response status: ${postResponse.status}`);
            console.log(`📄 Response data preview: ${postResponse.data.substring(0, 200)}...`);

            // Parse the response
            const cleanedResponse = postResponse.data.replace(")]}'", "");
            const parsedResponse = JSON.parse(cleanedResponse);
            
            if (parsedResponse && parsedResponse[0] && parsedResponse[0][2]) {
                const arrayString = parsedResponse[0][2];
                const innerParsed = JSON.parse(arrayString);
                
                if (innerParsed && innerParsed[1]) {
                    const articleUrl = innerParsed[1];
                    console.log(`✅ Successfully resolved: ${articleUrl}`);
                    return articleUrl;
                }
            }

            console.log('❌ Could not extract URL from API response');
            return null;

        } catch (error) {
            console.log(`❌ API resolution failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Fallback method using traditional redirect following
     */
    async getArticleUrlViaRedirect(googleNewsUrl) {
        try {
            const webUrl = this.rssToWebUrl(googleNewsUrl);
            
            const response = await axios.get(webUrl, {
                headers: this.headers,
                maxRedirects: 5,
                timeout: 8000
            });

            if (response.request && response.request.res && response.request.res.responseUrl) {
                const finalUrl = response.request.res.responseUrl;
                if (!finalUrl.includes('news.google.com')) {
                    return finalUrl;
                }
            }

            return null;
        } catch (error) {
            if (error.response && error.response.status >= 300 && error.response.status < 400) {
                const location = error.response.headers.location;
                if (location && !location.includes('news.google.com')) {
                    return location;
                }
            }
            return null;
        }
    }

    /**
     * Combined resolver that tries API first, then falls back to redirects
     */
    async resolveArticleUrl(googleNewsUrl) {
        console.log(`🎯 Resolving: ${googleNewsUrl}`);

        // Method 1: Try the API approach
        console.log('📡 Trying Google API method...');
        const apiUrl = await this.getArticleUrlViaApi(googleNewsUrl);
        if (apiUrl) {
            return {
                url: apiUrl,
                method: 'api',
                success: true
            };
        }

        // Method 2: Fallback to redirect following
        console.log('🔄 Trying redirect method...');
        const redirectUrl = await this.getArticleUrlViaRedirect(googleNewsUrl);
        if (redirectUrl) {
            return {
                url: redirectUrl,
                method: 'redirect',
                success: true
            };
        }

        return {
            url: googleNewsUrl,
            method: 'none',
            success: false
        };
    }

    /**
     * Batch resolve multiple URLs
     */
    async resolveMultipleUrls(googleNewsUrls, delay = 1000) {
        const results = [];
        
        for (let i = 0; i < googleNewsUrls.length; i++) {
            const url = googleNewsUrls[i];
            console.log(`\n🔍 Processing ${i + 1}/${googleNewsUrls.length}`);
            
            const result = await this.resolveArticleUrl(url);
            results.push({
                original: url,
                ...result
            });

            // Add delay to avoid rate limiting
            if (i < googleNewsUrls.length - 1) {
                console.log(`⏳ Waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        return results;
    }
}

// Test function
async function testApiResolver() {
    const resolver = new GoogleNewsApiResolver();
    
    // Test URLs from your paste
    const testUrls = [
        'https://news.google.com/rss/articles/CBMiWkFVX3lxTE4zdG02T0d3MmVXNmRLYTlmWHFzWlZ0cElObkZVSmhEZ1FybHp3NUp3a1BaaW1aUmszVUg1RDlYWGVpck0wRi04dkRtS2RZSlMxZXlLczZOV0NPd9IBX0FVX3lxTE41R3JSSkx5TDJfaGVsblF3Qm5wR0NBM21tWmVKOEJKMDZ4UGVHQklOaEdTdmJHaXhIa1pIOHFWM09ja2d5M0lUblhZUll1MlZWR0h0T0FNc1lyQkNjUXFF?oc=5',
        'https://news.google.com/rss/articles/CBMifEFVX3lxTFBkR0pWOFJLdXI3NFhCVVYwMDYxUVV4LTBpUXhMNkRDTTJhSUFiWk5BS3JqTW9xTlU2eEVBWFlvNTdCUDU1NlplZTRxd0twU0Nlbl91SUR3allpM1BFc3B2b0VrTmNZWGdXUWkxX2RKWVExeklPVzl2ZVF2VFY?oc=5'
    ];

    console.log('🧪 Testing Google News API Resolver\n');

    for (const url of testUrls) {
        const result = await resolver.resolveArticleUrl(url);
        console.log('\n📊 Result:');
        console.log(`   Original: ${result.url === url ? 'SAME AS INPUT' : url}`);
        console.log(`   Resolved: ${result.url}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Success: ${result.success}`);
        console.log('---');
        
        // Add delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

module.exports = {
    GoogleNewsApiResolver
};

// Run test if this file is executed directly
if (require.main === module) {
    testApiResolver().catch(console.error);
}