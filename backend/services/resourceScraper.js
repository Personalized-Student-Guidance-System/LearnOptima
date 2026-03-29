const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Web Scraper Service for learning resources
 * Scrapes resources from multiple platforms like Udemy, Coursera, GitHub, etc.
 */

class ResourceScraper {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    // Cache for scraped resources (in-memory)
    this.cache = {};
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Scrape Udemy courses for a specific skill
   */
  async scrapeUdemy(skill, limit = 3) {
    try {
      const searchUrl = `https://www.udemy.com/api-2.0/courses/?search=${encodeURIComponent(skill)}&page_size=${limit}`;
      
      const response = await axios.get(searchUrl, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      const courses = response.data?.results || [];
      return courses.slice(0, limit).map(course => ({
        title: course.title,
        url: `https://www.udemy.com/course/${course.url_title}/`,
        platform: 'Udemy',
        price: course.price ? `$${course.price}` : 'Free',
        rating: course.rating,
        students: course.num_subscribers
      }));
    } catch (error) {
      console.error(`Error scraping Udemy for ${skill}:`, error.message);
      return [];
    }
  }

  /**
   * Scrape Coursera courses for a specific skill
   */
  async scrapeCoursera(skill, limit = 3) {
    try {
      const searchUrl = `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`;
      
      const response = await axios.get(searchUrl, { 
        headers: this.headers,
        timeout: 10000 
      });
      
      const $ = cheerio.load(response.data);
      const courses = [];
      
      $('[data-test="search-result-card"]').slice(0, limit).each((i, elem) => {
        const title = $(elem).find('[data-test="link"]').text().trim();
        const url = $(elem).find('[data-test="link"]').attr('href');
        const institution = $(elem).find('[data-test="institution-name"]').text().trim();
        
        if (title && url) {
          courses.push({
            title: title.substring(0, 80),
            url: url.startsWith('http') ? url : `https://coursera.org${url}`,
            platform: 'Coursera',
            institution: institution || 'Coursera'
          });
        }
      });
      
      return courses;
    } catch (error) {
      console.error(`Error scraping Coursera for ${skill}:`, error.message);
      return [];
    }
  }

  /**
   * Scrape GitHub repositories for learning resources
   */
  async scrapeGitHub(skill, limit = 3) {
    try {
      const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(skill + ' tutorial')}&sort=stars&order=desc&per_page=${limit}`;
      
      const response = await axios.get(searchUrl, { 
        headers: { ...this.headers, 'Accept': 'application/vnd.github.v3+json' },
        timeout: 10000 
      });
      
      const repos = response.data?.items || [];
      return repos.map(repo => ({
        title: repo.name + ' - ' + (repo.description || 'GitHub Repository'),
        url: repo.html_url,
        platform: 'GitHub',
        stars: repo.stargazers_count,
        language: repo.language
      }));
    } catch (error) {
      console.error(`Error scraping GitHub for ${skill}:`, error.message);
      return [];
    }
  }

  /**
   * Scrape YouTube (simplified - just returns search link)
   */
  async scrapeYouTube(skill, limit = 1) {
    try {
      return [{
        title: `Learn ${skill} - YouTube Video Tutorials`,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent('learn ' + skill)}`,
        platform: 'YouTube',
        type: 'Video'
      }];
    } catch (error) {
      console.error(`Error creating YouTube link for ${skill}:`, error.message);
      return [];
    }
  }

  /**
   * Scrape GeeksforGeeks tutorials
   */
  async scrapeGeeksForGeeks(skill, limit = 1) {
    try {
      return [{
        title: `${skill} Tutorial - GeeksforGeeks`,
        url: `https://www.geeksforgeeks.org/?s=${encodeURIComponent(skill)}`,
        platform: 'GeeksforGeeks',
        type: 'Tutorial'
      }];
    } catch (error) {
      console.error(`Error creating GeeksforGeeks link for ${skill}:`, error.message);
      return [];
    }
  }

  /**
   * Get comprehensive resources for a skill from multiple platforms
   */
  async getResourcesForSkill(skill, options = {}) {
    const {
      limit = 2,  // Reduced default limit for compact display
      platforms = ['udemy', 'coursera', 'youtube', 'geeksforgeeks'],  // Removed GitHub due to space
      useCache = true
    } = options;

    // Check cache
    const cacheKey = `${skill.toLowerCase()}_${platforms.join('_')}`;
    if (useCache && this.cache[cacheKey]) {
      const cached = this.cache[cacheKey];
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const allResources = [];
    const resourcesPerPlatform = 1;  // Only 1 per platform for compact display

    // Scrape from each platform in parallel
    const scraperMap = {
      udemy: () => this.scrapeUdemy(skill, resourcesPerPlatform),
      coursera: () => this.scrapeCoursera(skill, resourcesPerPlatform),
      youtube: () => this.scrapeYouTube(skill, resourcesPerPlatform),
      geeksforgeeks: () => this.scrapeGeeksForGeeks(skill, resourcesPerPlatform)
    };

    const promises = platforms.map(platform => 
      scraperMap[platform] ? scraperMap[platform]().catch(() => []) : Promise.resolve([])
    );

    const results = await Promise.allSettled(promises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        allResources.push(...result.value);
      }
    });

    // Limit total results and sort by quality
    const finalResources = allResources
      .slice(0, limit)
      .map(r => ({
        title: r.title ? r.title.substring(0, 60) : 'Learn ' + skill,  // Truncate titles
        url: r.url,
        platform: r.platform
      }));  // Keep only essential fields

    // Cache the results
    this.cache[cacheKey] = {
      data: finalResources,
      timestamp: Date.now()
    };

    return finalResources;
  }

  /**
   * Get resources for a career role (multiple skills)
   */
  async getResourcesForRole(role, options = {}) {
    const roleSkills = {
      'Software Engineer': [
        'Python', 'JavaScript', 'Data Structures', 'System Design',
        'React', 'Node.js', 'SQL', 'Docker'
      ],
      'Data Scientist': [
        'Python', 'Machine Learning', 'SQL', 'Pandas', 'NumPy',
        'Scikit-learn', 'TensorFlow', 'Statistics'
      ],
      'DevOps Engineer': [
        'Docker', 'Kubernetes', 'Linux', 'AWS', 'CI/CD',
        'Terraform', 'Git', 'Bash scripting'
      ],
      'ML Engineer': [
        'Python', 'Machine Learning', 'Deep Learning', 'TensorFlow',
        'PyTorch', 'Computer Vision', 'NLP', 'Data Structures'
      ],
      'Frontend Developer': [
        'JavaScript', 'React', 'HTML CSS', 'Web Development',
        'TypeScript', 'Git', 'REST API'
      ],
      'Backend Developer': [
        'Python', 'Node.js', 'SQL', 'REST API', 'System Design',
        'Docker', 'Linux', 'Database Design'
      ],
      'Product Manager': [
        'System Design', 'Analytics', 'Communication', 'SQL', 'Product Strategy'
      ]
    };

    const skills = roleSkills[role] || [];
    const resourcesBySkill = {};

    // Scrape resources for each skill in the role
    for (const skill of skills) {
      resourcesBySkill[skill] = await this.getResourcesForSkill(skill, {
        limit: 3,
        ...options
      });
    }

    return {
      role,
      skills,
      resourcesBySkill,
      totalResources: Object.values(resourcesBySkill).reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {};
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      cacheSize: Object.keys(this.cache).length,
      cacheItems: Object.keys(this.cache),
      cacheTimeout: `${this.cacheTimeout / (1000 * 60 * 60)} hours`
    };
  }
}

module.exports = new ResourceScraper();
