#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const unzipper = require('unzipper');
const csvParser = require('csv-parser');
const Bottleneck = require('bottleneck');
const { createObjectCsvWriter } = require('csv-writer');
const { Command } = require('commander');

const WHATCMS_API_KEY = process.env.WHATCMS_API_KEY;
if (!WHATCMS_API_KEY) {
  console.error('❌ No WHATCMS_API_KEY found. Please create a .env file with YOUR_KEY under WHATCMS_API_KEY');
  process.exit(1);
}
console.log('🔑 Loaded WHATCMS_API_KEY from .env');

const PLANS = {
  free:    { monthlyQuota: 500,    minTimeMs: 15000 },
  '10000': { monthlyQuota: 10000,  minTimeMs: 5000  },
  '20000': { monthlyQuota: 20000,  minTimeMs: 2000  },
  '50000': { monthlyQuota: 50000,  minTimeMs: 1000  },
  '100000':{ monthlyQuota: 100000, minTimeMs: 1000  },
  '200000':{ monthlyQuota: 200000, minTimeMs: 250   },
  '300000':{ monthlyQuota: 300000, minTimeMs: 250   },
  '400000':{ monthlyQuota: 400000, minTimeMs: 250   },
  '500000':{ monthlyQuota: 500000, minTimeMs: 250   },
};

/**
 * Detect CMS via WhatCMS Tech API, return an object with all fields
 */
async function detectCMS(domain) {
  try {
    console.log(`🔍 Making API request for: ${domain}`);
    const resp = await axios.get('https://whatcms.org/API/Tech', {
      params: { key: WHATCMS_API_KEY, url: domain },
      timeout: 15000,
    });
    
    console.log(`📡 Raw API response:`, JSON.stringify(resp.data, null, 2));
    
    if (resp.data.error) {
      console.error(`❌ API Error: ${resp.data.msg}`);
      throw new Error(resp.data.msg);
    }
    
    // Extract all the data from the Tech API response
    const techResult = {
      request: resp.data.request || '',
      last_checked: resp.data.last_checked || '',
      result_code: resp.data.result?.code || '',
      result_msg: resp.data.result?.msg || '',
      results: resp.data.results || [],
      meta_social: resp.data.meta?.social || [],
      error: ''
    };
    
    console.log(`✅ Processed Tech API result:`, techResult);
    return techResult;
  } catch (error) {
    console.error(`❌ Error detecting CMS for ${domain}:`, error.message);
    if (error.response) {
      console.error(`📡 HTTP Status: ${error.response.status}`);
      console.error(`📡 Response data:`, error.response.data);
    }
    throw error;
  }
}

async function fetchMajesticMillion() {
  console.log('⟳ Downloading Majestic Million…');
  const url = 'https://downloads.majestic.com/majestic_million.csv';
  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: 30000 });
    const domains = [];
    return new Promise((resolve, reject) => {
      res.data
        .pipe(csvParser({ headers: ['rank','domain'], skipLines: 1 }))
        .on('data', row => domains.push(row.domain))
        .on('end', () => {
          console.log(`✔️  Downloaded ${domains.length.toLocaleString()} domains from Majestic`);
          resolve(domains);
        })
        .on('error', reject);
    });
  } catch (err) {
    console.error('❌ Failed to fetch Majestic list:', err.message);
    return [];
  }
}

async function fetchTranco() {
  console.log('⟳ Downloading Tranco Top 1M…');
  const url = 'https://tranco-list.eu/top-1m.csv.zip';
  try {
    const res = await axios.get(url, { responseType: 'stream', timeout: 30000 });
    const domains = [];
    return new Promise((resolve, reject) => {
      res.data
        .pipe(unzipper.ParseOne())
        .pipe(csvParser({ headers: ['rank','domain'], skipLines: 0 }))
        .on('data', row => domains.push(row.domain))
        .on('end', () => {
          console.log(`✔️  Downloaded ${domains.length.toLocaleString()} domains from Tranco`);
          resolve(domains);
        })
        .on('error', reject);
    });
  } catch (err) {
    console.error('❌ Failed to fetch Tranco list:', err.message);
    return [];
  }
}

/**
 * Generate a default filename based on parameters
 */
function generateDefaultFilename(opts) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const parts = ['cms-scan'];
  
  if (opts.domain) {
    parts.push('single');
    parts.push(opts.domain.replace(/[^a-zA-Z0-9]/g, '-'));
  } else {
    if (opts.source) parts.push(opts.source);
    if (opts.extension) parts.push(opts.extension);
    if (opts.limit) parts.push(`limit-${opts.limit}`);
  }
  
  parts.push(timestamp);
  return `${parts.join('-')}.csv`;
}

/**
 * Handle CSV filename with timestamp if file exists
 */
function getOutputFilename(opts) {
  let filename = opts.output;
  
  // If no output file specified, generate default filename
  if (!filename || filename === 'results.csv') {
    filename = generateDefaultFilename(opts);
    console.log(`📄 No output file specified. Using: ${filename}`);
  }
  
  // If file exists, add timestamp before extension
  if (fs.existsSync(filename)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    filename = `${base}-${timestamp}${ext}`;
    console.log(`📄 File ${opts.output} already exists. Using: ${filename}`);
  }
  
  return filename;
}

(async () => {
  const program = new Command();
  program
    .description('Scan domains & detect Umbraco sites via WhatCMS with plan-aware rate limiting')
    .option('--plan <plan>', 'API plan (free, 10000,20000…500000)', 'free')
    .option('--source <src>', 'Domain list source (tranco, majestic)', 'tranco')
    .option('-e, --extension <tld>', 'TLD to filter (without dot)', 'nl')
    .option('--fetch', 'Download list instead of reading a file')
    .option('-i, --input <file>', 'Path to domains file (one per line)')
    .option('-d, --domain <domain>', 'Single domain to scan')
    .option('-L, --limit <n>', 'Max domains to scan', v => parseInt(v,10))
    .option('-o, --output <file>', 'Output CSV path', 'results.csv')
    .parse(process.argv);

  const opts = program.opts();
  if (opts.source === 'alexa') {
    console.error('❌ Alexa Top 1M is no longer supported (403 error). Please use --source majestic or --source tranco.');
    process.exit(1);
  }

  const plan = PLANS[opts.plan];
  if (!plan) {
    console.error('❌ Unknown plan:', opts.plan, 'Valid plans:', Object.keys(PLANS).join(', '));
    process.exit(1);
  }

  const limiter = new Bottleneck({ maxConcurrent: 1, minTime: plan.minTimeMs });

  let domains = [];
  if (opts.fetch) {
    switch (opts.source) {
      case 'majestic':
        domains = await fetchMajesticMillion();
        break;
      case 'tranco':
        domains = await fetchTranco();
        break;
      default:
        console.error('❌ Unknown source:', opts.source);
        process.exit(1);
    }
  } else if (opts.input) {
    domains = fs.readFileSync(path.resolve(opts.input), 'utf8')
                .split(/\r?\n/).filter(Boolean);
    console.log(`✔️  Loaded ${domains.length.toLocaleString()} domains from ${opts.input}`);
  } else if (opts.domain) {
    domains = [opts.domain];
    console.log(`✔️  Loaded single domain: ${opts.domain}`);
  } else {
    console.error('❌ You must pass either `--fetch`, `--input <file>`, or `--domain <domain>`');
    process.exit(1);
  }

  if (domains.length === 0) {
    console.warn('⚠️  No domains to scan. Exiting.');
    process.exit(0);
  }

  // Only apply TLD filtering if not scanning a single domain
  if (!opts.domain) {
    const tldPattern = new RegExp(`\\.${opts.extension.replace(/^\./,'')}$`, 'i');
    domains = domains.filter(d => tldPattern.test(d));
    if (opts.limit) domains = domains.slice(0, opts.limit);
  }

  console.log(`ℹ️  Plan: ${opts.plan}  •  Rate-limit: 1 req every ${plan.minTimeMs}ms`);
  if (opts.domain) {
    console.log(`ℹ️  Scanning single domain: ${opts.domain}`);
  } else {
    console.log(`ℹ️  Scanning ${domains.length} domains for .${opts.extension}`);
  }

  const results = [];
  let used = 0;
  const total = domains.length;

  for (let i = 0; i < total; i++) {
    const domain = domains[i];
    if (used >= plan.monthlyQuota) {
      console.warn(`⚠️  Reached monthly quota (${plan.monthlyQuota}). Stopping early.`);
      break;
    }

    console.log(`[${i+1}/${total}] ⏳ Scanning ${domain}`);
    try {
      const techData = await limiter.schedule(() => detectCMS(domain));
      used++;
      
      // Check if any of the results contain Umbraco
      const umbracoResult = techData.results.find(result => 
        result.name && result.name.toLowerCase() === 'umbraco'
      );
      
      if (umbracoResult) {
        console.log(`[${i+1}/${total}] ✅ ${domain} → Umbraco${umbracoResult.version ? ' v'+umbracoResult.version : ''}`);
      } else {
        const techNames = techData.results.map(r => r.name).join(', ');
        console.log(`[${i+1}/${total}] ❌ ${domain} not Umbraco (${techNames || 'unknown'})`);
      }
      
      // Create a comprehensive result object with all Tech API data
      const result = {
        domain,
        request: techData.request,
        last_checked: techData.last_checked,
        result_code: techData.result_code,
        result_msg: techData.result_msg,
        results_count: techData.results.length,
        results_json: JSON.stringify(techData.results),
        meta_social_json: JSON.stringify(techData.meta_social),
        error: techData.error
      };
      
      // Add individual tech results as separate columns (up to 10)
      for (let i = 0; i < Math.min(techData.results.length, 10); i++) {
        const tech = techData.results[i];
        result[`tech${i+1}_name`] = tech.name || '';
        result[`tech${i+1}_id`] = tech.id || '';
        result[`tech${i+1}_version`] = tech.version || '';
        result[`tech${i+1}_categories`] = tech.categories ? tech.categories.join(', ') : '';
        result[`tech${i+1}_url`] = tech.url || '';
      }
      
      // Fill remaining tech slots with empty values
      for (let i = techData.results.length; i < 10; i++) {
        result[`tech${i+1}_name`] = '';
        result[`tech${i+1}_id`] = '';
        result[`tech${i+1}_version`] = '';
        result[`tech${i+1}_categories`] = '';
        result[`tech${i+1}_url`] = '';
      }
      
      results.push(result);
    } catch (err) {
      console.log(`[${i+1}/${total}] ⚠️  Error on ${domain}: ${err.message}`);
      
      // Create error result with empty values
      const errorResult = {
        domain,
        request: '',
        last_checked: '',
        result_code: '',
        result_msg: '',
        results_count: 0,
        results_json: '',
        meta_social_json: '',
        error: err.message
      };
      
      // Fill all tech slots with empty values
      for (let i = 1; i <= 10; i++) {
        errorResult[`tech${i}_name`] = '';
        errorResult[`tech${i}_id`] = '';
        errorResult[`tech${i}_version`] = '';
        errorResult[`tech${i}_categories`] = '';
        errorResult[`tech${i}_url`] = '';
      }
      
      results.push(errorResult);
    }
  }

  const outputFilename = getOutputFilename(opts);
  const csvWriter = createObjectCsvWriter({
    path: outputFilename,
    header: [
      { id: 'domain',  title: 'Domain' },
      { id: 'request', title: 'Request' },
      { id: 'last_checked', title: 'Last_Checked' },
      { id: 'result_code', title: 'Result_Code' },
      { id: 'result_msg', title: 'Result_Message' },
      { id: 'results_count', title: 'Results_Count' },
      { id: 'results_json', title: 'Results_JSON' },
      { id: 'meta_social_json', title: 'Meta_Social_JSON' },
      { id: 'error',   title: 'Error' },
      // Tech 1
      { id: 'tech1_name', title: 'Tech1_Name' },
      { id: 'tech1_id', title: 'Tech1_ID' },
      { id: 'tech1_version', title: 'Tech1_Version' },
      { id: 'tech1_categories', title: 'Tech1_Categories' },
      { id: 'tech1_url', title: 'Tech1_URL' },
      // Tech 2
      { id: 'tech2_name', title: 'Tech2_Name' },
      { id: 'tech2_id', title: 'Tech2_ID' },
      { id: 'tech2_version', title: 'Tech2_Version' },
      { id: 'tech2_categories', title: 'Tech2_Categories' },
      { id: 'tech2_url', title: 'Tech2_URL' },
      // Tech 3
      { id: 'tech3_name', title: 'Tech3_Name' },
      { id: 'tech3_id', title: 'Tech3_ID' },
      { id: 'tech3_version', title: 'Tech3_Version' },
      { id: 'tech3_categories', title: 'Tech3_Categories' },
      { id: 'tech3_url', title: 'Tech3_URL' },
      // Tech 4
      { id: 'tech4_name', title: 'Tech4_Name' },
      { id: 'tech4_id', title: 'Tech4_ID' },
      { id: 'tech4_version', title: 'Tech4_Version' },
      { id: 'tech4_categories', title: 'Tech4_Categories' },
      { id: 'tech4_url', title: 'Tech4_URL' },
      // Tech 5
      { id: 'tech5_name', title: 'Tech5_Name' },
      { id: 'tech5_id', title: 'Tech5_ID' },
      { id: 'tech5_version', title: 'Tech5_Version' },
      { id: 'tech5_categories', title: 'Tech5_Categories' },
      { id: 'tech5_url', title: 'Tech5_URL' },
      // Tech 6
      { id: 'tech6_name', title: 'Tech6_Name' },
      { id: 'tech6_id', title: 'Tech6_ID' },
      { id: 'tech6_version', title: 'Tech6_Version' },
      { id: 'tech6_categories', title: 'Tech6_Categories' },
      { id: 'tech6_url', title: 'Tech6_URL' },
      // Tech 7
      { id: 'tech7_name', title: 'Tech7_Name' },
      { id: 'tech7_id', title: 'Tech7_ID' },
      { id: 'tech7_version', title: 'Tech7_Version' },
      { id: 'tech7_categories', title: 'Tech7_Categories' },
      { id: 'tech7_url', title: 'Tech7_URL' },
      // Tech 8
      { id: 'tech8_name', title: 'Tech8_Name' },
      { id: 'tech8_id', title: 'Tech8_ID' },
      { id: 'tech8_version', title: 'Tech8_Version' },
      { id: 'tech8_categories', title: 'Tech8_Categories' },
      { id: 'tech8_url', title: 'Tech8_URL' },
      // Tech 9
      { id: 'tech9_name', title: 'Tech9_Name' },
      { id: 'tech9_id', title: 'Tech9_ID' },
      { id: 'tech9_version', title: 'Tech9_Version' },
      { id: 'tech9_categories', title: 'Tech9_Categories' },
      { id: 'tech9_url', title: 'Tech9_URL' },
      // Tech 10
      { id: 'tech10_name', title: 'Tech10_Name' },
      { id: 'tech10_id', title: 'Tech10_ID' },
      { id: 'tech10_version', title: 'Tech10_Version' },
      { id: 'tech10_categories', title: 'Tech10_Categories' },
      { id: 'tech10_url', title: 'Tech10_URL' }
    ]
  });
  await csvWriter.writeRecords(results);
  console.log(`✅ Done! Scanned ${used} domains; results saved to ${outputFilename}`);
})();
