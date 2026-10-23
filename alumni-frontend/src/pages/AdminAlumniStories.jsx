import { GraduationCap } from 'lucide-react';
import AdminCuratedList from '../components/AdminCuratedList';

const FIELDS = [
  { name: 'name', label: 'Name', type: 'text' },
  { name: 'batch_label', label: 'Batch (e.g. Class of 2015)', type: 'text' },
  { name: 'role_title', label: 'Role or achievement', type: 'text' },
  { name: 'photo', label: 'Photo', type: 'image', maxDim: 800 },
  { name: 'quote', label: 'Quote', type: 'textarea' },
  { name: 'story', label: 'Full story', type: 'textarea' },
];

export default function AdminAlumniStories() {
  return (
    <AdminCuratedList
      icon={GraduationCap}
      title="Faces behind the success"
      blurb="Successful alumni shown on the homepage."
      endpoint="/alumni-stories" listKey="stories"
      fields={FIELDS} titleField="name" imageField="photo" featuredDefault
      subtitleOf={(s) => [s.batch_label, s.role_title].filter(Boolean).join(' · ')}
    />
  );
}
