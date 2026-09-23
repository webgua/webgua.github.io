'use strict';

/**
 * Lil'Log / PaperMod 版式适配
 *
 * Stellar 的模板在 node_modules 里，直接改模板会在重装依赖后丢失，
 * 所以用 after_render:html 在生成产物上做两件事：
 *
 *   1. 把首页 welcome 组件从顶栏搬到正文顶部
 *      —— PaperMod 的 <article class="first-entry home-info"> 位于 <main> 内，
 *         而 Stellar 把它渲染在左侧栏（顶栏）里，位置和宽度都不对。
 *   2. 注入阅读时长（复用 hexo-wordcount 注册的 min2read helper）
 *
 * 数据全部取自 filter 的 data.page（layout / permalink / content / posts），
 * 不靠 HTML 结构反推页面类型，也不依赖日期元素的具体标签名。
 * 理由见文件末尾的注释。
 *
 * 组件内容仍然来自 source/_data/widgets.yml，改那边即可生效。
 */

// 列表卡片的起始标签。Stellar 有的模板用双引号、有的用单引号写 class
// （例如归档页是 <a class='post fs14'>），所以两种引号都要接受
const CARD_OPEN_RE = /<a\b[^<>]*\bclass=(?:"[^"]*\bpost-card\b[^"]*"|'[^']*\bpost-card\b[^']*')[^<>]*>/gi;
const WELCOME_RE =
  /<widget\b[^<>]*\bclass="[^"]*\bwidget-wrapper\b[^"]*\bmarkdown\b[^"]*"[^<>]*>[\s\S]*?<\/widget>/;

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

/**
 * 归一化成可比较的站点内路径：去掉 origin、丢弃 hash/query、
 * 还原百分号编码、统一首尾斜杠。
 *
 * 需要 decodeURIComponent 的原因：permalink 是 percent-encoded，
 * 而 Windows 上实际输出路径是明文中文，字面量不同但指向同一篇文章。
 */
function normalize(u) {
  if (!u) return '';
  let s = String(u).trim();
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/]+/, ''); // 去 origin
  s = s.split('#')[0].split('?')[0];
  try {
    s = decodeURIComponent(s);
  } catch (e) {
    /* 非法转义序列，保留原样 */
  }
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1 && !s.endsWith('/')) s += '/';
  return s;
}

/**
 * 取出 id="xxx" 元素的完整片段，返回 {start, end}。
 *
 * 不关心标签名是什么 —— 列表卡片里是 <span id="post-meta">，
 * 文章页里是 <div class="flex-row" id="post-meta">，同一个 id 两种标签。
 * 用开/闭标签计数处理嵌套，避免非贪婪正则遇到嵌套同名标签时提前截断。
 */
function findElementById(html, id, from) {
  // 必须带 g 标志，lastIndex = from 才会生效；
  // 否则 exec 永远从头匹配，多卡片场景会全部命中第一张卡片的 post-meta
  const openRe = new RegExp('<([a-zA-Z][a-zA-Z0-9]*)\\b[^<>]*?\\bid="' + id + '"[^<>]*>', 'g');
  openRe.lastIndex = from || 0;
  const open = openRe.exec(html);
  if (!open) return null;

  const tag = open[1].toLowerCase();
  const pairRe = new RegExp('<' + tag + '(?=[\\s/>])|</' + tag + '>', 'gi');
  pairRe.lastIndex = open.index + open[0].length;

  let depth = 1;
  let m;
  while ((m = pairRe.exec(html)) !== null) {
    if (m[0].charAt(1) === '/') {
      depth -= 1;
      if (depth === 0) return { start: open.index, end: m.index + m[0].length };
    } else {
      depth += 1;
    }
  }
  return null; // 标签未闭合，交给调用方跳过
}

/** 与 hexo-wordcount 的 min2read 一致，仅在其缺失时兜底 */
function fallbackMin2read(content) {
  const text = String(content || '').replace(/<[^>]*>/g, '');
  const cn = (text.match(/[\u4E00-\u9FA5]/g) || []).length;
  const en = (text.replace(/[\u4E00-\u9FA5]/g, '').match(/[a-zA-Z0-9_]+/g) || []).length;
  const t = cn / 300 + en / 160;
  return t < 1 ? 1 : Math.round(t);
}

function makeTimer(hexo) {
  return hexo.extend.helper.get('min2read') || fallbackMin2read;
}

function badge(min) {
  return '<span class="min2read">' + min + ' min</span>';
}

/**
 * 主题升级可能改掉 class 名或 DOM 结构，届时本脚本会静默失效
 * （页面照常生成，只是少了阅读时长）。这里主动告警，避免问题被忽略。
 */
const warned = new Set();
function warnOnce(msg) {
  if (warned.has(msg)) return;
  warned.add(msg);
  console.warn('[papermod] ' + msg);
}

/** page.posts 可能是 warehouse Query，也可能已经是数组 */
function toArray(posts) {
  if (!posts) return [];
  if (Array.isArray(posts)) return posts;
  if (typeof posts.toArray === 'function') return posts.toArray();
  if (Array.isArray(posts.data)) return posts.data;
  return [];
}

/* ------------------------------------------------------------------ *
 * 1) 首页欢迎语搬进正文
 * ------------------------------------------------------------------ */

function moveIntroToMain(html) {
  const w = WELCOME_RE.exec(html);
  if (!w) return html;

  const intro = '<article class="first-entry home-info">' + w[0] + '</article>';
  const rest = html.slice(0, w.index) + html.slice(w.index + w[0].length);

  const anchor = rest.indexOf('<div class="post-list');
  if (anchor >= 0) return rest.slice(0, anchor) + intro + rest.slice(anchor);

  const main = rest.indexOf('<div class="l_main"');
  if (main >= 0) {
    const at = rest.indexOf('>', main) + 1;
    return rest.slice(0, at) + intro + rest.slice(at);
  }
  return rest;
}

/* ------------------------------------------------------------------ *
 * 2) 阅读时长
 * ------------------------------------------------------------------ */

/** 列表页：给每张卡片注入 */
function injectIntoCards(html, posts, timer) {
  // permalink -> 分钟数
  const byPath = new Map();
  posts.forEach((p) => byPath.set(normalize(p.permalink), timer(p.content)));
  if (byPath.size === 0) return html;

  // 先收集每张卡片的起始位置；卡片 i 的作用范围到卡片 i+1 为止
  const starts = [];
  CARD_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = CARD_OPEN_RE.exec(html)) !== null) starts.push(m.index);
  if (starts.length === 0) return html;

  const edits = [];
  for (let i = 0; i < starts.length; i += 1) {
    const limit = i + 1 < starts.length ? starts[i + 1] : html.length;
    const range = findElementById(html, 'post-meta', starts[i]);
    if (!range || range.end > limit) continue;

    const card = html.slice(starts[i], limit);
    const href = (/href="([^"]*)"/.exec(card) || [])[1];
    const min = byPath.get(normalize(href));
    if (min == null) continue;

    edits.push({ at: range.end, snippet: badge(min) });
  }

  // 从后往前插，避免前面的插入影响后面的下标
  edits
    .sort((a, b) => b.at - a.at)
    .forEach((e) => {
      html = html.slice(0, e.at) + e.snippet + html.slice(e.at);
    });
  return html;
}

/* ------------------------------------------------------------------ *
 * Filter
 * ------------------------------------------------------------------ */

hexo.extend.filter.register('after_render:html', function (html, data) {
  if (!data || !data.page) return html;
  const page = data.page;
  const timer = makeTimer(this);

  if (data.path === 'index.html') html = moveIntroToMain(html);

  // 单篇文章：内容就在 page.content 上，直接算，不需要任何 URL 匹配
  if (page.layout === 'post') {
    const range = findElementById(html, 'post-meta');
    if (range) {
      html = html.slice(0, range.end) + badge(timer(page.content)) + html.slice(range.end);
    } else {
      warnOnce('文章页未找到 #post-meta，阅读时长未注入');
    }
    return html;
  }

  // 首页 / 分类页 / 标签页：文章集合就在 page.posts 上
  const posts = toArray(page.posts);
  if (posts.length) {
    const before = html;
    html = injectIntoCards(html, posts, timer);
    // 归档页用的是另一种紧凑列表（<a class='post fs14'>）且按 PaperMod 原版
    // 不显示阅读时长，所以这里只对首页做失效检查，避免误报
    if (data.path === 'index.html' && html === before) {
      warnOnce('首页未注入阅读时长 —— Stellar 的列表卡片 class 可能已变化，请检查 CARD_OPEN_RE');
    }
  }

  return html;
});

/**
 * 原先的三个坑为什么不复存在
 *
 * 1. 日期元素标签不一致 —— findElementById() 只认 id，span / div 都能定位，
 *    并用开闭标签计数处理嵌套，不再依赖写死标签名的正则。
 * 2. 页面类型判定 —— 直接读 data.page.layout 和 data.page.posts，
 *    不再用 class="bread-nav" 之类的字符串去嗅探（实际 class 是
 *    "top bread-nav footnote"，精确匹配必然漏）。
 * 3. URL 匹配 —— 分钟数直接从 page.content / page.posts[].content 算，
 *    permalink 取自 page 对象，不再由 data.path 反推。href 与 permalink
 *    比较时统一走 normalize()（去 origin + decode + 补尾斜杠）。
 *
 * 附带的好处：不再需要全局 Map、不再需要 hexo.locals / hexo.database 兜底、
 * 不再需要 before_generate 清缓存 —— 数据每页现取，server 模式下也不会读到旧值。
 */
