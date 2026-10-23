import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Section, Empty, Loading } from '../components/PageHeader';
import Avatar from '../components/ui/Avatar';

export default function AlumniStoryDetail() {
  const { id } = useParams();
  const [story, setStory] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.get(`/alumni-stories/${id}`).then((r) => setStory(r.data.story)).catch(() => setMissing(true));
  }, [id]);

  if (missing) return <Section><Empty title="Story not found">It may have been removed. <Link to="/" className="underline">Back to home</Link></Empty></Section>;
  if (!story) return <Section><Loading /></Section>;

  return (
    <Section eyebrow="Faces Behind the Success" title={story.name}>
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--navy)] mb-6"><ArrowLeft size={16} /> Back to home</Link>
      <div className="grid md:grid-cols-3 gap-10 items-start">
        <div>
          {story.photo
            ? <img src={story.photo} alt={story.name} className="w-full rounded-[var(--radius)] object-cover aspect-square" />
            : <Avatar name={story.name} size="xl" />}
          <p className="mt-4 text-sm text-[var(--muted)]">{[story.batch_label, story.role_title].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="md:col-span-2">
          {story.quote && <blockquote className="serif text-2xl text-[var(--navy)] border-l-4 border-[var(--gold)] pl-5 mb-6">“{story.quote}”</blockquote>}
          {story.story && <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap">{story.story}</p>}
        </div>
      </div>
    </Section>
  );
}
