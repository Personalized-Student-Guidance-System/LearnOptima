const { spawn } = require('child_process');
const path = require('path');

/**
 * Career Data Scraper - Integrates Python scraper for dynamic job/resources data
 * Caches results for 1 hour to avoid rate limits
 */
class CareerScraper {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get dynamic career data: scraped jobs, skills, resources
   * @param {string} role - Career role (e.g. 'Software Engineer')
   * @param {string} location - Job location (default 'India')
   * @param {int} numJobs - Number of jobs to scrape (default 5)
   */
  async getDynamicData(role, location = 'India', numJobs = 5) {
    const cacheKey = `${role.toLowerCase()}_${location}_${numJobs}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      console.log(`[CareerScraper] Cache hit for ${role}`);
      return cached.data;
    }

    console.log(`[CareerScraper] Scraping live data for ${role} (${location})`);
    
    return new Promise((resolve, reject) => {
      const pythonPath = path.join(__dirname, '../ml/skill_resources_scraper.py');
      const args = [
        '--role', role,
        '--location', location,
        '--num-jobs', numJobs.toString(),
        '--json'
      ];

      const proc = spawn('python', args, { 
        cwd: path.dirname(pythonPath),
        timeout: 30000, // 30s timeout
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            let data = JSON.parse(stdout);
            if (!data.jobs || data.jobs.length === 0) {
              data.jobs = this.getFallbackData(role, data.extracted_skills || ['Python', 'JavaScript', 'React']).jobs;
              data.source = data.source || 'scraped-with-fallback-jobs';
            }
            // Cache result
            this.cache.set(cacheKey, {
              data,
              timestamp: Date.now()
            });
            console.log(`[CareerScraper] Success: ${data.extracted_skills?.length || 0} skills, ${data.jobs?.length || 0} jobs`);
            resolve(data);
          } catch (parseErr) {
            console.error('[CareerScraper] JSON parse error:', parseErr.message, stdout);
            resolve(this.getFallbackData(role));
          }
        } else {
          console.error(`[CareerScraper] Python exit code ${code}:`, stderr);
          resolve(this.getFallbackData(role));
        }
      });

      proc.on('error', (err) => {
        console.error('[CareerScraper] Spawn error:', err.message);
        resolve(this.getFallbackData(role));
      });
    });
  }

  /**
   * Fallback static data when scraping fails
   */
  getFallbackData(role, scrapedSkills = ['Python', 'JavaScript', 'React', 'SQL', 'Docker', 'AWS', 'TypeScript']) {
    console.log(`[CareerScraper] Generating dynamic fallback jobs for ${role} using scraped skills: ${scrapedSkills.slice(0,3).join(', ')}`);
    
    const companies = [
      {name: 'Google India', loc: 'Bangalore', url: 'https://careers.google.com/jobs', salary: '₹25-45 LPA'},
      {name: 'Amazon', loc: 'Chennai', url: 'https://amazon.jobs', salary: '₹28-50 LPA'},
      {name: 'Flipkart', loc: 'Bangalore', url: 'https://careers.flipkart.com/', salary: '₹18-35 LPA'},
      {name: 'Microsoft', loc: 'Hyderabad', url: 'https://careers.microsoft.com/', salary: '₹22-42 LPA'},
      {name: 'Paytm', loc: 'Noida', url: 'https://paytm.com/careers', salary: '₹20-38 LPA'},
      {name: 'TCS', loc: 'Mumbai', url: 'https://www.tcs.com/careers', salary: '₹15-30 LPA'}
    ];
    
    const now = new Date();
    const mockJobs = companies.slice(0,6).map((company, idx) => {
      const days = 1 + Math.floor(Math.random() * 7); // 1-7 days urgent
      const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const skills = scrapedSkills.sort(() => 0.5 - Math.random()).slice(0,3 + idx % 2); // 3-4 skills
      
      return {
        title: `${role} - ${['SDE', 'Engineer', 'Developer', 'Specialist'][Math.floor(Math.random()*4)]}`,
        company: company.name,
        location: company.loc,
        salary: company.salary,
        deadline: deadline,
        applyUrl: company.url,
        skills: skills
      };
    }).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)); // Urgent first
    
    return {
      role,
      jobs: mockJobs,
      extracted_skills: scrapedSkills,
      resources: {}, // Use Python resources if available
      source: 'dynamic-fallback'
    };
  }


  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new CareerScraper();

