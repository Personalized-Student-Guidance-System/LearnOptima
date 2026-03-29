const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');
const resourceScraper = require('../services/resourceScraper');

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

// Get personalized roadmap based on user's skills with scraped resources
async function getPersonalizedRoadmap(userId, role) {
  try {
    const baseRoadmap = roadmaps[role] || roadmaps['Software Engineer'];
    const profile = await StudentProfile.findOne({ userId });
    
    // Get user's actual skills from StudentProfile
    const userSkills = [...(profile?.extractedSkills || []), ...(profile?.extraSkills || [])];
    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    
    console.log(`[Roadmap] Building for ${role}: user has ${userSkills.length} skills`);
    
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
          // Get resources from web scraper (with timeout to avoid slow requests)
          const resources = await Promise.race([
            resourceScraper.getResourcesForSkill(skill, {
              limit: 2,  // Compact: 2 resources per skill
              platforms: ['coursera', 'udemy', 'youtube', 'geeksforgeeks']
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Scraping timeout')), 5000)
            )
          ]);
          
          const resourcesArray = Array.isArray(resources) ? resources : [];
          semester.resources[skillIndex] = {
            skill,
            hasSkill,  // Mark if user already has this skill
            resources: resourcesArray.slice(0, 2)  // Limit to 2 resources
          };
          console.log(`[Roadmap] Sem ${semester.sem} skill "${skill}": ${resourcesArray.length} resources found`);
        } catch (error) {
          console.warn(`[Roadmap] Failed to scrape resources for ${skill}:`, error.message);
          // Fallback to basic resources if scraping fails
          semester.resources[skillIndex] = {
            skill,
            hasSkill,
            resources: [
              { title: `Learn ${skill}`, url: `https://www.youtube.com/results?search_query=${encodeURIComponent('learn ' + skill)}`, platform: 'YouTube' }
            ]
          };
        }
      }
    }
    
    console.log(`[Roadmap] Complete - ${personalizedRoadmap.semesters.length} semesters built`);
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

module.exports = router;