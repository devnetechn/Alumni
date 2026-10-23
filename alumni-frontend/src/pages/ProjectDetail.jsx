import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Section, Empty, Loading } from '../components/PageHeader';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/projects/${id}`).then((r) => setProject(r.data.project)).catch(() => setMissing(true));
  }, [id]);

  if (missing) return <Section><Empty title="Project not found">It may have been removed. <Link to="/" className="underline">Back to home</Link></Empty></Section>;
  if (!project) return <Section><Loading /></Section>;

  return (
    <Section eyebrow="Highlighted Project" title={project.title}>
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)] mb-6"><ArrowLeft size={16} /> Back to home</Link>
      <div className="grid md:grid-cols-2 gap-10 items-start">
        {project.image && <img src={project.image} alt={project.title} className="w-full rounded-[var(--radius)] object-cover" />}
        <div>
          <p className="text-xs text-[var(--muted)] mb-4">
            {[project.batch_name, project.lead_name && `Led by ${project.lead_name}`].filter(Boolean).join(' · ')}
          </p>
          {project.summary && <p className="serif text-xl text-[var(--navy)] mb-4">{project.summary}</p>}
          {project.description && <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap">{project.description}</p>}
        </div>
      </div>
    </Section>
  );
}
