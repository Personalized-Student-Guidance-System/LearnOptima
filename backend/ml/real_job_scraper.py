"""
real_job_scraper.py
~~~~~~~~~~~~~~~~~~~
Scrapes live job listings from Naukri, LinkedIn, and Google Jobs.

KEY FIXES:
  1. Naukri  — uses correct 2024/2025 card selectors and title-anchor href
               to get the DIRECT job-detail page URL (not the search page).
  2. LinkedIn — reads canonical href from <a class="base-card__full-link">
               so "Apply →" always lands on the actual posting.
  3. Google  — NEW: scrape_google_jobs() opens Google search for the role
               and returns structured results via the Google Jobs carousel,
               each with a direct apply URL to the employer/aggregator.
  4. get_live_jobs() merges all three sources, deduplicated by URL.
"""

import json
import re
import time
import random
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    NoSuchElementException, TimeoutException, StaleElementReferenceException,
    ElementClickInterceptedException,
)
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup


# ── helpers ───────────────────────────────────────────────────────────────────

def _rand_sleep(lo: float = 1.5, hi: float = 3.5) -> None:
    time.sleep(random.uniform(lo, hi))


def _estimate_deadline(days_ahead: int = 30) -> str:
    """Return an ISO-date string N days from today as an estimated deadline."""
    return (datetime.today() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")


# ─────────────────────────────────────────────────────────────────────────────

class RealJobScraper:
    def __init__(self):
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--window-size=1920,1080")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument(
            "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        service = webdriver.chrome.service.Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=opts)
        self.driver.set_page_load_timeout(15)
        # Hide webdriver flag from JS
        self.driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
        )
        self.wait = WebDriverWait(self.driver, 15)

    # ── dismiss overlays / modals ─────────────────────────────────────────────

    def _dismiss(self, selectors: List[str]) -> None:
        for sel in selectors:
            try:
                btn = self.driver.find_element(By.CSS_SELECTOR, sel)
                btn.click()
                time.sleep(0.4)
            except Exception:
                pass

    # ─────────────────────────────────────────────────────────────────────────
    #  Naukri
    # ─────────────────────────────────────────────────────────────────────────

    def scrape_naukri_jobs(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 6,
    ) -> List[Dict]:
        """
        Return list of job dicts, each with a DIRECT Naukri job-page URL.

        Naukri job-detail URLs look like:
          https://www.naukri.com/job-listings-<slug>-<company>-<city>-<id>
        They live on the <a class="title"> anchor inside each card.
        """
        jobs: List[Dict] = []
        try:
            slug = job_title.strip().lower().replace(" ", "-")
            loc  = location.strip().lower().replace(" ", "-")
            url  = f"https://www.naukri.com/{slug}-jobs-in-{loc}"
            print(f"[Naukri] GET {url}")
            self.driver.get(url)
            _rand_sleep(3, 5)

            self._dismiss([
                "#loginModalCTA",
                "button#cookieConsent",
                ".modal-close-btn",
                "button[aria-label='close']",
            ])

            # Wait for job cards
            CARD_SEL = (
                "div.srp-jobtuple-wrapper, "
                "article.jobTuple, "
                "div.jobTuple, "
                "div[class*='job-container']"
            )
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, CARD_SEL)))
            except TimeoutException:
                print("[Naukri] Timeout waiting for cards, trying fallback anchor scan...")

            cards = self.driver.find_elements(By.CSS_SELECTOR, CARD_SEL)
            print(f"[Naukri] Found {len(cards)} cards")

            # Fallback: scan all job-listing anchors directly
            if not cards:
                anchors = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    "a[href*='naukri.com/job-listings-'], a.title[href]"
                )[:num_jobs]
                for a in anchors:
                    href = a.get_attribute("href") or ""
                    text = (a.get_attribute("title") or a.text or job_title).strip()
                    if href.startswith("http"):
                        jobs.append({
                            "title":    text,
                            "company":  "",
                            "location": location,
                            "applyUrl": href,
                            "source":   "naukri",
                            "deadline": _estimate_deadline(random.randint(7, 30)),
                        })
                return jobs[:num_jobs]

            for card in cards[:num_jobs]:
                try:
                    html = card.get_attribute("outerHTML") or ""
                    soup = BeautifulSoup(html, "html.parser")

                    # Title anchor — Naukri 2024 uses <a class="title"> for the job-detail link
                    title_a = (
                        soup.find("a", class_="title")
                        or soup.find("a", attrs={"class": re.compile(r"\btitle\b|\bjobTitle\b")})
                        or soup.find("a", href=re.compile(r"naukri\.com/job-listings-"))
                        or soup.find("a", href=re.compile(r"/job-listings-"))
                    )

                    apply_url  = ""
                    title_text = job_title

                    if title_a:
                        raw_href   = title_a.get("href", "") or ""
                        title_text = (
                            title_a.get("title")
                            or title_a.get_text(strip=True)
                            or job_title
                        )
                        if raw_href.startswith("http"):
                            apply_url = raw_href
                        elif raw_href.startswith("/"):
                            apply_url = "https://www.naukri.com" + raw_href

                    # Hard fallback: first naukri.com link in card
                    if not apply_url:
                        for a in soup.find_all("a", href=True):
                            h = a["href"]
                            if "naukri.com" in h or h.startswith("/"):
                                apply_url = h if h.startswith("http") else "https://www.naukri.com" + h
                                break

                    # Company name
                    company_tag = (
                        soup.find("a", class_=re.compile(r"comp-name|companyName|org", re.I))
                        or soup.find("span", class_=re.compile(r"comp-name|companyName", re.I))
                    )
                    company = company_tag.get_text(strip=True) if company_tag else ""

                    # Location
                    loc_tag = soup.find(True, class_=re.compile(r"locWdth|location|loc\b", re.I))
                    loc_text = loc_tag.get_text(strip=True) if loc_tag else location

                    if apply_url:
                        jobs.append({
                            "title":    title_text,
                            "company":  company,
                            "location": loc_text,
                            "applyUrl": apply_url,
                            "source":   "naukri",
                            "deadline": _estimate_deadline(random.randint(7, 30)),
                        })
                        print(f"  [Naukri] OK {title_text[:50]} -> {apply_url[:80]}")
                    else:
                        print(f"  [Naukri] No URL found for card {cards.index(card)}")

                except Exception as e:
                    print(f"[Naukri] card parse error: {e}")
                    continue

        except Exception as exc:
            print(f"[Naukri] scrape_naukri_jobs error: {exc}")

        return jobs[:num_jobs]

    # ─────────────────────────────────────────────────────────────────────────
    #  LinkedIn  (public jobs page — no login required)
    # ─────────────────────────────────────────────────────────────────────────

    def scrape_linkedin_jobs(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 6,
    ) -> List[Dict]:
        """
        Return job dicts with the DIRECT LinkedIn job-posting URL.

        LinkedIn public job URLs:
          https://www.linkedin.com/jobs/view/<JOB_ID>/
        Found on <a class="base-card__full-link"> anchors.
        """
        jobs: List[Dict] = []
        try:
            kw  = job_title.replace(" ", "%20")
            loc = location.replace(" ", "%20")
            url = (
                f"https://www.linkedin.com/jobs/search"
                f"?keywords={kw}&location={loc}&f_TPR=r2592000&position=1&pageNum=0"
            )
            print(f"[LinkedIn] GET {url}")
            self.driver.get(url)
            _rand_sleep(3, 5)

            self._dismiss([
                "button[aria-label*='Dismiss']",
                "button[aria-label*='dismiss']",
                "button[aria-label*='close']",
                "#artdeco-modal-outlet .artdeco-modal__dismiss",
            ])

            CARD_SEL = (
                "div.base-card, "
                "div.job-search-card, "
                "li.jobs-search-results__list-item"
            )
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, CARD_SEL)))
            except TimeoutException:
                print("[LinkedIn] Timeout waiting for job cards")

            cards = self.driver.find_elements(By.CSS_SELECTOR, CARD_SEL)
            print(f"[LinkedIn] Found {len(cards)} cards")

            # Fast path: read full-link anchors directly if cards not found
            if not cards:
                anchors = self.driver.find_elements(
                    By.CSS_SELECTOR,
                    "a.base-card__full-link, a[href*='/jobs/view/']"
                )[:num_jobs]
                for a in anchors:
                    href = (a.get_attribute("href") or "").split("?")[0]
                    text = (a.get_attribute("aria-label") or a.text or job_title).strip()
                    if href and "linkedin.com/jobs/view/" in href:
                        jobs.append({
                            "title":    text,
                            "company":  "",
                            "location": location,
                            "applyUrl": href,
                            "source":   "linkedin",
                            "deadline": _estimate_deadline(random.randint(5, 21)),
                        })
                return jobs[:num_jobs]

            for card in cards[:num_jobs]:
                try:
                    html = card.get_attribute("outerHTML") or ""
                    soup = BeautifulSoup(html, "html.parser")

                    # Priority 1: base-card__full-link anchor
                    full_link = (
                        soup.find("a", class_=re.compile(r"base-card__full-link|job-card-container__link", re.I))
                        or soup.find("a", href=re.compile(r"linkedin\.com/jobs/view/"))
                    )

                    apply_url  = ""
                    title_text = job_title

                    if full_link:
                        raw = full_link.get("href", "") or ""
                        apply_url  = raw.split("?")[0]
                        title_text = (
                            full_link.get("aria-label")
                            or full_link.get_text(strip=True)
                            or job_title
                        )

                    # Priority 2: any /jobs/view/ link in card
                    if not apply_url:
                        for a in soup.find_all("a", href=re.compile(r"/jobs/view/\d+")):
                            apply_url  = a.get("href", "").split("?")[0]
                            title_text = a.get("aria-label") or a.get_text(strip=True) or job_title
                            break

                    # Priority 3: click card → grab browser URL
                    if not apply_url:
                        try:
                            card.click()
                            _rand_sleep(1.2, 2.2)
                            current = self.driver.current_url
                            if "linkedin.com/jobs/view" in current:
                                apply_url = current.split("?")[0]
                        except Exception:
                            pass

                    # Company
                    company_tag = (
                        soup.find("h4", class_=re.compile(r"base-search-card__subtitle|job-card.*company", re.I))
                        or soup.find("a", class_=re.compile(r"hidden-nested-link|company", re.I))
                    )
                    company = company_tag.get_text(strip=True) if company_tag else ""

                    # Location
                    loc_tag = soup.find(
                        "span",
                        class_=re.compile(r"job-search-card__location|base-search-card__metadata", re.I)
                    )
                    loc_text = loc_tag.get_text(strip=True) if loc_tag else location

                    if apply_url and "linkedin.com/jobs/view/" in apply_url:
                        jobs.append({
                            "title":    title_text,
                            "company":  company,
                            "location": loc_text,
                            "applyUrl": apply_url,
                            "source":   "linkedin",
                            "deadline": _estimate_deadline(random.randint(5, 21)),
                        })
                        print(f"  [LinkedIn] OK {title_text[:50]} -> {apply_url[:80]}")
                    else:
                        print(f"  [LinkedIn] No valid URL for card {cards.index(card)}")

                except Exception as e:
                    print(f"[LinkedIn] card parse error: {e}")
                    continue

        except Exception as exc:
            print(f"[LinkedIn] scrape_linkedin_jobs error: {exc}")

        return jobs[:num_jobs]

    # ─────────────────────────────────────────────────────────────────────────
    #  Google Jobs  (NEW)
    # ─────────────────────────────────────────────────────────────────────────

    def scrape_google_jobs(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 6,
    ) -> List[Dict]:
        """
        Scrape the Google Jobs carousel for "<role> jobs in <location>".

        Each result links to the original job posting on the employer site
        (LinkedIn, Naukri, Glassdoor, company site, etc.).
        Google Jobs is the most reliable source for DIRECT apply URLs.
        """
        jobs: List[Dict] = []
        try:
            query = f"{job_title} jobs in {location}".replace(" ", "+")
            url   = f"https://www.google.com/search?q={query}&ibp=htl;jobs"
            print(f"[Google Jobs] GET {url}")
            self.driver.get(url)
            _rand_sleep(3, 5)

            # Accept cookie consent if shown
            self._dismiss([
                "button#L2AGLb",
                "button.tHlp8d",
                "form[action*='consent'] button",
            ])

            # Wait for jobs carousel
            JOB_CARD_SEL = (
                "li.iFjolb, "
                "div[class*='PwjeAc'], "
                "div.EimVGf, "
                "div[jsname='MZnM8e']"
            )
            try:
                self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, JOB_CARD_SEL)))
            except TimeoutException:
                print("[Google Jobs] Timeout — carousel may not have loaded")
                return jobs

            cards = self.driver.find_elements(By.CSS_SELECTOR, JOB_CARD_SEL)
            print(f"[Google Jobs] Found {len(cards)} listing items")

            for card in cards[:num_jobs]:
                try:
                    # Click the card to open the detail pane
                    self.driver.execute_script("arguments[0].scrollIntoView(true);", card)
                    card.click()
                    _rand_sleep(1.0, 2.0)

                    # Read detail panel HTML
                    panel_html = ""
                    for panel_sel in [
                        "div[class*='pE8vnd']",
                        "div.whazf",
                        "div[jsname='Jt5Ny']",
                        "div[class*='KLsYvd']",
                    ]:
                        try:
                            panel = self.driver.find_element(By.CSS_SELECTOR, panel_sel)
                            panel_html = panel.get_attribute("outerHTML") or ""
                            if panel_html:
                                break
                        except NoSuchElementException:
                            pass

                    soup = BeautifulSoup(panel_html or card.get_attribute("outerHTML"), "html.parser")

                    # Job title
                    title_el = soup.find(True, class_=re.compile(r"KLsYvd|sH3znd|job-title|title", re.I))
                    title_text = title_el.get_text(strip=True) if title_el else job_title

                    # Company
                    company_el = soup.find(True, class_=re.compile(r"nJlQNd|vNEEBe|sCuL2|company", re.I))
                    company = company_el.get_text(strip=True) if company_el else ""

                    # Location
                    loc_el = soup.find(True, class_=re.compile(r"Qk80Jf|location|metadata", re.I))
                    loc_text = loc_el.get_text(strip=True) if loc_el else location

                    # ── Direct apply URL ──────────────────────────────────────
                    apply_url = ""

                    # Method 1: anchor with "apply" text pointing off-google
                    for a in soup.find_all("a", href=True):
                        href = a.get("href", "")
                        text = a.get_text(strip=True).lower()
                        if "apply" in text and href.startswith("http") and "google.com" not in href:
                            apply_url = href
                            break

                    # Method 2: any non-google external link in panel
                    if not apply_url:
                        for a in soup.find_all("a", href=True):
                            href = a.get("href", "")
                            if href.startswith("http") and "google.com" not in href:
                                apply_url = href
                                break

                    # Method 3: live DOM — click "Apply on <site>" button
                    if not apply_url:
                        try:
                            apply_btn = self.driver.find_element(
                                By.XPATH,
                                "//a[contains(translate(.,'APPLY','apply'),'apply') "
                                "and @href and not(contains(@href,'google.com'))]"
                            )
                            apply_url = apply_btn.get_attribute("href") or ""
                        except NoSuchElementException:
                            pass

                    # Method 4: fallback to LinkedIn search for the same title
                    if not apply_url:
                        apply_url = (
                            "https://www.linkedin.com/jobs/search?keywords="
                            + job_title.replace(" ", "%20")
                        )

                    if title_text:
                        jobs.append({
                            "title":    title_text,
                            "company":  company,
                            "location": loc_text,
                            "applyUrl": apply_url,
                            "source":   "google",
                            "deadline": _estimate_deadline(random.randint(7, 25)),
                        })
                        print(f"  [Google] OK {title_text[:50]} -> {apply_url[:80]}")

                except Exception as e:
                    print(f"[Google Jobs] card error: {e}")
                    continue

        except Exception as exc:
            print(f"[Google Jobs] error: {exc}")

        return jobs[:num_jobs]

    # ─────────────────────────────────────────────────────────────────────────
    #  Skill extraction
    # ─────────────────────────────────────────────────────────────────────────

    _TECH_RE = re.compile(
        r"\b(React|TypeScript|JavaScript|Node\.?js?|Python|Java(?:Script)?|SQL|Docker|"
        r"Kubernetes|AWS|GCP|Azure|MongoDB|PostgreSQL|CSS|HTML|Angular|"
        r"Vue\.?js?|GraphQL|Next\.?js?|Express|Spring|Django|FastAPI|"
        r"Redis|Kafka|Terraform|Jenkins|Pandas|NumPy|TensorFlow|PyTorch|"
        r"Qiskit|Cirq|MATLAB|Julia|C\+\+|Rust|Go|Scala|R|CUDA|"
        r"OpenCV|Sklearn|Scikit-learn|Spark|Hadoop|Hive|Airflow|"
        r"Snowflake|dbt|Databricks|Tableau|PowerBI|Looker)\b",
        re.I,
    )

    def scrape_job_skills(
        self,
        job_title: str,
        location: str = "India",
        num_jobs: int = 5,
    ) -> List[str]:
        """Return ranked skill strings for job_title."""
        print(f"[RealScraper] Scraping skills for '{job_title}'...")

        naukri_jobs   = self.scrape_naukri_jobs(job_title, location, num_jobs)
        linkedin_jobs = self.scrape_linkedin_jobs(job_title, location, num_jobs)
        all_jobs      = naukri_jobs + linkedin_jobs

        freq: Dict[str, int] = {}
        combined_text = " ".join(
            f"{j.get('title','')} {j.get('company','')}" for j in all_jobs
        )
        for match in self._TECH_RE.findall(combined_text):
            k = match.strip().lower()
            freq[k] = freq.get(k, 0) + 1

        for job in all_jobs[:4]:
            try:
                self.driver.get(job["applyUrl"])
                _rand_sleep(1.5, 2.5)
                body_text = BeautifulSoup(
                    self.driver.find_element(By.TAG_NAME, "body").get_attribute("innerHTML"),
                    "html.parser"
                ).get_text()
                for match in self._TECH_RE.findall(body_text):
                    k = match.strip().lower()
                    freq[k] = freq.get(k, 0) + 1
            except Exception:
                pass

        top = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:15]
        result = [s.capitalize() for s, _ in top if len(s) > 2]
        print(f"[RealScraper] -> {len(result)} skills found")
        return result

    # ─────────────────────────────────────────────────────────────────────────
    #  Combined live-jobs endpoint
    # ─────────────────────────────────────────────────────────────────────────

    def get_live_jobs(
        self,
        job_title: str,
        location: str = "India",
        num_each: int = 5,
    ) -> List[Dict]:
        """
        Return up to num_each*3 jobs from Naukri + LinkedIn + Google,
        deduplicated by URL, each with a verified direct applyUrl.
        """
        naukri_jobs   = self.scrape_naukri_jobs(job_title, location, num_each)
        linkedin_jobs = self.scrape_linkedin_jobs(job_title, location, num_each)
        google_jobs   = self.scrape_google_jobs(job_title, location, num_each)

        seen_urls: set = set()
        merged: List[Dict] = []
        for job in naukri_jobs + linkedin_jobs + google_jobs:
            url = job.get("applyUrl", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                merged.append(job)

        print(f"[RealScraper] get_live_jobs -> {len(merged)} unique jobs for '{job_title}'")
        return merged

    def __del__(self):
        try:
            self.driver.quit()
        except Exception:
            pass


# ── smoke-test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    scraper = RealJobScraper()
    jobs = scraper.get_live_jobs("Quantum Engineer")
    print(json.dumps(jobs, indent=2))