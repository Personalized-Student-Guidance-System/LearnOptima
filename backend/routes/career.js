const router = require('express').Router();
const auth = require('../middleware/auth');

const roadmaps = {
  'Software Engineer': {
    semesters: [
      { sem: 1, title: 'Foundation', tasks: ['Learn C/C++ basics', 'Data structures fundamentals', 'Linux basics', 'Git basics'] },
      { sem: 2, title: 'Core CS', tasks: ['OOP concepts', 'DBMS & SQL', 'Computer Networks basics', 'Web basics (HTML/CSS)'] },
      { sem: 3, title: 'Development', tasks: ['JavaScript fundamentals', 'Python for scripting', 'REST API concepts', 'Database design'] },
      { sem: 4, title: 'Frameworks', tasks: ['React or Angular', 'Node.js / Django', 'Docker basics', 'Agile methodology'] },
      { sem: 5, title: 'Advanced', tasks: ['System design', 'Microservices', 'Cloud basics (AWS/GCP)', 'DSA practice (LeetCode)'] },
      { sem: 6, title: 'Specialization', tasks: ['Open source contributions', 'Build 2-3 full-stack projects', 'Competitive programming', 'Technical interviews prep'] },
      { sem: 7, title: 'Industry Ready', tasks: ['Internship', 'Portfolio website', 'Resume optimization', 'Mock interviews'] },
      { sem: 8, title: 'Placement', tasks: ['Campus placements', 'Off-campus applications', 'Negotiate offers', 'Final project'] }
    ]
  },
  'Data Scientist': {
    semesters: [
      { sem: 1, title: 'Math Foundation', tasks: ['Linear Algebra', 'Statistics basics', 'Python basics', 'Excel for data'] },
      { sem: 2, title: 'Programming', tasks: ['Python (NumPy, Pandas)', 'Probability & Statistics', 'SQL fundamentals', 'Data visualization'] },
      { sem: 3, title: 'ML Basics', tasks: ['Supervised learning', 'Unsupervised learning', 'Scikit-learn', 'Feature engineering'] },
      { sem: 4, title: 'Deep Learning', tasks: ['Neural networks', 'TensorFlow/PyTorch', 'CNNs & RNNs', 'NLP basics'] },
      { sem: 5, title: 'Advanced ML', tasks: ['MLOps fundamentals', 'Model deployment', 'A/B testing', 'Big Data (Spark)'] },
      { sem: 6, title: 'Specialization', tasks: ['Kaggle competitions', 'Research papers', 'Domain-specific datasets', 'Cloud ML platforms'] },
      { sem: 7, title: 'Industry', tasks: ['Data science internship', 'End-to-end ML project', 'Technical blogging', 'Network building'] },
      { sem: 8, title: 'Placement', tasks: ['Company applications', 'Case study preparation', 'Portfolio projects', 'Final placement'] }
    ]
  }
};

router.get('/', auth, async (req, res) => {
  try {
    const role = req.query.role || 'Software Engineer';
    const roadmap = roadmaps[role] || roadmaps['Software Engineer'];
    res.json({ role, roadmap, availableRoles: Object.keys(roadmaps) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;