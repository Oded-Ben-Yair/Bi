const { chromium } = require('playwright');
const fs = require('fs');

const prompts = [
  {
    name: 'total_revenue',
    text: 'What is the total revenue in the Axia dataset?',
    expectedKeywords: ['revenue', 'total', '$', 'million', 'transactions']
  },
  {
    name: 'sales_trends',
    text: 'Show me the sales trends for the last quarter in the DS-Axia dataset',
    expectedKeywords: ['Q', '2025', 'growth', 'revenue', 'trend', '%']
  },
  {
    name: 'top_products',
    text: 'What are the top performing products by revenue in DS-Axia?',
    expectedKeywords: ['rank', 'product', 'revenue', '$', 'top', 'units']
  },
  {
    name: 'yoy_comparison',
    text: "Compare this year's performance with last year using DS-Axia data",
    expectedKeywords: ['2024', '2025', 'growth', '%', 'revenue', 'projected']
  },
  {
    name: 'customer_segments',
    text: 'Analyze customer segments and their contribution to revenue in DS-Axia',
    expectedKeywords: ['Enterprise', 'SMB', 'segment', 'revenue', '%', 'customers']
  },
  {
    name: 'revenue_forecast',
    text: 'Generate a revenue forecast for the next quarter based on DS-Axia trends',
    expectedKeywords: ['Q4', '2025', 'forecast', 'predicted', '$', 'growth']
  },
  {
    name: 'anomaly_detection',
    text: 'Detect any anomalies or unusual patterns in the DS-Axia dataset',
    expectedKeywords: ['anomaly', 'detected', 'spike', 'drop', 'z-score', 'date']
  }
];

async function testPrompt(page, prompt, index) {
  console.log(`\n${index}. Testing: "${prompt.name}"`);
  console.log(`   Prompt: "${prompt.text}"`);

  // Clear input and type new prompt
  const textarea = await page.locator('textarea');
  await textarea.fill(prompt.text);

  // Send message
  await page.keyboard.press('Enter');
  console.log('   ✅ Message sent');

  // Wait for response (increased timeout for complex queries)
  console.log('   ⏳ Waiting for response...');
  await page.waitForTimeout(8000);

  // Get all messages
  const messages = await page.locator('[data-role="assistant"]').allTextContents();
  const lastResponse = messages[messages.length - 1] || '';

  // Check if response contains expected keywords
  let foundKeywords = [];
  let missingKeywords = [];

  for (const keyword of prompt.expectedKeywords) {
    if (lastResponse.toLowerCase().includes(keyword.toLowerCase())) {
      foundKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  // Determine quality
  const quality = foundKeywords.length / prompt.expectedKeywords.length;
  let qualityLabel = '';
  if (quality >= 0.8) qualityLabel = '🟢 EXCELLENT';
  else if (quality >= 0.6) qualityLabel = '🟡 GOOD';
  else if (quality >= 0.4) qualityLabel = '🟠 FAIR';
  else qualityLabel = '🔴 POOR';

  console.log(`   Quality: ${qualityLabel} (${Math.round(quality * 100)}%)`);
  console.log(`   Found keywords: ${foundKeywords.join(', ')}`);
  if (missingKeywords.length > 0) {
    console.log(`   Missing keywords: ${missingKeywords.join(', ')}`);
  }

  // Extract key metrics from response
  const metrics = {
    hasNumbers: /\d+/.test(lastResponse),
    hasCurrency: /\$[\d,]+/.test(lastResponse),
    hasPercentage: /\d+%/.test(lastResponse),
    responseLength: lastResponse.length
  };

  console.log(`   Metrics: Numbers:${metrics.hasNumbers} Currency:${metrics.hasCurrency} Percentage:${metrics.hasPercentage} Length:${metrics.responseLength}`);

  // Take screenshot
  await page.screenshot({
    path: `test-prompt-${index}-${prompt.name}.png`,
    fullPage: true
  });

  return {
    prompt: prompt.name,
    quality: quality,
    qualityLabel: qualityLabel,
    foundKeywords: foundKeywords,
    missingKeywords: missingKeywords,
    metrics: metrics,
    responseSnippet: lastResponse.substring(0, 200) + '...'
  };
}

(async () => {
  console.log('🚀 Starting comprehensive prompt quality test...');
  console.log('📅 Date: September 29, 2025');
  console.log('📊 Testing all 6 suggested prompts + total revenue');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to app
  console.log('\n📱 Opening application...');
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);

  // Test all prompts
  const results = [];
  for (let i = 0; i < prompts.length; i++) {
    const result = await testPrompt(page, prompts[i], i + 1);
    results.push(result);

    // Wait between prompts
    if (i < prompts.length - 1) {
      await page.waitForTimeout(2000);
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('📊 QUALITY SUMMARY REPORT');
  console.log('='.repeat(60));

  let excellentCount = 0;
  let goodCount = 0;
  let fairCount = 0;
  let poorCount = 0;

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.prompt}: ${result.qualityLabel}`);
    if (result.quality >= 0.8) excellentCount++;
    else if (result.quality >= 0.6) goodCount++;
    else if (result.quality >= 0.4) fairCount++;
    else poorCount++;
  });

  console.log('\nOverall Statistics:');
  console.log(`🟢 Excellent: ${excellentCount}/${prompts.length}`);
  console.log(`🟡 Good: ${goodCount}/${prompts.length}`);
  console.log(`🟠 Fair: ${fairCount}/${prompts.length}`);
  console.log(`🔴 Poor: ${poorCount}/${prompts.length}`);

  const overallScore = (excellentCount * 4 + goodCount * 3 + fairCount * 2 + poorCount * 1) / (prompts.length * 4);
  console.log(`\n📈 Overall Quality Score: ${Math.round(overallScore * 100)}%`);

  // Save detailed report
  const report = {
    testDate: new Date().toISOString(),
    promptsTested: prompts.length,
    results: results,
    summary: {
      excellent: excellentCount,
      good: goodCount,
      fair: fairCount,
      poor: poorCount,
      overallScore: Math.round(overallScore * 100)
    }
  };

  fs.writeFileSync('prompt-quality-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Detailed report saved to prompt-quality-report.json');

  // Final screenshot
  await page.screenshot({ path: 'test-all-prompts-final.png', fullPage: true });

  await browser.close();
  console.log('\n✅ Test complete!');
})();