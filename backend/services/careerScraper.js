const { spawn } = require('child_process');
const path = require('path');
const { promisify } = require('util');

class CareerScraperError extends Error {
  constructor(message, scrapedData = null) {
    super(message);
    this.name = 'CareerScraperError';
    this.scrapedData = scrapedData;
  }
}

/**
 * Scrapes real job skills for any role using web_scraper.py
 */
class CareerScraper {
  constructor() {
this.pythonPath = path.join(__dirname, '../ml/web_scraper_cli.py');
  }

  async getRoleSkills(role, location = 'India', limit = 20) {
    return new Promise((resolve, reject) => {
      const args = [this.pythonPath, 'scrape_job_skills'];
      const inputData = JSON.stringify({ job_title: role, location, num_jobs: limit });

      const proc = spawn('python', args, {
        cwd: path.dirname(this.pythonPath),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!proc) {
        return reject(new CareerScraperError('Failed to start Python scraper process'));
      }

      let stdout = '';
      let stderr = '';

      proc.stdin.write(inputData + '\n');
      proc.stdin.end();

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new CareerScraperError(`Scraper exited with code ${code}: ${stderr}`));
        }

        try {
          // The scraper may emit log lines before the JSON – find the first JSON object/array line
          const jsonLine = stdout.split('\n').find(l => {
            const t = l.trim();
            return t.startsWith('{') || t.startsWith('[');
          });
          if (!jsonLine) throw new Error('No JSON found in output');
          const result = JSON.parse(jsonLine.trim());
          resolve(result.skills || []);
        } catch (parseErr) {
          reject(new CareerScraperError(`Failed to parse scraper output: ${stdout}`, stdout));
        }
      });
    });
  }

  async getLiveJobs(role, location = 'India', limit = 10) {
    // Reuse same scraper for consistency
    return new Promise((resolve, reject) => {
      const args = [this.pythonPath, 'get_live_jobs'];
      const inputData = JSON.stringify({ job_title: role, location, num_each: limit });

      const proc = spawn('python', args, {
        cwd: path.dirname(this.pythonPath),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!proc) {
        return reject(new CareerScraperError('Failed to start Python scraper process'));
      }

      let stdout = '';
      let stderr = '';

      proc.stdin.write(inputData + '\n');
      proc.stdin.end();

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          return reject(new CareerScraperError(`Scraper exited with code ${code}: ${stderr}`));
        }

        try {
          // The scraper may emit log lines before the JSON – find the first JSON object/array line
          const jsonLine = stdout.split('\n').find(l => {
            const t = l.trim();
            return t.startsWith('{') || t.startsWith('[');
          });
          if (!jsonLine) throw new Error('No JSON found in output');
          const result = JSON.parse(jsonLine.trim());
          // Standard shape: { jobs: [...] }
          // (Older versions returned just an array; keep tolerance.)
          if (Array.isArray(result)) return resolve({ jobs: result });
          resolve({ jobs: result.jobs || [] });
        } catch (parseErr) {
          reject(new CareerScraperError(`Failed to parse scraper output: ${stdout}`, stdout));
        }
      });
    });
  }
}

module.exports = new CareerScraper();
