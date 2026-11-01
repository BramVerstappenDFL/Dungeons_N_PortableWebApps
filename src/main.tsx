import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import '@fontsource/alegreya/400.css';
import '@fontsource/alegreya/500.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya/400-italic.css';
import '@fontsource/texturina/400.css';
import '@fontsource/texturina/600.css';
import '@fontsource/texturina/700.css';
import '@fontsource/uncial-antiqua/400.css';
import './styles/grimoire/tokens.css';
import './styles/grimoire/bundle.css';
import './styles/app.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
