type ValueCardProps = {
  title: string;
  description: string;
};

export default function ValueCard({ title, description }: ValueCardProps) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="mb-4 text-2xl font-bold text-green-700">{title}</h3>

      <p className="leading-7 text-gray-600">{description}</p>
    </div>
  );
}
