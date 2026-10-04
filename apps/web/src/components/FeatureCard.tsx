type FeatureCardProps = {
  title: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  index?: number;
};

export default function FeatureCard({
  title,
  description,
  iconSrc,
  iconAlt,
  index = 0,
}: FeatureCardProps) {
  return (
    <article
      className="group flex flex-col items-start gap-5 rounded-xl border border-outline-variant/50 bg-surface p-8 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
      style={{ animationDelay: `${index * 120}ms` }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container transition-transform duration-300 group-hover:scale-110">
        <img className="h-[50px] w-[50px]" alt={iconAlt} src={iconSrc} />
      </div>
      <h3 className="text-2xl font-semibold text-on-surface">{title}</h3>
      <p className="text-base leading-relaxed text-on-surface-variant">
        {description}
      </p>
    </article>
  );
}
