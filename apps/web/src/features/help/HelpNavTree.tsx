import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t, useLabels } from '../../i18n/labels.js';
import { helpDocPathActive } from './HelpDocPage.js';
import { helpPathFromSlug } from './help-registry.js';
import {
  helpNavItemContainsSlug,
  helpNavItemKey,
  helpNavItemLabel,
  helpPathSlug,
  type HelpNavItem,
} from './help-nav.js';

function HelpNavNode({
  item,
  pathname,
  depth = 0,
}: {
  item: HelpNavItem;
  pathname: string;
  depth?: number;
}) {
  const labels = useLabels();
  const currentSlug = helpPathSlug(pathname);
  const hasChildren = (item.children?.length ?? 0) > 0;
  const containsActive = hasChildren && helpNavItemContainsSlug(item, currentSlug);
  const itemKey = helpNavItemKey(item);
  const [open, setOpen] = useState(containsActive || depth === 0);

  useEffect(() => {
    if (containsActive) {
      setOpen(true);
    }
  }, [containsActive]);

  if (!hasChildren) {
    if (item.slug === undefined) {
      return null;
    }
    const path = helpPathFromSlug(item.slug);
    const active = helpDocPathActive(item.slug, pathname);
    return (
      <li>
        <Link
          className={`help-center-nav-link${active ? ' is-active' : ''}`}
          to={path}
        >
          {helpNavItemLabel(item, labels)}
        </Link>
      </li>
    );
  }

  return (
    <li className="help-center-nav-group">
      <div className="help-center-nav-group-head">
        <button
          type="button"
          className="help-center-nav-toggle"
          aria-expanded={open}
          aria-label={open ? t(labels, 'help.nav.collapse') : t(labels, 'help.nav.expand')}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '▾' : '▸'}
        </button>
        <span className="help-center-nav-group-label">{helpNavItemLabel(item, labels)}</span>
      </div>
      {open && (
        <ul className="help-center-nav-children">
          {item.children!.map((child) => (
            <HelpNavNode
              key={helpNavItemKey(child)}
              item={child}
              pathname={pathname}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HelpNavTree({ pathname, items }: { pathname: string; items: HelpNavItem[] }) {
  return (
    <ul className="help-center-nav-list">
      {items.map((item) => (
        <HelpNavNode key={helpNavItemKey(item)} item={item} pathname={pathname} />
      ))}
    </ul>
  );
}
