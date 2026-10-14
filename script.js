/*
  Edit only this block when publishing the archive.
  Posts are Markdown files below postsRoot (or anywhere in the repository when it is empty).
*/
const SITE_CONFIG = {
  title: 'ARCHIVE',
  owner: 'chmk26',
  repository: 'chmk26.github.io',
  branch: 'main',
  // Leave empty when category folders (Study/, Projects/, …) are at repository root.
  // Set this to 'posts' only if all posts live inside a posts/ folder.
  postsRoot: '',
  attachmentsRoot: '_Attachments',
  ignoredFolders: ['_Attachments', '_Templates', '.obsidian'],
  ignoredFiles: ['README.md'],
  homePostLimit: 10
};

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.1A8.8 8.8 0 0 1 9.9 3.5 8.8 8.8 0 1 0 20.5 14.1Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

let posts = [];
let loadIssue = '';
let attachmentsByName = new Map();
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupTheme();
  setupSidebar();
  setupSearch();
  posts = await loadPosts();
  renderNavigation();
  if (loadIssue) { showLoadIssue(); return; }
  if (location.pathname.endsWith('post.html')) await renderPost();
  else renderListing();
}

function setupTheme() {
  const button = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('archive-theme');
  const preferred = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const paint = theme => {
    document.documentElement.dataset.theme = theme;
    button.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    button.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  };
  paint(saved || preferred);
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('archive-theme', next); paint(next);
  });
}

function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sidebar-scrim');
  const toggle = document.getElementById('sidebar-toggle');
  const setOpen = open => {
    document.body.classList.toggle('sidebar-closed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    scrim.classList.toggle('visible', open && innerWidth < 820);
  };
  if (innerWidth < 820) setOpen(false);
  toggle.addEventListener('click', () => setOpen(document.body.classList.contains('sidebar-closed')));
  scrim.addEventListener('click', () => setOpen(false));
  window.addEventListener('resize', () => { if (innerWidth >= 820) scrim.classList.remove('visible'); });
  sidebar.addEventListener('click', event => { if (event.target.closest('a') && innerWidth < 820) setOpen(false); });
}

function setupSearch() {
  document.getElementById('search-form').addEventListener('submit', event => {
    event.preventDefault();
    const query = document.getElementById('search-input').value.trim();
    location.href = `index.html?view=search${query ? `&q=${encodeURIComponent(query)}` : ''}`;
  });
}

async function loadPosts() {
  const { owner, repository, branch, postsRoot } = SITE_CONFIG;
  if (owner.startsWith('YOUR_') || repository.startsWith('YOUR_')) {
    loadIssue = 'setup'; return [];
  }
  try {
    const treeUrl = `https://api.github.com/repos/${owner}/${repository}/git/trees/${branch}?recursive=1`;
    const treeResponse = await fetch(treeUrl);
    if (!treeResponse.ok) throw new Error(`GitHub API: ${treeResponse.status}`);
    const { tree } = await treeResponse.json();
    indexAttachments(tree);
    const files = tree.filter(item => isPostFile(item.path));
    const results = await Promise.all(files.map(file => fetchPost(file.path)));
    return results.filter(Boolean);
  } catch (error) {
    loadIssue = error.message;
    return [];
  }
}

async function fetchPost(path) {
  const url = githubRawUrl(path);
  const response = await fetch(url);
  if (!response.ok) return null;
  const source = await response.text();
  const { data, body } = parseFrontmatter(source);
  const categories = postCategories(path);
  return {
    path, body, categories,
    title: data.title || basename(path),
    summary: data.summary || excerpt(body),
    date: String(data.date || '1970-01-01'),
    updated: String(data.updated || data.date || ''),
    tags: asList(data.tags)
  };
}

function isPostFile(path) {
  if (!/\.md$/i.test(path)) return false;
  const root = SITE_CONFIG.postsRoot.replace(/^\/+|\/+$/g, '');
  if (root && !path.startsWith(`${root}/`)) return false;
  const relative = root ? path.slice(root.length + 1) : path;
  if (SITE_CONFIG.ignoredFiles.includes(relative)) return false;
  return !relative.split('/').some(part => SITE_CONFIG.ignoredFolders.includes(part));
}

function postCategories(path) {
  const root = SITE_CONFIG.postsRoot.replace(/^\/+|\/+$/g, '');
  const relative = root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
  return relative.split('/').slice(0, -1);
}

/* `_Attachments` is indexed once so Obsidian embeds such as ![[diagram.png]]
   keep working even when the Markdown file only stores the filename. */
function indexAttachments(tree) {
  attachmentsByName = new Map();
  const root = `${SITE_CONFIG.attachmentsRoot}/`;
  tree.filter(item => item.type === 'blob' && item.path.startsWith(root)).forEach(item => {
    const name = decodeURIComponent(item.path.split('/').pop()).toLocaleLowerCase();
    const entries = attachmentsByName.get(name) || [];
    entries.push(item.path);
    attachmentsByName.set(name, entries);
  });
}

function parseFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: source };
  const data = {}; let current = null;
  match[1].split(/\r?\n/).forEach(line => {
    const list = line.match(/^\s*-\s+(.+)$/);
    if (list && current) { (data[current] ||= []).push(cleanValue(list[1])); return; }
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (!pair) return;
    current = pair[1];
    data[current] = pair[2] ? cleanValue(pair[2]) : [];
  });
  return { data, body: match[2] };
}

function cleanValue(value) { return value.trim().replace(/^['"]|['"]$/g, ''); }
function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (/^\[.*\]$/.test(value)) return value.slice(1, -1).split(',').map(cleanValue).filter(Boolean);
  return [value];
}
function basename(path) { return decodeURIComponent(path.split('/').pop().replace(/\.md$/i, '')).replace(/[-_]/g, ' '); }
function excerpt(body) { return body.replace(/```[\s\S]*?```/g, '').replace(/[#>*_`\[\]]/g, '').replace(/\n+/g, ' ').trim().slice(0, 150); }

function renderNavigation() {
  const categoryList = document.getElementById('category-list');
  categoryList.innerHTML = navLink('All Posts', posts.length, 'index.html?view=blog', !params.get('category'));
  const roots = [...new Set(posts.map(post => post.categories[0]).filter(Boolean))].sort(localeSort);
  roots.forEach(root => {
    const rootPosts = posts.filter(post => post.categories[0] === root);
    categoryList.insertAdjacentHTML('beforeend', `<div class="category-group">${navLink(root, rootPosts.length, categoryUrl(root), matchesCategory(root))}${secondLevel(root, rootPosts)}</div>`);
  });
  const tags = new Map();
  posts.forEach(post => post.tags.forEach(tag => tags.set(tag, (tags.get(tag) || 0) + 1)));
  document.getElementById('tag-list').innerHTML = [...tags.entries()].sort((a, b) => localeSort(a[0], b[0])).map(([tag, count]) => `<a class="tag-link" href="${tagUrl(tag)}">#${escapeHtml(tag)} <small>${count}</small></a>`).join('') || '<p class="muted">아직 태그가 없습니다.</p>';
}

function secondLevel(root, rootPosts) {
  const levels = [...new Set(rootPosts.map(post => post.categories[1]).filter(Boolean))].sort(localeSort);
  return levels.map(level => navLink(level, rootPosts.filter(post => post.categories[1] === level).length, categoryUrl(`${root}/${level}`), matchesCategory(`${root}/${level}`), 'subcategory')).join('');
}
function navLink(label, count, href, active, extra = '') { return `<a class="category-link ${extra} ${active ? 'is-active' : ''}" href="${href}"><span>${escapeHtml(label)}</span><small>${count}</small></a>`; }
function categoryUrl(category) { return `index.html?view=search&category=${encodeURIComponent(category)}`; }
function tagUrl(tag) { return `index.html?view=search&tag=${encodeURIComponent(tag)}`; }
function matchesCategory(category) { return params.get('category') === category; }

function renderListing() {
  const view = params.get('view') || 'home';
  const q = params.get('q') || '';
  const selected = filterPosts(q);
  document.title = `${view === 'home' ? 'Home' : view === 'blog' ? 'Blog' : 'Search'} · ${SITE_CONFIG.title}`;
  if (view === 'home') {
    app.innerHTML = `<section class="home-intro"><a class="home-profile" href="index.html" aria-label="ARCHIVE 홈"><span class="profile__avatar" aria-hidden="true">A</span><strong>ARCHIVE</strong><small>Study &amp; Project Notes</small></a><p class="eyebrow">PERSONAL KNOWLEDGE ARCHIVE</p><h1>배움과 작업의 흔적을<br>차분히 쌓아갑니다.</h1><p>Study, projects, and paper reviews.</p><a class="text-link" href="index.html?view=blog">모든 기록 보기 ${ICONS.arrow}</a></section><section class="listing-section"><div class="section-title"><div><p class="eyebrow">RECENT POSTS</p><h2>최근 기록</h2></div><a class="quiet-link" href="index.html?view=blog">All posts</a></div>${postList(selected.slice(0, SITE_CONFIG.homePostLimit), 'home-list')}</section>`;
  } else {
    const title = view === 'blog' ? 'All Posts' : searchTitle(q);
    app.innerHTML = `<section class="page-heading"><p class="eyebrow">${view === 'blog' ? `${posts.length} POSTS` : 'SEARCH RESULTS'}</p><h1>${title}</h1></section>${controls()}<section id="listing-results" class="${view === 'blog' ? 'post-grid' : 'search-list'}">${postList(sortPosts(selected), view === 'blog' ? 'post-grid' : 'search-list')}</section>`;
    setupSort(selected, view);
  }
}

function searchTitle(query) {
  if (params.get('tag')) return `#${params.get('tag')}`;
  if (params.get('category')) return params.get('category').split('/').join(' / ');
  return query ? `“${escapeHtml(query)}” 검색 결과` : 'Search archive';
}
function filterPosts(query = '') {
  const category = params.get('category'); const tag = params.get('tag'); const term = query.toLocaleLowerCase();
  return posts.filter(post => (!category || post.categories.join('/').startsWith(category)) && (!tag || post.tags.includes(tag)) && (!term || `${post.title} ${post.summary} ${post.body}`.toLocaleLowerCase().includes(term)));
}
function controls() { return `<div class="listing-controls"><p id="result-count" class="muted"></p><label class="sort-label">정렬 <select id="sort-select"><option value="latest">최신순</option><option value="oldest">오래된순</option><option value="title">이름순</option></select></label></div>`; }
function setupSort(selected, view) {
  const select = document.getElementById('sort-select');
  const render = () => { document.getElementById('listing-results').innerHTML = postList(sortPosts(selected, select.value), view === 'blog' ? 'post-grid' : 'search-list'); document.getElementById('result-count').textContent = `${selected.length} posts`; };
  select.addEventListener('change', render); render();
}
function sortPosts(items, mode = 'latest') { return [...items].sort((a, b) => mode === 'title' ? localeSort(a.title, b.title) : mode === 'oldest' ? dateValue(a.date) - dateValue(b.date) : dateValue(b.date) - dateValue(a.date)); }
function postList(items, className) { return items.length ? items.map(post => postCard(post, className)).join('') : document.getElementById('empty-template').innerHTML; }
function postCard(post, variant) {
  const category = post.categories.map((name, index) => `<a href="${categoryUrl(post.categories.slice(0, index + 1).join('/'))}">${escapeHtml(name)}</a>`).join('<span>/</span>') || 'Uncategorized';
  return `<article class="post-card ${variant === 'home-list' ? 'post-card--row' : ''}"><div class="post-card__main"><p class="post-category">${category}</p><h2><a href="post.html?file=${encodeURIComponent(post.path)}">${escapeHtml(post.title)}</a></h2><p class="post-summary">${escapeHtml(post.summary)}</p></div><time datetime="${escapeHtml(post.date)}">${formatDate(post.date)}</time></article>`;
}

async function renderPost() {
  const path = params.get('file');
  const post = posts.find(item => item.path === path);
  if (!post) { app.innerHTML = '<section class="notice"><p class="eyebrow">NOT FOUND</p><h1>게시글을 찾을 수 없습니다.</h1><p>주소 또는 저장소 설정을 확인해 주세요.</p></section>'; return; }
  document.title = `${post.title} · ${SITE_CONFIG.title}`;
  const preparedBody = prepareAttachments(post.body, post);
  const rendered = typeof marked !== 'undefined'
    ? DOMPurify.sanitize(marked.parse(preparedBody, { gfm: true, breaks: true }), { ADD_TAGS: ['video', 'source', 'iframe'], ADD_ATTR: ['controls', 'src', 'type', 'title', 'allowfullscreen', 'loading', 'target', 'rel'] })
    : `<p>${escapeHtml(preparedBody)}</p>`;
  app.innerHTML = `<header class="article-header"><nav class="breadcrumbs"><a href="index.html?view=blog">Archive</a>${post.categories.map((item, index) => `<span>/</span><a href="${categoryUrl(post.categories.slice(0, index + 1).join('/'))}">${escapeHtml(item)}</a>`).join('')}</nav><h1>${escapeHtml(post.title)}</h1>${post.summary ? `<p class="article-summary">${escapeHtml(post.summary)}</p>` : ''}<time datetime="${escapeHtml(post.date)}">Published ${formatDate(post.date)}</time></header><div class="markdown-body">${rendered}</div><footer class="article-footer"><div class="meta-item"><span>Tags</span><div>${post.tags.map(tag => `<a class="chip" href="${tagUrl(tag)}">#${escapeHtml(tag)}</a>`).join('') || '<em>—</em>'}</div></div><div class="meta-item"><span>Categories</span><div>${post.categories.map((category, index) => `<a class="chip" href="${categoryUrl(post.categories.slice(0, index + 1).join('/'))}">${escapeHtml(category)}</a>`).join('') || '<em>—</em>'}</div></div><div class="meta-item"><span>Updated</span><time datetime="${escapeHtml(post.updated)}">${post.updated ? formatDate(post.updated) : '—'}</time></div></footer>`;
}

function prepareAttachments(markdown, post) {
  // Obsidian wiki links: ![[file.png]], ![[file.mp4|caption]], [[paper.pdf]].
  let result = markdown.replace(/(!?)\[\[([^\]]+)\]\]/g, (whole, embed, content) => {
    const [target, label = ''] = content.split('|');
    const url = attachmentUrl(target.trim(), post);
    if (!url) return whole;
    return embed ? attachmentEmbed(url, label || filenameFromTarget(target)) : `[${label || filenameFromTarget(target)}](${url})`;
  });

  // Standard Markdown attachments: ![caption](_Attachments/.../image.png) and [PDF](...).
  result = result.replace(/(!?\[[^\]]*\]\()([^\s)]+)(\))/g, (whole, opening, target, closing) => {
    const url = attachmentUrl(target, post);
    if (!url) return whole;
    const label = opening.replace(/^!?\[/, '').replace(/\]\($/, '') || filenameFromTarget(target);
    return opening.startsWith('!') ? attachmentEmbed(url, label) : `${opening}${url}${closing}`;
  });
  return result;
}

function attachmentUrl(target, post) {
  const cleanTarget = target.trim().replace(/^<|>$/g, '');
  if (!cleanTarget || /^(https?:|data:|mailto:|#)/i.test(cleanTarget)) return null;
  const directPath = resolveAttachmentPath(cleanTarget, post);
  return directPath ? githubRawUrl(directPath) : null;
}

function resolveAttachmentPath(target, post) {
  const root = SITE_CONFIG.attachmentsRoot;
  const withoutFragment = target.split(/[?#]/)[0];
  let decoded;
  try { decoded = decodeURIComponent(withoutFragment); } catch { decoded = withoutFragment; }
  const normalised = decoded.replace(/\\/g, '/').replace(/^\.\//, '');

  // Explicit _Attachments paths, including relative paths written by Obsidian.
  const fromRoot = normalised.replace(/^\/+/, '');
  if (fromRoot.startsWith(`${root}/`)) return fromRoot;
  try {
    const relativePath = new URL(normalised, `https://archive.local/${post.path}`).pathname.replace(/^\//, '');
    if (relativePath.startsWith(`${root}/`)) return relativePath;
  } catch { /* A filename is handled below. */ }

  // Attachments Management commonly leaves a filename-only wiki embed.
  const filename = filenameFromTarget(normalised).toLocaleLowerCase();
  const matches = attachmentsByName.get(filename);
  if (!matches?.length) return null;
  const expected = `${root}/${post.categories.join('/')}/`;
  return matches.find(path => path.startsWith(expected)) || matches[0];
}

function attachmentEmbed(url, label) {
  const extension = url.split('?')[0].split('.').pop().toLocaleLowerCase();
  const safeLabel = escapeHtml(label || 'Attachment');
  if (['mp4', 'webm', 'ogg', 'mov'].includes(extension)) {
    return `<video class="attachment-video" controls preload="metadata" title="${safeLabel}"><source src="${url}" type="video/${extension === 'mov' ? 'quicktime' : extension}">이 브라우저는 영상을 재생할 수 없습니다.</video>`;
  }
  if (extension === 'pdf') {
    return `<iframe class="attachment-pdf" src="${url}" title="${safeLabel}"></iframe><p class="attachment-open"><a href="${url}" target="_blank" rel="noopener">PDF 열기: ${safeLabel}</a></p>`;
  }
  return `<img src="${url}" alt="${safeLabel}" loading="lazy">`;
}

function filenameFromTarget(target) { return target.split(/[\\/]/).pop().split('#')[0].trim(); }
function githubRawUrl(path) {
  const encodedPath = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `https://raw.githubusercontent.com/${SITE_CONFIG.owner}/${SITE_CONFIG.repository}/${SITE_CONFIG.branch}/${encodedPath}`;
}

function showLoadIssue() {
  if (loadIssue === 'setup') {
    app.innerHTML = '<section class="notice"><p class="eyebrow">SETUP REQUIRED</p><h1>아카이브를 연결해 주세요.</h1><p><code>script.js</code> 맨 위의 <code>SITE_CONFIG</code>에서 GitHub ID와 저장소 이름을 입력하면 <code>posts/</code> 폴더의 Markdown을 읽습니다.</p></section>';
    return;
  }
  app.innerHTML = `<section class="notice"><p class="eyebrow">CONNECTION ERROR</p><h1>게시글을 불러오지 못했습니다.</h1><p>${escapeHtml(loadIssue)}<br>GitHub 저장소 설정과 공개 여부를 확인해 주세요.</p></section>`;
}
function formatDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date) ? value : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(date); }
function dateValue(value) { const date = new Date(value); return Number.isNaN(date) ? 0 : date.valueOf(); }
function localeSort(a, b) { return String(a).localeCompare(String(b), 'ko'); }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]); }
