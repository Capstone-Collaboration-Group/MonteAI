# Critical Evaluation of the MonteAI Manuscript

Scope of review: Chapters 1-3 and the references. The flowcharts, ERD, DFD, and RAG pipeline figures were not visible in the text, so they were judged only from what the prose says about them. Treat this as a rough pre-defense review.

## Overall assessment
<hr>
The project is ambitious and has a real local need behind it. The engineering scope is strong for an undergraduate capstone, with three platforms, RAG, TOTP, and an ingestion pipeline. The manuscript does not yet match the engineering. Its biggest problems are:

1. The evaluation design can't support the claims you make.
2. The "agentic" and "accurate/grounded" claims are asserted but not demonstrated.
3. There are internal contradictions across chapters.
4. The literature review reads as advocacy for MonteAI rather than as a synthesis that produces a gap.

---

## A. Major holes (fix these first)

### 1. The evaluation can't validate the claims

- [ ] - **Perception surveys can't measure performance efficiency, security, or accuracy.** Students can't judge resource utilization, TOTP robustness, or retrieval correctness through a Likert item. You need objective evidence alongside the survey:
- [ ]  - **Retrieval quality:** a gold set of queries (say 50-100) with labeled relevant theses, scored with Recall@k, MRR, or nDCG.
- [ ]  - **Answer quality:** RAGAS (faithfulness, answer relevance, context precision/recall). Your own literature cites it (Aytar, Hemmat, Neupane), so the panel will expect it.
- [ ]  - **Citation accuracy:** the percentage of citations that point to a real retrieved thesis that supports the claim.
- [ ]  - **Out-of-scope behavior:** how the system responds when no relevant thesis exists.
- [ ]  - **Performance:** load testing (k6, JMeter, or Locust) with p50/p95 latency and concurrent-user behavior.
- [x]  - **Security:** an OWASP ASVS or ZAP scan, TOTP flow testing, rate-limit testing, and RBAC bypass attempts.
- [x] - **Your testing phases stop at "unit testing" and "acceptance testing."** Integration, system, performance, and security testing are missing, yet you evaluate those qualities.
- [ ] - **No success thresholds.** "Fast and reliable response times" (Objective 2) is undefined. Set targets such as p95 < X seconds, faithfulness >= Y, and availability >= Z.
- [ ] - **No baseline or comparator.** "Improves the quality and efficiency of thesis research" can't be shown without comparing against something. A small task-based comparison (find three related studies using the library process versus MonteAI, measuring time and relevance) would turn an opinion into evidence.

### 2. "Agentic" is in your title but not in your design

- [ ] The scope mentions "planning and tool-use," but Chapter 3 describes a standard retrieve-then-generate pipeline. There is no agent loop, tool set, planner, memory, or decision logic, and the literature review has nothing on agentic AI or agentic RAG. The panel will probe this hard. Either:

- [ ] - **Define and implement it:** list the tools (search, metadata filter, citation formatter, related-study recommender), show how the model chooses among them, and cite agentic RAG literature (for example ReAct and agentic RAG surveys); or
- **Drop "agentic" from the title.**

### 3. What exactly does RAG retrieve?

- [x]Chapter 3 says the LLM answers "using only those metadata including the citations." The Data Tier says Pinecone stores "metadata and full text chunks." The scope says RAG is grounded in published theses. These are three different systems, and the answer determines whether you are really grounding in thesis content or only in abstracts and keywords.

Related gaps:

- [ ] - **Digitization is not addressed.** The theses are hardbound, and "soft copies... in the future" appears as a future requirement. Where do the PDFs come from? Are they scanned, OCR'd, or submitted digitally? Which theses and how many?
- [ ] - **Pipeline details are missing:** the embedding model, chunking strategy and size, top-k, similarity threshold, reranking or hybrid search, conversation-history handling, language handling (Taglish and Filipino queries), and the model's refusal behavior.
- [ ] - **Justify gpt-5-nano.** It is a small, cost-optimized model. Why was it chosen, and how were hallucination and quality tested against it?

### 4. Overclaiming
<hr>
- [x] Statements like "ensures that all generated responses are accurate," "strictly bound," and "reducing the risk of fabricated content" overstate what RAG does. Your own cited sources (Li et al., Gao et al.) list hallucination as an unresolved RAG problem. Rewrite these as "designed to reduce" and support them with your measured results. Also, an LLM's parametric knowledge can leak into answers even with retrieval, so you need a guardrail and a test for it.

### 5. A contradiction in your privacy argument

- [x] Chapter 2 says MonteAI "operates within an institution-based system... reducing exposure to external threats." But queries and thesis content go to an external LLM provider, Pinecone, Azure, and Firestore. That is not internal. Reframe it honestly: data is limited in scope but processed by third-party cloud services, here are the safeguards, and here is the legal basis.

### 6. Legal, ethical, and IP gaps (no section covers any of these)

- [ ] - **Data Privacy Act of 2012 (RA 10173).** You collect student emails, queries, and TOTP secrets. Address consent, retention, data-processing agreements, and a privacy notice.
- [ ] - **Copyright and authorship of the theses.** Do the students who wrote them, or the institution, consent to digitization and AI processing? Is there an institutional policy? Is view-only enforceable?
- [ ] - **Survey ethics:** informed consent, anonymity, and an ethics review or endorsement.
- [ ] - **Academic integrity:** could MonteAI make it easier to copy past CDM theses? Does it include any similarity safeguard?

### 7. The sampling and statistical design has errors

- [ ] - **Slovin plus convenience sampling is incoherent.** Slovin assumes random sampling. Convenience sampling cannot "ensure the sample is representative," and the manuscript says exactly that. Acknowledge the limitation or use stratified sampling by program and year level.
- [ ] - **The sample size is never computed.** With N = 5,813 and e = 0.05, n = 5813 / (1 + 5813 x 0.0025) = about 374.2, so about 375. The formula is also garbled ("n = N1 + Ne2"). Write it as n = N / (1 + Ne^2).
- [ ] - **The population doesn't match the purpose.** MonteAI is for thesis and capstone students, but your population is all 5,813 enrolled students. First-year students who never do research can't meaningfully evaluate it. Consider restricting to students enrolled in research or capstone courses.
- [ ] - **Respondents must actually use the system.** There is no evaluation protocol covering how they access it, for how long, what tasks they do, or how they are onboarded. The Android-only app also excludes iPhone users unless the web version is the fallback.
- [x] - **The staff and IT expert counts are unstated.** How many Research Department staff are there? How many IT experts, and what are their selection criteria? Expert evaluators usually need to be purposively selected.
- [x] - **The instrument validation is vague.** "Validated" needs substance: the number and qualifications of validators, a Content Validity Index, a pilot test, and Cronbach's alpha. Prefer adapting established instruments such as SUS and prior ISO 25010 questionnaires. The questionnaires themselves belong in the appendices.
- [x] - **Weighted mean alone is thin.** Add standard deviation, reliability coefficients, and a test for differences among the three respondent groups (Kruskal-Wallis or ANOVA).
- [ ] - **The Likert interval formula is garbled** (the division symbol is missing). It should read (4 - 1) / 4 = 0.75. Also, your problem statement says "acceptability," but the verbal scale only says "Agree"; map scores to acceptability labels.
- [x] - **Research design.** This is a system development study, so consider framing it as developmental or applied research with a descriptive evaluation phase. Pure "quantitative descriptive" will draw the question.

### 8. Misuse of ISO/IEC 25010

- [ ] - **You mix the 2011 and 2023 editions.** The 2023 revision renamed *Usability* to *Interaction Capability*. You list both Usability (SOP 4) and Interaction Capability (SOP 6) as separate characteristics, which makes them overlapping constructs. "Satisfaction" appears under both.
- [ ] - **The characteristics list is inconsistent.** Chapter 3 names five (functional suitability, performance efficiency, usability, reliability, security) while the SOP has six.
- [ ] - **"Accuracy of generating information" is not Reliability.** That is functional correctness. Reliability covers availability, fault tolerance, recoverability, and maturity.
- [ ] - **Justify the exclusions.** Say why Compatibility, Maintainability, and Flexibility (Portability in 2011) are left out. This matters because you ship three platforms.
- [ ] - **Pick one edition, state which one, and map each sub-problem to its sub-characteristics.**

### 9. Sustainability and operations

- [ ] - **Cost is not estimated.** The 30-queries/day cap is justified by cost, but there is no token cost model, hosting cost (Azure SQL, Blob, Firestore, Pinecone), or budget.
- [ ] - **No handover plan.** Who pays and maintains it after your defense?
- [ ] - **Four data stores across two clouds** (Azure SQL, Blob, Firestore, Pinecone). Justify this, or the panel will call it over-engineering.
- **Android distribution is vague.** The flowchart shows a "download app" page. Is that an APK sideload or Play Store? Sideloading carries a trust problem.
- [ ] - **There is no deployment diagram, timeline or Gantt chart, or team roles.**

---

## B. Internal inconsistencies to clean up

- [ ] - **Locale.** Chapter 1 says "Montalban, Rizal," while Chapter 3 says "Rodriguez, Rizal." Pick one.
- [ ] - **Users.** "Students and faculty" appear in the web description and the desktop user management, but the respondents, objectives, and scope mention only students and the Research Department. Is faculty a user role or not?
- [ ] - **Naming of data stores.** The desktop flowchart refers to a "faculty database" and "admin database," while the ERD and data tier use Azure SQL tables.
- [ ] - **Desktop in the SOP.** The SOP asks about response time and resource utilization of the desktop app "when multiple student users are accessing," but students can't use the desktop app.
- [ ] - **Web scope.** The scope calls the website a "semi-dynamic promotional website" but also puts the full student research assistant on web.
- [ ] - **Software table errors.** "Visual Studio 2020" doesn't exist (2019 and 2022 do), and the table says Microsoft SQL Server 2022 while the architecture uses Azure SQL Database.
- [ ] - **Numbering.** Table 1 versus Table 3.2, Figure 1 and Figure 2 versus Figure 3.x, and Figure 3.5 is used for both the RAG phase 2 flowchart and the Level 0 DFD.
- [ ] - **Data-gathering methods.** The conceptual framework lists interviews and surveys, but Chapter 3 never describes the interview, the requirements-gathering process, or its outputs.
- [ ] - **Tense.** A proposal should consistently say "will," but there are scattered "was determined," "computed," and "developed."
- [ ] - **Framework.** The conceptual framework has no evaluation stage (the survey and ISO 25010 assessment), and the output box should show the evaluated quality attributes.
- [ ] - **Stakeholders.** The librarian, who manages the hardbound copies, is not listed. Neither are the student authors whose work is being used.

---

## C. Literature review

- [ ] 1. **There is no review of related systems**, even though the chapter title promises one. You need a feature-comparison matrix of MonteAI against Elicit, Consensus, SciSpace, NotebookLM, general chatbots (ChatGPT and the like), DSpace or EPrints repositories, and any Philippine institutional repositories or library chatbots. This is the strongest basis for your gap.
- [ ] 2. **Missing technical literature.** Add sources on vector databases and embeddings, chunking and reranking, hybrid retrieval, RAG evaluation (RAGAS), agentic RAG, LLM citation hallucination, prompt injection through ingested documents, TOTP (RFC 6238), RBAC, OCR for scanned documents, ISO 25010 in comparable evaluations, and Scrumban beyond a single source.
- [ ] 3. **It reads as summary plus advocacy.** Almost every paragraph ends with "this is relevant to MonteAI because..." and the gap statements are formulaic ("the study does not propose a system"). A study isn't obliged to propose your system. Organize by theme, compare and contrast findings, and derive the gap from the contrasts.
- [ ] 4. **The Synthesis section is the weakest part** and is partly unreadable (for example "Filipino majors and different administrators"). A real synthesis identifies agreements, contradictions, and the specific unresolved problem that MonteAI targets, and links it to your variables.
- [ ] 5. **Unsupported gap claims.** "Tools made specifically for an institution work better than general AI tools" has no citation. "No AI research assistant specifically for one institution's theses exists" is likely false, since institutional RAG chatbots exist. Narrow it, for example to Philippine HEIs, and verify with a search.
- [ ] 6. **A pedagogical weakness the panel will exploit:** limiting students to local undergraduate theses may push them to cite lower-quality or secondary sources instead of peer-reviewed literature. Address how MonteAI complements rather than replaces proper literature search.
- [ ] 7. **Some citations are stretched.** Doskaliuk et al. is about AI in peer review but is used to support general authorship and originality claims. Yambao et al. (an AR furniture app) is used to justify ISO 25010 and Likert evaluation. Cite the ISO standard itself and software-evaluation studies.

---

## D. Reference list problems

- [ ] - **Duplicate entry.** Giray et al. (2024) appears twice with different author lists.
- [ ] - **Uncited references.** Etikan et al., Hair et al., and Memon et al. appear in the list but not in the text.
- [ ] - **"et al." misuse.** Wang & Xu (2024) is cited as "Wang et al.," Sejdiu & Sejdiu (2025) as "Sejdiu et al.," and "Lewis et. al" has a stray period. Lewis is also out of alphabetical order.
- [ ] - **Year mismatches to verify.** AlBlooshi and Long et al. are listed as 2026, but their DOIs (feduc.2025.xxxxx) and volume 10 suggest 2025. Check the DOI of Vasantha et al. as well, since the prefix doesn't obviously match the journal.
- [ ] - **Format inconsistency.** Gorbunova and Long et al. are in a different style than the APA 7 entries.
- [ ] - **Source quality.** Several are in low-tier or possibly predatory outlets (IJRTI, IJCRT, IJISRT, IJERN, and some others). Verify them against Scopus, DOAJ, and Beall-type lists, and replace where possible. Also, many are arXiv preprints, which is fine for RAG but should be balanced with peer-reviewed work.
- [ ] - **Verify every DOI and claim** against the source before the defense.

---

## E. Writing and presentation

- [ ] - **Typos and slips:** "Scrumbam," "MonterAI," "MonteIAI," "CD<," "ir," "helped helped," "the the," "to to," and "Al" (lowercase L) in place of "AI."
- [ ] - **Informal phrasing:** "eliminate developer headache" does not belong in a thesis.
- [ ] - **Sub-problem grammar** ("as evaluate the;") needs rewriting. Phrase them as "What is the level of acceptability of MonteAI in terms of..."
- [ ] - **"Significance of the Studies"** should be "Study." "All Institutions" is awkward.
- [ ] - **Definition of Terms** should have conceptual and operational definitions. The "Token" definition is too informal.
- [ ] - **Objectives versus SOP.** Map each objective to a sub-problem. Objectives 1-5 are about building and 6-7 are about evaluating, but the SOP asks only evaluation questions, and objectives 6 and 7 duplicate sub-problems 5 and 6.
- [ ] - **Limitations are incomplete.** Add: English-only (or whatever language), limits on the corpus size and which theses are indexed, dependence on internet and third-party APIs, no iOS, no measurement of learning outcomes, and TOTP-only authentication.

---

## F. Suggested priority order

- [ ] 1. Fix the evaluation design: add objective testing and RAG metrics, and align ISO 25010 with one edition.
- [ ] 2. Resolve "agentic" and the metadata-versus-full-text question.
- [ ] 3. Add the legal and ethics section and the Data Privacy Act coverage.
- [ ] 4. Fix sampling (compute n, address the convenience-sampling problem, define the evaluation protocol).
- [ ] 5. Add a related-systems comparison and rewrite the synthesis.
- [ ] 6. Clean the references, then the inconsistencies and the prose.

---

# Expected Panel Questions

A short prep note appears under each group.

## Problem and rationale

1. How do you know there is a need? What evidence (interview notes, borrowing records, survey data) shows students struggle to access CDM theses?
2. How many theses does CDM have, and how many will you ingest? Is the corpus big enough to justify RAG over a good search bar?
3. Why can't students just use Google Scholar, ChatGPT, or NotebookLM? What does MonteAI do that they don't?
4. Local undergraduate theses vary in quality. Won't students end up citing weak sources, and how do you prevent that?
5. Could MonteAI make plagiarism of past CDM theses easier? What safeguards exist?
6. What is the actual measure of "improved research efficiency"? What is your baseline?

*Prep: bring the interview notes, thesis counts, and a comparison matrix.*

## RAG and "agentic" design

7. What makes MonteAI agentic? Show the agent loop, the tools, and how the model decides among them.
8. Is the LLM answering from metadata, abstracts, or full text? What do you chunk and embed?
9. Which embedding model and chunk size did you pick, and why? Did you test alternatives?
10. How do you handle scanned or low-quality PDFs? Is OCR involved?
11. What happens when a student asks something the repository doesn't cover? How do you stop the model from using outside knowledge?
12. How did you measure hallucination, and what were the results? Can you show a failing example?
13. Why gpt-5-nano? What are the cost, quality, and vendor lock-in tradeoffs, and what happens if the API changes or is discontinued?
14. How do you ensure citations are real and correct?
15. How do you handle prompt injection if text inside a thesis tries to instruct the model?
16. How does the system handle Filipino or Taglish queries, and typos or vague queries?

*Prep: have a diagram of the exact pipeline and a demo of an out-of-scope query and a citation check.*

## Data, privacy, ethics, and IP

17. Do the thesis authors and the institution consent to digitization and AI processing? What is the copyright position?
18. How does the system comply with the Data Privacy Act? What do you store about students' queries, and for how long?
19. Student queries and thesis content go to OpenAI, Pinecone, and Azure. How is that consistent with your claim that data stays within the institution?
20. How is "view-only" PDF access enforced? Can a student screenshot or download?
21. Did your survey go through any ethics review, and how is respondent anonymity protected?

*Prep: have a consent and data-handling statement and a data-flow diagram showing which third parties receive what.*

## Security

22. Why TOTP only? How does account recovery work without weakening it?
23. How do you verify a valid CDM student email? Is there email verification?
24. How are TOTP secrets, passwords, and API keys stored and rotated?
25. How did you secure the Electron admin app (context isolation, code signing, update channel)? How do you stop a non-admin from reaching admin endpoints?

## Methodology and statistics

26. Why is this a descriptive study when you built a system? Why not developmental research?
27. Slovin assumes random sampling, but you used convenience sampling. How do you justify it, and what is your computed sample size?
28. Why survey all enrolled students rather than students doing thesis work? How many will have actually used the system?
29. How were the questionnaires validated? What are the CVI and Cronbach's alpha?
30. Why only weighted mean? How will you compare the three respondent groups?
31. Why ISO/IEC 25010, and which edition? Why were Compatibility and Maintainability left out?
32. Can students really rate "resource utilization" or "security"? What objective tests back it up?
33. What counts as "acceptable"? What score would make you say the system failed?

*Prep: compute n = about 374-375, name the edition, and prepare the objective test plan.*

## Reliability and results (if you already have prototype data)

34. What is your retrieval accuracy and faithfulness score? How was the test set built?
35. What is the response time at 50 or 100 concurrent users? Where is the bottleneck?
36. Did you compare MonteAI against the manual library process? What did you find?

## Sustainability and scope

37. What does it cost per month to run, and who pays after the defense?
38. What happens if students hit the 30-query limit? Why 30?
39. How will new theses be ingested over time, and who is responsible?
40. Why Android only? What about iPhone users?
41. Who maintains it after your graduation, and what is the handover plan?
42. Are four databases across two clouds necessary? What breaks if you use fewer?

## Literature

43. Your literature doesn't include existing RAG-based thesis or repository systems. How is your gap real?
44. Several references are from low-tier journals. How did you vet them?
45. How did you apply what the literature found to design decisions, rather than citing it after the fact?
