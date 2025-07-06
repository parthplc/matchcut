// integrated-news-searcher.js - News searcher with built-in URL decoder
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const { URL } = require('url');
const ScreenshotService = require('./screenshot-service');

class GoogleNewsDecoder {
    constructor(proxy) {
        let proxyConfig = null;
        if (proxy) {
            try {
                const proxyUrl = new URL(proxy);
                proxyConfig = {
                    protocol: proxyUrl.protocol.replace(':', ''),
                    host: proxyUrl.hostname,
                    port: proxyUrl.port,
                };
                if (proxyUrl.username || proxyUrl.password) {
                    proxyConfig.auth = {
                        username: proxyUrl.username,
                        password: proxyUrl.password,
                    };
                }
            } catch (error) {
                console.error("Invalid proxy URL format. Ignoring proxy.", error);
            }
        }
        this.client = axios.create({
            proxy: proxyConfig,
            maxRedirects: 5,
            timeout: 10000
        });
    }

    getBase64Str(sourceUrl) {
        try {
            const url = new URL(sourceUrl);
            const pathParts = url.pathname.split('/');
            
            if (url.hostname === 'news.google.com' && pathParts.length > 1 && ['articles', 'read'].includes(pathParts[pathParts.length - 2])) {
                return { status: true, base64Str: pathParts[pathParts.length - 1] };
            }
            return { status: false, message: 'Invalid Google News URL format.' };
        } catch (e) {
            return { status: false, message: `Error in getBase64Str: ${e.message}` };
        }
    }

    async getDecodingParams(base64Str) {
        const urlsToTry = [
            `https://news.google.com/articles/${base64Str}`,
            `https://news.google.com/rss/articles/${base64Str}`
        ];

        for (const url of urlsToTry) {
            try {
                const response = await this.client.get(url);
                const $ = cheerio.load(response.data);
                const dataElement = $('c-wiz > div[jscontroller]');

                if (dataElement.length > 0) {
                    const signature = dataElement.attr('data-n-a-sg');
                    const timestamp = dataElement.attr('data-n-a-ts');
                    if (signature && timestamp) {
                        return {
                            status: true,
                            signature,
                            timestamp,
                            base64Str,
                        };
                    }
                }
            } catch (error) {
                // Continue to next URL
                continue;
            }
        }

        return {
            status: false,
            message: 'Failed to fetch data attributes from Google News.',
        };
    }

    async decodeUrl(signature, timestamp, base64Str) {
        const url = 'https://news.google.com/_/DotsSplashUi/data/batchexecute';
        
        const innerPayload = JSON.stringify([
            "garturlreq",
            [
                ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
                "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0
            ],
            base64Str,
            Number(timestamp),
            signature
        ]);

        const outerPayload = [[["Fbv4je", innerPayload]]];
        const requestBody = `f.req=${encodeURIComponent(JSON.stringify(outerPayload))}`;

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        };

        try {
            const response = await this.client.post(url, requestBody, { headers });
            const responseLines = response.data.split('\n');
            const dataLine = responseLines.find(line => line.startsWith('[['));

            if (!dataLine) {
                throw new Error("Could not find the data line in the batchexecute response.");
            }
            
            const parsedData = JSON.parse(dataLine);
            const innerJsonString = parsedData[0][2];
            const decodedUrl = JSON.parse(innerJsonString)[1];

            return { status: true, decoded_url: decodedUrl };
        } catch (e) {
            return { status: false, message: `Error in decodeUrl: ${e.message}` };
        }
    }

    async decodeGoogleNewsUrl(sourceUrl) {
        try {
            const base64Response = this.getBase64Str(sourceUrl);
            if (!base64Response.status) {
                return base64Response;
            }

            const decodingParamsResponse = await this.getDecodingParams(base64Response.base64Str);
            if (!decodingParamsResponse.status) {
                return decodingParamsResponse;
            }

            const decodedUrlResponse = await this.decodeUrl(
                decodingParamsResponse.signature,
                decodingParamsResponse.timestamp,
                decodingParamsResponse.base64Str
            );

            return decodedUrlResponse;
        } catch (e) {
            return { status: false, message: `Error in decodeGoogleNewsUrl: ${e.message}` };
        }
    }
}

class IntegratedGoogleNewsSearcher {
    constructor(proxy = null) {
        this.baseUrl = 'https://news.google.com/rss';
        this.parser = new xml2js.Parser({ explicitArray: false });
        this.decoder = new GoogleNewsDecoder(proxy);
        this.screenshotService = new ScreenshotService();
        
        // Stats for tracking decoder performance
        this.decodingStats = {
            total: 0,
            successful: 0,
            failed: 0
        };
    }

    async searchNews(keyword, language = 'en', country = 'US', maxResults = 50, decodeUrls = true, captureScreenshots = false, screenshotOptions = {}) {
        try {
            const searchUrl = this.buildSearchUrl(keyword, language, country);
            console.log(`🔍 Searching for: "${keyword}"`);
            console.log(`📡 URL: ${searchUrl}`);

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 15000
            });

            const parsed = await this.parser.parseStringPromise(response.data);
            const articles = await this.extractArticles(parsed, maxResults, decodeUrls);

            // Capture screenshots if requested
            if (captureScreenshots && articles.length > 0) {
                console.log(`\n📸 Starting screenshot capture...`);
                const defaultScreenshotOptions = {
                    batchSize: 2,
                    batchDelay: 2000,
                    delay: 3,
                    timeout: 30,
                    ...screenshotOptions
                };
                
                const screenshotResult = await this.screenshotService.batchCapture(
                    articles.map(article => ({
                        ...article,
                        decodedUrl: article.realUrl || article.link,
                        id: this.generateArticleId(article)
                    })),
                    {
                        ...defaultScreenshotOptions,
                        targetCount: maxResults
                    }
                );
                
                // Store screenshot paths in article objects
                screenshotResult.results.forEach((result, index) => {
                    if (articles[index]) {
                        articles[index].screenshot = {
                            success: result.success,
                            filePath: result.filePath || null,
                            fileName: result.fileName || null,
                            error: result.error || null,
                            timestamp: result.timestamp
                        };
                    }
                });
                
                console.log(`📊 Screenshot Summary: ${screenshotResult.summary.successful}/${screenshotResult.summary.total} captured (${screenshotResult.summary.successRate})`);
            }

            // Print decoding stats
            if (decodeUrls && this.decodingStats.total > 0) {
                console.log(`\n📊 URL Decoding Stats:`);
                console.log(`   Total attempts: ${this.decodingStats.total}`);
                console.log(`   Successful: ${this.decodingStats.successful}`);
                console.log(`   Failed: ${this.decodingStats.failed}`);
                console.log(`   Success rate: ${Math.round((this.decodingStats.successful / this.decodingStats.total) * 100)}%`);
            }

            return {
                success: true,
                keyword,
                totalResults: articles.length,
                articles: articles,
                decodingStats: this.decodingStats
            };

        } catch (error) {
            console.error('❌ Search failed:', error.message);
            return {
                success: false,
                error: error.message,
                articles: []
            };
        }
    }

    buildSearchUrl(keyword, language, country) {
        const encodedKeyword = encodeURIComponent(keyword);
        return `${this.baseUrl}/search?q=${encodedKeyword}&hl=${language}-${country}&gl=${country}&ceid=${country}:${language}`;
    }

    async decodeArticleUrl(article, index) {
        const startTime = Date.now();
        console.log(`🔓 Decoding URL ${index + 1}: ${article.title.substring(0, 50)}...`);
        
        this.decodingStats.total++;
        
        try {
            const result = await this.decoder.decodeGoogleNewsUrl(article.link);
            const duration = Date.now() - startTime;
            
            if (result.status) {
                this.decodingStats.successful++;
                article.realUrl = result.decoded_url;
                article.domain = this.extractDomainFromUrl(result.decoded_url);
                console.log(`   ✅ Success: ${article.domain} (${duration}ms)`);
                return true;
            } else {
                this.decodingStats.failed++;
                console.log(`   ❌ Failed: ${result.message} (${duration}ms)`);
                // Fallback to improved domain extraction method
                article.domain = this.extractRealDomain(article);
                console.log(`   🔄 Fallback domain: ${article.domain}`);
                return false;
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            this.decodingStats.failed++;
            console.log(`   ❌ Error: ${error.message} (${duration}ms)`);
            article.domain = this.extractRealDomain(article);
            console.log(`   🔄 Fallback domain: ${article.domain}`);
            return false;
        }
    }

    // Process articles in parallel batches for faster decoding
    async decodeArticlesInBatches(articles, batchSize = 5) {
        const totalStart = Date.now();
        console.log(`🚀 Starting parallel decoding of ${articles.length} URLs in batches of ${batchSize}...`);
        
        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            const batchStart = Date.now();
            
            console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}: URLs ${i + 1}-${Math.min(i + batchSize, articles.length)}`);
            
            // Decode all URLs in this batch in parallel
            const promises = batch.map((article, batchIndex) => 
                this.decodeArticleUrl(article, i + batchIndex)
            );
            
            await Promise.all(promises);
            
            const batchDuration = Date.now() - batchStart;
            console.log(`✅ Batch completed in ${batchDuration}ms`);
            
            // Small delay between batches to be respectful
            if (i + batchSize < articles.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        const totalDuration = Date.now() - totalStart;
        console.log(`\n🎯 All ${articles.length} URLs processed in ${totalDuration}ms (avg: ${Math.round(totalDuration / articles.length)}ms per URL)`);
    }

    extractDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            return 'unknown-domain';
        }
    }

    // Extract domain from Google News URL patterns
    extractDomainFromGoogleNewsUrl(googleNewsUrl) {
        try {
            // Pattern 1: Look for domain hints in the URL path
            const domainPatterns = [
                // Common news domains that appear in Google News URLs
                /(?:cnn|bbc|reuters|bloomberg|wsj|nytimes|washingtonpost|theguardian|forbes|cnbc|yahoo|apnews|npr|techcrunch|businessinsider|cointelegraph|coindesk|investing|barrons|tradingview|cointribune|cryptoslate|hindustantimes|timesofindia|ndtv|mathrubhumi|indiatoday|businesstoday|goodreturns|people|futurism|investors|fool|barchart|ccn|dlnews|ainvest|thecryptobasic)/i,
                // Look for domain-like patterns in the URL
                /([a-zA-Z0-9-]+)\.(com|org|net|co\.uk|in|ai|io|tv|news)/i
            ];
            
            for (const pattern of domainPatterns) {
                const match = googleNewsUrl.match(pattern);
                if (match) {
                    const domain = match[0].toLowerCase();
                    // Map common abbreviations to full domains
                    const domainMap = {
                        'cnn': 'cnn.com',
                        'bbc': 'bbc.com',
                        'wsj': 'wsj.com',
                        'nytimes': 'nytimes.com',
                        'reuters': 'reuters.com',
                        'bloomberg': 'bloomberg.com',
                        'forbes': 'forbes.com',
                        'cnbc': 'cnbc.com',
                        'yahoo': 'yahoo.com',
                        'npr': 'npr.org',
                        'techcrunch': 'techcrunch.com',
                        'businessinsider': 'businessinsider.com',
                        'cointelegraph': 'cointelegraph.com',
                        'coindesk': 'coindesk.com',
                        'investing': 'investing.com',
                        'barrons': 'barrons.com',
                        'tradingview': 'tradingview.com',
                        'cointribune': 'cointribune.com',
                        'cryptoslate': 'cryptoslate.com',
                        'people': 'people.com',
                        'futurism': 'futurism.com'
                    };
                    return domainMap[domain] || domain;
                }
            }
            
            return null;
        } catch (e) {
            return null;
        }
    }

    extractRealDomain(article) {
        // Try multiple strategies to extract domain
        let domain = null;
        
        // Strategy 1: Extract from Google News URL pattern
        if (article.link) {
            domain = this.extractDomainFromGoogleNewsUrl(article.link);
            if (domain) {
                return domain;
            }
        }
        
        // Strategy 2: Map from source name
        if (article.source && article.source !== 'Unknown') {
            const sourceName = article.source.toLowerCase();
            
            const sourceMapping = {
                'wsj': 'wsj.com',
                'wall street journal': 'wsj.com',
                'reuters': 'reuters.com',
                'cnn': 'cnn.com',
                'bbc': 'bbc.com',
                'guardian': 'theguardian.com',
                'the guardian': 'theguardian.com',
                'bloomberg': 'bloomberg.com',
                'techcrunch': 'techcrunch.com',
                'cointelegraph': 'cointelegraph.com',
                'coindesk': 'coindesk.com',
                'forbes': 'forbes.com',
                'cnbc': 'cnbc.com',
                'yahoo': 'yahoo.com',
                'yahoo finance': 'finance.yahoo.com',
                'associated press': 'apnews.com',
                'ap': 'apnews.com',
                'npr': 'npr.org',
                'new york times': 'nytimes.com',
                'nytimes': 'nytimes.com',
                'washington post': 'washingtonpost.com',
                'people.com': 'people.com',
                'people': 'people.com',
                'hindustan times': 'hindustantimes.com',
                'times of india': 'timesofindia.indiatimes.com',
                'ndtv': 'ndtv.com',
                'business insider': 'businessinsider.com',
                'goodreturns': 'goodreturns.in',
                'mathrubhumi': 'mathrubhumi.com',
                'business today': 'businesstoday.in',
                'india today': 'indiatoday.in',
                'investing.com': 'investing.com',
                'investing': 'investing.com',
                'barrons': 'barrons.com',
                'tradingview': 'tradingview.com',
                'cointribune': 'cointribune.com',
                'cryptoslate': 'cryptoslate.com',
                'bitcoin.com': 'news.bitcoin.com',
                'bitcoin.com news': 'news.bitcoin.com',
                'ccn': 'ccn.com',
                'thecryptobasic': 'thecryptobasic.com',
                'dlnews': 'dlnews.com',
                'ainvest': 'ainvest.com',
                'futurism': 'futurism.com',
                'investor\'s business daily': 'investors.com',
                'investors': 'investors.com',
                'the motley fool': 'fool.com',
                'motley fool': 'fool.com',
                'barchart': 'barchart.com',
                'investopedia': 'investopedia.com',
                'aboutamazon': 'aboutamazon.com',
                'amazon': 'aboutamazon.com'
            };
            
            for (const [name, domainValue] of Object.entries(sourceMapping)) {
                if (sourceName.includes(name)) {
                    return domainValue;
                }
            }
            
            // Strategy 3: Extract domain-like patterns from source name
            const domainMatch = sourceName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            if (domainMatch) {
                return domainMatch[1];
            }
            
            // Strategy 4: Try to create a reasonable domain from source name
            const cleanSource = sourceName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            if (cleanSource && cleanSource.length > 2) {
                const words = cleanSource.split(/\s+/);
                if (words.length === 1) {
                    return `${words[0].toLowerCase()}.com`;
                } else if (words.length === 2) {
                    return `${words[0].toLowerCase()}${words[1].toLowerCase()}.com`;
                } else {
                    return `${words[0].toLowerCase()}.com`;
                }
            }
        }

        // Strategy 5: Last resort - create a meaningful identifier
        const titleWords = article.title.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/);
        const meaningfulWord = titleWords.find(word => word.length > 4) || titleWords[0] || 'news';
        return `${meaningfulWord}.unknown`;
    }

    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    generateArticleId(article) {
        const cleanTitle = article.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const hash = Math.abs(this.hashCode(article.title + article.link)).toString(16).substring(0, 8);
        return `${cleanTitle}_${hash}`;
    }

    removeDuplicateUrls(articles) {
        const seenUrls = new Set();
        const seenTitles = new Set();
        const uniqueArticles = [];
        
        for (const article of articles) {
            const normalizedUrl = (article.realUrl || article.link).toLowerCase();
            
            if (seenUrls.has(normalizedUrl)) {
                console.log(`🔄 Duplicate URL skipped: ${article.title.substring(0, 50)}...`);
                continue;
            }
            
            const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/g, '');
            const titleWords = normalizedTitle.split(' ').filter(w => w.length > 3);
            const titleKey = titleWords.slice(0, 5).join(' ');
            
            if (seenTitles.has(titleKey)) {
                console.log(`🔄 Similar title skipped: ${article.title.substring(0, 50)}...`);
                continue;
            }
            
            seenUrls.add(normalizedUrl);
            seenTitles.add(titleKey);
            uniqueArticles.push(article);
            console.log(`✅ Added: ${article.title.substring(0, 50)}... (${article.domain})`);
        }
        
        return uniqueArticles;
    }

    async extractArticles(parsed, maxResults, decodeUrls = true) {
        try {
            const channel = parsed.rss.channel;
            let items = channel.item || [];
            
            if (!Array.isArray(items)) {
                items = [items];
            }

            // Extract all articles first
            const allArticles = items.map(item => ({
                title: this.cleanTitle(item.title),
                link: item.link,
                pubDate: new Date(item.pubDate),
                description: this.stripHtml(item.description || ''),
                source: this.extractSourceName(item.source),
                guid: item.guid._ || item.guid
            }));

            console.log(`📰 Found ${allArticles.length} raw articles`);

            // Decode URLs if requested (with smart limiting)
            if (decodeUrls && allArticles.length > 0) {
                console.log(`\n🔓 Starting URL decoding process...`);
                
                // Smart limiting: only decode what we need + small buffer for deduplication
                const buffer = Math.min(maxResults, 10); // Add 5-10 extra for deduplication
                const maxDecodeAttempts = Math.min(maxResults + buffer, allArticles.length);
                const articlesToDecode = allArticles.slice(0, maxDecodeAttempts);
                
                console.log(`📊 Attempting to decode ${articlesToDecode.length} URLs...`);
                
                // Use parallel batch processing for much faster decoding
                const batchSize = Math.min(articlesToDecode.length <= 10 ? 3 : 5, articlesToDecode.length);
                await this.decodeArticlesInBatches(articlesToDecode, batchSize);
                
                // Copy decoded info back to original articles
                for (let i = 0; i < articlesToDecode.length; i++) {
                    if (allArticles[i]) {
                        allArticles[i].realUrl = articlesToDecode[i].realUrl;
                        allArticles[i].domain = articlesToDecode[i].domain;
                    }
                }
                
                // Apply improved domain extraction to remaining articles
                for (let i = articlesToDecode.length; i < allArticles.length; i++) {
                    allArticles[i].domain = this.extractRealDomain(allArticles[i]);
                }
            } else {
                // Apply improved domain extraction to all articles
                console.log(`\n🔍 Extracting domains without URL decoding...`);
                allArticles.forEach((article, index) => {
                    article.domain = this.extractRealDomain(article);
                    if (index < 5) {
                        console.log(`   📍 ${article.title.substring(0, 40)}... → ${article.domain}`);
                    }
                });
                if (allArticles.length > 5) {
                    console.log(`   📍 ... and ${allArticles.length - 5} more articles`);
                }
            }

            console.log(`\n🔍 Processing and removing duplicates...`);
            const uniqueArticles = this.removeDuplicateUrls(allArticles);
            
            console.log(`✨ After deduplication: ${uniqueArticles.length} unique articles`);

            return uniqueArticles.slice(0, maxResults);

        } catch (error) {
            console.error('❌ Error extracting articles:', error);
            return [];
        }
    }

    extractSourceName(source) {
        if (!source) return 'Unknown';
        
        let sourceName = source._ || source.url || source;
        
        if (typeof sourceName === 'string') {
            sourceName = sourceName.replace(/\s*-\s*.*$/, '').trim();
        }
        
        return sourceName || 'Unknown';
    }

    cleanTitle(title) {
        if (!title) return '';
        return title.replace(/\s*-\s*[^-]+$/, '').trim();
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').trim();
    }

    // Reset stats for new search
    resetStats() {
        this.decodingStats = {
            total: 0,
            successful: 0,
            failed: 0
        };
    }
}

module.exports = {
    IntegratedGoogleNewsSearcher,
    GoogleNewsDecoder
};