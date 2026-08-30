const GITHUB_USER = 'chmk26'; 
const GITHUB_REPO = 'chmk26.github.io'; 
const BRANCH = 'main';

const GA_MEASUREMENT_ID = 'G-1XTL7HDE9T'; // GA4 측정 ID로 교체하세요.

function trackPageView(pageTitle = document.title, pagePath = window.location.pathname + window.location.search) {
  if (typeof gtag !== 'function') return;

  gtag('event', 'page_view', {
    page_title: pageTitle,
    page_path: pagePath,
    page_location: window.location.href
  });
}

let postsData = [];
let foldersData = {};
let currentFolder = 'all';
let currentSubfolder = 'all';
let currentTag = 'all';
let searchKeyword = '';
let currentSort = 'latest';

// 미니멀한 테마 아이콘 SVG 정의
const MOON_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const SUN_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initSidebarLogic();
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tag')) currentTag = urlParams.get('tag');
  if (urlParams.has('category')) currentFolder = urlParams.get('category');
  if (urlParams.has('subcategory')) currentSubfolder = urlParams.get('subcategory');

  const isPostDetailPage = !!document.getElementById('markdown-body');

  // 어느 페이지에서든 사이드바 데이터를 구성하기 위해 공통 호출
  fetchPostsFromGithub();

  // 목록 페이지는 바로 page_view를 보내고, 상세 페이지는 마크다운 제목을 읽은 뒤 renderPostDetail()에서 보냅니다.
  if (isPostDetailPage) {
    renderPostDetail();
  } else {
    trackPageView('Archive', window.location.pathname + window.location.search);
  }
});

function initThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'dark';
  
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggleBtn.innerHTML = savedTheme === 'light' ? SUN_ICON : MOON_ICON;

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggleBtn.innerHTML = newTheme === 'light' ? SUN_ICON : MOON_ICON;
  });
}

function initSidebarLogic() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const closeBtn = document.getElementById('sidebar-close');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const openSidebar = () => {
    sidebar.classList.add('active');
    overlay.classList.add('active');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  };

  if(toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  if(closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if(overlay) overlay.addEventListener('click', closeSidebar);
}

async function fetchPostsFromGithub() {
  try {
    const treeUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
    const response = await fetch(treeUrl);
    const data = await response.json();
    
    const mdFiles = data.tree.filter(item => item.path.startsWith('posts/') && item.path.endsWith('.md'));
    const fetchPromises = mdFiles.map(file => fetchRawMarkdown(file.path));
    postsData = (await Promise.all(fetchPromises)).filter(p => p !== null);
    
    buildFolderStructure();
    initFolderMenu();
    initTagsCloud();
    updateSubfolderButtons();
    setupFilters();
    renderPosts();
  } catch (error) {
    const grid = document.getElementById('posts-grid');
    if(grid) {
      grid.innerHTML = '<p>데이터를 불러오지 못했습니다. Github 설정을 확인해주세요.</p>';
    }
  }
}

async function fetchRawMarkdown(filePath) {
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${filePath}`;
  const res = await fetch(rawUrl);
  const text = await res.text();
  
  const frontmatterRegex = /^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]([\s\S]*)$/;
  const match = text.match(frontmatterRegex);
  if (!match) return null;

  let meta = {};
  let currentKey = null;

  match[1].split('\n').forEach(line => {
    const trimmed = line.trim();

    // tags:
    //   - ROS2
    //   - Lyrical
    if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(trimmed.slice(2).trim().replace(/['"]/g, ''));
      return;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();

      currentKey = key;

      if (val === '') {
        meta[key] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
      } else {
        meta[key] = val.replace(/['"]/g, '');
      }
    }
  });

  const pathParts = filePath.split('/');
  meta.folder = pathParts.length > 2 ? pathParts[1] : 'Uncategorized';
  meta.subfolder = pathParts.length > 3 ? pathParts[2] : 'General';
  meta.categories = pathParts.length > 2 ? pathParts.slice(1, -1) : [];
  meta.id = pathParts[pathParts.length - 1].replace('.md', '');
  meta.filePath = filePath;
  if(!meta.date) meta.date = '2020-01-01';
  if(!meta.title) meta.title = meta.id;
  
  return meta;
}

function buildFolderStructure() {
  foldersData = {};
  postsData.forEach(post => {
    if (!foldersData[post.folder]) foldersData[post.folder] = { count: 0, subfolders: new Set() };
    foldersData[post.folder].count++;
    foldersData[post.folder].subfolders.add(post.subfolder);
  });
}

function initFolderMenu() {
  const container = document.getElementById('folder-list-container');
  if(!container) return;

  container.innerHTML = `
    <div class="folder-item ${currentFolder === 'all' ? 'active' : ''}" onclick="selectFolder('all')">
      <span>All Posts</span>
      <span class="folder-count">${postsData.length}</span>
    </div>
  `;
  
  Object.keys(foldersData).forEach(folder => {
    const div = document.createElement('div');
    div.className = `folder-item ${currentFolder === folder ? 'active' : ''}`;
    div.innerHTML = `<span>${folder}</span><span class="folder-count">${foldersData[folder].count}</span>`;
    div.onclick = () => selectFolder(folder);
    container.appendChild(div);
  });
}

function selectFolder(folder) {
  currentFolder = folder;
  currentSubfolder = 'all';
  initFolderMenu();
  updateSubfolderButtons();
  renderPosts();
}

function updateSubfolderButtons() {
  const subContainer = document.getElementById('subfolder-buttons');
  if (!subContainer) return;
  subContainer.innerHTML = '';
  if (currentFolder === 'all' || !foldersData[currentFolder]) { subContainer.style.display = 'none'; return; }

  const subfolders = ['all', ...Array.from(foldersData[currentFolder].subfolders)];
  if (subfolders.length > 1) { 
    subContainer.style.display = 'flex';
    subfolders.forEach(sub => {
      const btn = document.createElement('button');
      btn.className = `sub-btn ${sub === 'all' ? 'active' : ''}`;
      btn.textContent = sub === 'all' ? 'All' : sub;
      btn.onclick = () => {
        currentSubfolder = sub;
        document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderPosts();
      };
      subContainer.appendChild(btn);
    });
  } else { subContainer.style.display = 'none'; }
}

function initTagsCloud() {
  const tagContainer = document.getElementById('all-tags-cloud');
  if(!tagContainer) return;

  let allTags = [];
  postsData.forEach(p => { if (p.tags) allTags.push(...p.tags); });
  const uniqueTags = ['all', ...new Set(allTags)];
  
  tagContainer.innerHTML = '';
  uniqueTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = `tag-btn ${tag === currentTag ? 'active' : ''}`;
    btn.textContent = tag === 'all' ? '#All' : `#${tag}`;
    btn.onclick = () => {
      currentTag = tag;
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPosts();
    };
    tagContainer.appendChild(btn);
  });
}

function setupFilters() {
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');

  if(searchInput) {
    searchInput.addEventListener('input', (e) => { searchKeyword = e.target.value.toLowerCase(); renderPosts(); });
  }
  if(sortSelect) {
    sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; renderPosts(); });
  }
}

function renderPosts() {
  const grid = document.getElementById('posts-grid');
  if(!grid) return;
  grid.innerHTML = '';

  let filtered = postsData.filter(post => {
    return (currentFolder === 'all' || post.folder === currentFolder) &&
           (currentSubfolder === 'all' || post.subfolder === currentSubfolder) &&
           (currentTag === 'all' || (post.tags && post.tags.includes(currentTag))) &&
           (post.title.toLowerCase().includes(searchKeyword) || (post.summary && post.summary.toLowerCase().includes(searchKeyword)));
  });

  filtered.sort((a, b) => {
    if (currentSort === 'latest') return new Date(b.date) - new Date(a.date);
    if (currentSort === 'oldest') return new Date(a.date) - new Date(b.date);
    return a.title.localeCompare(b.title, 'ko');
  });

  if(filtered.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);">조건에 맞는 게시글이 없습니다.</p>';
    return;
  }

  filtered.forEach(post => {
    const card = document.createElement('a');
    card.href = `post.html?file=${encodeURIComponent(post.filePath)}`;
    card.className = 'card';
    card.innerHTML = `
      <div class="card-category">${post.folder} > ${post.subfolder}</div>
      <h2 class="card-title">${post.title}</h2>
      <p class="card-summary">${post.summary || ''}</p>
      <div class="card-footer">
        <span>${post.date}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function renderPostDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const filePath = urlParams.get('file');
  if (!filePath) return;

  try {
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${filePath}`;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error();
    const text = await res.text();
    
    const match = text.match(/^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]([\s\S]*)$/);
    let mdBody = text;
    let meta = { title: "Untitled", date: "", tags: [] };

    if (match) {
      mdBody = match[2];
      let currentKey = null;
      match[1].split('\n').forEach(line => {
        const trimmed = line.trim();

        if (trimmed.startsWith('- ') && currentKey) {
          if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
          meta[currentKey].push(trimmed.slice(2).trim().replace(/['"]/g, ''));
          return;
        }

        const colonIdx = line.indexOf(':');
        if (colonIdx > -1) {
          const key = line.slice(0, colonIdx).trim();
          let val = line.slice(colonIdx + 1).trim();

          currentKey = key;

          if (val === '') {
            meta[key] = [];
          } else if (val.startsWith('[') && val.endsWith(']')) {
            meta[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
          } else {
            meta[key] = val.replace(/['"]/g, '');
          }
        }
      });
    }

    const fileId = filePath.split('/').pop().replace('.md', '');
    document.title = `${meta.title} - Archive`;
    trackPageView(meta.title, `/post/${fileId}`);

    document.getElementById('post-header').innerHTML = `
      <h1>${meta.title}</h1>
      <div class="post-meta">
        <span>${meta.date}</span>
      </div>
    `;

    marked.setOptions({
      breaks: true,
    
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
      }
    });
    
    document.getElementById('markdown-body').innerHTML = marked.parse(mdBody);
    enhanceObsidianCallouts(document.getElementById('markdown-body'));
    
    document.querySelectorAll('.markdown-body pre').forEach(pre => {
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>`;
      
      btn.onclick = () => {
        const codeText = pre.querySelector('code').innerText;
        navigator.clipboard.writeText(codeText).then(() => {
          btn.innerHTML = '✔';
          setTimeout(() => {
            btn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path></svg>`;
          }, 2000);
        });
      };
      pre.appendChild(btn);
    });

    // 폴더 경로 자동 파싱
    const pathParts = filePath.split('/');
    const categories = pathParts.length > 2 ? pathParts.slice(1, -1) : [];

    const TAG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41 11 3.83V3H4v7h.83l9.58 9.59a2 2 0 0 0 2.82 0l3.36-3.36a2 2 0 0 0 0-2.82ZM7.5 8A1.5 1.5 0 1 1 7.5 5a1.5 1.5 0 0 1 0 3Z"/></svg>`;
    const FOLDER_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.75A1.75 1.75 0 0 1 4.75 5h4.1l1.8 2h8.6A1.75 1.75 0 0 1 21 8.75v8.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25v-10.5Z"/></svg>`;
    const CALENDAR_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2.75v2.5M17 2.75v2.5M4 8.25h16M5.5 4.75h13A1.5 1.5 0 0 1 20 6.25v12A1.5 1.5 0 0 1 18.5 19.75h-13A1.5 1.5 0 0 1 4 18.25v-12a1.5 1.5 0 0 1 1.5-1.5Z"/></svg>`;

    let metaHTML = '';

    if (meta.tags && meta.tags.length > 0) {
      metaHTML += `
        <div class="meta-row">
          <span class="meta-label">${TAG_ICON}<span>Tags</span></span>
          <div class="meta-list">
            ${meta.tags.map(tag => `<button class="post-meta-chip" onclick="window.location.href='index.html?tag=${encodeURIComponent(tag)}'">${escapeHTML(tag)}</button>`).join('')}
          </div>
        </div>`;
    }

    if (categories.length > 0) {
      metaHTML += `
        <div class="meta-row">
          <span class="meta-label">${FOLDER_ICON}<span>Categories</span></span>
          <div class="meta-list">
            ${categories.map((cat, index) => {
              const href = index === 0
                ? `index.html?category=${encodeURIComponent(cat)}`
                : `index.html?category=${encodeURIComponent(categories[0])}&subcategory=${encodeURIComponent(cat)}`;
              return `<button class="post-meta-chip" onclick="window.location.href='${href}'">${escapeHTML(cat)}</button>`;
            }).join('')}
          </div>
        </div>`;
    }

    if (meta.date) {
      metaHTML += `
        <div class="meta-row">
          <span class="meta-label">${CALENDAR_ICON}<span>Updated</span></span>
          <span class="meta-date">${escapeHTML(meta.date)}</span>
        </div>`;
    }

    document.getElementById('post-keywords').innerHTML = metaHTML;

  } catch {
    document.getElementById('markdown-body').innerHTML = '<p>게시글을 찾을 수 없습니다.</p>';
  }
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function enhanceObsidianCallouts(root) {
  if (!root) return;

  const labels = {
    note:'Note', abstract:'Abstract', summary:'Summary', tldr:'TL;DR',
    info:'Info', todo:'Todo', tip:'Tip', hint:'Hint', important:'Important',
    success:'Success', check:'Check', done:'Done', question:'Question',
    help:'Help', faq:'FAQ', warning:'Warning', caution:'Caution',
    attention:'Attention', failure:'Failure', fail:'Fail', missing:'Missing',
    danger:'Danger', error:'Error', bug:'Bug', example:'Example',
    quote:'Quote', cite:'Cite'
  };

  root.querySelectorAll('blockquote').forEach(blockquote => {
    const first = blockquote.querySelector(':scope > p:first-child');
    if (!first) return;

    const match = first.innerHTML.match(/^\[!([a-zA-Z0-9_-]+)\]([+-])?(?:\s+([^\n<]+))?/i);
    if (!match) return;

    const type = match[1].toLowerCase();
    const fold = match[2] || '';
    const customTitle = match[3] ? match[3].trim() : '';
    first.innerHTML = first.innerHTML.replace(match[0], '').trim();
    if (!first.textContent.trim() && !first.children.length) first.remove();

    const callout = document.createElement('aside');
    callout.className = `callout callout-${type}`;
    callout.dataset.callout = type;

    const header = document.createElement('div');
    header.className = 'callout-header';

    const title = document.createElement('div');
    title.className = 'callout-title';
    title.innerHTML = `${calloutIcon(type)}<span>${escapeHTML(customTitle || labels[type] || type)}</span>`;
    header.appendChild(title);

    const body = document.createElement('div');
    body.className = 'callout-content';
    while (blockquote.firstChild) body.appendChild(blockquote.firstChild);

    callout.appendChild(header);
    callout.appendChild(body);

    if (fold) {
      callout.classList.add('is-foldable');
      if (fold === '-') callout.classList.add('is-collapsed');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'callout-toggle';
      toggle.setAttribute('aria-label', 'Toggle callout');
      toggle.innerHTML = `<svg viewBox="0 0 24 24"><path d="m8 10 4 4 4-4"/></svg>`;
      header.appendChild(toggle);
      header.addEventListener('click', () => callout.classList.toggle('is-collapsed'));
    }

    blockquote.replaceWith(callout);
  });
}

function calloutIcon(type) {
  const group = {
    abstract:'list', summary:'list', tldr:'list',
    info:'info', todo:'check', tip:'bulb', hint:'bulb', important:'bulb',
    success:'check', check:'check', done:'check',
    question:'question', help:'question', faq:'question',
    warning:'warning', caution:'warning', attention:'warning',
    failure:'x', fail:'x', missing:'x', danger:'warning', error:'warning',
    bug:'bug', example:'list', quote:'quote', cite:'quote'
  }[type] || 'note';

  const paths = {
    note:'<path d="M6 3.75h9l3 3v13.5H6V3.75Zm8.5.5v3h3"/>',
    list:'<path d="M5 6h14M5 10.5h14M5 15h9M5 19h7"/>',
    info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v6M12 7.5h.01"/>',
    check:'<circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16.5 9"/>',
    bulb:'<path d="M9 18.25h6M10 21h4M8.25 14.5a6 6 0 1 1 7.5 0c-1.1.8-1.5 1.6-1.5 2.5h-4.5c0-.9-.4-1.7-1.5-2.5Z"/>',
    question:'<circle cx="12" cy="12" r="8.5"/><path d="M9.75 9.25A2.5 2.5 0 0 1 12.2 7c1.55 0 2.8.95 2.8 2.4 0 1.75-1.45 2.2-2.3 2.75-.55.35-.7.7-.7 1.35M12 17h.01"/>',
    warning:'<path d="M10.6 4.4 3.7 17a2 2 0 0 0 1.75 3h13.1a2 2 0 0 0 1.75-3L13.4 4.4a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9v4M12 16.5h.01"/>',
    x:'<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
    bug:'<path d="M8 9h8v7a4 4 0 0 1-8 0V9Zm2-3.5h4M12 5.5V3M5 11h3M16 11h3M5 15h3M16 15h3"/>',
    quote:'<path d="M6.5 8.5H10v4H7.5c0 2-.75 3.5-2.25 4.5M14 8.5h3.5v4H15c0 2-.75 3.5-2.25 4.5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[group]}</svg>`;
}
