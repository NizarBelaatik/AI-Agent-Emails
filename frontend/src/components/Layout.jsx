// src/components/Layout.jsx
import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  Home, Users, Mail, FileText, Calendar, 
  Settings, BarChart, Clock, Layers, Database,
  Menu, X
} from 'lucide-react';

const Layout = () => {
  const [isOpen, setIsOpen] = useState(true);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/import', label: 'Import', icon: Database },
    { path: '/email-generation', label: 'Email Generation', icon: Mail },
    { path: '/email-sender', label: 'Emails', icon: FileText },
    { path: '/scheduled', label: 'Scheduled', icon: Clock },
    { path: '/campaigns', label: 'Campaigns', icon: Layers },
    { path: '/templates', label: 'Templates', icon: FileText },
    { path: '/reports', label: 'Reports', icon: BarChart },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md border"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 shadow-sm transition-transform duration-300 z-40
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 mt-10">
          <h1 className="text-2xl font-bold text-gray-800">
            <span className="text-primary-600">.</span> Email Auto
          </h1>
          <p className="text-sm text-gray-500 mt-1">Automation System</p>
        </div>
        
        <nav className="mt-8 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <Icon size={18} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-bold">U</span>
            </div>
            <div>
              <p className="font-medium text-sm">Admin User</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`p-6 transition-all duration-300 ${
          isOpen ? 'ml-64' : 'ml-0'
        }`}
      >
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;
