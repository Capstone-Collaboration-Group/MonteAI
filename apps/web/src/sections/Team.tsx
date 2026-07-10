import TeamCard from "../components/TeamCard";

function Team() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">

        <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
          Meet Our Team
        </h2>

        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-8 text-gray-600">
          Behind MonteAI is a passionate team dedicated to improving academic research through technology.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">

<TeamCard
  name="Charles Bernard Balaguer"
  role="Backend Developer"
/>

<TeamCard
  name="Angelica Buenaagua"
  role="Frontend Developer • UI Developer"
/>

<TeamCard
  name="John Christian Joyo"
  role="Frontend Developer • Documentation Specialist"
/>

<TeamCard
  name="Reca Mae Montebon"
  role="UI/UX Designer"
/>

<TeamCard
  name="Jazon Williams Chang"
  role="Frontend Developer • Documentation Specialist"
/>

<TeamCard
  name="Jake Galgo"
  role="UI/UX Designer "
/>

<TeamCard
  name="Shem Tuscano"
  role="-"
/>

<TeamCard
  name="Liyo Wang"
  role="Backend Developer"
/>


        </div>

      </div>
    </section>
  );
}

export default Team;