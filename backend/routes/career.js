const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');
const resourceScraper = require('../services/resourceScraper');
const careerScraper = require('../services/careerScraper');

// Checklist completion schema
const checklistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  items: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });

const Checklist = mongoose.model('RoadmapChecklist', checklistSchema);

// Complete roadmap data with skill mapping
const roadmaps = {
  'Software Engineer': {
    semesters: [
      {
        sem: 1,
        title: 'Foundation',
        duration: '3 months',
        skills: ['C/C++ basics', 'Data structures fundamentals', 'Linux basics', 'Git basics'],
        tasks: ['Learn C/C++ basics', 'Data structures fundamentals', 'Linux basics', 'Git basics']
      },
      {
        sem: 2,
        title: 'Core CS',
        duration: '3 months',
        skills: ['OOP concepts', 'DBMS & SQL', 'Computer Networks basics', 'Web basics (HTML/CSS)'],
        tasks: ['OOP concepts', 'DBMS & SQL', 'Computer Networks basics', 'Web basics (HTML/CSS)']
      },
      {
        sem: 3,
        title: 'Development',
        duration: '3 months',
        skills: ['JavaScript fundamentals', 'Python for scripting', 'REST API concepts', 'Database design'],
        tasks: ['JavaScript fundamentals', 'Python for scripting', 'REST API concepts', 'Database design']
      },
      {
        sem: 4,
        title: 'Frameworks',
        duration: '3 months',
        skills: ['React', 'Node.js / Django', 'Docker basics', 'Agile methodology'],
        tasks: ['React', 'Node.js / Django', 'Docker basics', 'Agile methodology']
      },
      {
        sem: 5,
        title: 'Advanced',
        duration: '3 months',
        skills: ['System design', 'Microservices', 'Cloud basics (AWS/GCP)', 'DSA practice (LeetCode)'],
        tasks: ['System design', 'Microservices', 'Cloud basics (AWS/GCP)', 'DSA practice (LeetCode)']
      },
      {
        sem: 6,
        title: 'Specialization',
        duration: '3 months',
        skills: ['Open source contributions', 'Full-stack projects', 'Competitive programming', 'Technical interviews prep'],
        tasks: ['Open source contributions', 'Build 2-3 full-stack projects', 'Competitive programming', 'Technical interviews prep']
      },
      {
        sem: 7,
        title: 'Industry Ready',
        duration: '3 months',
        skills: ['Internship', 'Portfolio website', 'Resume optimization', 'Mock interviews'],
        tasks: ['Internship', 'Portfolio website', 'Resume optimization', 'Mock interviews']
      },
      {
        sem: 8,
        title: 'Placement',
        duration: '3 months',
        skills: ['Campus placements', 'Off-campus applications', 'Offer negotiation', 'Final project'],
        tasks: ['Campus placements', 'Off-campus applications', 'Negotiate offers', 'Final project']
      }
    ]
  },
  'Data Scientist': {
    semesters: [
      {
        sem: 1,
        title: 'Math Foundation',
        duration: '3 months',
        skills: ['Linear Algebra', 'Statistics basics', 'Python basics', 'Excel for data'],
        tasks: ['Linear Algebra', 'Statistics basics', 'Python basics', 'Excel for data']
      },
      {
        sem: 2,
        title: 'Programming',
        duration: '3 months',
        skills: ['Python (NumPy, Pandas)', 'Probability & Statistics', 'SQL fundamentals', 'Data visualization'],
        tasks: ['Python (NumPy, Pandas)', 'Probability & Statistics', 'SQL fundamentals', 'Data visualization']
      },
      {
        sem: 3,
        title: 'ML Basics',
        duration: '3 months',
        skills: ['Supervised learning', 'Unsupervised learning', 'Scikit-learn', 'Feature engineering'],
        tasks: ['Supervised learning', 'Unsupervised learning', 'Scikit-learn', 'Feature engineering']
      },
      {
        sem: 4,
        title: 'Deep Learning',
        duration: '3 months',
        skills: ['Neural networks', 'TensorFlow/PyTorch', 'CNNs & RNNs', 'NLP basics'],
        tasks: ['Neural networks', 'TensorFlow/PyTorch', 'CNNs & RNNs', 'NLP basics']
      },
      {
        sem: 5,
        title: 'Advanced ML',
        duration: '3 months',
        skills: ['MLOps fundamentals', 'Model deployment', 'A/B testing', 'Big Data (Spark)'],
        tasks: ['MLOps fundamentals', 'Model deployment', 'A/B testing', 'Big Data (Spark)']
      },
      {
        sem: 6,
        title: 'Specialization',
        duration: '3 months',
        skills: ['Kaggle competitions', 'Research papers', 'Domain-specific datasets', 'Cloud ML platforms'],
        tasks: ['Kaggle competitions', 'Research papers', 'Domain-specific datasets', 'Cloud ML platforms']
      },
      {
        sem: 7,
        title: 'Industry',
        duration: '3 months',
        skills: ['Data science internship', 'End-to-end ML project', 'Technical blogging', 'Network building'],
        tasks: ['Data science internship', 'End-to-end ML project', 'Technical blogging', 'Network building']
      },
      {
        sem: 8,
        title: 'Placement',
        duration: '3 months',
        skills: ['Company applications', 'Case study preparation', 'Portfolio projects', 'Final placement'],
        tasks: ['Company applications', 'Case study preparation', 'Portfolio projects', 'Final placement']
      }
    ]
  },
  'DevOps Engineer': {
    semesters: [
      {
        sem: 1,
        title: 'Foundation',
        duration: '3 months',
        skills: ['Linux fundamentals', 'Bash scripting', 'Networking basics', 'Git basics'],
        tasks: ['Linux fundamentals', 'Bash scripting', 'Networking basics', 'Git basics']
      },
      {
        sem: 2,
        title: 'Virtualization',
        duration: '3 months',
        skills: ['Docker basics', 'Container orchestration', 'Docker Compose', 'Docker networking'],
        tasks: ['Docker basics', 'Container orchestration', 'Docker Compose', 'Docker networking']
      },
      {
        sem: 3,
        title: 'Kubernetes',
        duration: '3 months',
        skills: ['Kubernetes architecture', 'Deployments & Services', 'StatefulSets', 'Ingress'],
        tasks: ['Kubernetes architecture', 'Deployments & Services', 'StatefulSets', 'Ingress']
      },
      {
        sem: 4,
        title: 'Cloud Platforms',
        duration: '3 months',
        skills: ['AWS fundamentals', 'EC2 & VPC', 'S3 & Database services', 'IAM & Security'],
        tasks: ['AWS fundamentals', 'EC2 & VPC', 'S3 & Database services', 'IAM & Security']
      },
      {
        sem: 5,
        title: 'CI/CD',
        duration: '3 months',
        skills: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'Pipeline scripting'],
        tasks: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'Pipeline scripting']
      },
      {
        sem: 6,
        title: 'Infrastructure as Code',
        duration: '3 months',
        skills: ['Terraform', 'Ansible', 'CloudFormation', 'Configuration management'],
        tasks: ['Terraform', 'Ansible', 'CloudFormation', 'Configuration management']
      },
      {
        sem: 7,
        title: 'Monitoring & Logging',
        duration: '3 months',
        skills: ['Prometheus', 'ELK Stack', 'Grafana', 'Log aggregation'],
        tasks: ['Prometheus', 'ELK Stack', 'Grafana', 'Log aggregation']
      },
      {
        sem: 8,
        title: 'Advanced & Production',
        duration: '3 months',
        skills: ['Security hardening', 'Disaster recovery', 'Performance tuning', 'Production deployment'],
        tasks: ['Security hardening', 'Disaster recovery', 'Performance tuning', 'Production deployment']
      }
    ]
  },
  'ML Engineer': {
    semesters: [
      {
        sem: 1,
        title: 'Foundation',
        duration: '3 months',
        skills: ['Python', 'NumPy & Pandas', 'Matplotlib', 'Jupyter Notebooks'],
        tasks: ['Python', 'NumPy & Pandas', 'Matplotlib', 'Jupyter Notebooks']
      },
      {
        sem: 2,
        title: 'ML Fundamentals',
        duration: '3 months',
        skills: ['Supervised Learning', 'Unsupervised Learning', 'Feature Engineering', 'Model Evaluation'],
        tasks: ['Supervised Learning', 'Unsupervised Learning', 'Feature Engineering', 'Model Evaluation']
      },
      {
        sem: 3,
        title: 'Deep Learning',
        duration: '3 months',
        skills: ['Neural Networks', 'TensorFlow', 'Keras', 'CNNs & RNNs'],
        tasks: ['Neural Networks', 'TensorFlow', 'Keras', 'CNNs & RNNs']
      },
      {
        sem: 4,
        title: 'Advanced DL',
        duration: '3 months',
        skills: ['Transformers', 'BERT & GPT', 'GANs', 'Reinforcement Learning'],
        tasks: ['Transformers', 'BERT & GPT', 'GANs', 'Reinforcement Learning']
      },
      {
        sem: 5,
        title: 'Computer Vision',
        duration: '3 months',
        skills: ['Image Processing', 'Object Detection', 'Segmentation', 'Face Recognition'],
        tasks: ['Image Processing', 'Object Detection', 'Segmentation', 'Face Recognition']
      },
      {
        sem: 6,
        title: 'NLP',
        duration: '3 months',
        skills: ['NLP Fundamentals', 'Text Classification', 'Sentiment Analysis', 'Language Models'],
        tasks: ['NLP Fundamentals', 'Text Classification', 'Sentiment Analysis', 'Language Models']
      },
      {
        sem: 7,
        title: 'MLOps',
        duration: '3 months',
        skills: ['Model Deployment', 'Model Monitoring', 'Data Pipelines', 'Model Serving'],
        tasks: ['Model Deployment', 'Model Monitoring', 'Data Pipelines', 'Model Serving']
      },
      {
        sem: 8,
        title: 'Production & Projects',
        duration: '3 months',
        skills: ['End-to-End Projects', 'Research Papers', 'Competition Kaggle', 'Production Systems'],
        tasks: ['End-to-End Projects', 'Research Papers', 'Kaggle Competitions', 'Production Systems']
      }
    ]
  }
};

// Generate dynamic roadmap for any role (including custom roles)
async function generateDynamicRoadmap(role, userId) {
  try {
    console.log(`[DynamicRoadmap] Generating roadmap for role: ${role}`);
    
    // Try to import the skill resources scraper
    const path = require('path');
    const scraperPath = path.join(__dirname, '../ml/skill_resources_scraper.py');
    
    // Since we can't directly import Python, we'll create a basic dynamic structure
    // and fetch skills from a predefined mapping or use a fallback
    
    const skillsByRole = {
      'quant engineer': ['Python', 'C++', 'Financial Mathematics', 'Statistics', 'Machine Learning', 'Data Analysis', 'SQL', 'Linux', 'Algorithms', 'Risk Management'],
      'blockchain developer': ['Solidity', 'Ethereum', 'Smart Contracts', 'Web3.js', 'DeFi', 'Cryptography', 'JavaScript', 'React', 'Node.js', 'Distributed Systems'],
      'ux designer': ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'UI Design', 'Design Systems', 'Usability Testing', 'Adobe XD', 'HTML/CSS'],
      'game developer': ['C#', 'Unity', 'Unreal Engine', 'Game Physics', '3D Graphics', 'Networking', 'Game Design', 'C++', 'Python'],
      'cloud architect': ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Microservices', 'System Design', 'Security', 'Networking', 'Infrastructure as Code'],
      'cybersecurity engineer': ['Network Security', 'Cryptography', 'Penetration Testing', 'Malware Analysis', 'Linux Security', 'Python', 'C', 'Firewalls', 'SSL/TLS'],
      'data engineer': ['Python', 'SQL', 'Apache Spark', 'Kafka', 'ETL', 'Data Warehousing', 'AWS/GCP', 'Hadoop', 'Scala', 'NoSQL'],
      'mobile app developer': ['React Native', 'Swift', 'Kotlin', 'Flutter', 'Android', 'iOS', 'Firebase', 'REST API', 'Mobile UI/UX'],
      'ios developer': ['Swift', 'Objective-C', 'iOS SDK', 'Xcode', 'CoreData', 'SwiftUI', 'Networking', 'App Architecture'],
      'android developer': ['Kotlin', 'Java', 'Android Studio', 'Android SDK', 'Material Design', 'Firebase', 'Room Database', 'MVVM Pattern'],
      'embedded systems engineer': ['C', 'C++', 'Assembly', 'Microcontrollers', 'RTOS', 'Hardware Design', 'IoT', 'Firmware Development'],
      'devops engineer': ['Docker', 'Kubernetes', 'CI/CD', 'Linux', 'AWS/GCP/Azure', 'Infrastructure as Code', 'Terraform', 'Ansible', 'Monitoring'],
      'site reliability engineer': ['Python', 'Go', 'Linux', 'Kubernetes', 'Prometheus', 'ELK Stack', 'Cloud Platforms', 'Incident Response'],
      'platform engineer': ['Kubernetes', 'Docker', 'Internal Tools', 'System Design', 'API Design', 'Infrastructure', 'Monitoring', 'Developer Experience'],
      'ml researcher': ['Mathematics', 'Python', 'TensorFlow/PyTorch', 'Research Papers', 'Statistical Analysis', 'Deep Learning', 'Computer Vision/NLP'],
      'nlp engineer': ['Natural Language Processing', 'Transformers', 'BERT', 'GPT', 'Python', 'TensorFlow/PyTorch', 'Text Processing'],
      'computer vision engineer': ['OpenCV', 'TensorFlow', 'Python', 'Image Processing', 'Deep Learning', 'CNN', 'Object Detection', 'Video Analysis'],
      'product manager': ['Product Strategy', 'Data Analysis', 'User Research', 'Communication', 'Roadmap Planning', 'Business Acumen', 'Metrics & Analytics'],
      'solutions architect': ['System Design', 'Cloud Architecture', 'AWS/Azure/GCP', 'Consulting', 'Requirements Analysis', 'Problem Solving'],
      'technical writer': ['Technical Documentation', 'API Documentation', 'Markdown', 'Figma', 'Communication', 'Writing Skills', 'Technical Knowledge'],
      'security engineer': ['Cryptography', 'Network Security', 'Secure Coding', 'Vulnerability Assessment', 'Penetration Testing', 'Risk Management'],
      'fintech developer': ['Java/Python', 'Spring Boot', 'Microservices', 'APIs', 'Blockchain', 'Trading Systems', 'Financial Protocols'],
      'ar/vr developer': ['Unity', 'Unreal Engine', 'C#/C++', 'ARKit', 'ARCore', '3D Graphics', 'Real-time Rendering', 'Spatial Computing'],
      'robotics engineer': ['C++', 'Python', 'ROS', 'Computer Vision', 'Control Systems', 'Mechanics', 'Machine Learning', 'Embedded Systems'],
      'data analyst': ['SQL', 'Python/R', 'Tableau', 'Power BI', 'Excel', 'Statistics', 'Data Visualization', 'Business Intelligence'],
      'business analyst': ['Requirements Gathering', 'Data Analysis', 'SQL', 'Excel', 'Process Improvement', 'Documentation', 'Stakeholder Management'],
      'reliability engineer': ['Monitoring', 'Log Analysis', 'System Performance', 'Incident Response', 'Linux', 'Cloud Platforms', 'Automation'],
    };
    
    // Get skills for the role (case-insensitive matching)
    const roleLower = role.toLowerCase();
    let requiredSkills = [];
    
    // First try exact match
    if (skillsByRole[roleLower]) {
      requiredSkills = skillsByRole[roleLower];
    } else {
      // Try partial match
      for (const [key, skills] of Object.entries(skillsByRole)) {
        if (roleLower.includes(key) || key.includes(roleLower)) {
          requiredSkills = skills;
          break;
        }
      }
    }
    
    // If no match found, create a generic roadmap with basic skills
    if (requiredSkills.length === 0) {
      console.log(`[DynamicRoadmap] No predefined skills for "${role}", creating generic roadmap`);
      requiredSkills = ['Fundamentals', 'Core Concepts', 'Programming', 'Tools & Technologies', 'Advanced Topics', 'Project Work', 'Specialization', 'Industry Skills'];
    }
    
    // Organize skills into 8 semesters/phases
    const semesters = [];
    const skillsPerPhase = Math.ceil(requiredSkills.length / 8);
    
    for (let phase = 0; phase < 8; phase++) {
      const startIdx = phase * skillsPerPhase;
      const endIdx = Math.min(startIdx + skillsPerPhase, requiredSkills.length);
      const phaseSkills = requiredSkills.slice(startIdx, endIdx);
      
      const phases = ['Foundation', 'Core Concepts', 'Development', 'Advanced', 'Specialization', 'Integration', 'Mastery', 'Excellence'];
      
      semesters.push({
        sem: phase + 1,
        title: phases[phase] || `Phase ${phase + 1}`,
        duration: '3-4 weeks',
        skills: phaseSkills,
        tasks: phaseSkills.map(skill => `Learn and practice "${skill}"`)
      });
    }
    
    console.log(`[DynamicRoadmap] Generated ${semesters.length} phases with ${requiredSkills.length} total skills`);
    return { semesters, isCustom: true };
  } catch (err) {
    console.error('[DynamicRoadmap] Error:', err.message);
    return null;
  }
}

// Get personalized roadmap based on user's skills with scraped resources
async function getPersonalizedRoadmap(userId, role) {
  try {
    // Check if role exists in predefined roadmaps
    let baseRoadmap = roadmaps[role];
    let isCustomRole = false;
    
    // If role not found in predefined list, generate dynamic roadmap
    if (!baseRoadmap) {
      console.log(`[Roadmap] Role "${role}" not predefined, generating dynamic roadmap`);
      const dynamicRoadmap = await generateDynamicRoadmap(role, userId);
      if (dynamicRoadmap) {
        baseRoadmap = dynamicRoadmap;
        isCustomRole = true;
      } else {
        // Fallback to Software Engineer roadmap
        baseRoadmap = roadmaps['Software Engineer'];
        console.log('[Roadmap] Falling back to Software Engineer roadmap');
      }
    }
    
    const profile = await StudentProfile.findOne({ userId });
    
    // Get user's actual skills from StudentProfile
    const userSkills = [...(profile?.extractedSkills || []), ...(profile?.extraSkills || [])];
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    
    console.log(`[Roadmap] Building for ${role}: user has ${userSkills.length} skills, isCustomRole=${isCustomRole}`);
    
    const personalizedRoadmap = JSON.parse(JSON.stringify(baseRoadmap));
    
    // Add scraped resources to each semester
    for (let semesterIndex = 0; semesterIndex < personalizedRoadmap.semesters.length; semesterIndex++) {
      const semester = personalizedRoadmap.semesters[semesterIndex];
      semester.resources = [];
      
      // Scrape resources for each skill in the semester
      for (let skillIndex = 0; skillIndex < (semester.skills || semester.tasks || []).length; skillIndex++) {
        const skill = (semester.skills || semester.tasks)[skillIndex];
        const skillLower = skill.toLowerCase();
        const hasSkill = userSkillsLower.some(s => s.includes(skillLower) || skillLower.includes(s));
        
        try {
// Skip scraping for speed - use generic resources always
          let resources = [
            { 
              title: `YouTube: Learn ${skill}`, 
              url: `https://www.youtube.com/results?search_query=${encodeURIComponent('learn ' + skill)}`,
              platform: 'YouTube'
            },
            { 
              title: `Udemy: ${skill} Courses`, 
              url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`,
              platform: 'Udemy'
            },
            { 
              title: `Coursera: ${skill}`, 
              url: `https://www.coursera.org/search?query=${encodeURIComponent(skill)}`,
              platform: 'Coursera'
            }
          ];
          console.log(`[Roadmap] Fast resources for ${skill}`);
          
          semester.resources[skillIndex] = {
            skill,
            hasSkill,  // Mark if user already has this skill
            resources: resources.slice(0, 3)  // Limit to 3 resources
          };
          console.log(`[Roadmap] Sem ${semester.sem} skill "${skill}": ${resources.length} resources found`);
        } catch (error) {
          console.warn(`[Roadmap] Error processing ${skill}:`, error.message);
          // Fallback to basic resources
          semester.resources[skillIndex] = {
            skill,
            hasSkill,
            resources: [
              { 
                title: `Learn ${skill}`, 
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent('learn ' + skill)}`,
                platform: 'YouTube'
              }
            ]
          };
        }
      }
    }
    
    console.log(`[Roadmap] Complete - ${personalizedRoadmap.semesters.length} semesters built with resources`);
    return personalizedRoadmap;
  } catch (err) {
    console.error('Error generating personalized roadmap:', err);
    return roadmaps[role] || roadmaps['Software Engineer'];
  }
}

// Get or create checklist for user & role
async function getOrCreateChecklist(userId, role) {
  let checklist = await Checklist.findOne({ userId, role });
  if (!checklist) {
    checklist = new Checklist({ userId, role, items: {} });
    await checklist.save();
  }
  return checklist;
}

// API: Get personalized roadmap
router.get('/personalized', auth, async (req, res) => {
  try {
    const role = req.query.role || 'Software Engineer';
    const userId = req.user.id;
    
    console.log(`[Career API] Fetching roadmap for role: ${role}, userId: ${userId}`);
    const roadmap = await getPersonalizedRoadmap(userId, role);
    const checklist = await getOrCreateChecklist(userId, role);
    
    // Verify roadmap structure
    const semesterCount = roadmap?.semesters?.length || 0;
    const firstSemesterTaskCount = roadmap?.semesters?.[0]?.tasks?.length || 0;
    const firstTaskResources = roadmap?.semesters?.[0]?.resources?.[0]?.resources?.length || 0;
    
    console.log(`[Career API] Roadmap built - semesters: ${semesterCount}, first sem tasks: ${firstSemesterTaskCount}, first task resources: ${firstTaskResources}`);
    
    res.json({
      role,
      roadmap,
      checklistId: checklist._id,
      availableRoles: Object.keys(roadmaps)
    });
  } catch (err) {
    console.error(`[Career API] Error:`, err.message);
    res.status(500).json({ message: err.message });
  }
});

// API: Get checklist items
router.get('/checklist/:checklistId', auth, async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.checklistId);
    if (!checklist) {
      return res.status(404).json({ message: 'Checklist not found' });
    }
    res.json({ items: Object.fromEntries(checklist.items) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// API: Update checklist item
router.post('/checklist/item', auth, async (req, res) => {
  try {
    const { role, itemKey, isChecked } = req.body;
    const userId = req.user.id;
    
    const checklist = await getOrCreateChecklist(userId, role);
    checklist.items.set(itemKey, isChecked);
    await checklist.save();
    
    res.json({ success: true, items: Object.fromEntries(checklist.items) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Legacy: Get basic roadmap
router.get('/', auth, async (req, res) => {
  try {
    const role = req.query.role || 'Software Engineer';
    const roadmap = roadmaps[role] || roadmaps['Software Engineer'];
    res.json({ role, roadmap, availableRoles: Object.keys(roadmaps) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// API: Get LIVE scraped jobs & skills for target role (dynamic)
router.get('/live-jobs', auth, async (req, res) => {
  try {
    const { role = 'Software Engineer', location = 'India', limit = 10 } = req.query;
    console.log(`[Career API] Scraping live jobs for ${role} (${location})`);
    
    const data = await careerScraper.getDynamicData(role, location, parseInt(limit));
    
    // Use real jobs if available, fallback to derived
    let jobs = data.jobs || data.extracted_skills?.slice(0, 8).map(skill => 
      `${role} - ${skill} Specialist`
    ) || [];
    
    // Parse/sort deadlines (ISO date or null)
    jobs = jobs.map(job => ({
      ...job,
      deadlineParsed: job.deadline ? new Date(job.deadline) : null
    })).sort((a, b) => {
      const da = a.deadlineParsed || new Date('2099-01-01');
      const db = b.deadlineParsed || new Date('2099-01-01');
      return da - db; // Ascending (urgent first)
    });
    
    res.json({
      role,
      location,
      jobs,
      skills: data.extracted_skills || [],
      resources: data.resources || {},
      source: data.source,
      scrapedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('[Career API] Live-jobs error:', err.message);
    res.status(500).json({ message: 'Scraping unavailable, try again later' });
  }
});

// Legacy endpoint (deprecated - use /live-jobs)
router.get('/job-roles', auth, async (req, res) => {
  res.redirect(307, `/api/career/live-jobs?role=${req.query.role || 'Software Engineer'}`);
});

module.exports = router;