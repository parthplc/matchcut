// test.js - Updated version to show real source URLs
const { GoogleNewsSearcher } = require('./news-searcher');

async function testWithRealUrls() {
    console.log('🔍 Testing Google News Search with Real Source URLs...\n');
    
    const searcher = new GoogleNewsSearcher();
    
    // Test with the same search that was showing google.com URLs
    console.log('Searching for "Bitcoin price"...\n');
    const results = await searcher.searchNews('Bitcoin price', 'en', 'US', 10);
    
    if (results.success) {
        console.log(`\n📊 Final Results: ${results.totalResults} unique articles\n`);
        
        results.articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   📰 Source: ${article.source}`);
            console.log(`   🌐 Domain: ${article.domain}`);
            console.log(`   📅 Date: ${article.pubDate.toLocaleDateString()}`);
            console.log(`   🔗 URL: ${article.realUrl || article.link}`);
            console.log(''); // Empty line for spacing
        });
        
        // Show domain distribution like in your second example
        const domainCount = {};
        results.articles.forEach(article => {
            const domain = article.domain || 'unknown';
            domainCount[domain] = (domainCount[domain] || 0) + 1;
        });
        
        console.log('📊 Domain Distribution:');
        Object.entries(domainCount)
            .sort(([,a], [,b]) => b - a)
            .forEach(([domain, count]) => {
                console.log(`   ${domain}: ${count} article${count > 1 ? 's' : ''}`);
            });
            
    } else {
        console.log('❌ Search failed:', results.error);
    }
}

// Alternative: Quick search function for testing different topics
async function quickSearch(topic) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Quick search for: "${topic}"`);
    console.log('='.repeat(60));
    
    const searcher = new GoogleNewsSearcher();
    const results = await searcher.searchNews(topic, 'en', 'US', 100);
    
    if (results.success) {
        results.articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   📰 ${article.source} (${article.domain})`);
            console.log(`   📅 ${article.pubDate.toLocaleDateString()}`);
            console.log(`   🔗 ${article.realUrl || article.link}\n`);
        });
    }
}

// Main execution
async function main() {
    // Run the main test
    await testWithRealUrls();
    
    // Test a few more topics to see different sources
    await quickSearch('Soham Parekh');
    // await quickSearch('climate change');
}

// Run the tests
main().catch(console.error);