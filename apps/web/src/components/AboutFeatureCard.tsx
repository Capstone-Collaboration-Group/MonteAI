type AboutFeatureCardProps = {
  title: string;
  description: string;
};

export default function AboutFeatureCard({
  title,
  description,
}: AboutFeatureCardProps) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-xl font-bold text-gray-900">
        {title}
      </h3>

      <p className="mt-4 text-gray-600 leading-7">
        {description}
      </p>
    </div>
  );
}