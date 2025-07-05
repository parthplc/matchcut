// integrated-news-searcher.js - News searcher with built-in URL decoder
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const { URL } = require('url');

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
        
        // Stats for tracking decoder performance
        this.decodingStats = {
            total: 0,
            successful: 0,
            failed: 0
        };
    }

    async searchNews(keyword, language = 'en', country = 'US', maxResults = 50, decodeUrls = true) {
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
        console.log(`🔓 Decoding URL ${index + 1}: ${article.title.substring(0, 50)}...`);
        
        this.decodingStats.total++;
        
        try {
            const result = await this.decoder.decodeGoogleNewsUrl(article.link);
            
            if (result.status) {
                this.decodingStats.successful++;
                article.realUrl = result.decoded_url;
                article.domain = this.extractDomainFromUrl(result.decoded_url);
                console.log(`   ✅ Success: ${article.domain}`);
                return true;
            } else {
                this.decodingStats.failed++;
                console.log(`   ❌ Failed: ${result.message}`);
                // Fallback to original domain extraction method
                article.domain = this.extractRealDomain(article);
                return false;
            }
        } catch (error) {
            this.decodingStats.failed++;
            console.log(`   ❌ Error: ${error.message}`);
            article.domain = this.extractRealDomain(article);
            return false;
        }
    }

    extractDomainFromUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch (e) {
            return 'unknown-domain';
        }
    }

    extractRealDomain(article) {
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
                'india today': 'indiatoday.in'
            };
            
            for (const [name, domain] of Object.entries(sourceMapping)) {
                if (sourceName.includes(name)) {
                    return domain;
                }
            }
            
            const domainMatch = sourceName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            if (domainMatch) {
                return domainMatch[1];
            }
        }

        return `unknown-${Math.abs(this.hashCode(article.title + article.source))}`;
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

            // Decode URLs if requested (limited to prevent overwhelming the API)
            if (decodeUrls && allArticles.length > 0) {
                console.log(`\n🔓 Starting URL decoding process...`);
                
                // Limit decoding to prevent rate limiting
                const articlesToDecode = allArticles.slice(0, Math.min(maxResults + 5, 20));
                
                for (let i = 0; i < articlesToDecode.length; i++) {
                    await this.decodeArticleUrl(articlesToDecode[i], i);
                    
                    // Add small delay to be respectful to Google's servers
                    if (i < articlesToDecode.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                
                // Copy decoded info back to original articles
                for (let i = 0; i < articlesToDecode.length; i++) {
                    if (allArticles[i]) {
                        allArticles[i].realUrl = articlesToDecode[i].realUrl;
                        allArticles[i].domain = articlesToDecode[i].domain;
                    }
                }
            } else {
                // Fallback domain extraction for all articles
                allArticles.forEach(article => {
                    article.domain = this.extractRealDomain(article);
                });
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