import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Import from './pages/Import';
import Imported from './pages/Imported';
import EmailGeneration from './pages/EmailGeneration';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Welcome – go to /import</div>} />
          <Route path="import" element={<Import />} />
          <Route path="imported" element={<Imported />} />
          <Route path="email-generation" element={<EmailGeneration />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
