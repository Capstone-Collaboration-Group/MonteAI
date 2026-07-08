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
    <article className={`flex flex-col items-start gap-6 rounded-[48px] border border-[#becab61a] bg-white p-10 shadow-[0px_4px_20px_#0064000d] transition duration-200 hover:-translate-y-1 hover:border-[#00640033] hover:shadow-[0px_12px_40px_#0064001a] ${cardClassName}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#96f2c8]">
        <img className={iconClassName} alt={iconAlt} src={iconSrc} />
      </div>
      {titleNode}
      <div className={descriptionWrapperClassName}>
        <p className={descriptionClassName}>{description}</p>
      </div>
    </article>
  );
}