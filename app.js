/**
 * Dr. Reda Ali El-Sayed Attalla — Academic Portfolio Interactions
 * Implements responsive popover-to-inline nav, scrollspy, accessible tabs,
 * live publication filtering, and native <dialog> controls.
 */

(function () {
  'use strict';

  /* ========================================================================
     1. Responsive Header Navigation (Popover <-> Inline via ResizeObserver)
     ======================================================================== */
  const header = document.querySelector('.site-header');
  const headerInner = header?.querySelector('.header-inner');
  const menu = document.getElementById('site-menu');
  const menuButton = header?.querySelector('.menu-button');

  if (header && headerInner && menu && menuButton) {
    let lastWidth = header.getBoundingClientRect().width;
    let rafId = 0;

    const updateNavLayout = () => {
      const wasWide = header.classList.contains('is-wide');
      const wasOpen = !wasWide && menu.matches(':popover-open');

      header.classList.add('is-measuring', 'is-wide');
      menu.removeAttribute('popover');

      const fitsInline = headerInner.scrollWidth <= headerInner.clientWidth + 1;

      if (fitsInline) {
        header.classList.add('is-wide');
        menu.removeAttribute('popover');
        menuButton.setAttribute('aria-expanded', 'false');
      } else {
        header.classList.remove('is-wide');
        menu.setAttribute('popover', 'auto');
        if (wasOpen) {
          try {
            menu.showPopover();
          } catch {
            // Ignore if top-layer cannot reopen mid-resize
          }
        }
      }

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    // Initial measurement once fonts & layout settle
    updateNavLayout();
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateNavLayout);
    }

    const headerObserver = new ResizeObserver((entries) => {
      const currentWidth = entries[0]?.contentRect.width ?? header.getBoundingClientRect().width;
      const isCurrentlyWide = header.classList.contains('is-wide');
      if (isCurrentlyWide || currentWidth > lastWidth) {
        updateNavLayout();
      }
      lastWidth = currentWidth;
    });
    headerObserver.observe(header);

    const menuObserver = new ResizeObserver(() => {
      if (header.classList.contains('is-wide')) {
        updateNavLayout();
      }
    });
    menuObserver.observe(menu);

    menu.addEventListener('toggle', (event) => {
      if (!header.classList.contains('is-wide')) {
        menuButton.setAttribute('aria-expanded', String(event.newState === 'open'));
      }
    });

    // Close narrow popover when navigating to an in-page section
    menu.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (link && !header.classList.contains('is-wide') && menu.matches(':popover-open')) {
        menu.hidePopover();
      }
    });
  }

  /* ========================================================================
     2. Scrollspy (Native scroll-target-group + IntersectionObserver fallback)
     ======================================================================== */
  const navLinks = Array.from(document.querySelectorAll('#site-menu a[href^="#"]'));
  const observedSections = navLinks
    .map((link) => {
      const id = link.getAttribute('href').slice(1);
      return document.getElementById(id);
    })
    .filter(Boolean);

  if (navLinks.length > 0 && observedSections.length > 0) {
    if (CSS.supports('scroll-target-group: auto')) {
      const syncAriaCurrent = () => {
        const currentLink = document.querySelector('#site-menu a:target-current');
        navLinks.forEach((link) => {
          link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
        });
      };
      syncAriaCurrent();
      document.addEventListener('scrollend', syncAriaCurrent);
    } else {
      const sectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const activeId = `#${entry.target.id}`;
              navLinks.forEach((link) => {
                const isActive = link.getAttribute('href') === activeId;
                link.classList.toggle('target-current', isActive);
                link.setAttribute('aria-current', String(isActive));
              });
            }
          }
        },
        { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
      );
      observedSections.forEach((section) => sectionObserver.observe(section));
    }
  }

  /* ========================================================================
     3. Accessible Tabs with Find-in-Page (beforematch) & RTL Keyboard Nav
     ======================================================================== */
  const supportsFocusGroup = Object.hasOwn(HTMLElement.prototype, 'focusGroup');

  document.querySelectorAll('.tabs').forEach((tabsRoot) => {
    const tablist = tabsRoot.querySelector('[role="tablist"], [focusgroup]');
    const tabs = Array.from(tabsRoot.querySelectorAll('button[role="tab"]'));
    const panels = Array.from(tabsRoot.querySelectorAll(':scope > .tab-panels > [role="tabpanel"]'));

    if (!tablist || tabs.length === 0 || panels.length === 0) return;

    const selectTab = (targetTab, { focus = false, scrollTab = true } = {}) => {
      const targetId = targetTab.id;
      tabs.forEach((tab) => {
        const isSelected = tab === targetTab;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.toggleAttribute('focusgroupstart', isSelected);
        if (!supportsFocusGroup) {
          tab.tabIndex = isSelected ? 0 : -1;
        }
      });

      panels.forEach((panel) => {
        const isMatch = panel.getAttribute('aria-labelledby') === targetId;
        if (isMatch) {
          panel.removeAttribute('hidden');
          const hasFocusable = panel.querySelector('a, button, input, select, textarea, details, [tabindex]:not([tabindex="-1"])');
          if (!hasFocusable) {
            panel.tabIndex = 0;
          } else {
            panel.removeAttribute('tabindex');
          }
        } else {
          panel.hidden = 'until-found';
          panel.removeAttribute('tabindex');
        }
      });

      if (scrollTab) {
        targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      }
      if (focus) {
        targetTab.focus();
      }
    };

    // Initialize roving tabindex fallback when focusgroup is unsupported
    if (!supportsFocusGroup) {
      const initial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
      tabs.forEach((t) => {
        t.tabIndex = t === initial ? 0 : -1;
      });
    }

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('button[role="tab"]');
      if (tab && tabs.includes(tab)) {
        selectTab(tab);
      }
    });

    tablist.addEventListener('keydown', (event) => {
      const current = event.target.closest('button[role="tab"]');
      if (!current) return;
      const index = tabs.indexOf(current);
      if (index === -1) return;

      const isRtl = getComputedStyle(tablist).direction === 'rtl';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

      let nextIndex = -1;
      if (event.key === nextKey) nextIndex = (index + 1) % tabs.length;
      else if (event.key === prevKey) nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;

      if (nextIndex !== -1) {
        event.preventDefault();
        selectTab(tabs[nextIndex], { focus: true });
      }
    });

    // Sync tab selection when browser Find-in-Page reveals a hidden="until-found" panel
    tabsRoot.addEventListener('beforematch', (event) => {
      const matchedPanel = event.target.closest('[role="tabpanel"]');
      if (!matchedPanel) return;
      const tabId = matchedPanel.getAttribute('aria-labelledby');
      const matchingTab = tabs.find((t) => t.id === tabId);
      if (matchingTab) {
        selectTab(matchingTab, { scrollTab: true });
      }
    });
  });

  /* ========================================================================
     4. Publications Search & Language Filter
     ======================================================================== */
  const pubSearchInput = document.getElementById('pub-search');
  const pubFilterButtons = Array.from(document.querySelectorAll('.filter-pill[data-pub-filter]'));
  const pubCards = Array.from(document.querySelectorAll('.pub-card[data-pub-lang]'));
  const pubStatus = document.getElementById('pub-status');
  const pubEmpty = document.getElementById('pub-empty');

  if (pubSearchInput && pubCards.length > 0) {
    let activeFilter = 'all';

    const applyPubFilters = () => {
      const query = pubSearchInput.value.trim().toLowerCase();
      let visibleCount = 0;

      pubCards.forEach((card) => {
        const lang = card.dataset.pubLang || '';
        const text = card.textContent.toLowerCase();
        const matchesFilter = activeFilter === 'all' || lang === activeFilter;
        const matchesQuery = !query || text.includes(query);
        const show = matchesFilter && matchesQuery;

        card.hidden = !show;
        if (show) visibleCount += 1;
      });

      if (pubEmpty) {
        pubEmpty.hidden = visibleCount > 0;
      }
      if (pubStatus) {
        pubStatus.textContent = `يتم عرض ${visibleCount} من أصل ${pubCards.length} بحثاً علمياً منشوراً`;
      }
    };

    pubSearchInput.addEventListener('input', applyPubFilters);

    pubFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.pubFilter || 'all';
        pubFilterButtons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === btn));
        });
        applyPubFilters();
      });
    });
  }

  /* ========================================================================
     5. Native <dialog> Modal for Featured Research Paper Abstract
     ======================================================================== */
  const paperDialog = document.getElementById('paper-dialog');
  const openPaperBtn = document.getElementById('open-paper-dialog');

  if (paperDialog && openPaperBtn) {
    openPaperBtn.addEventListener('click', () => {
      paperDialog.showModal();
    });
  }
  /* ========================================================================
     6. Responsive Tables: label each cell so rows can stack as cards on phones
     ======================================================================== */
  document.querySelectorAll('.data-table').forEach((table) => {
    const labels = Array.from(table.querySelectorAll('thead th'), (th) => th.textContent.trim());
    table.setAttribute('role', 'table');
    table.querySelectorAll('thead, tbody').forEach((group) => group.setAttribute('role', 'rowgroup'));
    table.querySelectorAll('th').forEach((th) => th.setAttribute('role', 'columnheader'));
    table.querySelectorAll('tr').forEach((row) => {
      row.setAttribute('role', 'row');
      Array.from(row.querySelectorAll('td')).forEach((cell, i) => {
        cell.setAttribute('role', 'cell');
        if (labels[i]) cell.dataset.label = labels[i];
      });
    });
  });
})();
