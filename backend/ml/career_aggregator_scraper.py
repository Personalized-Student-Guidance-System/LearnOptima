#!/usr/bin/env python3
"""
career_aggregator_scraper.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Playwright + BeautifulSoup based resource and job aggregator for LearnOptima.

Features:
  - Accepts a target role as input.
  - Searches job boards (LinkedIn, Indeed) and learning platforms
    (Coursera, freeCodeCamp).
  - Extracts title, company/provider, source URL, and full text description.
  - Uses Gemini API (or a local heuristic fallback) to parse descriptions into:
      {
        "deadline": "YYYY-MM-DD" | "N/A",
        "skills_required": [top 5 skills],
        "resource_type": "Job" | "Course" | "Article"
      }
  - Handles dynamic pages with Playwright.
  - Includes basic blocked-request detection and retry logic.

Usage:
  python career_aggregator_scraper.py "Full Stack Developer"
  python career_aggregator_scraper.py "Full Stack Developer" --limit 3 --pretty

Environment:
  GEMINI_API_KEY=<your_key>   # optional but recommended

Notes:
  - Some job boards may block headless traffic. This script detects common
    block signals and continues gracefully rather than crashing the whole run.
  - Run once after install if needed:
      python -m playwright install chromium
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import time
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Callable, Dict, List, Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PlaywrightTimeoutError = Exception
    sync_playwright = None
    PLAYWRIGHT_AVAILABLE = False


DEFAULT_TIMEOUT_MS = 45000
DEFAULT_LIMIT_PER_SOURCE = 3
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

BLOCK_PATTERNS = [
    "captcha",
    "unusual traffic",
    "access denied",
    "temporarily blocked",
    "verify you are human",
    "bot detection",
    "security check",
]

SKILL_PATTERN = re.compile(
    r"\b("
    r"python|javascript|typescript|java|react|node\.?js|express|mongodb|mysql|sql|"
    r"postgresql|docker|kubernetes|aws|azure|gcp|html|css|tailwind|next\.?js|"
    r"rest api|graphql|git|linux|devops|django|flask|fastapi|selenium|playwright|"
    r"data structures|algorithms|system design|communication|problem solving|"
    r"machine learning|deep learning|nlp|figma|testing|jest|cypress"
    r")\b",
    re.IGNORECASE,
)

DATE_PATTERNS = [
    re.compile(r"(?:apply by|deadline|closing date|last date)[:\s]+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})", re.I),
    re.compile(r"(?:apply by|deadline|closing date|last date)[:\s]+(\d{4}-\d{2}-\d{2})", re.I),
    re.compile(r"(?:apply by|deadline|closing date|last date)[:\s]+(\d{1,2}/\d{1,2}/\d{4})", re.I),
]


class BlockedRequestError(Exception):
    """Raised when a source appears to block scraping traffic."""


@dataclass
class AggregatedItem:
    source: str
    title: str
    company: str
    url: str
    description: str
    parsed_metadata: Dict[str, object]


def _sleep(lo: float = 0.8, hi: float = 1.8) -> None:
    time.sleep(random.uniform(lo, hi))


def _normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _truncate(text: str, limit: int = 12000) -> str:
    text = _normalize_whitespace(text)
    return text[:limit]


def _looks_blocked(html: str, url: str = "") -> bool:
    haystack = f"{url} {html}".lower()
    return any(token in haystack for token in BLOCK_PATTERNS)


def _guess_resource_type(source: str, title: str, description: str) -> str:
    combined = f"{source} {title} {description}".lower()
    if any(word in combined for word in ["course", "specialization", "coursera", "learn "]):
        return "Course"
    if any(word in combined for word in ["article", "tutorial", "guide", "freecodecamp", "blog"]):
        return "Article"
    return "Job"


def _extract_deadline_heuristic(text: str) -> str:
    sample = text[:4000]
    for pattern in DATE_PATTERNS:
        match = pattern.search(sample)
        if not match:
            continue
        raw = match.group(1).strip()
        for fmt in ("%B %d, %Y", "%b %d, %Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(raw, fmt).date().isoformat()
            except ValueError:
                continue
    return "N/A"


def _extract_top_skills_heuristic(text: str, max_items: int = 5) -> List[str]:
    matches = [m.lower().replace(".?", ".") for m in SKILL_PATTERN.findall(text or "")]
    counts = Counter(matches)
    return [skill for skill, _ in counts.most_common(max_items)]


def parse_description_with_gemini(
    description: str,
    title: str,
    source: str,
    api_key: Optional[str] = None,
) -> Dict[str, object]:
    """
    Parse a description into structured metadata using Gemini.
    Falls back to heuristic extraction if the API key is missing or the call fails.
    """
    fallback = {
        "deadline": _extract_deadline_heuristic(description),
        "skills_required": _extract_top_skills_heuristic(description),
        "resource_type": _guess_resource_type(source, title, description),
    }

    api_key = api_key or os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return fallback

    prompt = (
        "You are an information extraction system. "
        "Read the given listing description and return ONLY valid JSON with this exact schema: "
        '{"deadline":"ISO_DATE_OR_N/A","skills_required":["skill1","skill2","skill3","skill4","skill5"],'
        '"resource_type":"Job|Course|Article"}. '
        "Rules: deadline must be ISO format YYYY-MM-DD or N/A. "
        "skills_required must contain at most 5 concise skills. "
        "resource_type must be exactly one of Job, Course, or Article.\n\n"
        f"Source: {source}\n"
        f"Title: {title}\n"
        f"Description:\n{description[:8000]}"
    )

    try:
        response = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "response_mime_type": "application/json",
                },
            },
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["candidates"][0]["content"]["parts"][0]["text"].strip()
        text = re.sub(r"^```json\s*", "", text, flags=re.I)
        text = re.sub(r"```$", "", text).strip()
        parsed = json.loads(text)

        deadline = parsed.get("deadline") or fallback["deadline"]
        skills = parsed.get("skills_required") or fallback["skills_required"]
        resource_type = parsed.get("resource_type") or fallback["resource_type"]

        if not isinstance(skills, list):
            skills = fallback["skills_required"]

        return {
            "deadline": deadline if isinstance(deadline, str) else fallback["deadline"],
            "skills_required": [str(s).strip() for s in skills if str(s).strip()][:5],
            "resource_type": str(resource_type).strip() if resource_type else fallback["resource_type"],
        }
    except Exception:
        return fallback


class CareerAggregatorScraper:
    def __init__(self, target_role: str, limit_per_source: int = DEFAULT_LIMIT_PER_SOURCE):
        self.target_role = (target_role or "Full Stack Developer").strip()
        self.limit_per_source = max(1, limit_per_source)
        self.gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        self.errors: List[Dict[str, str]] = []

    def _build_context(self, browser):
        return browser.new_context(
            user_agent=USER_AGENT,
            locale="en-US",
            viewport={"width": 1440, "height": 900},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Upgrade-Insecure-Requests": "1",
            },
        )

    def _safe_goto(self, page, url: str, source_name: str, retries: int = 2) -> bool:
        for attempt in range(retries + 1):
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT_MS)
                page.wait_for_timeout(random.randint(1200, 2200))
                html = page.content()
                if _looks_blocked(html, url):
                    raise BlockedRequestError(f"{source_name} appears to be blocking the request")
                return True
            except (PlaywrightTimeoutError, BlockedRequestError) as exc:
                if attempt >= retries:
                    self.errors.append({"source": source_name, "url": url, "error": str(exc)})
                    return False
                page.wait_for_timeout((attempt + 1) * 2000)
            except Exception as exc:
                self.errors.append({"source": source_name, "url": url, "error": str(exc)})
                return False
        return False

    def _fetch_detail_text(self, page, url: str, source_name: str, selectors: List[str]) -> str:
        if not self._safe_goto(page, url, source_name):
            return ""

        for selector in selectors:
            try:
                page.locator(selector).first.wait_for(timeout=6000)
                break
            except Exception:
                continue

        soup = BeautifulSoup(page.content(), "html.parser")
        for bad in soup(["script", "style", "noscript"]):
            bad.decompose()

        for selector in selectors:
            try:
                node = soup.select_one(selector)
                if node:
                    text = _truncate(node.get_text(" ", strip=True))
                    if len(text) > 100:
                        return text
            except Exception:
                continue

        return _truncate(soup.get_text(" ", strip=True))

    def _record_item(self, source: str, title: str, company: str, url: str, description: str) -> Optional[AggregatedItem]:
        title = _normalize_whitespace(title)
        company = _normalize_whitespace(company)
        description = _truncate(description)
        if not title or not url or len(description) < 40:
            return None

        parsed = parse_description_with_gemini(
            description=description,
            title=title,
            source=source,
            api_key=self.gemini_api_key,
        )
        return AggregatedItem(
            source=source,
            title=title,
            company=company or "N/A",
            url=url,
            description=description,
            parsed_metadata=parsed,
        )

    def scrape_linkedin_jobs(self, context) -> List[AggregatedItem]:
        page = context.new_page()
        items: List[AggregatedItem] = []
        search_url = (
            "https://www.linkedin.com/jobs/search"
            f"?keywords={quote_plus(self.target_role)}&location={quote_plus('India')}"
        )
        if not self._safe_goto(page, search_url, "linkedin"):
            page.close()
            return items

        page.mouse.wheel(0, 2500)
        page.wait_for_timeout(1500)
        soup = BeautifulSoup(page.content(), "html.parser")
        cards = soup.select("div.base-card, li.jobs-search-results__list-item, div.job-search-card")

        for card in cards[: self.limit_per_source]:
            try:
                link = card.select_one("a.base-card__full-link, a[href*='/jobs/view/']")
                title_node = card.select_one("h3")
                company_node = card.select_one("h4, a.hidden-nested-link, span.base-search-card__subtitle")
                url = (link.get("href", "") if link else "").split("?")[0]
                title = title_node.get_text(" ", strip=True) if title_node else self.target_role
                company = company_node.get_text(" ", strip=True) if company_node else "N/A"

                description = self._fetch_detail_text(
                    page,
                    url,
                    "linkedin",
                    [
                        "div.show-more-less-html__markup",
                        "div.description__text",
                        "section.show-more-less-html",
                        "main",
                    ],
                )
                item = self._record_item("LinkedIn", title, company, url, description)
                if item:
                    items.append(item)
                    _sleep()
            except Exception as exc:
                self.errors.append({"source": "linkedin", "url": search_url, "error": str(exc)})

        page.close()
        return items

    def scrape_indeed_jobs(self, context) -> List[AggregatedItem]:
        page = context.new_page()
        items: List[AggregatedItem] = []
        search_url = f"https://in.indeed.com/jobs?q={quote_plus(self.target_role)}&l={quote_plus('India')}"
        if not self._safe_goto(page, search_url, "indeed"):
            page.close()
            return items

        page.mouse.wheel(0, 2500)
        page.wait_for_timeout(1500)
        soup = BeautifulSoup(page.content(), "html.parser")
        cards = soup.select("div.job_seen_beacon, div.slider_container, div.cardOutline")

        for card in cards[: self.limit_per_source]:
            try:
                link = card.select_one("a.jcs-JobTitle, h2 a")
                company_node = card.select_one("span.companyName, [data-testid='company-name']")
                title = link.get_text(" ", strip=True) if link else self.target_role
                raw_url = link.get("href", "") if link else ""
                if raw_url.startswith("/"):
                    url = f"https://in.indeed.com{raw_url}"
                else:
                    url = raw_url
                company = company_node.get_text(" ", strip=True) if company_node else "N/A"

                description = self._fetch_detail_text(
                    page,
                    url,
                    "indeed",
                    [
                        "#jobDescriptionText",
                        "div.jobsearch-JobComponent-description",
                        "main",
                    ],
                )
                item = self._record_item("Indeed", title, company, url, description)
                if item:
                    items.append(item)
                    _sleep()
            except Exception as exc:
                self.errors.append({"source": "indeed", "url": search_url, "error": str(exc)})

        page.close()
        return items

    def scrape_coursera_resources(self, context) -> List[AggregatedItem]:
        page = context.new_page()
        items: List[AggregatedItem] = []
        search_url = f"https://www.coursera.org/search?query={quote_plus(self.target_role)}"
        if not self._safe_goto(page, search_url, "coursera"):
            page.close()
            return items

        page.mouse.wheel(0, 2200)
        page.wait_for_timeout(1500)
        soup = BeautifulSoup(page.content(), "html.parser")
        cards = soup.select("li[data-testid='search-product-card'], div.cds-ProductCard-container")

        for card in cards[: self.limit_per_source]:
            try:
                link = card.select_one("a[href]")
                title_node = card.select_one("h3, h2")
                provider_node = card.select_one("p, span.css-6ecy9b")
                raw_url = link.get("href", "") if link else ""
                url = raw_url if raw_url.startswith("http") else f"https://www.coursera.org{raw_url}"
                title = title_node.get_text(" ", strip=True) if title_node else self.target_role
                company = provider_node.get_text(" ", strip=True) if provider_node else "Coursera"

                description = self._fetch_detail_text(
                    page,
                    url,
                    "coursera",
                    [
                        "div[data-testid='about-this-course']",
                        "section[class*='description']",
                        "main",
                    ],
                )
                item = self._record_item("Coursera", title, company, url, description)
                if item:
                    items.append(item)
                    _sleep()
            except Exception as exc:
                self.errors.append({"source": "coursera", "url": search_url, "error": str(exc)})

        page.close()
        return items

    def scrape_freecodecamp_articles(self, context) -> List[AggregatedItem]:
        page = context.new_page()
        items: List[AggregatedItem] = []
        search_url = f"https://www.freecodecamp.org/news/search/?query={quote_plus(self.target_role)}"
        if not self._safe_goto(page, search_url, "freecodecamp"):
            page.close()
            return items

        page.mouse.wheel(0, 2200)
        page.wait_for_timeout(1500)
        soup = BeautifulSoup(page.content(), "html.parser")
        cards = soup.select("article a[href], main a[href*='/news/']")
        seen = set()

        for link in cards:
            try:
                href = link.get("href", "")
                if not href:
                    continue
                url = href if href.startswith("http") else f"https://www.freecodecamp.org{href}"
                if url in seen or "/news/search/" in url:
                    continue
                seen.add(url)

                title = link.get_text(" ", strip=True) or self.target_role
                description = self._fetch_detail_text(
                    page,
                    url,
                    "freecodecamp",
                    [
                        "article",
                        "main article",
                        "main",
                    ],
                )
                item = self._record_item("freeCodeCamp", title, "freeCodeCamp", url, description)
                if item:
                    items.append(item)
                    _sleep()
                if len(items) >= self.limit_per_source:
                    break
            except Exception as exc:
                self.errors.append({"source": "freecodecamp", "url": search_url, "error": str(exc)})

        page.close()
        return items

    def run(self) -> Dict[str, object]:
        if not PLAYWRIGHT_AVAILABLE:
            return {
                "target_role": self.target_role,
                "count": 0,
                "items": [],
                "errors": [
                    {
                        "source": "playwright",
                        "url": "",
                        "error": (
                            "Playwright is not installed in the active Python environment. "
                            "Install dependencies with `pip install -r backend/ml/requirements.txt` "
                            "and then run `python -m playwright install chromium`."
                        ),
                    }
                ],
                "generated_at": datetime.utcnow().isoformat() + "Z",
            }

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            context = self._build_context(browser)
            context.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
            )

            sources: List[Callable] = [
                self.scrape_linkedin_jobs,
                self.scrape_indeed_jobs,
                self.scrape_coursera_resources,
                self.scrape_freecodecamp_articles,
            ]

            results: List[AggregatedItem] = []
            for scraper in sources:
                try:
                    results.extend(scraper(context))
                except Exception as exc:
                    self.errors.append({"source": scraper.__name__, "url": "", "error": str(exc)})

            context.close()
            browser.close()

        payload = {
            "target_role": self.target_role,
            "count": len(results),
            "items": [asdict(item) for item in results],
            "errors": self.errors,
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }
        return payload


def main() -> None:
    parser = argparse.ArgumentParser(description="Playwright + BeautifulSoup career aggregator")
    parser.add_argument("target_role", nargs="?", default="Full Stack Developer")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    scraper = CareerAggregatorScraper(args.target_role, args.limit)
    result = scraper.run()
    if args.pretty:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()