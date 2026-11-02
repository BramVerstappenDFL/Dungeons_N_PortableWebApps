import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const TABS: [string, string, IconName][] = [
  ['/', 'Sheet', 'person'],
  ['/combat', 'Combat', 'swords'],
  ['/dice', 'Dice', 'd20'],
  ['/pack', 'Pack', 'pack'],
  ['/notes', 'Notes', 'notes'],
];

export function TabBar() {
  return (
    <nav aria-label="Main" className="tabbar">
      {TABS.map(([to, label, icon]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'tab is-on' : 'tab')}>
          <Icon name={icon} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
