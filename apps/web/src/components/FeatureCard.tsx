type FeatureCardProps = {
  title: string;
  description: string;
};

function FeatureCard({
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">
     
      <h3 className="text-center text-xl font-semibold text-green-900">
        {title}
      </h3>

      <p className="mt-3 text-center text-gray-600 leading-7">
        {description}
      </p>
    </div>
  );
}

export default FeatureCard;