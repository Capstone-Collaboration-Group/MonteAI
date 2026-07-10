type ValueCardProps = {
  icon: string;
  title: string;
  description: string;
};

function ValueCard({
  icon,
  title,
  description,
}: ValueCardProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
        {icon}
      </div>

      <h3 className="mt-6 text-center text-2xl font-bold text-gray-900">
        {title}
      </h3>

      <p className="mt-4 text-center leading-7 text-gray-600">
        {description}
      </p>

    </div>
  );
}

export default ValueCard;