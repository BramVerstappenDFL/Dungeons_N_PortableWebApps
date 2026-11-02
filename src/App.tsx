import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useActive } from './store/characters';
import { useTheme } from './ui/theme';
import { UpdatePrompt } from './ui/UpdatePrompt';
import { SheetScreen } from './screens/SheetScreen';
import { CreateScreen } from './screens/CreateScreen';
import { DamageScreen } from './screens/DamageScreen';
import { RestScreen } from './screens/RestScreen';
import { CombatScreen } from './screens/CombatScreen';
import { DiceScreen } from './screens/DiceScreen';
import { PackScreen } from './screens/PackScreen';
import { NotesScreen } from './screens/NotesScreen';
import { SpellBookScreen } from './screens/SpellBookScreen';
import { AboutScreen } from './screens/AboutScreen';

// Browser and status-bar colour: the `paper` token of each theme, matching the header.
const THEME_COLOR = { parchment: '#f8f0da', dungeon: '#231b14' };

export default function App() {
  const theme = useTheme();
  const active = useActive();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  return (
    <div className="app" data-theme={theme}>
      <Routes>
        <Route path="/new" element={<CreateScreen />} />
        <Route path="/about" element={<AboutScreen />} />
        {active ? (
          <>
            <Route path="/" element={<SheetScreen key={active.id} c={active} />} />
            <Route path="/damage" element={<DamageScreen c={active} />} />
            <Route path="/rest" element={<RestScreen key={active.id} c={active} />} />
            <Route path="/combat" element={<CombatScreen key={active.id} c={active} />} />
            <Route path="/dice" element={<DiceScreen key={active.id} c={active} />} />
            <Route path="/pack" element={<PackScreen key={active.id} c={active} />} />
            <Route path="/notes" element={<NotesScreen key={active.id} c={active} />} />
            <Route path="/spells" element={<SpellBookScreen c={active} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <Route path="*" element={<Navigate to="/new" replace />} />
        )}
      </Routes>
      <UpdatePrompt />
    </div>
  );
}
