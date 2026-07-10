type TeamCardProps = {
  name: string;
  role: string;
};

function TeamCard({ name, role }: TeamCardProps) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-3xl font-bold text-green-700">
        {name.charAt(0)}
      </div>

      <h3 className="mt-6 text-center text-xl font-bold text-gray-900">
        {name}
      </h3>

      <p className="mt-2 text-center text-sm font-medium text-green-700">
        {role}
      </p>
    </div>
  );
}

export default TeamCard;