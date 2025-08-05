# Umbraco CMS Detection Script

A Node.js command-line tool that scans domains to detect Umbraco CMS installations using the WhatCMS Tech API. This script can scan individual domains or bulk scan from popular domain lists like Tranco Top 1M or Majestic Million.

## Features

- 🔍 **CMS Detection**: Uses WhatCMS Tech API to detect Umbraco and other CMS technologies
- 📊 **Bulk Scanning**: Scan thousands of domains from popular domain lists
- 🎯 **Umbraco Focus**: Specifically identifies Umbraco CMS installations with version detection
- ⚡ **Rate Limiting**: Plan-aware rate limiting to respect API quotas
- 📁 **Multiple Sources**: Support for Tranco Top 1M and Majestic Million domain lists
- 🗂️ **CSV Export**: Comprehensive results exported to CSV with detailed tech information
- 🔧 **Flexible Input**: Scan single domains, custom domain lists, or fetch from online sources

## What It Does

This script helps security researchers, developers, and organizations identify websites running Umbraco CMS. It can:

- Scan individual domains for Umbraco detection
- Bulk scan thousands of domains from popular domain lists
- Filter domains by TLD (e.g., `.nl`, `.com`, `.org`)
- Export detailed results including detected technologies, versions, and metadata
- Respect API rate limits based on your WhatCMS plan

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager
- WhatCMS API key (free or paid plan)

## Installation

1. **Clone or download this repository:**
   ```bash
   git clone <repository-url>
   cd UmbracoSearch
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create a `.env` file in the project root:**
   ```bash
   WHATCMS_API_KEY=your_api_key_here
   ```

4. **Get your WhatCMS API key:**
   - Visit [WhatCMS.org](https://whatcms.org/)
   - Sign up for a free account
   - Get your API key from your dashboard

## Dependencies

The script requires the following npm packages:
- `axios` - HTTP client for API requests
- `bottleneck` - Rate limiting
- `commander` - CLI argument parsing
- `csv-parser` - CSV file parsing
- `csv-writer` - CSV file writing
- `dotenv` - Environment variable loading
- `unzipper` - ZIP file extraction

## Usage

### Basic Commands

**Scan a single domain:**
```bash
node detect-cms-cli.js --domain example.com
```

**Scan domains from a file:**
```bash
node detect-cms-cli.js --input domains.txt
```

**Fetch and scan Tranco Top 1M (default):**
```bash
node detect-cms-cli.js --fetch --source tranco --extension nl --limit 100
```

**Fetch and scan Majestic Million:**
```bash
node detect-cms-cli.js --fetch --source majestic --extension com --limit 500
```

### Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--plan <plan>` | API plan (free, 10000, 20000, 50000, 100000, 200000, 300000, 400000, 500000) | `free` |
| `--source <src>` | Domain list source (tranco, majestic) | `tranco` |
| `-e, --extension <tld>` | TLD to filter (without dot) | `nl` |
| `--fetch` | Download list instead of reading a file | - |
| `-i, --input <file>` | Path to domains file (one per line) | - |
| `-d, --domain <domain>` | Single domain to scan | - |
| `-L, --limit <n>` | Max domains to scan | - |
| `-o, --output <file>` | Output CSV path | `results.csv` |

### Rate Limiting by Plan

| Plan | Monthly Quota | Min Time Between Requests |
|------|---------------|---------------------------|
| free | 500 | 15 seconds |
| 10000 | 10,000 | 5 seconds |
| 20000 | 20,000 | 2 seconds |
| 50000 | 50,000 | 1 second |
| 100000 | 100,000 | 1 second |
| 200000+ | 200,000+ | 250ms |

### Examples

**Scan a single domain and save results:**
```bash
node detect-cms-cli.js --domain umbraco.com --output umbraco-scan.csv
```

**Scan first 100 .nl domains from Tranco list:**
```bash
node detect-cms-cli.js --fetch --source tranco --extension nl --limit 100
```

**Scan custom domain list:**
```bash
node detect-cms-cli.js --input my-domains.txt --extension com
```

**Use a paid plan for faster scanning:**
```bash
node detect-cms-cli.js --plan 10000 --fetch --source majestic --limit 1000
```

## Output

The script generates a CSV file with comprehensive information about each scanned domain:

### CSV Columns

- **Domain**: The scanned domain
- **Request**: API request details
- **Last_Checked**: When the domain was last checked
- **Result_Code**: API result code
- **Result_Message**: API result message
- **Results_Count**: Number of technologies detected
- **Results_JSON**: Full JSON of detected technologies
- **Meta_Social_JSON**: Social media metadata
- **Error**: Any error messages
- **Tech1_Name** through **Tech10_Name**: Detected technology names
- **Tech1_Version** through **Tech10_Version**: Technology versions
- **Tech1_Categories** through **Tech10_Categories**: Technology categories
- **Tech1_URL** through **Tech10_URL**: Technology URLs

### Sample Output

```csv
Domain,Request,Last_Checked,Result_Code,Result_Message,Results_Count,Results_JSON,Meta_Social_JSON,Error,Tech1_Name,Tech1_ID,Tech1_Version,Tech1_Categories,Tech1_URL
example.com,https://example.com,2024-01-15 10:30:00,200,Success,3,"[{""name"":""Umbraco"",""version"":""10.0.0""}]","[]","",Umbraco,1234,10.0.0,CMS,https://umbraco.com
```

## File Naming

The script automatically generates filenames based on your parameters:
- Single domain: `cms-scan-single-example-com-2024-01-15T10-30-00.csv`
- Bulk scan: `cms-scan-tranco-nl-limit-100-2024-01-15T10-30-00.csv`

If a file already exists, a timestamp is appended to avoid overwriting.

## Error Handling

The script handles various error scenarios:
- Network timeouts
- API rate limiting
- Invalid domains
- File I/O errors
- Missing API keys

All errors are logged to the console and included in the CSV output.

## Limitations

- **API Quotas**: Respects WhatCMS API monthly quotas
- **Rate Limiting**: Imposes delays between requests based on your plan
- **Domain Lists**: Requires internet connection to fetch domain lists
- **File Size**: Large domain lists may consume significant memory

## Troubleshooting

**"No WHATCMS_API_KEY found"**
- Create a `.env` file with your API key
- Ensure the file is in the project root directory

**"Unknown plan"**
- Use one of the supported plan names: `free`, `10000`, `20000`, etc.

**"Failed to fetch domain list"**
- Check your internet connection
- Domain list sources may be temporarily unavailable

**"Reached monthly quota"**
- Upgrade your WhatCMS plan or wait until next month
- The script will stop scanning when quota is reached

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this script.

## License

This project is open source. Please check the license file for details.

## Disclaimer

This tool is for legitimate security research and development purposes only. Always respect website terms of service and robots.txt files when scanning domains. 