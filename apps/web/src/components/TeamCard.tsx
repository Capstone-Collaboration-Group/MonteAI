type TeamCardProps = {
  name: string;
  role: string;
};

export default function TeamCard({
  name,
  role,
}: TeamCardProps) {
  return (
    <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
        {name
          .split(" ")
          .map((word) => word[0])
          .join("")
          .slice(0, 2)}
      </div>

      <h3 className="text-xl font-bold text-gray-900">
        {name}
      </h3>

      <p className="mt-2 text-green-700 font-medium">
        {role}
      </p>
    </div>
  );
}