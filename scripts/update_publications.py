"""Adds new Andermann ML papers from PubMed to data/publications.json.
Runs automatically every Monday on GitHub (see .github/workflows/update-publications.yml),
or anytime from the repository's Actions tab -> "Update publications" -> Run workflow.
Only adds papers it doesn't already have; never deletes or edits ones people added by hand,
except that a bioRxiv preprint gets swapped for its journal version once that is published."""
import json, re, time, urllib.parse, urllib.request

AUTHOR = 'Andermann ML[Author]'
START_YEAR = 2024            # the hand-curated list covers everything before this
FILE = 'data/publications.json'
EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'andermannlab-site/1.0 (publications updater)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def norm(title):
    return re.sub(r'[^a-z0-9]', '', title.lower())[:80]


def main():
    data = json.load(open(FILE, encoding='utf-8'))
    papers = data['papers']
    known = {norm(p['citation']) for p in papers}
    known_titles = [re.sub(r'[^a-z0-9]', '', p['citation'].lower()) for p in papers]

    term = f'{AUTHOR} AND {START_YEAR}:3000[pdat]'
    ids = get(EUTILS + 'esearch.fcgi?' + urllib.parse.urlencode(
        {'db': 'pubmed', 'term': term, 'retmax': 200, 'retmode': 'json'}))['esearchresult']['idlist']
    if not ids:
        print('No PubMed results.'); return
    time.sleep(0.5)
    summ = get(EUTILS + 'esummary.fcgi?' + urllib.parse.urlencode(
        {'db': 'pubmed', 'id': ','.join(ids), 'retmode': 'json'}))['result']

    added = 0
    for pid in ids:
        s = summ.get(pid)
        if not s or 'Journal Article' not in s.get('pubtype', []) and 'Review' not in s.get('pubtype', []):
            continue
        title = s.get('title', '').rstrip('.')
        t = norm(title)
        if not t:
            continue
        doi = next((a['value'] for a in s.get('articleids', []) if a.get('idtype') == 'doi'), '')
        year = int((re.search(r'\d{4}', s.get('pubdate', '')) or re.search(r'\d{4}', s.get('epubdate', ''))).group())
        authors = ', '.join(a['name'] for a in s.get('authors', []) if a.get('authtype') == 'Author')
        journal = s.get('source', '')
        vol = s.get('volume', '')
        citation = f'{authors}. {title}. {journal}{" " + vol if vol else ""} ({year}).'
        entry = {'year': year, 'citation': citation, 'link': f'https://doi.org/{doi}' if doi else f'https://pubmed.ncbi.nlm.nih.gov/{pid}/'}

        # already listed (any version)?
        match = next((i for i, kt in enumerate(known_titles) if t[:60] and t[:60] in kt), None)
        if match is not None:
            old = papers[match]
            if 'biorxiv' in old['citation'].lower():       # preprint is now published: swap it
                papers[match] = entry
                print('Published version replaces preprint:', title)
            continue
        if t in known:
            continue
        papers.append(entry); known.add(t); known_titles.append(re.sub(r'[^a-z0-9]', '', citation.lower()))
        added += 1
        print('Added:', title)

    papers.sort(key=lambda p: -int(p['year']))
    json.dump(data, open(FILE, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'Done. {added} new paper(s).')


if __name__ == '__main__':
    main()
