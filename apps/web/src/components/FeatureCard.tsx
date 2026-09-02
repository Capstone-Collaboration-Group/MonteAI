type FeatureCardProps = {
  title: string;
  description: string;
  iconSrc: string;
  iconAlt: string;
  iconClassName: string;
  cardClassName: string;
  descriptionWrapperClassName: string;
  descriptionClassName: string;
  titleNode: React.ReactNode;
};

export default function FeatureCard({
  description,
  iconSrc,
  iconAlt,
  iconClassName,
  cardClassName,
  descriptionWrapperClassName,
  descriptionClassName,
  titleNode,
}: FeatureCardProps) {
  return (
    <article
      className={`flex flex-col items-start gap-6 rounded-[48px] border border-outline-variant/10 bg-white p-10 shadow-[0px_4px_20px_var(--primary)] transition duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0px_12px_40px_var(--primary)] ${cardClassName}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container">
        <img className={iconClassName} alt={iconAlt} src={iconSrc} />
      </div>
      {titleNode}
      <div className={descriptionWrapperClassName}>
        <p className={descriptionClassName}>{description}</p>
      </div>
    </article>
  );
}
