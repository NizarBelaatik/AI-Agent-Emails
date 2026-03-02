import { Database, Users, Download, Activity, Settings } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Activity },
  { name: 'Import Data', href: '/import', icon: Download },
  { name: 'Recipients', href: '/recipients', icon: Users },
  { name: 'Import Jobs', href: '/import-jobs', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];