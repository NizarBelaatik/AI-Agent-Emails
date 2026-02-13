import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Import from './pages/Import';
import EmailGeneration from './pages/EmailGeneration';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="email-generation" element={<EmailGeneration />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
