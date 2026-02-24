import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Import from './pages/Import';
import EmailGeneration from './pages/EmailGeneration';
import Dashboard from './pages/Dashboard';

import SendEmails from './pages/EmailSender/SendEmails';
import BatchDetails from './pages/EmailSender/BatchDetails';

import EmailDispatcher from './pages/EmailDispatcher/EmailDispatcher';

function App() {
  return (
    <Router>
      <Routes>
          <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="email-generation" element={<EmailGeneration />} />
        

          <Route path="email-sender" element={<SendEmails />} />
          <Route path="/email-sender/batches/:id" element={<BatchDetails />} />

          <Route path="/email-dispatcher" element={<EmailDispatcher />} />


        </Route>
      </Routes>
    </Router>
  );
}

export default App;
