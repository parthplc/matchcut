// Fixed news-searcher.js - Better URL extraction for Google News
const axios = require('axios');
const xml2js = require('xml2js');

class GoogleNewsSearcher {
  constructor() {
    this.baseUrl = 'https://news.google.com/rss';
    this.parser = new xml2js.Parser({ explicitArray: false });
  }

  async searchNews(keyword, language = 'en', country = 'US', maxResults = 50) {
    try {
      const searchUrl = this.buildSearchUrl(keyword, language, country);
      console.log(`Searching for: "${keyword}"`);
      console.log(`URL: ${searchUrl}`);

      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000
      });

      const parsed = await this.parser.parseStringPromise(response.data);
      const articles = this.extractArticles(parsed, maxResults);

      return {
        success: true,
        keyword,
        totalResults: articles.length,
        articles: articles
      };

    } catch (error) {
      console.error('Search failed:', error.message);
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

  /**
   * Extract domain from source name or try to resolve real URL
   */
  extractRealDomain(article) {
    // Method 1: Try to get domain from source name
    if (article.source && article.source !== 'Unknown') {
      const sourceName = article.source.toLowerCase();
      
      // Map common source names to domains
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
      
      // Check if source name matches any known domains
      for (const [name, domain] of Object.entries(sourceMapping)) {
        if (sourceName.includes(name)) {
          return domain;
        }
      }
      
      // If source contains a domain-like string, extract it
      const domainMatch = sourceName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
      if (domainMatch) {
        return domainMatch[1];
      }
    }

    // Method 2: Try to extract from the Google News URL
    try {
      const url = new URL(article.link);
      const articleId = url.pathname.split('/articles/')[1]?.split('?')[0];
      
      if (articleId) {
        // Try to decode base64-encoded URL information
        try {
          const decoded = Buffer.from(articleId.replace(/^CBMi/, '').replace(/0gE.*$/, ''), 'base64').toString();
          const urlMatch = decoded.match(/https?:\/\/([^\/\s"]+)/);
          if (urlMatch) {
            return urlMatch[1].replace(/^www\./, '');
          }
        } catch (e) {
          // Decoding failed, continue
        }
      }
    } catch (e) {
      // URL parsing failed
    }

    // Method 3: Use article title to guess source
    if (article.title) {
      const title = article.title.toLowerCase();
      if (title.includes('reuters')) return 'reuters.com';
      if (title.includes('bloomberg')) return 'bloomberg.com';
      if (title.includes('wsj') || title.includes('wall street')) return 'wsj.com';
    }

    // Fallback: return a unique identifier based on article content
    return `unknown-${Math.abs(this.hashCode(article.title + article.source))}`;
  }

  /**
   * Simple hash function for generating unique identifiers
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Remove duplicate URLs from articles (FIXED VERSION)
   */
  removeDuplicateUrls(articles) {
    const seenUrls = new Set();
    const seenTitles = new Set();
    const domainCount = new Map();
    const uniqueArticles = [];
    
    for (const article of articles) {
      // Extract real domain
      const domain = this.extractRealDomain(article);
      article.domain = domain;
      
      // Normalize URL for comparison
      const normalizedUrl = article.link.toLowerCase();
      
      // Check for exact URL duplicates
      if (seenUrls.has(normalizedUrl)) {
        console.log(`🔄 Duplicate URL skipped: ${article.title.substring(0, 50)}...`);
        continue;
      }
      
      // Check for similar titles (basic deduplication)
      const normalizedTitle = article.title.toLowerCase().replace(/[^\w\s]/g, '');
      const titleWords = normalizedTitle.split(' ').filter(w => w.length > 3);
      const titleKey = titleWords.slice(0, 5).join(' '); // Use first 5 significant words
      
      if (seenTitles.has(titleKey)) {
        console.log(`🔄 Similar title skipped: ${article.title.substring(0, 50)}...`);
        continue;
      }
      
      // OPTIONAL: Limit articles per domain (comment out this block to remove domain limit)
      /*
      const currentDomainCount = domainCount.get(domain) || 0;
      if (currentDomainCount >= 2) { // Max 2 per domain
        console.log(`🔄 Domain limit reached for ${domain}: ${article.title.substring(0, 50)}...`);
        continue;
      }
      */
      
      // Add to unique articles
      seenUrls.add(normalizedUrl);
      seenTitles.add(titleKey);
      domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
      
      uniqueArticles.push(article);
      console.log(`✅ Added: ${article.title.substring(0, 50)}... (${domain})`);
    }
    
    return uniqueArticles;
  }

  /**
   * Extract articles from parsed RSS data (FIXED VERSION)
   */
  extractArticles(parsed, maxResults) {
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

      console.log(`📰 Found ${allArticles.length} raw articles, processing and removing duplicates...`);

      // Remove duplicates (now with better domain detection)
      const uniqueArticles = this.removeDuplicateUrls(allArticles);
      
      console.log(`✨ After deduplication: ${uniqueArticles.length} unique articles`);

      // Return only the requested number
      return uniqueArticles.slice(0, maxResults);

    } catch (error) {
      console.error('Error extracting articles:', error);
      return [];
    }
  }

  /**
   * Get source name from RSS source field and clean it
   */
  extractSourceName(source) {
    if (!source) return 'Unknown';
    
    let sourceName = source._ || source.url || source;
    
    // Clean up source name
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

  async getTrendingTopics(language = 'en', country = 'US') {
    try {
      const trendingUrl = `${this.baseUrl}?hl=${language}-${country}&gl=${country}&ceid=${country}:${language}`;
      
      const response = await axios.get(trendingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000
      });

      const parsed = await this.parser.parseStringPromise(response.data);
      const articles = this.extractArticles(parsed, 20);

      return {
        success: true,
        type: 'trending',
        articles: articles
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        articles: []
      };
    }
  }
}

module.exports = {
  GoogleNewsSearcher
};

// Test function
async function testWithBetterDomains() {
  console.log('🔍 Testing with Better Domain Detection...\n');
  
  const searcher = new GoogleNewsSearcher();
  
  const results = await searcher.searchNews('AI technology', 'en', 'US', 15);
  
  if (results.success) {
    console.log(`\n📊 Final Results: ${results.totalResults} unique articles\n`);
    
    results.articles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   📰 Source: ${article.source}`);
      console.log(`   🌐 Domain: ${article.domain}`);
      console.log(`   📅 Date: ${article.pubDate.toLocaleDateString()}`);
      console.log(`   🔗 URL: ${article.link}\n`);
    });
    
    // Show domain distribution
    const domainCount = {};
    results.articles.forEach(article => {
      const domain = article.domain || 'unknown';
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    });
    
    console.log('🌐 Articles per domain:');
    Object.entries(domainCount)
      .sort(([,a], [,b]) => b - a)
      .forEach(([domain, count]) => {
        console.log(`   ${domain}: ${count} article${count > 1 ? 's' : ''}`);
      });
  }
}

if (require.main === module) {
  testWithBetterDomains().catch(console.error);
}