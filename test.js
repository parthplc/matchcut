// integrated-test.js - Test the integrated news searcher with URL decoding
const { IntegratedGoogleNewsSearcher } = require('./news-searcher');

async function testIntegratedSearcher() {
    console.log('🚀 Testing Integrated Google News Searcher with URL Decoding\n');
    console.log('=' .repeat(70));
    
    const searcher = new IntegratedGoogleNewsSearcher();
    
    // Test 1: Search with URL decoding enabled
    console.log('\n📰 TEST 1: Search with URL decoding (Bitcoin price)');
    console.log('-'.repeat(50));
    
    const results1 = await searcher.searchNews('Bitcoin price', 'en', 'US', 8, true);
    
    if (results1.success) {
        console.log(`\n✅ Search Results: ${results1.totalResults} articles found\n`);
        
        results1.articles.forEach((article, index) => {
            console.log(`${index + 1}. 📰 ${article.title}`);
            console.log(`   📍 Source: ${article.source}`);
            console.log(`   🌐 Domain: ${article.domain}`);
            console.log(`   📅 Date: ${article.pubDate.toLocaleDateString()}`);
            console.log(`   🔗 Google URL: ${article.link}`);
            
            if (article.realUrl) {
                console.log(`   ✅ Real URL: ${article.realUrl}`);
            } else {
                console.log(`   ❌ Real URL: Not decoded`);
            }
            console.log('');
        });
        
        // Show domain distribution
        const domainCount = {};
        results1.articles.forEach(article => {
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
        console.log('❌ Test 1 failed:', results1.error);
    }
    
    // Reset stats for next test
    searcher.resetStats();
    
    // Test 2: Search without URL decoding for comparison
    console.log('\n\n📰 TEST 2: Search without URL decoding (AI technology)');
    console.log('-'.repeat(50));
    
    const results2 = await searcher.searchNews('AI technology', 'en', 'US', 5, false);
    
    if (results2.success) {
        console.log(`\n✅ Search Results: ${results2.totalResults} articles found\n`);
        
        results2.articles.forEach((article, index) => {
            console.log(`${index + 1}. 📰 ${article.title}`);
            console.log(`   📍 Source: ${article.source}`);
            console.log(`   🌐 Domain: ${article.domain} (estimated)`);
            console.log(`   📅 Date: ${article.pubDate.toLocaleDateString()}`);
            console.log(`   🔗 URL: ${article.link}`);
            console.log('');
        });
    } else {
        console.log('❌ Test 2 failed:', results2.error);
    }
    
    // Test 3: Comparison test - show difference between decoded and non-decoded
    console.log('\n\n📰 TEST 3: Side-by-side comparison');
    console.log('-'.repeat(50));
    
    const comparisonResults = await searcher.searchNews('Tesla stock', 'en', 'US', 3, true);
    
    if (comparisonResults.success) {
        console.log('\n🔍 Comparison: Google URLs vs Real URLs\n');
        
        comparisonResults.articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title.substring(0, 60)}...`);
            console.log(`   📱 Google URL: ${article.link}`);
            console.log(`   🌐 Real URL:   ${article.realUrl || 'Not decoded'}`);
            console.log(`   📍 Domain:     ${article.domain}`);
            console.log('');
        });
    }
}

async function testSpecificUrls() {
    console.log('\n\n🔧 Testing URL Decoder with Specific URLs');
    console.log('=' .repeat(70));
    
    const searcher = new IntegratedGoogleNewsSearcher();
    
    // Test specific Google News URLs
    const testUrls = [
        "https://news.google.com/articles/CBMiVkFVX3lxTE4zaGU2bTY2ZGkzdTRkSkJ0cFpsTGlDUjkxU2FBRURaTWU0c3QzVWZ1MHZZNkZ5Vzk1ZVBnTDFHY2R6ZmdCUkpUTUJsS1pqQTlCRzlzbHV3?oc=5",
        "https://news.google.com/rss/articles/CBMiqwFBVV85cUxNMTRqdUZpNl9hQldXbGo2YVVLOGFQdkFLYldlMUxUVlNEaElsYjRRODVUMkF3R1RYdWxvT1NoVzdUYS0xSHg3eVdpTjdVODQ5cVJJLWt4dk9vZFBScVp2ZmpzQXZZRy1ncDM5c2tRbXBVVHVrQnpmMGVrQXNkQVItV3h4dVQ1V1BTbjhnM3k2ZUdPdnhVOFk1NmllNTZkdGJTbW9NX0k5U3E2Tkk?oc=5"
    ];
    
    for (const [index, url] of testUrls.entries()) {
        console.log(`\nTest URL ${index + 1}:`);
        console.log(`Input:  ${url}`);
        
        const result = await searcher.decoder.decodeGoogleNewsUrl(url);
        
        if (result.status) {
            console.log(`✅ Output: ${result.decoded_url}`);
        } else {
            console.log(`❌ Failed: ${result.message}`);
        }
    }
}

async function quickSearchWithDecoding(topic, maxResults = 5) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 Quick search with decoding: "${topic}"`);
    console.log('='.repeat(70));
    
    const searcher = new IntegratedGoogleNewsSearcher();
    const results = await searcher.searchNews(topic, 'en', 'US', maxResults, true);
    
    if (results.success) {
        console.log(`\n📊 Results: ${results.totalResults} articles`);
        console.log(`🔓 Decoding: ${results.decodingStats.successful}/${results.decodingStats.total} successful\n`);
        
        results.articles.forEach((article, index) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   📰 ${article.source} → ${article.domain}`);
            console.log(`   📅 ${article.pubDate.toLocaleDateString()}`);
            
            if (article.realUrl) {
                console.log(`   ✅ Real: ${article.realUrl}`);
            } else {
                console.log(`   🔗 Google: ${article.link}`);
            }
            console.log('');
        });
    } else {
        console.log(`❌ Search failed: ${results.error}`);
    }
}

// Main execution function
async function main() {
    try {
        // Run comprehensive tests
        await testIntegratedSearcher();
        
        // Test URL decoding specifically
        await testSpecificUrls();
        
        // Quick searches with different topics
        await quickSearchWithDecoding('cryptocurrency news', 4);
        await quickSearchWithDecoding('climate change', 3);
        
        console.log('\n🎉 All tests completed!');
        console.log('\n💡 Key Features Demonstrated:');
        console.log('   ✅ Google News RSS search');
        console.log('   ✅ URL decoding to real source URLs');
        console.log('   ✅ Domain extraction and mapping');
        console.log('   ✅ Duplicate removal');
        console.log('   ✅ Performance statistics');
        console.log('   ✅ Error handling and fallbacks');
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
    }
}

// Handle both direct execution and module import
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testIntegratedSearcher,
    testSpecificUrls,
    quickSearchWithDecoding
};