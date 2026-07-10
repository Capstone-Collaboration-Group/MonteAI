function MissionVision() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">

        <h2 className="text-center text-3xl md:text-4xl font-bold text-gray-900">
          Our Mission & Vision
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-center text-lg leading-8 text-gray-600">
          We aim to transform the way academic research is conducted by
          combining artificial intelligence with collaboration and innovation.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">

          <div className="rounded-3xl border border-green-200 bg-green-50 p-10 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">

            <h3 className="text-3xl font-bold text-green-700">
              Our Mission
            </h3>

            <p className="mt-4 leading-8 text-lg leading-8 text-gray-600">
              To empower students, educators, and researchers with AI-powered
              tools that simplify every stage of the research journey—from idea
              generation to final documentation.
            </p>
          </div>

          <div className="rounded-3xl border border-green-200 bg-green-50 p-10 shadow-sm transition duration-300 hover:-translate-y-2 hover:shadow-xl">

           <h3 className="text-3xl font-bold text-green-700">
              Our Vision
            </h3>

            <p className="mt-4 leading-8 text-lg leading-8 text-gray-600">
              To become the leading AI-powered research platform that inspires
              innovation, encourages collaboration, and supports academic
              excellence around the world.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}

export default MissionVision;