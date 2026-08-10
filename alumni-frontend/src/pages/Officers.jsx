import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users } from 'lucide-react';
import { api } from '../api';
import Avatar from '../components/ui/Avatar';

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.05, ease: 'easeOut' },
  }),
};

export default function Officers() {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/officers').then((r) => {
      setOfficers(r.data.officers);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen py-16 px-6" style={{ background: 'var(--brand-bg)' }}>
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-[var(--brand-ink)] hover:text-[var(--brand-accent)] mb-8 text-sm font-bold">
          <ArrowLeft size={16} /> Back to home
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Users className="text-[var(--brand-accent)]" size={28} />
          <h1 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)]">Officers & Board</h1>
        </div>
        <p className="text-slate-500 mb-10">The people leading the Alumni Association.</p>

        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : officers.length === 0 ? (
          <p className="text-slate-500">No officers listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {officers.map((o, i) => (
              <motion.div
                key={o.id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={cardFade}
                className="bg-white border-[2.5px] border-[var(--brand-ink)] rounded-[var(--radius)] p-6 text-center hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow"
              >
                <div className="flex justify-center mb-4">
                  <Avatar name={o.name} pic={o.photo} size="lg" />
                </div>
                <p className="font-bold text-[var(--brand-ink)]">{o.name}</p>
                <p className="text-sm text-slate-500">{o.position}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
