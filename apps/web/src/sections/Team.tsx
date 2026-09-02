import TeamCard from "../components/TeamCard";

export default function Team() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl">

        <div className="text-center">
          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
            Meet Our Team
          </span>

          <h2 className="mt-6 text-4xl font-bold text-gray-900">
            The People Behind MonteAI
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-gray-500">
            Meet the dedicated team behind MonteAI, working together to build an
            intelligent platform that empowers academic research.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">

          <TeamCard
            name="Charles Bernard Balaguer"
            role="Project Leader"
          />

          <TeamCard
            name="Angelica Buenaagua"
            role="Frontend Developer"
          />

          <TeamCard
            name="John Christian Joyo"
            role="Frontend Developer & Documentation Lead"
          />

          <TeamCard
            name="Reca Mae Montebon"
            role="UX/UI Designer"
          />

          <TeamCard
            name="Jazon Williams Chang"
            role="Frontend Developer & Documentation Lead"
          />

          <TeamCard
            name="Liyo Wang"
            role="Backend Developer"
          />

          <TeamCard
            name="Jake Galgo"
            role="UX/UI Designer"
          />

          <TeamCard
            name="Shem Tuscano"
            role="Documentation"
          />

        </div>

      </div>
    </section>
  );
}