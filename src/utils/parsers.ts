import * as tldts from 'tldts';

export function extractUrls(text: string): Array<{ url: string; normalized: string; isShortener: boolean }> {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls: Array<{ url: string; normalized: string; isShortener: boolean }> = [];

  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0];
    const normalized = normalizeUrl(url);
    const isShortener = isShortenerUrl(normalized);

    urls.push({ url, normalized, isShortener });
  }

  return urls;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    parsed.hash = '';
    parsed.search = '';

    if (parsed.protocol === 'https:') {
      parsed.protocol = 'http:';
    }

    if (parsed.hostname) {
      const domain = tldts.parse(parsed.hostname);
      if (domain.domain && domain.tld) {
        parsed.hostname = `${domain.domain}.${domain.tld}`;
      }
    }

    let normalized = parsed.toString();

    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized.toLowerCase();
  } catch (error) {
    return url;
  }
}

function isShortenerUrl(url: string): boolean {
  const shorteners = [
    'bit.ly', 'tinyurl.com', 't.co', 'youtu.be', 'short.ly', 'lnkd.in',
    'bit.do', 'sh.st', 'cl.ly', 'oli.cm', 'sub.ly', 'blog桥梁.com', 'tr.im',
    'smallr.webcam', 'filoops.in', 'glam.io', 'wlcm.io', 'shortest.link',
    'lnks.gy', 'vgy.me', 'qr.net', 'q.gs', 'po.st', 'multiurl.net',
    'cutt.ly', 'cut.url', 'cutmy.link', 'cutlinks.net', 'cuturl.net',
    'decenturl.com', 'digbylink.com', 'domainpop.com', 'dyo.gg',
    'eightpoints.com', 'embogg.in', 'entermediadb.io', 'excerpt.hk',
    'fal.gg', 'ff.ab', 'fixurl.com', 'forfu.com', 'freazzy.com',
    'go7k.net', 'go2.link', 'go2l.ink', 'go2see.link', 'go2url.com',
    'goaff.pro', 'godbed.com', 'gotodebate.com', 'goti.so', 'gtag.me',
    'hide.my', 'hm.baidu.com', 'hoplinkz.com', 'href.li', 'huffduff.it',
    'i-g.it', 'ibm.co', 'iconosquare.com', 'iconosquare.io', 'ikp.in',
    'instafollow.agency', 'instansverv.se', 'iremla.com', 'is.gd',
    'itechie.net', 'itln.us', 'ivee.ly', 'joemonster.org', 'jumpurl.com',
    'justyy.com', 'kproxy.com', 'kuuta.com', 'last-link.com', 'lat.ms',
    'lc.chat', 'liip.to', 'lingojam.com', 'linkbee.io', 'linkbun.ch',
    'linkd.in', 'linked.in', 'links.revive-nigeria.org', 'ln.is', 'lnkd.in',
    'lnk.gd', 'lnk.to', 'lnky.ink', 'lnurl.net', 'longurl.org',
    'lovely-mx.com', 'mad men', 'manage.se', 'me2.do', 'mega80.com',
    'mindef.ch', 'mixlr.com', 'mlb.com', 'moby.to', 'myurl.in',
    'myurlbox.com', 'n-north.com', 'namebench.googlehosted.com',
    'nctr.co', 'nice.pe', 'nice.pe', 'nodevh.com', 'notion.so',
    'notion.so', 'nsfw.link', 'onicador.com', 'onloadio.com',
    'open.spotify.com', 'open.spotify.com', 'open.spotify.com', 'opay.tw',
    'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw',
    'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw', 'opay.tw',
  ];

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  return shorteners.some(shortener => hostname === shortener || hostname.endsWith('.' + shortener));
}

export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#([\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef]+)(?![\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff00-\uffef])/giu;

  const hashtags: string[] = [];
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push(match[1].toLowerCase());
  }

  return hashtags;
}