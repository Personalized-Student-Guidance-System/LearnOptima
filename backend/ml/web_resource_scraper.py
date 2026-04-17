import requests
import re
import urllib.parse
from typing import List, Dict

def scrape_youtube_videos(query: str, limit: int = 3) -> List[Dict]:
    """Scrapes YouTube search natively without API keys using Regex on ytInitialData."""
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://www.youtube.com/results?search_query={encoded_query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        html = response.text
        
        # ytInitialData holds the search results
        video_ids = re.findall(r'"videoId":"([^"]{11})"', html)
        
        # titles are usually near videoId in search result JSON
        # A more robust regex for title might be text inside "title":{"runs":[{"text":"..."
        titles = re.findall(r'"title":\{"runs":\[\{"text":"(.*?)"\}', html)
        
        seen_ids = set()
        unique_videos = []
        
        # Because regex can be misaligned if order is weird, we do a zip. 
        # Usually it matches up reasonably well for the first few main results.
        for vid, title in zip(video_ids, titles):
            if vid not in seen_ids and len(vid) == 11:
                seen_ids.add(vid)
                unique_videos.append({"id": vid, "title": title})
                if len(unique_videos) >= limit:
                    break
                    
        resources = []
        for v in unique_videos:
            resources.append({
                "title": f"▶ {v['title'].replace('+', ' ').strip()}",
                "url": f"https://www.youtube.com/watch?v={v['id']}"
            })
            
        return resources
    except Exception as e:
        print(f"[WebScraper] YouTube scrape error: {e}")
        return []

def scrape_duckduckgo_courses(query: str, limit: int = 3) -> List[Dict]:
    """Scrapes DuckDuckGo HTML version to get course links."""
    encoded_query = urllib.parse.quote_plus(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        results = []
        for a in soup.find_all('a', class_='result__url'):
            href = a.get('href', '')
            if href.startswith('//duckduckgo.com/l/?'):
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                if 'uddg' in parsed:
                    href = parsed['uddg'][0]
            
            container = a.find_parent('div', class_='result__body')
            title = "Course Tutorial"
            if container:
                title_elem = container.find('h2', class_='result__title')
                if title_elem:
                    title = title_elem.get_text(strip=True)
            
            if href and href.startswith('http'):
                results.append({
                    "title": f"📚 {title}",
                    "url": href
                })
                
            if len(results) >= limit:
                break
                
        return results
    except Exception as e:
        print(f"[WebScraper] DDG Course scrape error: {e}")
        return []

def get_real_resources(skill: str, tier: str) -> List[Dict]:
    """Get actual scraped resources for a skill and tier."""
    yt_query = f"{skill} tutorial {tier}"
    # Target specific sites or general query
    web_query = f"site:coursera.org OR site:udemy.com OR site:geeksforgeeks.org {skill} course {tier}"
    
    yt_links = scrape_youtube_videos(yt_query, limit=2)
    
    # Due to anti-bot on DDG from cloudflare, if it fails, fallback to standard formatting but at least we have YouTube
    course_links = scrape_duckduckgo_courses(web_query, limit=2)
    
    combined = []
    # Interleave results
    if yt_links:
        combined.append(yt_links[0])
    if course_links:
        combined.append(course_links[0])
    if len(yt_links) > 1:
        combined.append(yt_links[1])
    if len(course_links) > 1:
        combined.append(course_links[1])
        
    return combined[:3]

if __name__ == "__main__":
    print(get_real_resources("React Context API", "intermediate"))
