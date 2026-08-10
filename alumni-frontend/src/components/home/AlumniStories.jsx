import { motion } from 'framer-motion';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const cardFade = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, delay: i * 0.06, ease: 'easeOut' },
  }),
};

const STORIES = [
  {
    category: 'Alumni Spotlight',
    title: 'Building a business that gives back to the batch that raised her',
    description: 'How one graduate turned a small idea into a company that now employs a dozen fellow alumni.',
    date: 'Jul 2026',
    big: true,
  },
  {
    category: 'Career Journey',
    title: 'From classroom to courtroom',
    description: 'A decade after graduation, one alum reflects on the path to law school.',
    date: 'Jun 2026',
  },
  {
    category: 'Community Impact',
    title: 'The scholarship fund started by three batchmates',
    description: 'What began as a reunion pledge is now sending five students to college.',
    date: 'May 2026',
  },
  {
    category: 'Life After Graduation',
    title: 'Coming home to teach',
    description: 'Why one graduate chose to return and lead the same classroom she once sat in.',
    date: 'Apr 2026',
  },
];

export default function AlumniStories() {
  return (
    <motion.section
      id="stories"
      className="py-24 px-6"
      style={{ background: 'var(--editorial-beige)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={fadeIn}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--brand-accent)] mb-3">FEATURED WRITING</p>
        <h2 className="font-editorial text-4xl md:text-5xl text-[var(--brand-ink)] mb-12">
          Stories That Inspire
        </h2>
        <div className="grid md:grid-cols-2 gap-6 grid-flow-dense">
          {STORIES.map((s, i) => (
            <motion.article
              key={s.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={cardFade}
              className={`bg-white rounded-[var(--radius)] border-2 border-[var(--brand-ink)] p-8 hover:shadow-[4px_4px_0_var(--brand-ink)] transition-shadow ${s.big ? 'md:col-span-2' : ''}`}
            >
              <p className="text-xs font-bold tracking-wider text-[var(--brand-accent)] mb-3">{s.category.toUpperCase()}</p>
              <h3 className={`font-editorial text-[var(--brand-ink)] mb-3 ${s.big ? 'text-3xl' : 'text-2xl'}`}>{s.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-4">{s.description}</p>
              <p className="text-xs text-slate-400">{s.date}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
