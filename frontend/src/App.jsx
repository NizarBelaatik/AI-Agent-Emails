// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Generate from './pages/Generate';
import Emails from './pages/Emails';
import Scheduled from './pages/Scheduled';
import Campaigns from './pages/Campaigns';
import Templates from './pages/Templates';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />} > {/*element={<Layout />}*/}
          <Route index element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="recipients" element={<Import />} /> {/* Will create separate page later */}
          <Route path="generate" element={<Generate />} />
          <Route path="emails" element={<Emails />} />
          <Route path="scheduled" element={<Scheduled />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="templates" element={<Templates />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;