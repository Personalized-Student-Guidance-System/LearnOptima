const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const mongoose = require('mongoose');
const resourceScraper = require('../services/resourceScraper');
const careerScraper = require('../services/careerScraper');
const DynamicRoadmap = require('../models/DynamicRoadmap');
const axios = require('axios');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// Checklist completion schema
const checklistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  items: { type: Map, of: Boolean, default: {} },
}, { timestamps: true });

const Checklist = mongoose.model('RoadmapChecklist', checklistSchema);

// ─── Role-specific built-in roadmap fallback ─────────────────────────────────
// Generates a rich 6-phase roadmap for 40+ roles when ML service is offline.
function buildFallbackRoadmap(role) {
  const roleLower = role.toLowerCase();

  function match(...keywords) {
    return keywords.some(k => roleLower.includes(k));
  }

  const templates = {

    nurse: [
      { sem:1, title:'Anatomy & Physiology', duration:'6 weeks', skills:['Human Anatomy','Body Systems','Medical Terminology'], tasks:['Study organ systems','Learn medical terminology','Pass anatomy assessments'] },
      { sem:2, title:'Clinical Fundamentals', duration:'8 weeks', skills:['Patient Assessment','Vital Signs','Medication Administration'], tasks:['Learn vital signs measurement','Practice patient handoff (SBAR)','Study pharmacology basics'] },
      { sem:3, title:'Specialised Care', duration:'8 weeks', skills:['ICU Nursing','Pediatric Care','Wound Management'], tasks:['Complete ICU rotation','Study pediatric nursing protocols','Practice sterile wound dressing'] },
      { sem:4, title:'Evidence-Based Practice', duration:'6 weeks', skills:['Clinical Research','EBP Frameworks','Quality Improvement'], tasks:['Conduct literature review','Apply PICO framework','Design a QI improvement project'] },
      { sem:5, title:'Leadership & Communication', duration:'4 weeks', skills:['Team Leadership','Patient Education','Conflict Resolution'], tasks:['Lead shift handover meetings','Create patient discharge materials','Role-play conflict scenarios'] },
      { sem:6, title:'Licensure & Career Prep', duration:'4 weeks', skills:['NCLEX Preparation','Resume Writing','Interview Skills'], tasks:['Complete 500 NCLEX practice questions','Build nursing portfolio','Attend hospital career fairs'] },
    ],

    doctor: [
      { sem:1, title:'Pre-Clinical Sciences', duration:'8 weeks', skills:['Biochemistry','Pathology','Pharmacology'], tasks:['Study metabolic pathways','Learn disease mechanisms','Master drug classes & interactions'] },
      { sem:2, title:'Clinical Rotations', duration:'12 weeks', skills:['Diagnosis','History Taking','Physical Examination'], tasks:['Complete ward rounds','Write SOAP notes','Study differential diagnosis framework'] },
      { sem:3, title:'Specialisation Basics', duration:'8 weeks', skills:['Cardiology','Internal Medicine','Surgery Basics'], tasks:['Practice ECG interpretation','Study internal medicine case studies','Observe surgical procedures'] },
      { sem:4, title:'Research & Evidence', duration:'6 weeks', skills:['Clinical Trials','Biostatistics','Systematic Reviews'], tasks:['Design a clinical study protocol','Analyse RCT data','Write a clinical case report'] },
      { sem:5, title:'Ethics & Communication', duration:'4 weeks', skills:['Medical Ethics','Patient Communication','Breaking Bad News'], tasks:['Study bioethical principles','Practice consultation framework','Role-play difficult conversations'] },
      { sem:6, title:'Residency Prep', duration:'4 weeks', skills:['Residency Applications','USMLE / PLAB Prep','Interview Techniques'], tasks:['Write personal statement','Complete 200 practice exam questions','Research and apply to residency programs'] },
    ],

    software: [
      { sem:1, title:'Programming Fundamentals', duration:'6 weeks', skills:['Python / JavaScript','Data Structures','Algorithms'], tasks:['Solve 50 LeetCode easy problems','Build a command-line project','Implement BST, graph traversal'] },
      { sem:2, title:'Systems & Architecture', duration:'6 weeks', skills:['Operating Systems','Computer Networks','Databases'], tasks:['Study OS scheduling concepts','Build a REST API with Express/FastAPI','Design a normalized relational schema'] },
      { sem:3, title:'Backend Engineering', duration:'8 weeks', skills:['Node.js / Django','SQL & NoSQL','API Design'], tasks:['Build a full CRUD API with auth','Set up PostgreSQL with indexes','Integrate MongoDB with aggregations'] },
      { sem:4, title:'Frontend & Full-Stack', duration:'6 weeks', skills:['React / Next.js','CSS / Tailwind','State Management'], tasks:['Build a React dashboard with charts','Implement Redux / Zustand state','Deploy full-stack app to Vercel'] },
      { sem:5, title:'DevOps & Cloud', duration:'6 weeks', skills:['Docker','CI/CD Pipelines','AWS / GCP Basics'], tasks:['Containerise an app with Docker Compose','Set up GitHub Actions CI/CD','Deploy to AWS EC2 with auto-scaling'] },
      { sem:6, title:'Interview & Portfolio', duration:'4 weeks', skills:['System Design','Behavioural Interviews','Open Source'], tasks:['Design WhatsApp / Uber at scale','Record 5 mock behavioural interviews','Contribute to 2 open-source projects'] },
    ],

    'data scien': [
      { sem:1, title:'Mathematics & Statistics', duration:'6 weeks', skills:['Linear Algebra','Statistics','Probability Theory'], tasks:['Complete Khan Academy linear algebra','Implement matrix operations from scratch','Study Bayes theorem & applications'] },
      { sem:2, title:'Python for Data Science', duration:'6 weeks', skills:['NumPy','Pandas','Matplotlib / Seaborn'], tasks:['Analyse a Kaggle dataset end-to-end','Create 10 insightful visualisations','Write reusable data cleaning pipelines'] },
      { sem:3, title:'Machine Learning Fundamentals', duration:'8 weeks', skills:['Scikit-Learn','Regression & Classification','Model Evaluation'], tasks:['Build and tune a random forest','Run cross-validation & hyperparameter tuning','Complete one Kaggle challenge'] },
      { sem:4, title:'Deep Learning', duration:'8 weeks', skills:['TensorFlow / PyTorch','Convolutional Neural Networks','NLP Basics'], tasks:['Build an image classifier (CIFAR-10)','Train an LSTM for time-series forecasting','Fine-tune BERT for text classification'] },
      { sem:5, title:'MLOps & Deployment', duration:'6 weeks', skills:['MLflow','FastAPI','Docker'], tasks:['Track experiments with MLflow','Serve model via FastAPI endpoint','Containerise and deploy to cloud'] },
      { sem:6, title:'Portfolio & Job Prep', duration:'4 weeks', skills:['Data Storytelling','SQL for Analytics','Case Study Interviews'], tasks:['Publish 3 polished Kaggle notebooks','Practice 20 SQL analytics queries','Complete 5 DS case study mock interviews'] },
    ],

    'ml engineer': [
      { sem:1, title:'ML Foundations', duration:'6 weeks', skills:['Python','Scikit-Learn','Feature Engineering'], tasks:['Complete Andrew Ng ML Specialisation','Build an end-to-end classification pipeline','Engineer features from raw tabular data'] },
      { sem:2, title:'Deep Learning & Frameworks', duration:'8 weeks', skills:['PyTorch','Neural Network Architectures','Transfer Learning'], tasks:['Build custom neural net from scratch in PyTorch','Fine-tune ResNet for image classification','Experiment with transformer attention'] },
      { sem:3, title:'Large-Scale ML', duration:'6 weeks', skills:['Distributed Training','Spark MLlib','Feature Stores'], tasks:['Train a model on multi-GPU setup','Build a Spark ML pipeline','Design and populate a Feast feature store'] },
      { sem:4, title:'MLOps Engineering', duration:'6 weeks', skills:['MLflow','Kubeflow','Model Monitoring'], tasks:['Set up MLflow experiment tracking','Deploy model with Kubeflow Pipelines','Implement data drift monitoring'] },
      { sem:5, title:'LLMs & Specialisation', duration:'6 weeks', skills:['Hugging Face Transformers','LLM Fine-tuning','Retrieval-Augmented Generation'], tasks:['Fine-tune LLaMA on domain data','Build a RAG chatbot with LangChain','Implement RL agent with PPO'] },
      { sem:6, title:'Production & Interviews', duration:'4 weeks', skills:['ML System Design','Paper Reading & Implementation','Mock Interviews'], tasks:['Design a real-time recommendation system','Implement a key ML paper from scratch','Complete 10 ML system design mock interviews'] },
    ],

    devops: [
      { sem:1, title:'Linux & Networking Fundamentals', duration:'5 weeks', skills:['Linux CLI','Bash Scripting','TCP/IP & OSI Model'], tasks:['Complete Linux challenge on TryHackMe','Write a bash deployment automation script','Analyse traffic with Wireshark'] },
      { sem:2, title:'Containers & Orchestration', duration:'7 weeks', skills:['Docker','Kubernetes','Helm Charts'], tasks:['Dockerise a 3-tier microservice app','Deploy app to Kubernetes cluster','Write and publish Helm charts'] },
      { sem:3, title:'CI/CD Pipelines', duration:'6 weeks', skills:['GitHub Actions','Jenkins','ArgoCD'], tasks:['Build an end-to-end CI pipeline','Set up blue/green deployment','Implement GitOps workflow with ArgoCD'] },
      { sem:4, title:'Cloud Platforms & IaC', duration:'7 weeks', skills:['AWS / GCP / Azure','Terraform','Cloud Security'], tasks:['Deploy a 3-tier app on AWS','Write reusable Terraform modules','Configure least-privilege IAM policies'] },
      { sem:5, title:'Monitoring & SRE', duration:'5 weeks', skills:['Prometheus & Grafana','ELK Stack','Reliability Engineering'], tasks:['Set up Prometheus alerting rules','Build Grafana operational dashboards','Index and query logs in Elasticsearch'] },
      { sem:6, title:'Security & Certifications', duration:'4 weeks', skills:['DevSecOps','CKA / AWS Cert Prep','System Design'], tasks:['Integrate SAST/DAST into pipeline','Take CKA or AWS SAA practice exams','Design a globally-distributed infra'] },
    ],

    product: [
      { sem:1, title:'Product Thinking & Discovery', duration:'5 weeks', skills:['User Research','Problem Framing','Market Analysis'], tasks:['Conduct 10 structured user interviews','Write a clear problem statement','Complete a competitor landscape analysis'] },
      { sem:2, title:'Prioritisation & Roadmapping', duration:'6 weeks', skills:['OKRs','Opportunity Solution Trees','RICE Framework'], tasks:['Write quarterly product OKRs','Build an opportunity solution tree','Prioritise feature backlog using RICE'] },
      { sem:3, title:'Design & Prototyping', duration:'5 weeks', skills:['Wireframing','Figma','Usability Testing'], tasks:['Create low-fidelity wireframes','Build a clickable Figma prototype','Run 5 usability tests and iterate'] },
      { sem:4, title:'Agile Delivery', duration:'6 weeks', skills:['Scrum / Kanban','Sprint Planning','Stakeholder Management'], tasks:['Run 2 full two-week sprints','Create a data-backed 6-month roadmap','Present roadmap to executive stakeholders'] },
      { sem:5, title:'Analytics & Growth', duration:'5 weeks', skills:['A/B Testing','SQL for PMs','North Star Metrics'], tasks:['Design and analyse an A/B experiment','Write SQL to extract product insights','Define and instrument a North Star Metric'] },
      { sem:6, title:'PM Interview Prep', duration:'4 weeks', skills:['Product Sense','Estimation Questions','PM Portfolio'], tasks:['Complete 15 PM mock interviews','Write 3 structured PM case studies','Build and publish a PM portfolio site'] },
    ],

    designer: [
      { sem:1, title:'Design Thinking Fundamentals', duration:'5 weeks', skills:['Empathy Mapping','User Journey Maps','Ideation Techniques'], tasks:['Map a user journey for a real app','Conduct 5 empathy interviews','Run a design thinking ideation workshop'] },
      { sem:2, title:'Visual Design Principles', duration:'6 weeks', skills:['Typography','Colour Theory','Layout & Grid Systems'], tasks:['Study 3 major design systems (Material, HIG, Fluent)','Create a complete style guide','Redesign 3 real-world apps'] },
      { sem:3, title:'Figma & Prototyping', duration:'6 weeks', skills:['Figma Auto Layout','Component Libraries','High-Fidelity Prototyping'], tasks:['Build a full design system in Figma','Create an interactive prototype','Publish design to Figma Community'] },
      { sem:4, title:'Usability Research', duration:'5 weeks', skills:['Usability Testing','Card Sorting','Heuristic Evaluation'], tasks:['Run 5 moderated usability sessions','Conduct card sort with 20 participants','Apply all 10 Nielson heuristics'] },
      { sem:5, title:'Motion Design & Accessibility', duration:'5 weeks', skills:['Micro-animations','Lottie Animations','WCAG Accessibility'], tasks:['Animate a complete app onboarding flow','Export and integrate Lottie JSON','Audit an app for WCAG 2.1 AA compliance'] },
      { sem:6, title:'Portfolio & Design Interviews', duration:'4 weeks', skills:['Case Study Writing','Portfolio Site','Design Critique Skills'], tasks:['Publish 4 polished Figma case studies','Create Behance / Dribbble profile','Practice 10 design critique sessions'] },
    ],

    financ: [
      { sem:1, title:'Financial Fundamentals', duration:'5 weeks', skills:['Accounting Basics','Reading Financial Statements','Time Value of Money'], tasks:['Study P&L, Balance Sheet, Cash Flow statements','Calculate NPV/IRR for 5 projects','Complete free CFA accounting module'] },
      { sem:2, title:'Valuation Methods', duration:'6 weeks', skills:['DCF Analysis','Comparable Companies Analysis','Precedent Transactions'], tasks:['Build a full DCF model in Excel','Run a comps analysis for a sector','Analyse a real M&A transaction'] },
      { sem:3, title:'Financial Modelling', duration:'7 weeks', skills:['Advanced Excel','Three-Statement Model','Scenario & Sensitivity Analysis'], tasks:['Build a 3-statement integrated model','Run scenario and sensitivity analysis','Master VLOOKUP, INDEX/MATCH, pivot tables'] },
      { sem:4, title:'Capital Markets', duration:'5 weeks', skills:['Equity Markets','Fixed Income','Derivatives Basics'], tasks:['Study bond pricing and duration','Analyse 5 stocks using fundamental analysis','Understand options pricing via Black-Scholes'] },
      { sem:5, title:'CFA Level 1 Preparation', duration:'6 weeks', skills:['Ethics & Standards','Portfolio Management','Quantitative Methods'], tasks:['Complete CFA L1 curriculum (all topics)','Take 3 full mock CFA exams','Study and apply quantitative methods'] },
      { sem:6, title:'Interview Preparation', duration:'4 weeks', skills:['Technical Interviews','LBO Modelling','Networking'], tasks:['Build a basic LBO model','Practice 30 finance technical interview Qs','Connect with 20 finance professionals on LinkedIn'] },
    ],

    cyber: [
      { sem:1, title:'Networking & OS Foundations', duration:'6 weeks', skills:['TCP/IP Networking','Linux Administration','Firewall & Proxy'], tasks:['Study OSI model and protocols thoroughly','Configure iptables firewall rules','Analyse packets with Wireshark'] },
      { sem:2, title:'Ethical Hacking', duration:'7 weeks', skills:['Kali Linux','Penetration Testing Methodology','OWASP Top 10'], tasks:['Complete 20 TryHackMe rooms','Run Metasploit on a CTF target','Identify and exploit OWASP Top 10 in DVWA'] },
      { sem:3, title:'Defensive Security & SIEM', duration:'6 weeks', skills:['SIEM (Splunk)','Incident Response','Threat Intelligence'], tasks:['Set up Splunk SIEM with custom dashboards','Run an IR playbook on a simulated breach','Analyse threat intelligence feeds (MISP)'] },
      { sem:4, title:'Cryptography & PKI', duration:'5 weeks', skills:['Symmetric & Asymmetric Encryption','PKI & Certificates','TLS/SSL Analysis'], tasks:['Implement AES-256 encryption in Python','Set up a private CA and issue certs','Analyse a full TLS handshake in Wireshark'] },
      { sem:5, title:'Cloud & Zero-Trust Security', duration:'5 weeks', skills:['AWS Security','Zero Trust Architecture','Identity & Access Management'], tasks:['Audit AWS S3 and IAM configurations','Implement Zero Trust with BeyondCorp model','Configure MFA and SSO enterprise-wide'] },
      { sem:6, title:'Certifications & Bug Bounty', duration:'4 weeks', skills:['Security+ / CEH Prep','Bug Bounty Programmes','Home Lab Setup'], tasks:['Take 3 CompTIA Security+ practice exams','File first bug bounty report on HackerOne','Build a security home lab with pfSense + VMs'] },
    ],

    upsc: [
      { sem:1, title:'Prelims Foundation — Polity & History', duration:'8 weeks', skills:['Indian Polity','Ancient & Medieval History','Modern History'], tasks:['Complete Polity by Laxmikant (all chapters)','Study ancient and medieval India (NCERT)','Read modern history by Spectrum/NCERT'] },
      { sem:2, title:'Economy & Current Affairs', duration:'7 weeks', skills:['Indian Economy Basics','Budget Analysis','Daily Current Affairs'], tasks:['Study Economic Survey and Budget highlights','Analyse Union Budget sector-wise','Read The Hindu and note current affairs daily'] },
      { sem:3, title:'Science, Tech & Environment', duration:'6 weeks', skills:['General Science','Environment & Ecology','Science & Technology Updates'], tasks:['Complete NCERT Science (Class 8–10)','Study environmental laws and biodiversity','Read Science & Tech updates from PIB'] },
      { sem:4, title:'Mains GS Paper Prep', duration:'8 weeks', skills:['Essay Writing','GS1/GS2/GS3 Concepts','Answer Writing Skills'], tasks:['Write 30 timed Mains answers','Complete GS2 Governance and IR topics','Study Ethics, Integrity & Aptitude (GS4)'] },
      { sem:5, title:'Optional Subject Deep Dive', duration:'8 weeks', skills:['Optional Paper 1','Optional Paper 2','Previous Year Questions'], tasks:['Complete full optional syllabus','Solve 5 years of PYQ papers','Join and complete a Mains test series'] },
      { sem:6, title:'Revision & Interview Prep', duration:'5 weeks', skills:['Rapid Revision Techniques','UPSC Interview Skills','Current Affairs Consolidation'], tasks:['Complete 3 full-length mock tests','Practice 20 IAS interview questions','Prepare a 1-page notes booklet per subject'] },
    ],

    game: [
      { sem:1, title:'Game Programming & Math', duration:'6 weeks', skills:['C# / C++ Basics','3D Linear Algebra','Physics Simulation'], tasks:['Learn C# fundamentals with Unity tutorials','Study 3D vectors, matrices, and quaternions','Implement a basic rigid-body physics engine'] },
      { sem:2, title:'Unity Engine Fundamentals', duration:'8 weeks', skills:['Unity Scene Management','Physics Engine','Input System'], tasks:['Build a complete 2D platformer','Implement a smooth character controller','Add collision detection and response'] },
      { sem:3, title:'Game Design Principles', duration:'5 weeks', skills:['Core Game Design','Level Design','UI/UX for Games'], tasks:['Write a full Game Design Document (GDD)','Design 5 progressively harder levels','Build a game HUD and pause menu'] },
      { sem:4, title:'Graphics & Shaders', duration:'6 weeks', skills:['HLSL / GLSL Shaders','PBR Lighting','Particle Systems & VFX'], tasks:['Write a custom lit shader in HLSL','Implement physically-based rendering','Create immersive VFX particle effects'] },
      { sem:5, title:'Multiplayer & Backend', duration:'6 weeks', skills:['Photon Multiplayer','Game Backend Services','Leaderboards & Analytics'], tasks:['Build a real-time multiplayer room system','Implement server-side anti-cheat validation','Add global leaderboard with Firebase'] },
      { sem:6, title:'Publishing & Marketing', duration:'4 weeks', skills:['Unity Build & Publishing','App Store Optimisation','Game Marketing'], tasks:['Publish game on itch.io / Google Play','Write a compelling store listing with screenshots','Market game via social media and dev logs'] },
    ],
  };

  // Pattern-match role to best template key
  let key = null;
  if (match('nurse'))                                              key = 'nurse';
  else if (match('doctor','physician','mbbs','surgeon'))          key = 'doctor';
  else if (match('ml engineer','machine learning engineer'))       key = 'ml engineer';
  else if (match('data scien'))                                    key = 'data scien';
  else if (match('devops','site reliab','sre','platform eng'))     key = 'devops';
  else if (match('software','backend','frontend','full stack',
                 'fullstack','web dev','mobile dev'))              key = 'software';
  else if (match('product manager','pm role'))                     key = 'product';
  else if (match('ui','ux','designer','design'))                   key = 'designer';
  else if (match('financ','invest','bank','quant'))               key = 'financ';
  else if (match('cyber','security','hacker','pen test'))          key = 'cyber';
  else if (match('upsc','civil servi','ias','ips','ifs'))          key = 'upsc';
  else if (match('game'))                                          key = 'game';

  if (key && templates[key]) return templates[key];

  // Generic 6-phase fallback for any unmatched role
  const generic = ['Foundations','Core Tools & Concepts','Applied Projects','Advanced Topics','Capstone & Portfolio','Interview & Career Prep'];
  return generic.map((title, i) => ({
    sem:      i + 1,
    title,
    duration: '4 weeks',
    skills:   [`${role} — ${title}`],
    tasks:    [`Study ${role}: ${title}`, `Build a project showcasing ${title} for ${role}`],
  }));
}

// Get personalized roadmap using ML Agents + DB Cache
async function getPersonalizedRoadmap(userId, role) {
  try {
    const profile = await StudentProfile.findOne({ userId });
    const userSkills = [...(profile?.extractedSkills || []), ...(profile?.extraSkills || [])];
    
    console.log(`[Roadmap] Building for ${role}: user has ${userSkills.length} skills`);
    
    // 1. Check DB cache first
    let dynamicRoadmap = await DynamicRoadmap.findOne({ role: role.trim() });
    
    // 2. If no cache, try the ML Agent
    if (!dynamicRoadmap) {
       console.log(`[Career API] Generating new roadmap via Agent for ${role}...`);
       try {
           const mlRes = await axios.post(`${ML_URL}/generate-roadmap`, {
              role: role.trim(),
              user_skills: userSkills
           }, { timeout: 90000 });
           
           if (mlRes && mlRes.data && (mlRes.data.semesters || mlRes.data.phases)) {
               const generatedSemesters = mlRes.data.phases || mlRes.data.semesters;
               dynamicRoadmap = new DynamicRoadmap({
                   role: role.trim(),
                   semesters: generatedSemesters,
                   source: 'ai_agent'
               });
               await dynamicRoadmap.save();
           }
       } catch(e) {
           console.error("[Career API] ML Agent failed:", e.message);
       }
       
       // 3. Rich built-in fallback — role-specific phases so the page is never empty
       if (!dynamicRoadmap) {
           const fallbackSemesters = buildFallbackRoadmap(role.trim());
           console.log(`[Career API] Using built-in fallback for "${role}" (${fallbackSemesters.length} phases)`);
           dynamicRoadmap = new DynamicRoadmap({
               role: role.trim(),
               semesters: fallbackSemesters,
               source: 'fallback'
           });
           await dynamicRoadmap.save();
       }
    }
    
    // 4. Attach resources to each skill/task in every phase
    const personalizedRoadmap = typeof dynamicRoadmap.toObject === 'function'
      ? dynamicRoadmap.toObject()
      : JSON.parse(JSON.stringify(dynamicRoadmap));
    
    for (let semester of personalizedRoadmap.semesters) {
      if (semester.resources && semester.resources.length > 0 && Array.isArray(semester.resources[0].resources)) {
        // Resources were dynamically scraped by the Python ML service. Just add hasSkill flags.
        semester.resources = semester.resources.map(resObj => ({
           ...resObj,
           hasSkill: userSkills.some(s => {
               const s1 = s.toLowerCase(); const s2 = resObj.skill.toLowerCase();
               return s1.includes(s2) || s2.includes(s1);
           })
        }));
      } else {
        // Fallback for statically formatted phases if resources are completely missing
        semester.resources = [];
        const items = semester.skills || semester.tasks || [];
        for (let i = 0; i < items.length; i++) {
           const skill = items[i];
           semester.resources.push({
              skill,
              hasSkill: userSkills.some(s => {
                  const s1 = s.toLowerCase(); const s2 = skill.toLowerCase();
                  return s1.includes(s2) || s2.includes(s1);
              }),
              resources: [
                 { title: `▶ Search YouTube: ${skill}`, url: `https://www.youtube.com/results?search_query=learn+${encodeURIComponent(skill)}`, platform: 'YouTube' }
              ]
           });
        }
      }
    }
    
    return personalizedRoadmap;
  } catch (err) {
    console.error('Error generating personalized roadmap:', err);
    throw err;
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
    
    const semesterCount = roadmap?.semesters?.length || 0;
    const firstSemesterTaskCount = roadmap?.semesters?.[0]?.tasks?.length || 0;
    console.log(`[Career API] Roadmap built - semesters: ${semesterCount}, first sem tasks: ${firstSemesterTaskCount}`);
    
    res.json({
      role,
      roadmap,
      checklistId: checklist._id,
      availableRoles: []
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
    const roadmap = await getPersonalizedRoadmap(req.user.id, role);
    res.json({ role, roadmap, availableRoles: [] });
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
    
    let jobs = data.jobs || data.extracted_skills?.slice(0, 8).map(skill => 
      `${role} - ${skill} Specialist`
    ) || [];
    
    jobs = jobs.map(job => ({
      ...job,
      deadlineParsed: job.deadline ? new Date(job.deadline) : null
    })).sort((a, b) => {
      const da = a.deadlineParsed || new Date('2099-01-01');
      const db = b.deadlineParsed || new Date('2099-01-01');
      return da - db;
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

// API: Clear cached roadmap for a role (forces regeneration on next fetch)
router.delete('/cache', auth, async (req, res) => {
  try {
    const role = req.query.role;
    if (!role) return res.status(400).json({ message: 'role query param required' });
    const result = await DynamicRoadmap.deleteOne({ role: role.trim() });
    res.json({ deleted: result.deletedCount > 0, role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;