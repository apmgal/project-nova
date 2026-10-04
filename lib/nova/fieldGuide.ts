/**
 * APM Knowledge Library (player-facing name) — a persistent, browsable
 * reference covering all 27 APM syllabus modules (source: the "Project
 * Nova APM Knowledge Hub" spreadsheet), shown in FieldGuidePanel.tsx.
 * Deliberately a full reference hub rather than only the modules the
 * game mechanically teaches (confirmed design decision — see the
 * "Field Guide" entry in DESIGN_NOTES.md): every module is always
 * browsable, but only the ~15 tied to an actual scene via
 * `matchesConcepts` will ever "light up" via markFieldGuideSeen. The
 * rest (Leadership, Team Management, Conflict Resolution, Procurement &
 * Negotiation, Sustainability, Diversity & Inclusion, Organisational
 * Structures, Solutions Development, Ethics, Integrated Planning — the
 * modules with no `matchesConcepts`) are reference-only: always visible
 * in the list, never unlocked/highlighted, since nothing in the current
 * build teaches them as a discrete beat.
 *
 * Each `summary` quotes the source spreadsheet's own two-paragraph
 * module text close to verbatim (confirmed design decision — "keep the
 * same language as the Excel" rather than a condensed paraphrase), with
 * the module's key named concepts/tools wrapped in `**double
 * asterisks**` (simple markdown-style bold, parsed by
 * FieldGuidePanel.tsx's renderBoldedText helper — not real markdown,
 * just this one convention) so they stand out when scanning. Entries
 * are listed in the spreadsheet's own module order (1-27), which
 * FieldGuidePanel renders as-is.
 */

export interface FieldGuideEntry {
  /** Stable id — "module-<n>", independent of title wording so a later
   * title tweak can't silently break fieldGuideSeen save data. */
  id: string;
  moduleNumber: number;
  title: string;
  /** Near-verbatim source text (two paragraphs joined by "\n\n") with
   * `**key terms**` bolded — see the module doc comment above and
   * FieldGuidePanel.tsx's renderBoldedText. */
  summary: string;
  /** Scene.pmConcept strings (data/scenes.json) that unlock this entry —
   * see markFieldGuideSeen in state.ts. Empty for modules with no
   * in-game beat; those stay permanently browsable-but-unlit. Several
   * concepts intentionally point at the same module (e.g. both "PESTLE
   * analysis" and "SWOT analysis" unlock Module 6) and a few modules
   * share a concept with each other (Reviews/Assurance both touch
   * governance evidence) — that overlap is real, not a mapping error:
   * the APM syllabus itself revisits the same ground from different
   * angles across modules.
   */
  matchesConcepts: string[];
}

export const FIELD_GUIDE: FieldGuideEntry[] = [
  {
    id: "module-1",
    moduleNumber: 1,
    title: "Projects, Programmes and Portfolios",
    summary:
      "A **project** is a unique and transient endeavour undertaken to bring about change and achieve planned objectives. Projects are time bound, focus on specific goals within a defined timeframe and budget, and deliver outputs: tangible or intangible products, also called deliverables. **Business-as-usual (BAU)** activities are repetitive and ongoing, using process management techniques to maintain operational efficiency. Projects inherently carry more risk due to the uncertainties involved and may require a temporary range of specialist skills.\n\nA **programme** is a unique and transient strategic endeavour incorporating related projects and BAU activities to achieve beneficial change. Programmes focus on **outcomes and benefits**: changed circumstances or behaviour resulting from the use of outputs. A **portfolio** is a collection of projects and/or programmes used to manage investments at an organisational or functional level. Portfolio management involves selection, prioritisation and control in line with strategic objectives and capacity to deliver, optimising strategic benefits or operational efficiency. Organisational change requires coordinated efforts so that changes are fully embedded and substantial benefits are realised.",
    matchesConcepts: ["Project initiation", "Synthesising investigation findings"],
  },
  {
    id: "module-2",
    moduleNumber: 2,
    title: "Project Lifecycles",
    summary:
      "A **life cycle** is a framework comprising distinct high-level stages required to transform an idea or concept into reality in an orderly and efficient manner. **Linear life cycles** move through sequential phases and work when requirements are clear from the outset, providing a clear framework for the team. The project life cycle includes concept, definition and deployment. An extended life cycle includes adoption of outputs and benefits realisation, while the product life cycle considers the operational life of assets through to termination and replacement. **Hybrid life cycles** combine elements of linear and iterative approaches.\n\n**Iterative life cycles** allow changes and refinements to requirements, early delivery of benefits through product increments, and continuous stakeholder engagement through review and feedback. Limitations include scope creep and costly changes where physical deliverables are involved. The choice of life cycle depends on the project’s requirements, organisational context and culture. An integrated project management plan establishes a baseline for monitoring and controlling progress. **Transition** moves project deliverables to BAU: those who will use, maintain and support them need the necessary knowledge to operate them correctly.",
    matchesConcepts: ["Delivery lifecycle selection", "Project closure framing"],
  },
  {
    id: "module-3",
    moduleNumber: 3,
    title: "Different Organisational Structures",
    summary:
      "In a **functional structure**, managers have responsibility within their function and line management responsibilities. This is often useful for simple, self-contained projects within the function. Advantages include staff flexibility, technical expertise, peer learning and career development. Limitations include many points of contact, an inward-looking focus and no overall responsibility. In a **project structure**, a dedicated team works towards defined and agreed objectives, with the project manager holding project and line management responsibility. This supports strong team identity and a goal-oriented approach, but can create isolation, issues with continuity of employment, and loss of knowledge when teams disband.\n\nIn a **matrix structure**, the project manager has project responsibility while functional managers retain functional and line management responsibilities. Part-time team members have both project and line loyalties, and the same functional groups may service many projects. Advantages include shared resources, consistent rules, tailoring to the project and rapid responses to change. Limitations include resource conflicts, double reporting, conflicting loyalties and overloading individuals. The organisation’s governance approach informs the project approach, and the structure should reflect the needs of the project rather than assuming one size fits all.",
    matchesConcepts: [],
  },
  {
    id: "module-4",
    moduleNumber: 4,
    title: "Aspects of Project Governance",
    summary:
      "**Governance** is the framework of authority and accountability that defines and controls the outputs, outcomes and benefits from projects, programmes and portfolios. It enables the investing organisation to exert oversight and control over deployment of the work and realisation of value. Governance establishes behaviours, structures and decision-making authority through policies, regulations, processes and procedures, and delegated responsibilities. Effective governance links projects to strategic direction, provides clear ownership and leadership, supports stakeholder engagement and risk management, considers long-term value, and can be audited.\n\nA **Responsibility Assignment Matrix** links work to roles: the **Work Breakdown Structure (WBS)** defines the work and the **Organisational Breakdown Structure (OBS)** defines the people or units responsible. **RACI** identifies Responsible, Accountable, Consulted and Informed roles. **CARS** identifies Communicate, Approve, Responsible and Support roles. Linear governance uses phase reviews and decision gates, iterative governance is more devolved into the team, and hybrid governance retains a linear backbone with iterative delivery. Financial authority and funding release follow the governance framework. **PMOs** provide deployment support, process improvement and resource flexibility through embedded, central, or hub-and-spoke arrangements.",
    matchesConcepts: ["Governance expectation-setting"],
  },
  {
    id: "module-5",
    moduleNumber: 5,
    title: "The Importance of the Business Case",
    summary:
      "A **business case** provides justification for undertaking and continuing a project, programme or portfolio. It evaluates the benefits, costs and risks of alternative options and provides a rationale for the preferred solution. It documents reasons for the project, options, benefits and dis-benefits, scope and major deliverables, risks, success criteria, costs, timescales and investment appraisal. Its five elements are strategic context, economic analysis, commercial approach, financial case and management approach. The business case forms the baseline for the project, is produced in concept, updated during definition and reviewed for validity throughout deployment and at decision gates. The sponsor owns it and is responsible for benefits; the project manager keeps it under review and checks its validity when changes are requested.\n\nInvestment appraisal supports comparison of options. **Payback period** measures how long it takes to recover the initial investment, but ignores the time value of money and cash flows after payback. **Discounted Cash Flow (DCF)** converts future cash flows into today’s money. **Net Present Value (NPV)** is the present value of future cash flows minus the initial investment. **Internal Rate of Return (IRR)** is the discount rate at which NPV equals zero. Financial methods depend on estimates and do not include all non-financial or intangible benefits.",
    matchesConcepts: ["Business case completeness"],
  },
  {
    id: "module-6",
    moduleNumber: 6,
    title: "Tools & Techniques of a Business Case",
    summary:
      "Context is the societal and/or organisational setting of a project, programme or portfolio. **PESTLE** examines external influences: Political, Economic, Sociological, Technical, Legal and Environmental. **SWOT** examines Strengths, Weaknesses, Opportunities and Threats, identifying organisational capabilities and elements that could be exploited or pose risks. **VUCA** describes Volatility, Uncertainty, Complexity and Ambiguity: the speed of change, how well the future can be predicted, the number of factors to consider, and a lack of clarity in the information available. These tools help identify factors that may influence or impact the **business case**.\n\nThe business case is a living document that justifies initial and continued investment, enables agreement on success criteria, records governance decisions and documents options considered. It should be reviewed periodically and at decision gates throughout the life cycle to ensure investment remains aligned to expected benefits. Reviews consider project progress and changes affecting costs, risks or benefits. The business case is the starting point for developing the project management plan and can identify when benefits are no longer viable, allowing senior management to consider stopping the project.",
    matchesConcepts: ["PESTLE analysis", "SWOT analysis"],
  },
  {
    id: "module-7",
    moduleNumber: 7,
    title: "Requirements Management",
    summary:
      "**Requirements management** is the process of capturing, assessing and justifying stakeholders’ wants and needs. Gather high-level requirements in concept and refine them in definition, avoiding solutions at this early stage. Functional requirements describe what something must do; non-functional requirements describe how well it must be done. Analyse gaps, overlaps and conflicts, then justify and prioritise requirements according to value, benefits and project constraints. **MoSCoW** identifies Must have, Should have, Could have and Will not have requirements. Document and agree baseline needs with stakeholders to set expectations and provide the basis for scope, deliverables and acceptance criteria. Subsequent changes must pass through change control.\n\n**Configuration management** creates, maintains and controls changes to the scope of work. Its processes are planning, identification, control, status accounting and verification audit. Planning defines procedures and responsibilities; identification gives configurable items unique references; control manages changes and relationships between items; status accounting provides traceability and an audit trail; verification audit confirms deliverables match requirements and documented configuration information. Function analysis or function cost analysis examines the time and cost required to deliver requirements and the value they contribute. Requirements lead to scope, solutions meet requirements, and testing checks that products meet requirements.",
    matchesConcepts: ["MoSCoW prioritisation"],
  },
  {
    id: "module-8",
    moduleNumber: 8,
    title: "Solutions Development",
    summary:
      "**Solutions development** identifies, analyses and evaluates alternative options until a preferred solution is determined, maintained and refined. The business case must consider options including “do nothing”. Evaluation considers feasibility and attractiveness, project objectives, prioritised requirements, success and acceptance criteria, end-user priorities, the life cycle approach and value. Options may involve technical, social, procurement, management and transition considerations. Prioritisation considers the trade-off between costs, benefits and risks, stakeholder commitment and market capability. **MoSCoW**, numerical assignment, the ABC model and the 5 Whys method can help establish importance. User stories describe: “As a (specific User), I want (some functionality), so that (reason, value or benefit).”\n\nIn a linear life cycle, option analysis takes place early so that the preferred optimum solution can be agreed with scope; later changes follow robust change control. Iterative development allows options to be explored for longer and solutions to be delivered in increments. Must-have requirements can be delivered first as a **minimum viable product (MVP)**: a usable, rather than final, solution. Progressive user feedback guides development towards a **minimum marketable product (MMP)**, with future versions delivering further requirements. Investment appraisal supports option selection, but not every project benefit can be measured solely in financial terms.",
    matchesConcepts: ["Structured problem framing"],
  },
  {
    id: "module-9",
    moduleNumber: 9,
    title: "Sustainability",
    summary:
      "**Sustainability** should be built into a project from the outset as part of the overarching project vision. It requires balancing environmental, social, economic and administrative concerns. Environmental considerations include climate change, biodiversity and energy efficiency. Social considerations include diversity, equity, equality, inclusion, communities and human rights. Economic considerations include affordability, profitability and risk management. Administrative concerns include legislation and regulation, health and safety, and resource efficiency. Sustainability responsibilities apply to both individuals and organisations across the life cycles of project outputs.\n\nBusiness cases should align with the organisation’s sustainability agenda, considering product design, manufacturing processes, energy consumption, waste management and stakeholder relationships. Frameworks and standards include the **United Nations Sustainable Development Goals**, B-Corp Certification and ESG criteria. Monitoring and reporting require transparent, credible data and stakeholder engagement. Tools and techniques include **ISO 14001**, LEED, B Corp and SASB. Measures may include KPIs, ESG data, operational carbon usage and embodied carbon, considering positive and adverse impacts during creation, use, disposal and decommissioning.",
    matchesConcepts: [],
  },
  {
    id: "module-10",
    moduleNumber: 10,
    title: "Diversity & Inclusion",
    summary:
      "**Diversity and inclusion** means embracing and respecting differences among individuals and creating environments where everyone feels valued, heard and able to contribute their perspectives. Diversity supports higher performance through different skill sets, backgrounds, experiences and capabilities, helping generate innovative solutions and deliver outcomes. Project teams may span countries and cultures, so leadership and communication should create an open, honest and psychologically safe environment. Consider individuals’ perspectives, abilities and reasonable adjustments so that everyone has a fair chance to contribute.\n\n**Conscious and unconscious biases** are preferences or prejudices that influence perceptions and decision-making. Conscious bias involves deliberate thoughts and attitudes; unconscious bias operates involuntarily, often stemming from societal stereotypes. Fair treatment includes addressing barriers, recognising individual contributions, using meaningful communication, adapting working styles and organisational ways of working, and responding to signs of bias or resistance to inclusion. Lead by example through appropriate behaviour and communication. Project professionals should understand cultural differences and seek advice where needed on fair treatment and protected characteristics, which can vary by country.",
    matchesConcepts: [],
  },
  {
    id: "module-11",
    moduleNumber: 11,
    title: "Integrated Planning",
    summary:
      "**Integrated planning** incorporates multiple plans and processes into an integrated **Project Management Plan (PMP)**. The PMP details the why, what, when, who, how much, where and how of the project. Typical contents include benefits and their link to the business case; scope, product and work breakdown structures and acceptance criteria; the timeline for activities and deliverables; budget allocation through the cost breakdown structure; resources, roles, responsibilities and reporting lines; delivery logistics; and management approaches for quality, risk and issues, communication and project controls.\n\nAn integrated PMP communicates approved project details to stakeholders and engages key stakeholders in its creation and deployment. It acts as a single source of truth and reference document, supports induction of new team members, and provides contractual clarity between the project manager and sponsor on expectations. It guides the team and establishes a baseline for measurement and analysis of progress. Bringing plans together helps the project team understand how scope, time, cost, resources and management arrangements work together to deliver the intended benefits.",
    matchesConcepts: [],
  },
  {
    id: "module-12",
    moduleNumber: 12,
    title: "Schedule Management",
    summary:
      "**Schedule management** involves planning, developing and maintaining a timeline for project work, focusing on activities, resources and their dependencies. Scope is defined by the outputs, outcomes and benefits being delivered, with clear boundaries and interfaces to avoid duplication or gaps. A **Product Breakdown Structure (PBS)** identifies products and their acceptance criteria; a **Work Breakdown Structure (WBS)** defines the work, with work packages at the lowest level; and a **Cost Breakdown Structure (CBS)** provides the financial view. Scheduling must consider links between activities, BAU dependencies, stakeholder availability, business change and potential conflicts with other schedules.\n\nEstimating is ongoing: as more information becomes available, re-estimating improves confidence, validates assumptions, incorporates productivity data and lessons learned, and accounts for realised risks. Schedule optimisation depends on the WBS, estimates, dependencies, resource allocation, success criteria and baselines. The **critical path** consists of activities that directly affect the project end date; delays to these activities delay completion. **Slack** shows how far a non-critical activity can move without affecting the completion date. The **critical chain**, or resource critical path, emphasises resource constraints and uses buffers to protect the overall schedule against variation in task completion.",
    matchesConcepts: ["Scheduling", "Work Breakdown Structure"],
  },
  {
    id: "module-13",
    moduleNumber: 13,
    title: "Resource Management",
    summary:
      "**Resource management** identifies and schedules the internal and external resources needed to deliver project activities. Resources include human resources, materials, plant or equipment, and facilities. Requirements depend on the life cycle approach, activities, skills and capabilities, critical tasks, required timeframes, BAU needs and external support. Allocation considers the type and quantity of resources, availability and cost. Project managers work with resource or BAU managers to secure resources when needed. The **Organisational Breakdown Structure (OBS)** identifies available resources and escalation routes; combining tasks with these roles creates a **Responsibility Assignment Matrix (RAM)**, commonly using Responsible, Accountable, Consulted and Informed (**RACI**).\n\nIn a linear life cycle, the initial schedule assumes resources are available when required; resource management techniques are applied where availability differs. In iterative life cycles, prioritised requirements are delivered within a timebox using pre-allocated resources, with trade-offs where necessary. **Resource levelling** adjusts the schedule to fit a fixed amount of people or equipment and may move the project end date. **Resource smoothing** works within a fixed deadline, seeking to avoid large highs and lows in resource use. Levelling asks, “When can we finish with what we have?” Smoothing asks, “What do we need to finish on time?”",
    matchesConcepts: ["Resource management"],
  },
  {
    id: "module-14",
    moduleNumber: 14,
    title: "Budgeting & Cost Control",
    summary:
      "Budgets are created from estimates of the time and cost needed to complete the scope to the required acceptance criteria. The WBS supports the **Cost Breakdown Structure (CBS)**, identifying labour and non-labour costs for each work package. Cost planning considers fixed and variable costs, recurring and non-recurring costs, direct and indirect costs, supplier information, assumptions and payment timing. Costs must be spread over the project schedule so that cash flow and funding drawdowns are understood. Funding release reflects the life cycle and governance approach, including decision gates or shorter iterative intervals.\n\n**Cost control** identifies variances, areas of overspend and corrective actions, and refines forecasts when the baseline changes. **Earned Value Management (EVM)** compares Planned Value (PV), Earned Value (EV) and Actual Cost (AC). **Cost Variance** is EV minus AC, **Schedule Variance** is EV minus PV, the **Cost Performance Index** is EV/AC, and the **Schedule Performance Index** is EV/PV. Reporting compares actual and forecast costs, spend and work achieved, and forecast cost overruns. Financial closure includes reassigning resources, closing supplier contracts and final accounts, updating accounting and management systems, removing delegated authorities and project cost codes, settling payments, and returning surplus funding to the business.",
    matchesConcepts: ["Cost Breakdown Structure"],
  },
  {
    id: "module-15",
    moduleNumber: 15,
    title: "Stakeholder Engagement & Communications",
    summary:
      "**Stakeholders** are individuals or groups who have an interest or role in a project, programme or portfolio, or are impacted by it. Stakeholder analysis identifies their interests, objectives, relationship to the project and potential influence on risk and viability. The **power/interest matrix** supports engagement: high power and high interest require engagement and consultation; high power and low interest should be kept satisfied; low power and high interest should be kept informed; and low power and low interest require monitoring. Attitude towards the project also matters: influential supporters can champion delivery, while influential opponents may require intensive engagement.\n\nStakeholder analysis informs the **communication plan** and engagement strategy. The plan defines messages, the communicator, media or methods, frequency, expected feedback and barriers to communication. Tailoring considers the audience, desired impact, preferences, culture, language, organisational norms and governance timelines. Methods include written, electronic, verbal and face-to-face communication, with attention to non-verbal signals. An effective plan provides structure, consistency and accountability, improves understanding and engagement, and reduces misunderstandings and conflict. Managing expectations throughout the project helps identify risks, align stakeholder needs with agreed scope, sustain support and increase the likelihood that outputs are accepted.",
    matchesConcepts: ["Stakeholder mapping", "Communications planning", "Applied risk, stakeholder, procurement & communications management", "Political awareness in delivery"],
  },
  {
    id: "module-16",
    moduleNumber: 16,
    title: "Leadership",
    summary:
      "**Leadership** empowers and inspires others to deliver successful projects. Leaders adapt their approach to the team, the situation and the work required. **Autocratic leadership** provides strong direction in critical situations; participative or democratic leadership involves team members in decisions and builds collaboration; delegative leadership suits established teams with the knowledge to work independently. **Goleman**’s styles are commanding, visionary, affiliative, democratic, pacesetting and coaching. Motivation models include **Maslow**’s hierarchy of needs, **Herzberg**’s hygiene factors and motivators, and **McGregor**’s Theory X and Theory Y. These help leaders understand individual needs, remove sources of dissatisfaction and create opportunities for achievement, recognition, responsibility and growth.\n\nCoaching enables learning, development and improved performance. Mentoring is a longer-term relationship providing guidance based on the mentor’s experience and expertise. Both require understanding individual strengths and weaknesses, tailoring support, developing trust and considering the project context. Supportive leadership encourages ownership and helps people feel valued and empowered, while critical situations may require more directive leadership. **Emotional intelligence** means recognising and managing your own emotions and those of others. Its five elements are self-awareness, self-regulation, motivation, empathy and social skills, supporting calm decisions, constructive feedback, communication and effective conflict resolution.",
    matchesConcepts: [],
  },
  {
    id: "module-17",
    moduleNumber: 17,
    title: "Team Management",
    summary:
      "**Team management** creates and sustains teams through their development, maintenance and leadership. **Belbin** identifies preferred team roles and contributions; **Margerison-McCann** considers how people relate to others, use information, make decisions and organise work; and **Myers-Briggs** considers perception and communication preferences. **Hackman** emphasises a real team, clear direction, a structure that supports teamwork, a supportive organisation and coaching. **Tuckman** describes progression through forming, storming, norming and performing. **Katzenbach and Smith** emphasise commitment, complementary skills, clear goals and accountability. Understanding these models helps leaders use strengths and support team development.\n\nEffective teams have clear roles aligned to skills and experience, open and honest communication, trust, a common goal and a sense of community. Benefits include motivation, stronger problem solving, confidence to innovate and increased productivity through shared workload. Virtual and hybrid teams need deliberate approaches to trust, communication and cultural differences. Regular meetings that allow everyone to contribute, formal and informal dialogue, collaborative online workspaces, shared communication norms and a clear project team identity help avoid hidden conflict. Leaders should appreciate cultural nuances, encourage different perspectives, give clear messages and promote respect across dispersed teams.",
    matchesConcepts: [],
  },
  {
    id: "module-18",
    moduleNumber: 18,
    title: "Conflict Resolution",
    summary:
      "**Conflict** occurs when parties have differing opinions or attitudes that are not easily reconciled. Sources vary across the life cycle: funding and business case approval, stakeholder influence, scope and budget priorities, securing resources, missed deadlines, methods not being followed, unmet acceptance criteria, adoption difficulties and disagreement about benefits measurement. Conflict can add value through open debate, revealing underlying feelings and agendas, and clarifying priorities. Poorly managed conflict can reduce engagement and trust, damage morale, create misalignment and increase risks to delivery, quality and outcomes.\n\nThe **Thomas Kilmann Conflict Model** considers assertiveness, or the desire to achieve one’s own objectives, and cooperation, or the desire to help others achieve theirs. **Competing** prioritises one’s own needs; **accommodating** gives priority to the other party; **avoiding** does not pursue either party’s needs; **compromising** finds a middle ground through concessions; and **collaborating** seeks a solution that fully satisfies both parties. The appropriate approach depends on urgency, importance, relationships and the time available. Sometimes an external party is needed to resolve conflict and prevent escalation. Clear protocols should ensure escalated conflict is resolved in line with project delivery and governance.",
    matchesConcepts: [],
  },
  {
    id: "module-19",
    moduleNumber: 19,
    title: "Procurement & Negotiation",
    summary:
      "**Procurement** secures resources and chooses strategies for obtaining best value from supply chains. A procurement strategy documents the **make-or-buy** decision, supplier selection, negotiation approach, contractual relationships and reimbursement terms. It should protect budgets, deliver intended benefits and align with organisational strategy. Make-or-buy considerations include capacity, specialist skills, intellectual property, cost and value, and urgency. Supplier selection involves market research, pre-qualification, an Invitation to Tender (ITT), responses to bidder queries, evaluation against criteria, contract award and administration. Single, integrated and multiple supplier approaches have different implications for pricing, responsiveness, procurement effort and supply risk.\n\nNegotiation uses **BATNA**, the Best Alternative to a Negotiated Agreement, to establish a fallback if agreement is not reached; **ZOPA**, the Zone of Possible Agreement, identifies the overlap in acceptable terms; and a win-win approach seeks mutual benefit through collaboration. Contractual relationships include single, prime, sequential and parallel contracts. Reimbursement determines risk allocation: fixed price places cost-overrun risk on the supplier; cost plus reimburses costs with a fee; time and materials offers flexibility but leaves the customer exposed to actual usage and inefficiency; and target cost shares savings or overruns. Contract terms should reflect the scope, uncertainty and accepted distribution of risk.",
    matchesConcepts: ["Procurement & supplier selection"],
  },
  {
    id: "module-20",
    moduleNumber: 20,
    title: "Quality Management",
    summary:
      "**Quality management** ensures outputs are delivered in accordance with requirements. Quality planning takes the defined scope and establishes criteria for validating that outputs are fit for purpose, together with the methods used to verify this. The quality plan records verification methods, pass/fail criteria, the frequency of tests, checks or audits, and required resources. Once approved by the sponsor and governance board, it becomes part of the Project Management Plan, aligns scope with the business case and sets standards for assessment. Quality activities require resources and must be included in schedule and cost estimates. Stakeholder agreement supports successful handover.\n\n**Quality control** checks and tests outputs to confirm that they meet acceptance criteria. **Quality assurance** provides confidence that the right processes and methods have been used, building quality into delivery through standard practices. Test plans should be managed through change control so amendments are agreed and communicated. They may specify sample sizes, protocols, resources, independent performance or witnessing, and when outputs are available for testing. In iterative life cycles, acceptance criteria are defined for each time period and checked again for the final product. Where a project is part of a programme, some quality requirements may be planned and controlled at programme level.",
    matchesConcepts: ["Quality outcome / closure"],
  },
  {
    id: "module-21",
    moduleNumber: 21,
    title: "Reviews",
    summary:
      "**Reviews** gather information to assess project status and the ongoing viability of the work. **Decision gates** provide checkpoints at stage or iteration ends, involving senior stakeholders in approval of progress and changes and confirming alignment with business case benefits. **Benefits reviews** assess realised benefits after handover and identify improvement actions, with the sponsor leading this activity. **Audits** provide independent assessment of compliance with governance and quality plans, increasing stakeholder confidence. Typical reporting covers schedule progress, actual versus planned spending, earned value, audit findings and non-conformances, and risks and issues.\n\nTimely, well-presented information supports decision making and communication of actions to stakeholders. Data helps establish status against cost, schedule and quality criteria, generate solutions and option appraisals, identify risks early, improve estimates, and apply learning to quality assurance and control. Reporting and feedback connect the project team, project manager, sponsor and governance board. Reviews may lead to replanning where contractor or supply-chain performance is poor, team motivation is low, cost or cash flow exceeds forecasts, stakeholder communication is ineffective, outputs do not meet quality standards, or changes in risk affect time and budget buffers.",
    matchesConcepts: ["Status reporting / governance", "Project evaluation & reflective practice", "Reflective practice", "Organisational learning"],
  },
  {
    id: "module-22",
    moduleNumber: 22,
    title: "Assurance",
    summary:
      "**Assurance** is an objective and independent approach, agreed by the sponsor and key stakeholders, that provides confidence to the **governance** board that a project is on track to deliver its objectives. It supports decision making and change control, improves the accuracy of risk assessment and increases the probability of meeting primary objectives. Assurance, governance and **risk management** work together: governance sets direction and accountability, risk management identifies and responds to threats, and assurance provides evidence that these arrangements are effective. Weakness in one area affects the others and the project overall.\n\nAssurance activities include controls through policies, procedures and standards; compliance monitoring, audits and checks; and independent reviews providing strategic oversight. An assurance plan should be independent, objective and proportionate, focus on the highest risks, define clear accountabilities, coordinate timing and establish governance and reporting arrangements. Assessment may cover strategic alignment, value for money, procurement and contractual arrangements, affordability, benefits realisation and management of delivery. Assurance is embedded throughout the life cycle. A healthy assurance culture encourages transparency, welcomes challenge, recognises warning signs as a need for help and supports constructive action.",
    matchesConcepts: ["Regulatory inspection / governance evidence", "Documentation & audit trail", "Evidence-based diagnostics"],
  },
  {
    id: "module-23",
    moduleNumber: 23,
    title: "Risk & Issue Management",
    summary:
      "**Risk management** identifies and monitors threats and opportunities, reducing threats and enhancing opportunities within the organisation’s risk appetite. Its stages are identification, analysis, response, monitoring and escalation, and closure. Risks are recorded in a register with owners, assessed for likelihood and impact, and reviewed throughout the life cycle or each iteration. Threat responses include avoid, reduce, transfer and accept; opportunity responses include exploit, enhance, share and reject. Proactive responses address likelihood or impact before a risk occurs; reactive plans are implemented if it materialises. **Contingency** is defined and tracked provision in budget, time or, in iterative projects, scope and quality. The deck distinguishes project contingency for known risks from management reserve for rare, high-impact risks.\n\n**Issue management** focuses on understanding current problems, prioritising them against scope, quality, time, cost and business case benefits, and assigning owners for timely resolution. Issues are logged, analysed, escalated where needed and tracked until resolved. The sponsor may escalate to the governance board to agree the best course of action. Resolutions that change scope or the baseline plan must pass through change control. Governance provides processes, escalation thresholds, specialist expertise and resources. Risk and issue management supports realistic planning, more accurate contingency allocation, stakeholder confidence and learning for future projects.",
    matchesConcepts: ["Risk identification", "Risk response / issue management"],
  },
  {
    id: "module-24",
    moduleNumber: 24,
    title: "Transition Management",
    summary:
      "**Transition management** integrates project outputs into business-as-usual. Planning starts at the beginning of the project, with business readiness treated as a continuous activity. Engage end users and sponsors early, manage expectations, align needs with outputs, communicate deviations and familiarise stakeholders with deliverables before handover. **Change impact analysis** defines the change, identifies impacted groups and organisational areas, evaluates the level of impact, and develops an action plan. It considers people, performance, processes, systems and culture, including resistance and knowledge or skills gaps.\n\n**Knowledge transfer** helps BAU teams use, maintain and support the new capabilities and enables learning and continuous improvement. Handover may include process maps, operating procedures, manuals, project documentation, supplier relationships, licences, warranties and commissioning information. Training should occur at transition or at relevant points in iterative or hybrid delivery. The transition plan agrees documentation acceptance, sponsor sign-off and transfer of responsibility and ownership. Stakeholders should understand the future state, benefits and their ownership, conflict mitigation and any remaining risks transferred at closure. Linear delivery requires regular assurance against expectations, while iterative delivery offers ongoing opportunities for stakeholder input and buy-in.",
    matchesConcepts: ["Commissioning / handover readiness", "Baseline approval / transition to delivery"],
  },
  {
    id: "module-25",
    moduleNumber: 25,
    title: "Change Control",
    summary:
      "**Change control** manages requests to change the project baseline in a controlled way. Its stages are raising and logging the request, initial evaluation, detailed evaluation, recommendation and decision, updating plans and implementation, and communicating the change. Requests are documented with a unique ID and an owner. A change request records the project overview, description and reason, impacted areas, source, owner, date raised, decision, decision date and justification. Evaluation considers necessity, feasibility, impacts on baseline success criteria and completed work, and effects on other projects and BAU. The sponsor or governance board decides whether to approve, reject or defer based on value, cost and risk.\n\nRecommendations consider the business case, benefits timing, budget and contingency, available skills and resources, and the organisation’s capacity to support the change. In a linear life cycle, change control is a formal stop point protecting baselined work; a change freeze may be required to protect delivery. In iterative life cycles, change is expected and considered alongside existing requirements within the development process. Approved changes require updated plans, schedules, budgets, roles and responsibilities, risks and project records. Decisions and revised documentation must be communicated to stakeholders, with implementation actions tracked so the consequences of change remain understood.",
    matchesConcepts: ["Change control", "Crisis decision-making under constraint", "Full re-planning under forced scope change — the deliberate 'holy crap' moment", "Delayed consequence — deliberate structural change from v1"],
  },
  {
    id: "module-26",
    moduleNumber: 26,
    title: "Benefits Management",
    summary:
      "**Benefits management** identifies, defines, plans, tracks and realises the improvements expected from a project. Benefits are quantifiable and measurable improvements resulting from deliverables that are accepted, used and perceived positively by stakeholders. They should be identified early, aligned with strategic objectives and recorded in the business case. **Benefits mapping** connects enabling changes and intermediate benefits to end benefits and strategic goals. Set baseline measurements, realistic targets, milestones, dependencies and responsibilities. The sponsor is accountable for realising business case benefits, which may only become known after transition into BAU.\n\nA **benefits management plan** defines roles, measurement methods, priorities and timelines, while **benefit profiles** record identifiers, descriptions, owners, measures, risks and realisation dates. A **benefits realisation plan** sets out schedules, resources, risks, reporting and enabling changes. Dashboards compare forecast and actual benefits and track enabling-change KPIs. Agree measurement and management arrangements with stakeholders early, report intermediate benefits to demonstrate progress, and communicate end benefits after operational use. Benefits reviews, audits and post-investment reports assess actual versus forecast performance and lessons learned. Ongoing monitoring confirms that benefits are embedded in operations and sustained beyond project completion.",
    matchesConcepts: ["Benefits management"],
  },
  {
    id: "module-27",
    moduleNumber: 27,
    title: "Ethics",
    summary:
      "**Ethics, compliance and professionalism** mean working consistently in a moral, legal and socially responsible manner. Trust and respect are earned by following organisational and professional codes, acting within competence and authority, understanding project cultures and values, and seeking specialist advice where needed. **Continuing Professional Development (CPD)** covers knowledge, skills and behaviours. Individuals identify competence gaps, pursue formal and informal learning opportunities and act as reflective practitioners, learning from experience. The **APM Five Dimensions of Professionalism** are breadth, depth, achievement, commitment and accountability. Upholding ethical standards includes reporting wrongdoing and supporting a culture in which speaking up is encouraged.\n\nProjects operate within legal and regulatory frameworks determined by their industry and country. Project professionals should understand the environment in which they work and seek advice if uncertain. Different geographical locations can create conflicting standards, with the governance structure deciding which standards to align with. Regulations may prescribe specific actions or require employers to establish procedures for controlling risks. Regulatory requirements influence requirements capture, quality planning, integrated planning, risk analysis and management, issue management, change control and assurance arrangements. Failure to comply can result in corrective action or penalties for individuals and organisations.",
    matchesConcepts: [],
  },];

/** Every FIELD_GUIDE entry whose matchesConcepts includes `pmConcept` —
 * almost always zero or one, but kept as an array since a couple of
 * concepts deliberately point at more than one module's worth of overlap
 * (see FieldGuideEntry's own doc comment). Returns [] for undefined/empty
 * input or an unmapped concept (e.g. "N/A — narrative branch, not a PM
 * tool beat") rather than throwing — callers don't need to pre-filter. */
export function matchFieldGuideEntries(pmConcept: string | undefined | null): FieldGuideEntry[] {
  if (!pmConcept) return [];
  return FIELD_GUIDE.filter((entry) => entry.matchesConcepts.includes(pmConcept));
}
