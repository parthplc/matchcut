# MatchCut

An advanced Google News searcher with integrated URL decoding and high-performance parallel processing. MatchCut fetches news articles from Google News RSS feeds and decodes obfuscated URLs to reveal real source URLs.

## Current Status

This application is **production-ready** with advanced features and optimized performance.

## Features

### ✅ Core Features
- **Google News RSS Integration**: Fetches news articles from Google News RSS feeds
- **Keyword Search**: Search for news articles by keyword with language and country filters
- **Article Processing**: Extracts and processes article data including:
  - Title cleaning and normalization
  - Publication date parsing
  - Source name extraction
  - Advanced domain detection and mapping

### 🚀 Advanced URL Decoding
- **Google News URL Decoder**: Built-in decoder that converts obfuscated Google News URLs to real source URLs
- **High Success Rate**: Achieves 100% success rate for URL decoding when Google's API is responsive
- **Intelligent Fallbacks**: Multiple domain extraction strategies when decoding fails:
  - URL pattern analysis from Google News links
  - Expanded source name mapping (50+ news sources)
  - Smart domain generation from source names
  - Meaningful fallback identifiers instead of "undefined"

### ⚡ Performance Optimizations
- **Parallel URL Decoding**: Processes multiple URLs simultaneously using batch processing
- **74% Faster**: Reduced processing time from ~36s to ~9s for typical requests
- **Smart Rate Limiting**: Controlled concurrency with adaptive delays to respect server limits
- **Efficient Resource Usage**: Only decodes required articles + small buffer for deduplication

### 🔍 Smart Article Processing
- **Advanced Deduplication**: Removes duplicate articles based on:
  - Exact URL duplicates
  - Similar title matching
  - Content similarity detection
- **Domain Intelligence**: Accurate domain extraction using:
  - Source name mapping for 50+ major news sources
  - Google News URL pattern analysis
  - Intelligent fallback domain generation
- **Flexible Output**: Detailed article information with real URLs and source attribution

### 🔧 Technical Implementation
- **Node.js** with CommonJS modules
- **axios** for HTTP requests and URL decoding
- **xml2js** for RSS feed parsing
- **cheerio** for HTML parsing during URL decoding
- **Parallel Processing**: Promise.all() for concurrent URL decoding
- **Batch Processing**: Controlled concurrency with configurable batch sizes
- **Comprehensive Error Handling**: Graceful fallbacks and detailed logging
- **Configurable Parameters**: Language, country, max results, decoding options

## Project Structure

```
matchcut/
├── package.json          # Project dependencies and configuration
├── news-searcher.js      # Main IntegratedGoogleNewsSearcher class with URL decoder
├── test.js              # Comprehensive test suite with usage examples
├── decoder.js           # Standalone URL decoder (legacy)
├── node_modules/        # Dependencies
└── README.md           # This file
```

## Dependencies

- **axios**: ^1.10.0 - HTTP client for API requests and URL decoding
- **xml2js**: ^0.6.2 - XML/RSS parsing
- **cheerio**: ^1.0.0 - HTML parsing for URL decoding

## Usage Examples

### Basic Search with URL Decoding

```javascript
const { IntegratedGoogleNewsSearcher } = require('./news-searcher');

const searcher = new IntegratedGoogleNewsSearcher();

// Search with URL decoding enabled (default)
const results = await searcher.searchNews('Bitcoin price', 'en', 'US', 10, true);

if (results.success) {
    console.log(`Found ${results.totalResults} articles`);
    console.log(`Decoded ${results.decodingStats.successful}/${results.decodingStats.total} URLs`);
    
    results.articles.forEach(article => {
        console.log(`${article.title}`);
        console.log(`Source: ${article.source} → ${article.domain}`);
        console.log(`Real URL: ${article.realUrl || 'Not decoded'}`);
        console.log('---');
    });
}
```

### Fast Search without URL Decoding

```javascript
// For faster searches when real URLs aren't needed
const results = await searcher.searchNews('AI technology', 'en', 'US', 15, false);

if (results.success) {
    results.articles.forEach(article => {
        console.log(`${article.title} - ${article.domain}`);
    });
}
```

### Using the Standalone URL Decoder

```javascript
const { GoogleNewsDecoder } = require('./news-searcher');

const decoder = new GoogleNewsDecoder();
const googleNewsUrl = "https://news.google.com/articles/CBMi...";

const result = await decoder.decodeGoogleNewsUrl(googleNewsUrl);
if (result.status) {
    console.log(`Real URL: ${result.decoded_url}`);
} else {
    console.log(`Decode failed: ${result.message}`);
}
```

## Performance Benchmarks

**URL Decoding Performance:**
- **Parallel Processing**: 74% faster than sequential approach
- **Typical Performance**: ~9.2 seconds for 20 URL decodes (vs ~36 seconds sequential)
- **Success Rate**: 100% when Google's decoding API is responsive
- **Batch Processing**: 3-5 URLs processed simultaneously
- **Memory Efficient**: Only processes required articles + small buffer

**Search Parameters:**
- `keyword`: Search term (string)
- `language`: Language code (default: 'en')
- `country`: Country code (default: 'US') 
- `maxResults`: Number of articles to return (default: 50)
- `decodeUrls`: Enable URL decoding (default: true)

## Development Status

**✅ Production Ready Features:**
1. ✅ Advanced Google News RSS integration
2. ✅ High-performance parallel URL decoding
3. ✅ Intelligent domain extraction with multiple fallback strategies
4. ✅ Comprehensive deduplication system
5. ✅ Detailed performance monitoring and statistics
6. ✅ Robust error handling with graceful fallbacks
7. ✅ Optimized resource usage and rate limiting
8. ✅ Comprehensive test suite with real-world examples

**🚀 Recent Major Updates:**
- Implemented parallel URL decoding (74% performance improvement)
- Added intelligent domain extraction with 50+ source mappings
- Enhanced error handling with meaningful fallbacks
- Optimized resource usage to only decode required articles
- Added performance monitoring and detailed statistics

## Testing

Run the comprehensive test suite:

```bash
node test.js
```

**The test suite demonstrates:**
- **Parallel URL Decoding**: Performance comparison between old and new approaches
- **Real URL Extraction**: Converting Google News URLs to actual source URLs
- **Domain Intelligence**: Accurate domain extraction and mapping
- **Multiple Search Topics**: Bitcoin, AI technology, Tesla stock, and more
- **Performance Monitoring**: Detailed timing and success rate statistics
- **Deduplication**: Advanced duplicate removal algorithms
- **Error Handling**: Graceful fallbacks when URL decoding fails

**Sample Test Output:**
```
🚀 Testing Integrated Google News Searcher with URL Decoding
📊 Attempting to decode 20 URLs...
🚀 Starting parallel decoding of 20 URLs in batches of 5...
📦 Processing batch 1: URLs 1-5
   ✅ Success: wsj.com (1604ms)
   ✅ Success: theguardian.com (1922ms)
🎯 All 20 URLs processed in 9213ms (avg: 461ms per URL)
📊 URL Decoding Stats: 20/20 successful (100% success rate)
```

## License

ISC License