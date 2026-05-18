#!/usr/bin/env python3
"""
Scrape X (Twitter) trending topics by country from public trend pages.

Default source:
  https://trends24.in

Usage examples:
  python scripts/scrape_trending_topics.py
  python scripts/scrape_trending_topics.py --countries USA UK India --limit 11
  python scripts/scrape_trending_topics.py --output data/trends_by_country.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://trends24.in"
DEFAULT_COUNTRIES = ["USA", "UK", "Canada", "India", "Nigeria"]
DEFAULT_OUTPUT = "data/trends_by_country.json"

COUNTRY_SLUGS = {
    "USA": "united-states",
    "US": "united-states",
    "United States": "united-states",
    "UK": "united-kingdom",
    "United Kingdom": "united-kingdom",
}


@dataclass
class CountryTrends:
    country: str
    slug: str
    topics: List[str]
    hashtags: List[str]
    regular_topics: List[str]
    timeline_timestamp: Optional[str]
    source_url: str
    source_selector: str


def country_to_slug(country: str) -> str:
    mapped = COUNTRY_SLUGS.get(country.strip())
    if mapped:
        return mapped
    lowered = country.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")


def build_headers() -> Dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        )
    }


def fetch_html(
    url: str, headers: Dict[str, str], timeout: int = 20, retries: int = 2
) -> str:
    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        try:
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            return response.content.decode("utf-8", errors="replace")
        except Exception as err:  # noqa: BLE001
            last_err = err
            if attempt < retries:
                time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}") from last_err


def parse_timeline_timestamp(value: str) -> Optional[datetime]:
    cleaned = value.split(" (", 1)[0].strip()
    try:
        return datetime.strptime(cleaned, "%a %b %d %Y %H:%M:%S GMT%z")
    except ValueError:
        return None


def parse_country_topics(html: str, scan_limit: int) -> tuple[Optional[str], List[str]]:
    soup = BeautifulSoup(html, "html.parser")

    timeline_lists = soup.select("#timeline ol.trend-card__list")
    if not timeline_lists:
        timeline_lists = soup.select("ol.trend-card__list")

    chosen_list = None
    chosen_timestamp_text: Optional[str] = None
    chosen_timestamp_value: Optional[datetime] = None

    for block in timeline_lists:
        timestamp_header = block.find_previous("h3")
        timestamp_text = (
            timestamp_header.get_text(" ", strip=True) if timestamp_header else None
        )
        parsed_time = (
            parse_timeline_timestamp(timestamp_text) if timestamp_text else None
        )

        if chosen_list is None:
            chosen_list = block
            chosen_timestamp_text = timestamp_text
            chosen_timestamp_value = parsed_time
            continue

        if parsed_time and (
            chosen_timestamp_value is None or parsed_time > chosen_timestamp_value
        ):
            chosen_list = block
            chosen_timestamp_text = timestamp_text
            chosen_timestamp_value = parsed_time

    if chosen_list is not None:
        topics: List[str] = []
        for link in chosen_list.select("li .trend-name a.trend-link"):
            topic = link.get_text(" ", strip=True)
            if topic and topic not in topics:
                topics.append(topic)
            if len(topics) >= scan_limit:
                break
        return chosen_timestamp_text, topics

    return None, []


def scrape_country(
    country: str,
    headers: Dict[str, str],
    limit: int,
    timeout: int = 20,
    retries: int = 2,
) -> CountryTrends:
    slug = country_to_slug(country)
    url = f"{BASE_URL}/{slug}/"
    html = fetch_html(url, headers=headers, timeout=timeout, retries=retries)
    scan_limit = max(limit * 8, 50)
    timeline_timestamp, scraped_topics = parse_country_topics(html, scan_limit)

    topics = scraped_topics[:limit]
    hashtags = [topic for topic in scraped_topics if topic.startswith("#")][:limit]
    regular_topics = [topic for topic in scraped_topics if not topic.startswith("#")][
        :limit
    ]

    return CountryTrends(
        country=country,
        slug=slug,
        topics=topics,
        hashtags=hashtags,
        regular_topics=regular_topics,
        timeline_timestamp=timeline_timestamp,
        source_url=url,
        source_selector="ol.trend-card__list li .trend-name a.trend-link",
    )


def build_payload(results: List[CountryTrends]) -> Dict[str, object]:
    countries: Dict[str, object] = {}
    for item in results:
        countries[item.country] = {
            "slug": item.slug,
            "timeline_timestamp": item.timeline_timestamp,
            "topics": item.topics,
            "hashtags": item.hashtags,
            "regular_topics": item.regular_topics,
            "source_selector": item.source_selector,
            "source_url": item.source_url,
        }

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": "trends24.in (public web scrape)",
        "countries": countries,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape latest X trends by country from public web pages."
    )
    parser.add_argument(
        "--countries",
        nargs="+",
        default=DEFAULT_COUNTRIES,
        help="Country names/codes (default: USA UK Canada India Nigeria).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=11,
        help="Maximum number of topics per country (default: 11).",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Output JSON path (default: {DEFAULT_OUTPUT}).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout in seconds (default: 20).",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=2,
        help="Retry count for network errors (default: 2).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    headers = build_headers()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    results: List[CountryTrends] = []
    failed: List[str] = []

    for country in args.countries:
        try:
            item = scrape_country(
                country=country,
                headers=headers,
                limit=args.limit,
                timeout=args.timeout,
                retries=args.retries,
            )
            results.append(item)
            print(f"[ok] {country}: {len(item.topics)} topics")
        except Exception as err:  # noqa: BLE001
            failed.append(country)
            print(f"[error] {country}: {err}", file=sys.stderr)

    payload = build_payload(results)
    output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    print(f"\nSaved {len(results)} countries to {output_path}")

    if failed:
        print(f"Failed countries: {', '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
