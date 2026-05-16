import { useState } from 'react';
import { Building2, MapPin } from 'lucide-react';
import CompaniesTab from '@/components/companies/CompaniesTab';
import TerritoriesTab from '@/components/companies/TerritoriesTab';

export default function Companies() {
  const [activeTab, setActiveTab] = useState('companies');

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h2 className="font-syne font-bold text-xl text-foreground">Partners & Territories</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage partner companies and the territory hierarchy.</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === 'companies' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Building2 size={14} />Companies
        </button>
        <button
          onClick={() => setActiveTab('territories')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${activeTab === 'territories' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <MapPin size={14} />Clusters, Zones & Branches
        </button>
      </div>

      {activeTab === 'companies' && <CompaniesTab />}
      {activeTab === 'territories' && <TerritoriesTab />}
    </div>
  );
}