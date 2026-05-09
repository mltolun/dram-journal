#!/usr/bin/env python3
import os
import re
import sys
import json
import urllib.request
import urllib.error
from html import unescape
from urllib.parse import urlparse
from pathlib import Path

def load_env():
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key, value)

load_env()

SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
GEMINI_KEY = os.environ.get('GEMINI_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print('[error] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
    print('Make sure .env file exists with SUPABASE_SERVICE_KEY and VITE_SUPABASE_URL')
    sys.exit(1)


def http_get(url):
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read().decode('utf-8')
    except urllib.error.URLError as e:
        raise Exception(f'Request failed: {e}')


def attr(html, attr_name):
    pattern = rf'<meta[^>]+\s{re.escape(attr_name)}=["\']([^"\']+)["\']'
    match = re.search(pattern, html, re.IGNORECASE)
    return match.group(1) if match else ''


def decode_entities(text):
    return unescape(text)


def extract_fact(html, label):
    pattern = rf'{label}[\s\S]{{0,120}}?<p[^>]*class="h3"[^>]*>([^<]+)</p>'
    match = re.search(pattern, html, re.IGNORECASE)
    return decode_entities(match.group(1).strip()) if match else ''


def extract_distillery(html):
    pattern = r'Distillery[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)</p>'
    match = re.search(pattern, html, re.IGNORECASE)
    return decode_entities(match.group(1).strip()) if match else ''


def extract_all_facts(html):
    pattern = r'<p class="h3"[^>]*>([^<]+)</p>'
    matches = re.findall(pattern, html)
    return [decode_entities(m.strip()) for m in matches]


def scrape(url):
    print(f'[scraper] Fetching: {url}')
    html = http_get(url)

    raw_name = attr(html, 'property="og:title"') or ''
    if not raw_name:
        title_match = re.search(r'<title>([^<]+)', html)
        if title_match:
            raw_name = title_match.group(1).split('|')[0].strip()
    name = decode_entities(raw_name)

    facts = extract_all_facts(html)
    distillery_from_facts = None
    for i, v in enumerate(facts):
        if i > 0 and v not in ('Yes', 'No', 'Single Malt', 'Blended', 'Grain'):
            distillery_from_facts = v
            break

    abv = extract_fact(html, 'ABV').replace('%', '')
    if not abv:
        abv_match = re.search(r'ABV[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>(\d+)', html)
        if abv_match:
            abv = abv_match.group(1)

    country = extract_fact(html, 'Country') or ''
    type_str = extract_fact(html, 'Type') or ''
    distillery = extract_distillery(html) or distillery_from_facts or ''
    region = extract_fact(html, 'Region') or ''
    age_str = extract_fact(html, 'Age') or ''
    price_match = re.search(r'€(\d+)', html)
    price_str = price_match.group(1) if price_match else ''

    raw_locale = attr(html, 'property="og:locale"')
    locale_country = raw_locale.split('_').pop() if raw_locale else ''
    if not country and locale_country:
        locale_map = {'gb': 'United Kingdom', 'us': 'United States', 'jp': 'Japan', 'ie': 'Ireland'}
        country = locale_map.get(locale_country.lower(), locale_country)

    whisky_type = 'other'
    lower = (name + ' ' + country + ' ' + type_str).lower()
    if 'japanese' in lower or 'nippon' in lower or country == 'Japan':
        whisky_type = 'japanese'
    elif any(x in lower for x in ['scotch', 'speyside', 'islay', 'highland', 'lowland']):
        whisky_type = 'scotch'
    elif 'bourbon' in lower or 'tennessee' in lower or country == 'United States':
        whisky_type = 'bourbon'
    elif 'irish' in lower or country == 'Ireland':
        whisky_type = 'irish'
    elif type_str and 'blended' in type_str.lower():
        whisky_type = 'japanese'

    distillery_raw = distillery or None
    if not distillery_raw:
        known_distilleries = ['Hibiki', 'Yamazaki', 'Hakushu', 'Nikka', 'Macallan', 'Glenfiddich', 'Talisker', 'Lagavulin']
        for d in known_distilleries:
            if d in name:
                distillery_raw = d
                break

    price_band = None
    if price_str:
        try:
            num = float(price_str.replace(',', '.'))
            if num < 40:
                price_band = 'budget'
            elif num < 80:
                price_band = 'mid-range'
            elif num < 150:
                price_band = 'premium'
            elif num < 300:
                price_band = 'luxury'
            else:
                price_band = 'super-premium'
        except ValueError:
            pass

    print(f'[scraper] Parsed: name="{name}" distillery="{distillery}" country="{country}" type="{whisky_type}" abv="{abv}" price="{price_str}" price_band="{price_band}"')
    print(f'[scraper] Facts: [{", ".join(facts)}]')

    name_clean = re.sub(r'(Whisky Review|Whisky:|—)', '', name).strip()

    return {
        'name': name_clean,
        'distillery': distillery_raw,
        'country': country or None,
        'region': region or None,
        'type': whisky_type,
        'age': int(age_str) if age_str.isdigit() else None,
        'abv': float(abv) if abv else None,
        'price_band': price_band,
    }


def call_gemma(prompt):
    if not GEMINI_KEY:
        return None

    model = 'gemma-3-27b-it'
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}'

    payload = {
        'contents': [{'role': 'user', 'parts': [{'text': prompt}]}],
        'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 300, 'responseMimeType': 'application/json'}
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            if text:
                match = re.search(r'\{[\s\S]*\}', text)
                return json.loads(match.group(0)) if match else None
    except Exception as e:
        print(f'[gemma] Error: {e}')
    return None


def parse_flavor_response(parsed):
    if not parsed:
        return {}

    def clamp(v):
        return min(5, max(0, round(float(v or 0))))

    return {
        'nose': (parsed.get('nose') or '').strip(),
        'palate': (parsed.get('palate') or '').strip(),
        'dulzor': clamp(parsed.get('dulzor')),
        'ahumado': clamp(parsed.get('ahumado')),
        'cuerpo': clamp(parsed.get('cuerpo')),
        'frutado': clamp(parsed.get('frutado')),
        'especiado': clamp(parsed.get('especiado')),
    }


def supabase_insert(data):
    url = f'{SUPABASE_URL}/rest/v1/catalogue'
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    payload = json.dumps([data])

    req = urllib.request.Request(url, data=payload.encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        raise Exception(f'Insert failed: {e.code} - {error_body}')


def check_existing(name):
    url = f'{SUPABASE_URL}/rest/v1/catalogue?name=ilike.*%25{urllib.parse.quote(name)}%25&limit=1'
    headers = {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode('utf-8'))


def main():
    if len(sys.argv) < 2:
        print('Usage: python scripts/scrape_whisky.py <distilld-url>')
        sys.exit(1)

    url = sys.argv[1]
    data = scrape(url)

    existing = check_existing(data['name'])
    if existing:
        print(f'[scraper] Already exists in catalogue: "{existing[0]["name"]}" (id={existing[0]["id"]})')
        sys.exit(0)

    if GEMINI_KEY:
        parts = [data['name']]
        if data.get('distillery'):
            parts.append(f"by {data['distillery']}")
        if data.get('country'):
            parts.append(f"from {data['country']}")
        if data.get('age'):
            parts.append(f"aged {data['age']}")
        if data.get('abv'):
            parts.append(f"at {data['abv']}%")
        if data.get('type'):
            parts.append(f"style: {data['type']}")

        prompt = f'''You are an expert whisky taster. Provide tasting notes and flavor scores for:
{", ".join(parts)}.

Respond ONLY with a JSON object, no markdown, no explanation:
{{
  "nose": "2-4 aroma descriptors, comma separated",
  "palate": "2-4 taste descriptors, comma separated",
  "dulzor": <integer 0-5, sweetness>,
  "ahumado": <integer 0-5, smokiness>,
  "cuerpo": <integer 0-5, body/weight>,
  "frutado": <integer 0-5, fruitiness>,
  "especiado": <integer 0-5, spiciness>
}}'''

        print('[scraper] Calling Gemma for flavor profile…')
        flavor = call_gemma(prompt)
        if flavor:
            data.update(parse_flavor_response(flavor))
            data['status'] = True

    result = supabase_insert(data)
    print(f'[scraper] ✓ Added to catalogue: "{data["name"]}"')


if __name__ == '__main__':
    main()