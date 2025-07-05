# MatchCut

A Google News searcher application that fetches and processes news articles from Google News RSS feeds.

## Current Status

This application is currently in **development phase** with core functionality implemented and tested.

## Features

### ✅ Implemented
- **Google News RSS Integration**: Fetches news articles from Google News RSS feeds
- **Keyword Search**: Search for news articles by keyword with language and country filters
- **Article Processing**: Extracts and processes article data including:
  - Title cleaning and normalization
  - Publication date parsing
  - Source name extraction
  - Domain detection and mapping
- **Duplicate Removal**: Advanced deduplication system that removes:
  - Exact URL duplicates
  - Similar title duplicates
  - Optional domain-based limiting
- **Real Domain Detection**: Maps news sources to their actual domains using:
  - Source name mapping (150+ known sources)
  - Base64 URL decoding from Google News URLs
  - Pattern matching from article titles
- **Trending Topics**: Fetch trending news articles
- **Flexible Output**: Detailed article information with source attribution

### 🔧 Technical Implementation
- **Node.js** with CommonJS modules
- **axios** for HTTP requests
- **xml2js** for RSS feed parsing
- Comprehensive error handling and logging
- Configurable search parameters (language, country, max results)

## Project Structure

```
matchcut/
├── package.json          # Project dependencies and configuration
├── news-searcher.js      # Main GoogleNewsSearcher class
├── test.js              # Test file with usage examples
├── node_modules/        # Dependencies
└── README.md           # This file
```

## Dependencies

- **axios**: ^1.10.0 - HTTP client for API requests
- **xml2js**: ^0.6.2 - XML/RSS parsing

## Usage Example

```javascript
const { GoogleNewsSearcher } = require('./news-searcher');

const searcher = new GoogleNewsSearcher();
const results = await searcher.searchNews('Bitcoin price', 'en', 'US', 10);

if (results.success) {
    console.log(`Found ${results.totalResults} articles`);
    results.articles.forEach(article => {
        console.log(`${article.title} - ${article.source} (${article.domain})`);
    });
}
```

## Current Development Phase

The application is currently in the **testing and refinement phase**:

1. ✅ Core RSS parsing functionality complete
2. ✅ Advanced deduplication system implemented
3. ✅ Domain detection and source mapping working
4. ✅ Test cases written and functional
5. 🔄 Testing with real-world data and edge cases
6. 📋 Pending: Production deployment preparation
7. 📋 Pending: API documentation
8. 📋 Pending: Error handling improvements

## Testing

Run the test file to see the application in action:

```bash
node test.js
```

The test file demonstrates:
- Real URL extraction from Google News
- Domain distribution analysis
- Multiple search topic examples
- Source attribution verification

## License

ISC License