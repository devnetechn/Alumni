import { Hammer } from 'lucide-react';
import AdminCuratedList from '../components/AdminCuratedList';

const FIELDS = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'summary', label: 'Short summary', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'image', label: 'Photo', type: 'image', maxDim: 1200 },
  { name: 'batch_id', label: 'Batch (optional)', type: 'batch' },
  { name: 'lead_name', label: 'Led by (optional)', type: 'text' },
];

export default function AdminProjects() {
  return (
    <AdminCuratedList
      icon={Hammer}
      title="Highlighted projects"
      blurb="Projects shown on the homepage. Star a project to feature it."
      endpoint="/projects" listKey="projects"
      fields={FIELDS} titleField="title" imageField="image" featuredDefault={false}
      subtitleOf={(p) => [p.batch_name, p.lead_name && `Led by ${p.lead_name}`].filter(Boolean).join(' · ') || p.summary || ''}
    />
  );
}
