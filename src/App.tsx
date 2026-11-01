import { NavLink, Route, Routes, Link, useParams } from 'react-router-dom';
import { CharacterList } from './pages/CharacterList';
import { CharacterEditor } from './pages/CharacterEditor';
import { CharacterSheet } from './pages/CharacterSheet';
import { About } from './pages/About';
import { RollToast } from './components/RollToast';
import { QuickRoll } from './components/QuickRoll';
import { InstallButton, UpdatePrompt } from './components/PwaControls';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" width={28} height={28} />
          <span>D&amp;D Assist</span>
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>Characters</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
        <InstallButton />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<CharacterList />} />
          <Route path="/new" element={<CharacterEditor key="new" />} />
          <Route path="/c/:id" element={<CharacterSheet />} />
          <Route path="/c/:id/edit" element={<EditRoute />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<CharacterList />} />
        </Routes>
      </main>
      <QuickRoll />
      <RollToast />
      <UpdatePrompt />
    </div>
  );
}

// Remount the editor per character so form state never leaks between characters.
function EditRoute() {
  const { id } = useParams();
  return <CharacterEditor key={id} />;
}
