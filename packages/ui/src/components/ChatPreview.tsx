const studyLinks = [
  "Zhu et al. (2023) - Adaptive Gamification in K-5",
  "Martinez (2024) - LLMs and Literacy Outcomes",
];

export function ChatPreview() {
  return (
    <section aria-label="MonteAI conversation preview" className="w-full py-16 mt-12">
      <div className="mx-auto flex w-full max-w-[960px] flex-col overflow-hidden rounded-[48px] border border-[#becab633] bg-white shadow-[0px_25px_50px_-12px_#00000040,inset_0px_4px_4px_#00000040] transition duration-200 hover:-translate-y-1 hover:shadow-[0px_30px_60px_-14px_#00000040] hover:border-[#00640033]">
        <div className="flex items-center justify-between border-b border-[#becab633] bg-[#f6f3f2] px-8 py-6 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-[#006400]" />
            <div className="[font-family:'Inter-SemiBold',Helvetica] text-sm font-semibold tracking-[1.40px] text-[#006400]">
              MonteSkolar
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-2 w-2 rounded-full bg-[#becab6]" />
            <div className="h-2 w-2 rounded-full bg-[#becab6]" />
          </div>
        </div>

        <div className="flex flex-col gap-8 p-8 sm:p-10">
          <div className="flex justify-end">
            <div className="max-w-[28rem] rounded-[48px_48px_0px_48px] bg-[#f0eded] p-6">
              <p className="[font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#1b1b1c]">
                Help me find related studies about AI in education
                <br />
                focusing on primary school engagement.
              </p>
            </div>
          </div>

          <div className="max-w-[42rem] rounded-[48px_48px_48px_0px] bg-[#96f2c84c] p-6">
            <div className="flex flex-col gap-4">
              <p className="[font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#1b1b1c]">
                I found several relevant studies that match your criteria. Here are
                <br />
                the top three peer-reviewed entries from the last 24 months:
              </p>
              <ul className="flex flex-col gap-2">
                {studyLinks.map((study) => (
                  <li key={study} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#006400]" />
                    <p className="[font-family:'Inter-SemiBold',Helvetica] text-sm font-semibold leading-5 text-[#006400] underline">
                      {study}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <form className="flex w-full flex-col pt-2" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="monteai-prompt" className="sr-only">
              Ask MonteSkolar anything
            </label>
            <div className="flex h-16 items-center justify-between rounded-full bg-[#f0eded] px-4 py-0 opacity-85 sm:px-8">
              <input
                id="monteai-prompt"
                name="prompt"
                type="text"
                placeholder="Ask MonteSkolar anything..."
                aria-label="Ask MonteSkolar anything"
                className="w-full [font-family:'Inter-Regular',Helvetica] text-base leading-6 text-[#1b1b1c] placeholder:text-[#6f7a69]"
              />
              <button
                type="submit"
                className="ml-3 flex min-w-[88px] h-[42px] items-center justify-center rounded-full bg-[#006400] px-5 text-sm font-semibold text-white shadow-[0px_4px_4px_#00000040,inset_0px_4px_4px_#00000040] sm:ml-4 sm:px-6 cursor-pointer whitespace-nowrap"
                aria-label="Launch MonteSkolar"
              >
                Launch Now
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}