import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { getLogger } from './logging';

const DEFAULT_URL = 'http://141.95.14.181:27047/mods.html?lang=en';

export type ModLink = { filename: string; url: string; size?: number };

export async function scrapeMods(pageUrl: string = DEFAULT_URL): Promise<ModLink[]> {
  const { data: html, status } = await axios.get(pageUrl, {
    timeout: 15000,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': pageUrl,
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (status >= 400) throw new Error(`Failed to load mods page (HTTP ${status})`);
  const $ = cheerio.load(html);
  const links: ModLink[] = [];
  const collect = (hrefVal: string | undefined, textForSize: string) => {
    const href = (hrefVal || '').trim(); if (!href) return;
    let absolute: string; try { absolute = new URL(href, pageUrl).toString(); } catch { return; }
    if (!/\.(zip|zipx)(\?|$)/i.test(absolute)) return;
    const filename = absolute.split('/').pop()!.split('?')[0];
    const sizeText = textForSize.match(/(\d+[\.,]?\d*)\s?(MB|KB|GB)/i)?.[0];
    let size: number | undefined;
    if (sizeText) {
      const n = parseFloat(sizeText.replace(',', '.'));
      if (/GB/i.test(sizeText)) size = Math.round(n * 1024 * 1024 * 1024);
      else if (/MB/i.test(sizeText)) size = Math.round(n * 1024 * 1024);
      else if (/KB/i.test(sizeText)) size = Math.round(n * 1024);
    }
    links.push({ filename, url: absolute, size });
  };
  $('a, link, [data-href], [src]').each((_i, el) => {
    const $el = $(el);
    collect($el.attr('href'), $el.text());
    collect($el.attr('data-href'), $el.text());
    collect($el.attr('src'), $el.text());
  });
  const rawMatches = (html.match(/href\s*=\s*"([^"]+\.(?:zip|zipx)(?:\?[^"#]*)?)"/gi) || []);
  for (const m of rawMatches) {
    const href = m.replace(/^[^\"]*"/, '').replace(/"$/, '');
    collect(href, '');
  }
  // Deduplicate by filename
  const dedup = new Map<string, ModLink>();
  for (const l of links) if (!dedup.has(l.filename)) dedup.set(l.filename, l);
  const result = Array.from(dedup.values());
  try { getLogger().info(`Scraped ${result.length} mod links`); } catch {}
  return result;
}


