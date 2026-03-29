import requests
from bs4 import BeautifulSoup
import json
from typing import List, Dict

class SkillResourcesScraper:
    """
    Scrapes learning resources for specific skills from various platforms.
    Focuses on high-quality, free resources like tutorials, courses, practice platforms.
    """
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        # Curated list of resources by skill
        self.resource_database = {
            'Python': [
                {'title': 'Python Official Tutorial', 'url': 'https://docs.python.org/3/tutorial/'},
                {'title': 'Real Python', 'url': 'https://realpython.com/'},
                {'title': 'Codecademy Python', 'url': 'https://www.codecademy.com/learn/learn-python-3'},
                {'title': 'LeetCode Python Problems', 'url': 'https://leetcode.com/explore/?difficulty=EASY'},
                {'title': 'HackerRank Python', 'url': 'https://www.hackerrank.com/domains/python'},
            ],
            'JavaScript': [
                {'title': 'MDN JavaScript Guide', 'url': 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide'},
                {'title': 'JavaScript.info', 'url': 'https://javascript.info/'},
                {'title': 'Codecademy JavaScript', 'url': 'https://www.codecademy.com/learn/introduction-to-javascript'},
                {'title': 'FreeCodeCamp JavaScript', 'url': 'https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures'},
                {'title': 'LeetCode JavaScript', 'url': 'https://leetcode.com/explore/?difficulty=EASY'},
            ],
            'React': [
                {'title': 'React Official Docs', 'url': 'https://react.dev/'},
                {'title': 'React Tutorial - TutorialsPoint', 'url': 'https://www.tutorialspoint.com/reactjs/'},
                {'title': 'Scrimba React Course', 'url': 'https://scrimba.com/learn/learnreact'},
                {'title': 'FreeCodeCamp React', 'url': 'https://www.freecodecamp.org/learn/front-end-development-libraries/react/'},
                {'title': 'CodePen React Examples', 'url': 'https://codepen.io/pens/projects/?search=react'},
            ],
            'Node.js': [
                {'title': 'Node.js Official Docs', 'url': 'https://nodejs.org/en/docs/'},
                {'title': 'Node.js Tutorial', 'url': 'https://www.w3schools.com/nodejs/'},
                {'title': 'Express.js Guide', 'url': 'https://expressjs.com/'},
                {'title': 'Udemy Node.js Courses', 'url': 'https://www.udemy.com/courses/search/?q=node.js'},
                {'title': 'FreeCodeCamp Node.js', 'url': 'https://www.freecodecamp.org/learn/back-end-development-and-apis/'},
            ],
            'SQL': [
                {'title': 'SQL Tutorial - W3Schools', 'url': 'https://www.w3schools.com/sql/'},
                {'title': 'SQLZoo', 'url': 'https://sqlzoo.net/'},
                {'title': 'Mode SQL Tutorial', 'url': 'https://mode.com/sql-tutorial/'},
                {'title': 'HackerRank SQL', 'url': 'https://www.hackerrank.com/domains/sql'},
                {'title': 'LeetCode Database Problems', 'url': 'https://leetcode.com/explore/learn/card/sql-language/'},
            ],
            'Data Structures': [
                {'title': 'GeeksforGeeks DSA', 'url': 'https://www.geeksforgeeks.org/data-structures/'},
                {'title': 'LeetCode Explore', 'url': 'https://leetcode.com/explore/'},
                {'title': 'Visualgo - Algorithms Visualizer', 'url': 'https://visualgo.net/'},
                {'title': 'InterviewBit Data Structures', 'url': 'https://www.interviewbit.com/courses/programming/'},
                {'title': 'Coursera Data Structures', 'url': 'https://www.coursera.org/learn/data-structures'},
            ],
            'Machine Learning': [
                {'title': 'Scikit-learn Documentation', 'url': 'https://scikit-learn.org/stable/'},
                {'title': 'Fast.ai ML Course', 'url': 'https://www.fast.ai/'},
                {'title': 'Andrew Ng ML Course', 'url': 'https://www.coursera.org/learn/machine-learning'},
                {'title': 'Kaggle Learn', 'url': 'https://www.kaggle.com/learn'},
                {'title': 'Made With ML', 'url': 'https://madewithml.com/'},
            ],
            'Deep Learning': [
                {'title': 'TensorFlow Official Tutorial', 'url': 'https://www.tensorflow.org/tutorials'},
                {'title': 'PyTorch Tutorials', 'url': 'https://pytorch.org/tutorials/'},
                {'title': 'Fast.ai Deep Learning', 'url': 'https://course.fast.ai/'},
                {'title': 'Deeplearning.ai Specialization', 'url': 'https://www.deeplearning.ai/'},
                {'title': 'Kaggle Deep Learning', 'url': 'https://www.kaggle.com/learn/intro-to-deep-learning'},
            ],
            'System Design': [
                {'title': 'System Design Primer', 'url': 'https://github.com/donnemartin/system-design-primer'},
                {'title': 'Grokking System Design', 'url': 'https://www.educative.io/courses/grokking-the-system-design-interview'},
                {'title': 'High Scalability Blog', 'url': 'http://highscalability.com/'},
                {'title': 'YouTube - System Design', 'url': 'https://www.youtube.com/results?search_query=system+design+interview'},
                {'title': 'LeetCode System Design', 'url': 'https://leetcode.com/discuss/interview-question/system-design'},
            ],
            'AWS': [
                {'title': 'AWS Official Documentation', 'url': 'https://docs.aws.amazon.com/'},
                {'title': 'AWS Tutorials Dojo', 'url': 'https://www.tutorialsdojo.com/'},
                {'title': 'A Cloud Guru AWS', 'url': 'https://www.acg.com/'},
                {'title': 'Coursera AWS', 'url': 'https://www.coursera.org/search?query=aws'},
                {'title': 'CloudGuru Hands-on Labs', 'url': 'https://learn.acloud.guru/'},
            ],
            'Docker': [
                {'title': 'Docker Official Docs', 'url': 'https://docs.docker.com/'},
                {'title': 'Docker Tutorial - W3Schools', 'url': 'https://www.w3schools.com/docker/'},
                {'title': 'Play with Docker', 'url': 'https://labs.play-with-docker.com/'},
                {'title': 'Udemy Docker', 'url': 'https://www.udemy.com/courses/search/?q=docker'},
                {'title': 'FreeCodeCamp Docker', 'url': 'https://www.freecodecamp.org/news/docker-tutorial-for-beginners/'},
            ],
            'Git': [
                {'title': 'Git Official Tutorial', 'url': 'https://git-scm.com/doc'},
                {'title': 'GitHub Learning Lab', 'url': 'https://lab.github.com/'},
                {'title': 'Atlassian Git Tutorial', 'url': 'https://www.atlassian.com/git/tutorials'},
                {'title': 'Interactive Git Tutorial', 'url': 'https://learngitbranching.js.org/'},
                {'title': 'GitHub Skills', 'url': 'https://skills.github.com/'},
            ],
            'OOP': [
                {'title': 'GeeksforGeeks OOP', 'url': 'https://www.geeksforgeeks.org/object-oriented-programming-oops-concept-in-java/'},
                {'title': 'Refactoring Guru Design Patterns', 'url': 'https://refactoring.guru/design-patterns'},
                {'title': 'Design Patterns Book', 'url': 'https://www.patterns.dev/posts/'},
                {'title': 'TutorialsPoint OOP', 'url': 'https://www.tutorialspoint.com/object_oriented_programming/'},
                {'title': 'Polymorphism & Inheritance', 'url': 'https://www.w3schools.com/java/java_polymorphism.asp'},
            ],
            'Linux': [
                {'title': 'Linux Command Line Basics', 'url': 'https://ubuntu.com/tutorials/command-line-for-beginners'},
                {'title': 'Linux Academy (A Cloud Guru)', 'url': 'https://learn.acloud.guru/'},
                {'title': 'OverTheWire Linux', 'url': 'https://overthewire.org/wargames/bandit/'},
                {'title': 'Linux.com Tutorials', 'url': 'https://www.linux.com/training-tutorials/'},
                {'title': 'HowtoForge Linux Tutorials', 'url': 'https://www.howtoforge.com/'},
            ],
            'Web Development': [
                {'title': 'MDN Web Docs', 'url': 'https://developer.mozilla.org/'},
                {'title': 'FreeCodeCamp Web Dev', 'url': 'https://www.freecodecamp.org/'},
                {'title': 'The Odin Project', 'url': 'https://www.theodinproject.com/'},
                {'title': 'W3Schools Web', 'url': 'https://www.w3schools.com/'},
                {'title': 'Codecademy Web', 'url': 'https://www.codecademy.com/learn/paths/web-development'},
            ],
            'HTML CSS': [
                {'title': 'MDN HTML/CSS', 'url': 'https://developer.mozilla.org/en-US/docs/Learn/HTML'},
                {'title': 'W3Schools HTML/CSS', 'url': 'https://www.w3schools.com/whatis/'},
                {'title': 'CSS Tricks', 'url': 'https://css-tricks.com/'},
                {'title': 'FreeCodeCamp Responsive Design', 'url': 'https://www.freecodecamp.org/news/css-grid-flexbox-responsive-design/'},
                {'title': 'Flexbox Froggy Game', 'url': 'https://flexboxfroggy.com/'},
            ],
            'Competitive Programming': [
                {'title': 'LeetCode', 'url': 'https://leetcode.com/'},
                {'title': 'HackerRank', 'url': 'https://www.hackerrank.com/'},
                {'title': 'CodeChef', 'url': 'https://www.codechef.com/'},
                {'title': 'Codeforces', 'url': 'https://codeforces.com/'},
                {'title': 'AtCoder', 'url': 'https://atcoder.jp/'},
            ],
            'REST API': [
                {'title': 'REST API Tutorial', 'url': 'https://restfulapi.net/'},
                {'title': 'MDN HTTP/REST', 'url': 'https://developer.mozilla.org/en-US/docs/Web/HTTP'},
                {'title': 'Postman Learning Center', 'url': 'https://learning.postman.com/'},
                {'title': 'FreeCodeCamp REST API', 'url': 'https://www.freecodecamp.org/news/how-to-write-a-web-api-using-flask/'},
                {'title': 'OpenAPI/Swagger', 'url': 'https://swagger.io/specification/'},
            ],
        }
    
    def get_resources_for_skill(self, skill: str, limit: int = 5) -> List[Dict]:
        """
        Returns a list of resources for a given skill.
        Falls back to generic learning resources if skill not found.
        
        Args:
            skill: Name of the skill
            limit: Maximum number of resources to return
            
        Returns:
            List of resource dictionaries with 'title' and 'url'
        """
        # Try exact match
        if skill in self.resource_database:
            resources = self.resource_database[skill][:limit]
            return resources
        
        # Try partial match
        skill_lower = skill.lower()
        for key, resources in self.resource_database.items():
            if skill_lower in key.lower() or key.lower() in skill_lower:
                return resources[:limit]
        
        # Default to generic study resources
        generic_resources = [
            {'title': f'GeeksforGeeks - {skill}', 'url': f'https://www.geeksforgeeks.org/?s={skill.replace(" ", "+")}'},
            {'title': f'YouTube - Learn {skill}', 'url': f'https://www.youtube.com/results?search_query=learn+{skill.replace(" ", "+")}'},
            {'title': f'Udemy - {skill} Courses', 'url': f'https://www.udemy.com/courses/search/?q={skill.replace(" ", "+")}'},
            {'title': f'Coursera - {skill}', 'url': f'https://www.coursera.org/search?query={skill.replace(" ", "+")}'},
            {'title': f'Stack Overflow - {skill} Tag', 'url': f'https://stackoverflow.com/questions/tagged/{skill.lower().replace(" ", "-")}'},
        ]
        
        return generic_resources[:limit]
    
    def get_role_resources(self, role: str) -> Dict[str, List[List[Dict]]]:
        """
        Returns resources grouped by role and skill.
        Maps role to required skills and then to resources for each skill.
        
        Args:
            role: Career role (e.g., 'Software Engineer', 'Data Scientist')
            
        Returns:
            Dictionary with role's learning materials
        """
        role_skills = {
            'Software Engineer': [
                'Python', 'JavaScript', 'Data Structures', 'OOP', 'System Design',
                'React', 'Node.js', 'SQL', 'Git', 'Linux', 'Docker', 'REST API',
                'Competitive Programming'
            ],
            'Data Scientist': [
                'Python', 'SQL', 'Machine Learning', 'Deep Learning',
                'Data Structures', 'Statistics', 'TensorFlow', 'Pandas',
                'Scikit-learn', 'Jupyter', 'AWS'
            ],
            'DevOps Engineer': [
                'Linux', 'Docker', 'Git', 'AWS', 'System Design',
                'Kubernetes', 'Python', 'Networking', 'CI/CD', 'Terraform'
            ],
            'ML Engineer': [
                'Python', 'Machine Learning', 'Deep Learning', 'Data Structures',
                'TensorFlow', 'PyTorch', 'SQL', 'AWS', 'System Design'
            ],
            'Frontend Developer': [
                'HTML CSS', 'JavaScript', 'React', 'Web Development',
                'Git', 'REST API', 'CSS Tricks', 'TypeScript'
            ],
            'Backend Developer': [
                'Python', 'Node.js', 'SQL', 'REST API', 'System Design',
                'Docker', 'Linux', 'Git', 'OOP', 'Database Design'
            ],
            'Product Manager': [
                'System Design', 'Data Structures', 'Web Development',
                'SQL', 'Analytics', 'Communication'
            ],
        }
        
        skills = role_skills.get(role, role_skills['Software Engineer'])
        resources_by_skill = {}
        
        for skill in skills:
            resources_by_skill[skill] = self.get_resources_for_skill(skill, limit=3)
        
        return resources_by_skill


def main():
    """Test the scraper"""
    scraper = SkillResourcesScraper()
    
    # Test getting resources for a skill
    python_resources = scraper.get_resources_for_skill('Python')
    print("Python Resources:")
    for res in python_resources:
        print(f"  - {res['title']}: {res['url']}")
    
    # Test getting role resources
    se_resources = scraper.get_role_resources('Software Engineer')
    print("\nSoftware Engineer Skills & Resources:")
    for skill, resources in list(se_resources.items())[:3]:
        print(f"\n{skill}:")
        for res in resources:
            print(f"  - {res['title']}")


if __name__ == '__main__':
    main()
